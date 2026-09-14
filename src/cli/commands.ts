import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { AGENTS, getAgent, resolveAgents, skillsRootFor, type AgentDefinition } from '../core/agents.ts'
import { tokenize } from '../core/description.ts'
import { sha256 } from '../core/hash.ts'
import type { Lockfile, RegistrySkill } from '../core/types.ts'
import { adaptForAgent } from './lib/adapters.ts'
import { CliError, detectAgents, exists, toolAvailable, type CliContext } from './lib/context.ts'
import { canonicalDir, hashInstalled, isDanglingSymlink, placeSkill, removeCanonical, removeSkill, targetDir, upsertLockEntry } from './lib/installer.ts'
import { emptyLockfile, lockfilePath, readLockfile, writeLockfile } from './lib/lockfile.ts'
import { createSource, findSkill, resolveSkills, type SkillSource } from './lib/registry.ts'
import { materialize } from './lib/store.ts'
import { table, type Printer } from './output.ts'

export interface CommandDeps {
  context: CliContext
  printer: Printer
}

async function pickAgents(context: CliContext, requested: string[], fallbackFromLock?: string[]): Promise<AgentDefinition[]> {
  const detected = (await detectAgents(context)).map((agent) => agent.id)
  const wanted = requested.length ? requested : fallbackFromLock?.length ? fallbackFromLock : ['auto']
  const { agents, unknown } = resolveAgents(wanted, detected)
  if (unknown.length) throw new CliError(`unknown agent(s): ${unknown.join(', ')}. Known: ${AGENTS.map((agent) => agent.id).join(', ')}, all, auto`)
  if (agents.length === 0) throw new CliError('no agents selected: none detected for "auto"; pass -a <agent> or -a all')
  return agents
}

function describeInstalled(lock: Lockfile | null, name: string): string {
  const entry = lock?.skills[name]
  return entry ? `${entry.version} (${entry.agents.join(', ')})` : ''
}

export async function listCommand({ context, printer }: CommandDeps, options: { category?: string; installed?: boolean }): Promise<void> {
  const source = await createSource(context)
  const registry = await source.registry()
  const lock = await readLockfile(lockfilePath(context))
  let skills = registry.skills
  if (options.category) skills = skills.filter((skill) => skill.category === options.category)
  if (options.installed) skills = skills.filter((skill) => lock?.skills[skill.name])
  if (context.json) {
    printer.json(skills.map((skill) => ({ ...skill, files: undefined, installed: lock?.skills[skill.name] ?? null })))
    return
  }
  printer.info(printer.dim(`source: ${source.describe()}`))
  for (const categoryId of Object.keys(registry.categories)) {
    const inCategory = skills.filter((skill) => skill.category === categoryId)
    if (!inCategory.length) continue
    printer.info(`\n${printer.bold(registry.categories[categoryId]!.name)}`)
    printer.info(table(inCategory.map((skill) => [skill.name, `v${skill.version}`, `~${skill.tokens.skillMd} tok`, describeInstalled(lock, skill.name), shorten(skill.description)])))
  }
  if (!skills.length) printer.info('no skills match')
}

function shorten(description: string): string {
  const what = description.split(/\.\s+Use when/)[0] ?? description
  return what.length > 90 ? `${what.slice(0, 87)}...` : what
}

