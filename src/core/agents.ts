import { join } from 'node:path'

export interface AgentDefinition {
  id: string
  displayName: string
  /** Directory under the project root that holds skills. */
  projectDir: string
  /** Directory under the user's home that holds skills. */
  globalDir: string
  /** Dot-directories whose presence means the agent is in use. */
  markers: string[]
  docs: string
}

export const AGENTS: readonly AgentDefinition[] = [
  { id: 'claude-code', displayName: 'Claude Code', projectDir: '.claude/skills', globalDir: '.claude/skills', markers: ['.claude'], docs: 'https://code.claude.com/docs/en/skills' },
  { id: 'cursor', displayName: 'Cursor', projectDir: '.cursor/skills', globalDir: '.cursor/skills', markers: ['.cursor'], docs: 'https://cursor.com/docs' },
  { id: 'github-copilot', displayName: 'GitHub Copilot', projectDir: '.github/skills', globalDir: '.copilot/skills', markers: ['.github', '.copilot'], docs: 'https://docs.github.com/copilot' },
  { id: 'windsurf', displayName: 'Windsurf', projectDir: '.windsurf/skills', globalDir: '.codeium/windsurf/skills', markers: ['.windsurf', '.codeium'], docs: 'https://docs.windsurf.com' },
  { id: 'codex', displayName: 'OpenAI Codex', projectDir: '.codex/skills', globalDir: '.codex/skills', markers: ['.codex'], docs: 'https://developers.openai.com/codex' },
  { id: 'gemini', displayName: 'Gemini CLI', projectDir: '.gemini/skills', globalDir: '.gemini/skills', markers: ['.gemini'], docs: 'https://geminicli.com/docs' },
  { id: 'cline', displayName: 'Cline', projectDir: '.cline/skills', globalDir: '.cline/skills', markers: ['.cline'], docs: 'https://docs.cline.bot' },
  { id: 'opencode', displayName: 'OpenCode', projectDir: '.opencode/skills', globalDir: '.config/opencode/skills', markers: ['.opencode', '.config/opencode'], docs: 'https://opencode.ai/docs' },
]

export const AGENT_IDS = AGENTS.map((agent) => agent.id)

export function getAgent(id: string): AgentDefinition | undefined {
  return AGENTS.find((agent) => agent.id === id)
}

export function skillsRootFor(agent: AgentDefinition, options: { global: boolean; home: string; projectRoot: string }): string {
  return options.global ? join(options.home, agent.globalDir) : join(options.projectRoot, agent.projectDir)
}

/**
 * Expands user input such as ["all"], ["auto"], ["claude-code", "cursor"] into agent definitions.
 * `detected` is the list of agent ids found on disk; used by "auto".
 */
export function resolveAgents(requested: string[], detected: string[]): { agents: AgentDefinition[]; unknown: string[] } {
  const ids = new Set<string>()
  const unknown: string[] = []
  for (const raw of requested) {
    const id = raw.trim().toLowerCase()
    if (id === 'all') AGENT_IDS.forEach((agentId) => ids.add(agentId))
    else if (id === 'auto') detected.forEach((agentId) => ids.add(agentId))
    else if (getAgent(id)) ids.add(id)
    else unknown.push(raw)
  }
  return { agents: AGENTS.filter((agent) => ids.has(agent.id)), unknown }
}
