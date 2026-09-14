import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, lstat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { sha256 } from '../core/hash.ts'
import { adaptForAgent, stripFrontmatterKey } from './lib/adapters.ts'
import { doctorCommand, installCommand, removeCommand, updateCommand } from './commands.ts'
import { createContext, type CliContext } from './lib/context.ts'
import { createRemoteSource, resolveSkills } from './lib/registry.ts'
import { readLockfile } from './lib/lockfile.ts'
import type { Printer } from './output.ts'
import type { SkillsRegistry } from '../core/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

function silentPrinter(): Printer & { warnings: string[]; jsonOut: unknown[] } {
  const warnings: string[] = []
  const jsonOut: unknown[] = []
  return {
    warnings,
    jsonOut,
    info: () => {},
    warn: (message) => { warnings.push(message) },
    error: () => {},
    success: () => {},
    json: (value) => { jsonOut.push(value) },
    bold: (text) => text,
    dim: (text) => text,
  }
}

async function sandbox(): Promise<{ root: string; context: CliContext }> {
  const root = await mkdtemp(join(tmpdir(), 'mass-skills-'))
  const projectRoot = join(root, 'project')
  await mkdir(join(projectRoot, '.claude'), { recursive: true })
  await mkdir(join(projectRoot, '.cursor'), { recursive: true })
  await writeFile(join(projectRoot, 'package.json'), '{}')
  // Fake tools on PATH so `requires.tools` checks pass deterministically.
  const bin = join(root, 'bin')
  await mkdir(bin, { recursive: true })
  for (const tool of ['gh', 'git', 'node', 'npx', 'npm']) await writeFile(join(bin, tool), '#!/bin/sh\n', { mode: 0o755 })
  const context = await createContext({
    cwd: projectRoot,
    projectRoot,
    home: join(root, 'home'),
    cacheDir: join(root, 'cache'),
    from: repoRoot,
    color: false,
    env: { PATH: bin },
  })
  return { root, context }
}

test('install, doctor, drift, remove round trip against the local catalog', async () => {
  const { root, context } = await sandbox()
  try {
    const printer = silentPrinter()
    await installCommand({ context, printer }, { names: ['mass-code-review'], agents: ['claude-code', 'cursor'], symlink: false, withDependencies: true })
    const lock = await readLockfile(join(context.projectRoot, '.mass-skills.lock.json'))
    assert.ok(lock)
    assert.deepEqual(Object.keys(lock.skills).sort(), ['mass-code-review', 'mass-typescript-conventions'])
    assert.deepEqual(lock.skills['mass-code-review']!.agents, ['claude-code', 'cursor'])
    const claude = await readFile(join(context.projectRoot, '.claude/skills/mass-code-review/SKILL.md'), 'utf8')
    const cursor = await readFile(join(context.projectRoot, '.cursor/skills/mass-code-review/SKILL.md'), 'utf8')
    assert.match(claude, /allowed-tools:/)
    assert.doesNotMatch(cursor, /allowed-tools:/)

    const clean = await doctorCommand({ context, printer })
    assert.deepEqual(clean, [])

    await writeFile(join(context.projectRoot, '.claude/skills/mass-code-review/SKILL.md'), `${claude}\nlocal edit\n`)
    await assert.rejects(doctorCommand({ context, printer }), /1 problem/)
    const drifted = await doctorCommand({ ...{ context: { ...context, json: true } }, printer }).catch(() => null)
    assert.ok(drifted === null || drifted.some((problem) => problem.kind === 'drift'))

    await removeCommand({ context, printer }, { names: ['mass-code-review'], agents: [], force: false })
    const afterRemove = await readLockfile(join(context.projectRoot, '.mass-skills.lock.json'))
    assert.equal(afterRemove?.skills['mass-code-review'], undefined)
    await assert.rejects(lstat(join(context.projectRoot, '.claude/skills/mass-code-review')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('symlink install links agent dir to the canonical copy', async () => {
  const { root, context } = await sandbox()
  try {
    const printer = silentPrinter()
    await installCommand({ context, printer }, { names: ['mass-skill-architect'], agents: ['claude-code'], symlink: true, withDependencies: false })
    const info = await lstat(join(context.projectRoot, '.claude/skills/mass-skill-architect'))
    assert.equal(info.isSymbolicLink(), true)
    await updateCommand({ context, printer }, { names: [], check: true })
    assert.deepEqual(await doctorCommand({ context, printer }), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('remote source verifies file hashes', async () => {
  const registry: SkillsRegistry = {
    registryVersion: 1,
    catalogVersion: '0.0.0',
    repo: 'x/y',
    rawBase: 'https://example.invalid/raw',
    categories: {},
    skills: [{
      name: 'mass-x', description: 'd', category: 'c', tags: [], owner: '@o', version: '1.0.0', reviewed: '2026-01-01',
      path: 'skills/mass-x', files: [{ path: 'SKILL.md', sha256: sha256('good'), bytes: 4, executable: false }], contentHash: 'h', tokens: { skillMd: 1, total: 1 },
    }],
    deprecated: [{ name: 'mass-old', message: 'gone', alternatives: ['mass-x'] }],
  }
  const responses = new Map<string, string>([
    ['https://example.invalid/raw/main/skills-registry.json', JSON.stringify(registry)],
    ['https://example.invalid/raw/main/skills/mass-x/SKILL.md', 'tampered'],
  ])
  const seenAuth: string[] = []
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seenAuth.push(String((init?.headers as Record<string, string> | undefined)?.['authorization'] ?? ''))
    const body = responses.get(String(url))
    return new Response(body ?? 'nope', { status: body === undefined ? 404 : 200 })
  }) as typeof fetch
  const root = await mkdtemp(join(tmpdir(), 'mass-skills-remote-'))
  try {
    const context = await createContext({ cwd: root, projectRoot: root, home: root, cacheDir: join(root, 'cache'), from: null, fetch: fakeFetch, rawBaseOverride: 'https://example.invalid/raw', color: false, env: { GITHUB_TOKEN: 'secret-token' } })
    const source = createRemoteSource(context)
    const loaded = await source.registry()
    assert.equal(loaded.skills[0]!.name, 'mass-x')
    await assert.rejects(source.readFile(loaded.skills[0]!, 'SKILL.md'), /checksum mismatch/)
    assert.throws(() => resolveSkills(loaded, ['mass-old'], { withDependencies: true }), /deprecated/)
    assert.throws(() => resolveSkills(loaded, ['mass-missing'], { withDependencies: true }), /unknown skill/)
    assert.ok(seenAuth.every((value) => value === 'Bearer secret-token'), 'token sent on every request')
    await assert.rejects(source.readFile({ ...loaded.skills[0]!, files: [{ path: 'missing.md', sha256: 'x', bytes: 1, executable: false }] }, 'missing.md'), /not found/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('adapters strip allowed-tools for non-Claude agents only', () => {
  const skillMd = '---\nname: x\nallowed-tools: Bash(git:*)\nmetadata:\n  owner: "@o"\n---\n\n# X\n'
  assert.equal(stripFrontmatterKey(skillMd, 'allowed-tools'), '---\nname: x\nmetadata:\n  owner: "@o"\n---\n\n# X\n')
  const files = [{ path: 'SKILL.md', content: Buffer.from(skillMd), executable: false }]
  assert.equal(adaptForAgent(files, 'claude-code'), files)
  assert.doesNotMatch(adaptForAgent(files, 'cursor')[0]!.content.toString(), /allowed-tools/)
})
