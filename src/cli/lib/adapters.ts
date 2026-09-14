/**
 * Per-agent adaptation of skill files at install time. The seam for future per-agent formats.
 * v1: agents other than Claude Code get `allowed-tools` removed from the SKILL.md frontmatter,
 * because that key carries Claude Code permission semantics that other agents do not understand.
 */
export interface PayloadFile {
  path: string
  content: Buffer
  executable: boolean
}

export function adaptForAgent(files: PayloadFile[], agentId: string): PayloadFile[] {
  if (agentId === 'claude-code') return files
  return files.map((file) => {
    if (file.path !== 'SKILL.md') return file
    const text = file.content.toString('utf8')
    const adapted = stripFrontmatterKey(text, 'allowed-tools')
    return adapted === text ? file : { ...file, content: Buffer.from(adapted, 'utf8') }
  })
}

/** Removes a single-line top-level key from the YAML frontmatter block, leaving the body untouched. */
export function stripFrontmatterKey(skillMd: string, key: string): string {
  if (!skillMd.startsWith('---\n')) return skillMd
  const end = skillMd.indexOf('\n---', 4)
  if (end === -1) return skillMd
  const frontmatter = skillMd.slice(4, end)
  const lines = frontmatter.split('\n').filter((line) => !line.startsWith(`${key}:`))
  return `---\n${lines.join('\n')}${skillMd.slice(end)}`
}
