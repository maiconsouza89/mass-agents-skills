import { access, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { AGENTS, type AgentDefinition } from '../../core/agents.ts'

export class CliError extends Error {
  readonly exitCode: number
  constructor(message: string, exitCode = 1) {
    super(message)
    this.exitCode = exitCode
  }
}

export interface CliContext {
  cwd: string
  projectRoot: string
  home: string
  /** Git ref used for remote downloads. */
  ref: string
  /** Local catalog checkout, when installing from a working copy. */
  from: string | null
  global: boolean
  json: boolean
  yes: boolean
  refresh: boolean
  color: boolean
  rawBaseOverride: string | null
  /** Injectable for tests. */
  fetch: typeof fetch
  cacheDir: string
  env: NodeJS.ProcessEnv
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Walks up from `start` until a directory containing `.git` or `package.json` is found. */
export async function findProjectRoot(start: string): Promise<string> {
  let current = resolve(start)
  for (;;) {
    if ((await exists(join(current, '.git'))) || (await exists(join(current, 'package.json')))) return current
    const parent = dirname(current)
    if (parent === current) return resolve(start)
    current = parent
  }
}

/** Finds a checkout of this catalog above `start`, so running inside the repo uses local files. */
export async function findCatalogCheckout(start: string): Promise<string | null> {
  let current = resolve(start)
  for (;;) {
    const registry = join(current, 'skills-registry.json')
    const pkg = join(current, 'package.json')
    if ((await exists(registry)) && (await exists(pkg))) {
      try {
        const parsed = JSON.parse(await readFile(pkg, 'utf8')) as { name?: string }
        if (parsed.name === '@mass-solutions/agent-skills') return current
      } catch {
        // not our package.json
      }
    }
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

export async function detectAgents(context: Pick<CliContext, 'projectRoot' | 'home'>): Promise<AgentDefinition[]> {
  const detected: AgentDefinition[] = []
  for (const agent of AGENTS) {
    for (const marker of agent.markers) {
      if ((await exists(join(context.projectRoot, marker))) || (await exists(join(context.home, marker)))) {
        detected.push(agent)
        break
      }
    }
  }
  return detected
}

export async function createContext(overrides: Partial<CliContext> = {}): Promise<CliContext> {
  const cwd = overrides.cwd ?? process.cwd()
  const env = overrides.env ?? process.env
  const home = overrides.home ?? env['MASS_SKILLS_HOME'] ?? homedir()
  const projectRoot = overrides.projectRoot ?? (await findProjectRoot(cwd))
  const from = overrides.from !== undefined ? overrides.from : await findCatalogCheckout(cwd)
  return {
    cwd,
    projectRoot,
    home,
    ref: overrides.ref ?? env['MASS_SKILLS_REF'] ?? 'main',
    from,
    global: overrides.global ?? false,
    json: overrides.json ?? false,
    yes: overrides.yes ?? false,
    refresh: overrides.refresh ?? false,
    color: overrides.color ?? (Boolean(process.stdout.isTTY) && !env['NO_COLOR']),
    rawBaseOverride: overrides.rawBaseOverride ?? env['MASS_SKILLS_RAW_BASE'] ?? null,
    fetch: overrides.fetch ?? globalThis.fetch,
    cacheDir: overrides.cacheDir ?? env['MASS_SKILLS_CACHE'] ?? join(home, '.cache', 'mass-skills'),
    env,
  }
}

/** Checks PATH for an executable without spawning a process. */
export async function toolAvailable(tool: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  const path = env['PATH'] ?? ''
  const extensions = process.platform === 'win32' ? (env['PATHEXT'] ?? '.EXE;.CMD;.BAT').split(';') : ['']
  for (const dir of path.split(process.platform === 'win32' ? ';' : ':')) {
    if (!dir) continue
    for (const extension of extensions) {
      if (await exists(join(dir, tool + extension.toLowerCase())) || await exists(join(dir, tool + extension))) return true
    }
  }
  return false
}
