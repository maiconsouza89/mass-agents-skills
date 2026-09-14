import { parse as parseYaml } from 'yaml'
import type { ParsedSkill } from './types.ts'

const DELIMITER = /^---\r?\n/

export class FrontmatterError extends Error {}

/**
 * Splits a SKILL.md into YAML frontmatter and markdown body.
 * Throws FrontmatterError when delimiters are missing or YAML is not a mapping.
 */
export function parseSkillFile(raw: string): ParsedSkill {
  if (!DELIMITER.test(raw)) {
    throw new FrontmatterError('missing opening --- delimiter on line 1')
  }
  const rest = raw.replace(DELIMITER, '')
  const closing = rest.search(/^---\s*$/m)
  if (closing === -1) {
    throw new FrontmatterError('missing closing --- delimiter')
  }
  const yamlText = rest.slice(0, closing)
  const body = rest.slice(closing).replace(/^---[^\n]*\n?/, '')
  let data: unknown
  try {
    data = parseYaml(yamlText)
  } catch (error) {
    throw new FrontmatterError(`invalid YAML: ${(error as Error).message}`)
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new FrontmatterError('frontmatter must be a YAML mapping')
  }
  return { frontmatter: data as Record<string, unknown>, body, raw }
}

/** Serialises frontmatter + body back into a SKILL.md string. */
export function serializeSkillFile(frontmatter: Record<string, unknown>, body: string, stringify: (value: unknown) => string): string {
  return `---\n${stringify(frontmatter).trimEnd()}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`
}
