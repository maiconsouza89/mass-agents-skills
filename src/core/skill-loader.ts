import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { parseSkillFile } from './frontmatter.ts'
import type { DeprecatedSkill, ParsedSkill, TriggerEvals } from './types.ts'

export interface LoadedSkill extends ParsedSkill {
  folder: string
  dir: string
}

/** Lists skill folders (directories not starting with `_` or `.`), sorted. */
export async function listSkillFolders(skillsDir: string): Promise<string[]> {
  const entries = await readdir(skillsDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
}

export async function loadSkill(skillsDir: string, folder: string): Promise<LoadedSkill> {
  const dir = join(skillsDir, folder)
  const raw = await readFile(join(dir, 'SKILL.md'), 'utf8')
  return { ...parseSkillFile(raw), folder, dir }
}

export async function loadDeprecated(skillsDir: string): Promise<DeprecatedSkill[]> {
  try {
    const raw = await readFile(join(skillsDir, '_deprecated.yaml'), 'utf8')
    const parsed = parseYaml(raw) as unknown
    if (parsed === null || parsed === undefined) return []
    if (!Array.isArray(parsed)) throw new Error('_deprecated.yaml must be a list')
    return parsed as DeprecatedSkill[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function loadTriggerEvals(skillDir: string): Promise<TriggerEvals | null> {
  try {
    const raw = await readFile(join(skillDir, 'evals', 'triggers.yaml'), 'utf8')
    const parsed = (parseYaml(raw) ?? {}) as { positive?: unknown; negative?: unknown }
    const positive = Array.isArray(parsed.positive) ? parsed.positive.map(String) : []
    const negative = Array.isArray(parsed.negative)
      ? parsed.negative.map((item: unknown) =>
          typeof item === 'string'
            ? { prompt: item }
            : { prompt: String((item as { prompt?: unknown }).prompt ?? ''), expect: (item as { expect?: string }).expect },
        )
      : []
    return { positive, negative }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function loadGlobalNegatives(skillsDir: string): Promise<string[]> {
  try {
    const raw = await readFile(join(skillsDir, '_evals', 'negatives.yaml'), 'utf8')
    const parsed = parseYaml(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
