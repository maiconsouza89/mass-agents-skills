import { chmod, lstat, mkdir, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { skillsRootFor, type AgentDefinition } from '../../core/agents.ts'
import { contentHashOf, sha256 } from '../../core/hash.ts'
import { isPathInside, sanitizeName } from '../../core/paths.ts'
import type { InstallMethod, LockEntry, Lockfile, RegistrySkill } from '../../core/types.ts'
import { adaptForAgent, type PayloadFile } from './adapters.ts'
import { CliError, exists, type CliContext } from './context.ts'

export const CANONICAL_DIR = '.mass-skills/skills'

export function canonicalDir(context: Pick<CliContext, 'global' | 'home' | 'projectRoot'>, name: string): string {
  const base = context.global ? context.home : context.projectRoot
  return join(base, CANONICAL_DIR, sanitizeName(name))
}

export function targetDir(context: Pick<CliContext, 'global' | 'home' | 'projectRoot'>, agent: AgentDefinition, name: string): string {
  const root = skillsRootFor(agent, { global: context.global, home: context.home, projectRoot: context.projectRoot })
  const target = join(root, sanitizeName(name))
  if (!isPathInside(root, target)) throw new CliError(`refusing to write outside ${root}`)
  return target
}

async function writePayload(dir: string, files: PayloadFile[]): Promise<void> {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  for (const file of files) {
    const path = join(dir, file.path)
    if (!isPathInside(dir, path)) throw new CliError(`refusing to write ${file.path} outside ${dir}`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.content)
    if (file.executable) await chmod(path, 0o755)
  }
}

/** Removes whatever is at `path` without following symlinks. */
async function removePath(path: string): Promise<void> {
  try {
    const info = await lstat(path)
    if (info.isSymbolicLink() || info.isFile()) await rm(path, { force: true })
    else await rm(path, { recursive: true, force: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function createLink(target: string, linkPath: string): Promise<boolean> {
  await removePath(linkPath)
  await mkdir(dirname(linkPath), { recursive: true })
  const rel = relative(dirname(linkPath), target)
  try {
    await symlink(rel, linkPath, process.platform === 'win32' ? 'junction' : undefined)
    return true
  } catch {
    return false
  }
}

export interface PlacementResult {
  agent: string
  path: string
  method: InstallMethod
  symlinkFallback: boolean
}

/**
 * Places one skill into each agent directory, by copy (default) or by symlink to a canonical copy.
 * Non-Claude agents receive the adapted payload.
 */
export async function placeSkill(context: CliContext, skill: RegistrySkill, payload: PayloadFile[], agents: AgentDefinition[], method: InstallMethod): Promise<PlacementResult[]> {
  const results: PlacementResult[] = []
  for (const agent of agents) {
    const files = adaptForAgent(payload, agent.id)
    const target = targetDir(context, agent, skill.name)
    if (method === 'symlink') {
      // Canonical copy holds the Claude Code (unadapted) payload; adapted agents get a copy instead of a link.
      const canonical = canonicalDir(context, skill.name)
      if (files === payload) {
        if (!(await exists(join(canonical, 'SKILL.md')))) await writePayload(canonical, payload)
        if (await createLink(canonical, target)) {
          results.push({ agent: agent.id, path: target, method: 'symlink', symlinkFallback: false })
          continue
        }
        await writePayload(target, files)
        results.push({ agent: agent.id, path: target, method: 'copy', symlinkFallback: true })
        continue
      }
    }
    await removePath(target)
    await writePayload(target, files)
    results.push({ agent: agent.id, path: target, method: 'copy', symlinkFallback: false })
  }
  return results
}

export function upsertLockEntry(lock: Lockfile, skill: RegistrySkill, agents: string[], method: InstallMethod, now: string): LockEntry {
  const previous = lock.skills[skill.name]
  const entry: LockEntry = {
    version: skill.version,
    contentHash: skill.contentHash,
    method,
    agents: [...new Set([...(previous?.agents ?? []), ...agents])].sort(),
    installedAt: previous?.installedAt ?? now,
    updatedAt: now,
  }
  lock.skills[skill.name] = entry
  return entry
}

export async function removeSkill(context: CliContext, name: string, agents: AgentDefinition[]): Promise<string[]> {
  const removed: string[] = []
  for (const agent of agents) {
    const target = targetDir(context, agent, name)
    if (await exists(target).catch(() => false) || (await lstat(target).then(() => true).catch(() => false))) {
      await removePath(target)
      removed.push(target)
    }
  }
  return removed
}

export async function removeCanonical(context: CliContext, name: string): Promise<void> {
  await removePath(canonicalDir(context, name))
}

/** Hashes the files present in an installed skill directory (follows a symlink to its target). */
export async function hashInstalled(dir: string): Promise<{ contentHash: string; files: Array<{ path: string; sha256: string }> } | null> {
  if (!(await exists(dir))) return null
  const files: Array<{ path: string; sha256: string }> = []
  async function visit(current: string, prefix: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const abs = join(current, entry.name)
      if (entry.isDirectory()) await visit(abs, rel)
      else if (entry.isFile()) files.push({ path: rel, sha256: sha256(await readFile(abs)) })
    }
  }
  await visit(dir, '')
  return { contentHash: contentHashOf(files), files }
}

export async function isDanglingSymlink(path: string): Promise<boolean> {
  try {
    const info = await lstat(path)
    if (!info.isSymbolicLink()) return false
    const target = join(dirname(path), await readlink(path))
    return !(await exists(target))
  } catch {
    return false
  }
}
