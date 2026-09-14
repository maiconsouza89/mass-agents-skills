#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { doctorCommand, installCommand, listCommand, removeCommand, searchCommand, updateCommand } from './commands.ts'
import { CliError, createContext } from './lib/context.ts'
import { createPrinter } from './output.ts'

const USAGE = `mass-skills: install Mass Solutions skills into AI coding agents

usage
  mass-skills list [--category <id>] [--installed]
  mass-skills search <query>
  mass-skills install <skills...> -a <agents...> [--global] [--symlink] [--no-deps]
  mass-skills remove <skills...> [-a <agents...>] [--global] [--force]
  mass-skills update [skills...] [--check] [--global]
  mass-skills doctor [--global]

agents
  claude-code, cursor, github-copilot, windsurf, codex, gemini, cline, opencode, all, auto

global options
  --ref <git-ref>     branch, tag or commit to download from (default: main)
  --from <dir>        use a local catalog checkout instead of downloading
  --global            operate on the home directory instead of the project
  --refresh           ignore the cached registry
  --json              machine-readable output
  --no-color          disable colours
  -h, --help          show this help

environment
  MASS_SKILLS_TOKEN or GITHUB_TOKEN   read access for private repositories
  MASS_SKILLS_REPO (owner/name), MASS_SKILLS_REF, MASS_SKILLS_RAW_BASE (mirror), MASS_SKILLS_CACHE, MASS_SKILLS_HOME
`

export async function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      agent: { type: 'string', short: 'a', multiple: true, default: [] },
      category: { type: 'string' },
      installed: { type: 'boolean', default: false },
      global: { type: 'boolean', short: 'g', default: false },
      symlink: { type: 'boolean', default: false },
      'no-deps': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      ref: { type: 'string' },
      from: { type: 'string' },
      refresh: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      'no-color': { type: 'boolean', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  })
  const [command, ...rest] = positionals
  if (values.version) {
    process.stdout.write(`${CLI_VERSION}\n`)
    return 0
  }
  if (values.help || !command) {
    process.stdout.write(USAGE)
    return command ? 0 : 2
  }
  // "-a a b c" style: parseArgs only takes one value per flag, so agents may also arrive as positionals after the flag.
  const agents = splitList(values.agent)
  const context = await createContext({
    ref: values.ref,
    from: values.from !== undefined ? values.from : undefined,
    global: values.global,
    json: values.json,
    yes: values.yes,
    refresh: values.refresh,
    color: values['no-color'] ? false : undefined,
  })
  const printer = createPrinter({ color: context.color, json: context.json })
  const deps = { context, printer }
  try {
    switch (command) {
      case 'list':
      case 'ls':
        await listCommand(deps, { category: values.category, installed: values.installed })
        return 0
      case 'search':
        await searchCommand(deps, rest.join(' '))
        return 0
      case 'install':
      case 'add': {
        const { names, agentsFromPositionals } = splitSkillsAndAgents(rest)
        await installCommand(deps, { names, agents: [...agents, ...agentsFromPositionals], symlink: values.symlink, withDependencies: !values['no-deps'] })
        return 0
      }
      case 'remove':
      case 'rm': {
        const { names, agentsFromPositionals } = splitSkillsAndAgents(rest)
        await removeCommand(deps, { names, agents: [...agents, ...agentsFromPositionals], force: values.force })
        return 0
      }
      case 'update':
      case 'upgrade':
        await updateCommand(deps, { names: rest, check: values.check })
        return 0
      case 'doctor':
        await doctorCommand(deps)
        return 0
      default:
        printer.error(`unknown command "${command}"`)
        process.stdout.write(USAGE)
        return 2
    }
  } catch (error) {
    if (error instanceof CliError) {
      printer.error(error.message)
      return error.exitCode
    }
    printer.error((error as Error).stack ?? String(error))
    return 1
  }
}

const KNOWN_AGENT_WORDS = new Set(['claude-code', 'cursor', 'github-copilot', 'windsurf', 'codex', 'gemini', 'cline', 'opencode', 'all', 'auto'])

function splitList(values: string[]): string[] {
  return values.flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean)
}

/** Skills come first; anything that is a known agent word after them is treated as an agent (supports `-a claude-code cursor`). */
function splitSkillsAndAgents(positionals: string[]): { names: string[]; agentsFromPositionals: string[] } {
  const names: string[] = []
  const agentsFromPositionals: string[] = []
  for (const item of positionals) {
    if (KNOWN_AGENT_WORDS.has(item)) agentsFromPositionals.push(item)
    else names.push(item)
  }
  return { names, agentsFromPositionals }
}

export const CLI_VERSION = '0.1.0'

if (process.argv[1] && /bin\.(ts|js)$/.test(process.argv[1])) {
  run(process.argv.slice(2)).then((code) => process.exit(code))
}