export async function searchCommand({ context, printer }: CommandDeps, query: string): Promise<void> {
  const source = await createSource(context)
  const registry = await source.registry()
  const terms = tokenize(query)
  if (!terms.length) throw new CliError('search needs at least one meaningful word')
  const ranked = registry.skills
    .map((skill) => {
      const haystack = new Set(tokenize(`${skill.name.replace(/-/g, ' ')} ${skill.description} ${skill.tags.join(' ')}`))
      const hits = terms.filter((term) => haystack.has(term)).length
      return { skill, hits }
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits || (a.skill.name < b.skill.name ? -1 : 1))
  if (context.json) {
    printer.json(ranked.map(({ skill, hits }) => ({ name: skill.name, hits, description: skill.description, category: skill.category, tags: skill.tags })))
    return
  }
  if (!ranked.length) {
    printer.info(`no skills match "${query}"`)
    return
  }
  printer.info(table(ranked.map(({ skill, hits }) => [skill.name, `${hits}/${terms.length}`, skill.category, shorten(skill.description)]), ['skill', 'match', 'category', 'what it does']))
}

export interface InstallOptions {
  names: string[]
  agents: string[]
  symlink: boolean
  withDependencies: boolean
}

export async function installCommand(deps: CommandDeps, options: InstallOptions): Promise<void> {
  const { context, printer } = deps
  if (!options.names.length) throw new CliError('install needs at least one skill name; run `mass-skills list`')
  const source = await createSource(context)
  const registry = await source.registry()
  const { skills, added } = resolveSkills(registry, options.names, { withDependencies: options.withDependencies })
  if (added.length) printer.info(`also installing required skills: ${added.join(', ')}`)
  const agents = await pickAgents(context, options.agents)
  const method = options.symlink ? 'symlink' : 'copy'
  const lockPath = lockfilePath(context)
  const lock = (await readLockfile(lockPath)) ?? emptyLockfile(registry.repo, context.ref)
  lock.registry = { repo: registry.repo, ref: context.ref }
  const now = new Date().toISOString()
  const report: Array<{ skill: string; version: string; placements: Array<{ agent: string; path: string; method: string }> }> = []

  for (const skill of skills) {
    const payload = await materialize(context, source, skill)
    const placements = await placeSkill(context, skill, payload, agents, method)
    for (const placement of placements) {
      if (placement.symlinkFallback) printer.warn(`${skill.name}: symlink not supported for ${placement.agent}; copied instead`)
    }
    upsertLockEntry(lock, skill, agents.map((agent) => agent.id), method, now)
    report.push({ skill: skill.name, version: skill.version, placements: placements.map(({ agent, path, method: used }) => ({ agent, path, method: used })) })
    printer.success(`${skill.name}@${skill.version} -> ${agents.map((agent) => agent.id).join(', ')} (${method})`)
    for (const tool of skill.requires?.tools ?? []) {
      if (!(await toolAvailable(tool, context.env))) printer.warn(`${skill.name} expects "${tool}" on PATH and it was not found`)
    }
  }
  await writeLockfile(lockPath, lock)
  if (context.json) printer.json({ lockfile: lockPath, installed: report })
  else printer.info(printer.dim(`lockfile: ${lockPath}`))
}

export async function removeCommand({ context, printer }: CommandDeps, options: { names: string[]; agents: string[]; force: boolean }): Promise<void> {
  if (!options.names.length) throw new CliError('remove needs at least one skill name')
  const lockPath = lockfilePath(context)
  const lock = await readLockfile(lockPath)
  const removed: Array<{ skill: string; paths: string[] }> = []
  for (const name of options.names) {
    const entry = lock?.skills[name]
    if (!entry && !options.force) throw new CliError(`${name} is not in ${lockPath}; pass --force to remove it from agent directories anyway`)
    const agents = await pickAgents(context, options.agents.length ? options.agents : entry ? entry.agents : ['all'])
    const paths = await removeSkill(context, name, agents)
    if (entry && lock) {
      entry.agents = entry.agents.filter((agentId) => !agents.some((agent) => agent.id === agentId))
      if (entry.agents.length === 0) {
        delete lock.skills[name]
        await removeCanonical(context, name)
      } else entry.updatedAt = new Date().toISOString()
    }
    removed.push({ skill: name, paths })
    printer.success(`${name} removed from ${agents.map((agent) => agent.id).join(', ')}`)
  }
  if (lock) await writeLockfile(lockPath, lock)
  if (context.json) printer.json({ removed })
}

export async function updateCommand(deps: CommandDeps, options: { names: string[]; check: boolean }): Promise<void> {
  const { context, printer } = deps
  const lockPath = lockfilePath(context)
  const lock = await readLockfile(lockPath)
  if (!lock || Object.keys(lock.skills).length === 0) {
    printer.info('nothing installed; run `mass-skills install <skill>` first')
    return
  }
  const source = await createSource({ ...context, refresh: true })
  const registry = await source.registry()
  const names = options.names.length ? options.names : Object.keys(lock.skills)
  const outdated: Array<{ skill: string; from: string; to: string }> = []
  for (const name of names) {
    const entry = lock.skills[name]
    if (!entry) throw new CliError(`${name} is not installed`)
    const skill = findSkill(registry, name)
    if (!skill) {
      printer.warn(`${name} is no longer in the registry; remove it or keep the installed copy`)
      continue
    }
    if (skill.contentHash !== entry.contentHash) outdated.push({ skill: name, from: entry.version, to: skill.version })
  }
  if (options.check) {
    if (context.json) printer.json({ outdated })
    else if (!outdated.length) printer.success('all installed skills are up to date')
    else printer.info(table(outdated.map((item) => [item.skill, item.from, '->', item.to]), ['skill', 'installed', '', 'available']))
    if (outdated.length) throw new CliError(`${outdated.length} skill(s) outdated`, 1)
    return
  }
  if (!outdated.length) {
    printer.success('all installed skills are up to date')
    return
  }
  const now = new Date().toISOString()
  for (const item of outdated) {
    const skill = findSkill(registry, item.skill)!
    const entry = lock.skills[item.skill]!
    const agents = entry.agents.map((id) => getAgent(id)).filter((agent): agent is AgentDefinition => Boolean(agent))
    const payload = await materialize(context, source, skill)
    await placeSkill(context, skill, payload, agents, entry.method)
    upsertLockEntry(lock, skill, entry.agents, entry.method, now)
    printer.success(`${skill.name} ${item.from} -> ${item.to}`)
  }
  lock.registry = { repo: registry.repo, ref: context.ref }
  await writeLockfile(lockPath, lock)
  if (context.json) printer.json({ updated: outdated })
}

export interface DoctorProblem {
  skill: string
  agent?: string
  kind: 'missing' | 'dangling-symlink' | 'drift' | 'outdated' | 'unmanaged' | 'missing-tool' | 'unverifiable'
  message: string
}

export async function doctorCommand(deps: CommandDeps): Promise<DoctorProblem[]> {
  const { context, printer } = deps
  const lockPath = lockfilePath(context)
  const lock = await readLockfile(lockPath)
  const problems: DoctorProblem[] = []
  let source: SkillSource | null = null
  let registrySkills: RegistrySkill[] = []
  try {
    source = await createSource(context)
    registrySkills = (await source.registry()).skills
  } catch (error) {
    printer.warn(`registry unavailable (${(error as Error).message}); skipping outdated checks`)
  }

  const managed = new Map<string, Set<string>>()
  for (const [name, entry] of Object.entries(lock?.skills ?? {})) {
    const registrySkill = registrySkills.find((skill) => skill.name === name)
    if (registrySkill && registrySkill.contentHash !== entry.contentHash) {
      problems.push({ skill: name, kind: 'outdated', message: `installed ${entry.version}, registry has ${registrySkill.version}; run \`mass-skills update ${name}\`` })
    }
    for (const tool of registrySkill?.requires?.tools ?? []) {
      if (!(await toolAvailable(tool, context.env))) problems.push({ skill: name, kind: 'missing-tool', message: `requires "${tool}" on PATH` })
    }
    for (const agentId of entry.agents) {
      const agent = getAgent(agentId)
      if (!agent) continue
      managed.set(agentId, (managed.get(agentId) ?? new Set()).add(name))
      const dir = targetDir(context, agent, name)
      if (await isDanglingSymlink(dir)) {
        problems.push({ skill: name, agent: agentId, kind: 'dangling-symlink', message: `${dir} points to a missing target; reinstall` })
        continue
      }
      const installed = await hashInstalled(dir)
      if (!installed) {
        problems.push({ skill: name, agent: agentId, kind: 'missing', message: `${dir} does not exist; run \`mass-skills install ${name} -a ${agentId}\`` })
        continue
      }
      // Expected content: the store payload at the locked hash, adapted for this agent.
      const expectedSkill = registrySkill && registrySkill.contentHash === entry.contentHash ? registrySkill : null
      if (!expectedSkill || !source) {
        problems.push({ skill: name, agent: agentId, kind: 'unverifiable', message: `cannot verify ${dir}: locked version ${entry.version} is not the registry version; run \`mass-skills update\`` })
        continue
      }
      try {
        const payload = adaptForAgent(await materialize(context, source, expectedSkill), agentId)
        const expected = new Map(payload.map((file) => [file.path, file]))
        const changed = installed.files.filter((file) => {
          const original = expected.get(file.path)
          if (!original) return true
          return sha256(original.content) !== file.sha256
        })
        const missing = [...expected.keys()].filter((path) => !installed.files.some((file) => file.path === path))
        if (changed.length || missing.length) {
          const detail = [...changed.map((file) => `modified ${file.path}`), ...missing.map((path) => `missing ${path}`)].join(', ')
          problems.push({ skill: name, agent: agentId, kind: 'drift', message: `${dir} differs from the locked version (${detail}); reinstall to reset or move the change into the catalog` })
        }
      } catch (error) {
        problems.push({ skill: name, agent: agentId, kind: 'unverifiable', message: `cannot verify ${dir}: ${(error as Error).message}` })
      }
    }
  }

  for (const agent of AGENTS) {
    const root = skillsRootFor(agent, { global: context.global, home: context.home, projectRoot: context.projectRoot })
    if (!(await exists(root))) continue
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      if (!entry.name.startsWith('mass-')) continue
      if (managed.get(agent.id)?.has(entry.name)) continue
      problems.push({ skill: entry.name, agent: agent.id, kind: 'unmanaged', message: `${join(root, entry.name)} looks like a catalog skill but is not in ${lockPath}` })
    }
  }
  if (!context.global && lock && Object.values(lock.skills).some((entry) => entry.method === 'symlink')) {
    for (const [name, entry] of Object.entries(lock.skills)) {
      if (entry.method === 'symlink' && !(await exists(canonicalDir(context, name)))) problems.push({ skill: name, kind: 'missing', message: `canonical copy ${canonicalDir(context, name)} is missing; reinstall` })
    }
  }

  if (context.json) printer.json({ lockfile: lockPath, problems })
  else if (!problems.length) printer.success(`no problems found (${Object.keys(lock?.skills ?? {}).length} skill(s) in ${lockPath})`)
  else {
    printer.info(table(problems.map((problem) => [problem.kind, problem.skill, problem.agent ?? '', problem.message]), ['problem', 'skill', 'agent', 'detail']))
    throw new CliError(`${problems.length} problem(s) found`, 1)
  }
  return problems
}
