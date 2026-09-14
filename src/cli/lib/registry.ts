import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sha256 } from '../../core/hash.ts'
import type { RegistrySkill, SkillsRegistry } from '../../core/types.ts'
import { CliError, exists, type CliContext } from './context.ts'

const REGISTRY_TTL_MS = 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 15_000
const FETCH_RETRIES = 3

export interface SkillSource {
  kind: 'local' | 'remote'
  describe(): string
  registry(): Promise<SkillsRegistry>
  /** Reads one payload file of a skill. Remote reads are verified against the registry hash. */
  readFile(skill: RegistrySkill, path: string): Promise<Buffer>
}

async function fetchWithRetry(context: CliContext, url: string): Promise<Buffer> {
  let lastError: unknown
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await context.fetch(url, { signal: controller.signal, headers: { 'user-agent': 'mass-skills' } })
      if (response.status === 404) throw new CliError(`not found: ${url}`)
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
      if (error instanceof CliError) throw error
      if (attempt < FETCH_RETRIES) await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** (attempt - 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw new CliError(`failed to download ${url}: ${(lastError as Error)?.message ?? 'unknown error'}`)
}

export function createLocalSource(root: string): SkillSource {
  let cached: SkillsRegistry | null = null
  return {
    kind: 'local',
    describe: () => `local checkout ${root}`,
    async registry() {
      if (cached) return cached
      const file = join(root, 'skills-registry.json')
      if (!(await exists(file))) throw new CliError(`${file} not found; run \`npm run registry\` in the catalog checkout`)
      cached = JSON.parse(await readFile(file, 'utf8')) as SkillsRegistry
      return cached
    },
    async readFile(skill, path) {
      return readFile(join(root, skill.path, path))
    },
  }
}

export function createRemoteSource(context: CliContext, repoRawBase?: string): SkillSource {
  let cached: SkillsRegistry | null = null
  const ref = context.ref
  const rawBase = () => context.rawBaseOverride ?? repoRawBase ?? 'https://raw.githubusercontent.com/maiconsouza89/mass-agents-skills'
  return {
    kind: 'remote',
    describe: () => `${rawBase()}@${ref}`,
    async registry() {
      if (cached) return cached
      const cacheFile = join(context.cacheDir, 'registry', `${encodeURIComponent(ref)}.json`)
      if (!context.refresh && (await exists(cacheFile))) {
        const info = await stat(cacheFile)
        if (Date.now() - info.mtimeMs < REGISTRY_TTL_MS) {
          cached = JSON.parse(await readFile(cacheFile, 'utf8')) as SkillsRegistry
          return cached
        }
      }
      const buffer = await fetchWithRetry(context, `${rawBase()}/${ref}/skills-registry.json`)
      const registry = JSON.parse(buffer.toString('utf8')) as SkillsRegistry
      if (registry.registryVersion !== 1) throw new CliError(`unsupported registry version ${String(registry.registryVersion)}; update mass-skills`)
      await mkdir(join(context.cacheDir, 'registry'), { recursive: true })
      await writeFile(cacheFile, buffer)
      cached = registry
      return cached
    },
    async readFile(skill, path) {
      const entry = skill.files.find((file) => file.path === path)
      if (!entry) throw new CliError(`${skill.name}: ${path} is not listed in the registry`)
      const buffer = await fetchWithRetry(context, `${rawBase()}/${ref}/${skill.path}/${path}`)
      const digest = sha256(buffer)
      if (digest !== entry.sha256) {
        throw new CliError(`checksum mismatch for ${skill.name}/${path}: registry says ${entry.sha256.slice(0, 12)}, got ${digest.slice(0, 12)}. The registry and ref may be out of sync; retry with --refresh or pin --ref to a tag.`)
      }
      return buffer
    },
  }
}

export async function createSource(context: CliContext): Promise<SkillSource> {
  if (context.from) return createLocalSource(context.from)
  return createRemoteSource(context)
}

export function findSkill(registry: SkillsRegistry, name: string): RegistrySkill | undefined {
  return registry.skills.find((skill) => skill.name === name)
}

/** Resolves requested names, rejecting unknown or deprecated ones, and expands `requires.skills` transitively. */
export function resolveSkills(registry: SkillsRegistry, names: string[], options: { withDependencies: boolean }): { skills: RegistrySkill[]; added: string[] } {
  const ordered: RegistrySkill[] = []
  const seen = new Set<string>()
  const added: string[] = []
  const visit = (name: string, requestedDirectly: boolean, chain: string[]) => {
    if (seen.has(name)) return
    const deprecated = registry.deprecated.find((entry) => entry.name === name)
    if (deprecated) {
      const alternatives = deprecated.alternatives.length ? ` Use ${deprecated.alternatives.join(' or ')} instead.` : ''
      throw new CliError(`${name} is deprecated: ${deprecated.message}${alternatives}`)
    }
    const skill = findSkill(registry, name)
    if (!skill) {
      const suggestion = registry.skills.map((entry) => entry.name).filter((entry) => entry.includes(name) || name.includes(entry.replace(/^mass-/, ''))).slice(0, 3)
      throw new CliError(`unknown skill "${name}"${chain.length ? ` (required by ${chain.join(' > ')})` : ''}${suggestion.length ? `; did you mean ${suggestion.join(', ')}?` : ''}`)
    }
    seen.add(name)
    if (options.withDependencies) {
      for (const dependency of skill.requires?.skills ?? []) visit(dependency, false, [...chain, name])
    }
    ordered.push(skill)
    if (!requestedDirectly) added.push(name)
  }
  for (const name of names) visit(name, true, [])
  return { skills: ordered, added }
}
