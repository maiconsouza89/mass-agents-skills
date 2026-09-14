#!/usr/bin/env node
/**
 * Generates skills-registry.json from the catalog. Pure: it never edits a SKILL.md.
 *
 *   node tools/generate-registry.ts            # writes skills-registry.json
 *   node tools/generate-registry.ts --check    # exits 1 when the committed file is stale
 *   node tools/generate-registry.ts --readme   # also refreshes the catalog table in README.md
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { loadCategories, sortedCategoryIds } from '../src/core/categories.ts'
import { contentHashOf, sha256 } from '../src/core/hash.ts'
import { isExcludedFromPayload, walkFiles } from '../src/core/paths.ts'
import { listSkillFolders, loadDeprecated, loadSkill } from '../src/core/skill-loader.ts'
import { estimateTokens } from '../src/core/tokens.ts'
import type { RegistryFile, RegistrySkill, SkillMetadata, SkillsRegistry } from '../src/core/types.ts'

export interface GenerateOptions {
  rootDir: string
  skillsDir?: string
}

export const REPO = 'maiconsouza89/mass-agents-skills'
export const RAW_BASE = `https://raw.githubusercontent.com/${REPO}`

export async function generateRegistry(options: GenerateOptions): Promise<SkillsRegistry> {
  const rootDir = resolve(options.rootDir)
  const skillsDir = options.skillsDir ? resolve(options.skillsDir) : join(rootDir, 'skills')
  const pkg = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8')) as { version: string }
  const categories = await loadCategories(skillsDir)
  const deprecated = await loadDeprecated(skillsDir)
  const skills: RegistrySkill[] = []

  for (const folder of await listSkillFolders(skillsDir)) {
    const skill = await loadSkill(skillsDir, folder)
    const fm = skill.frontmatter
    const metadata = fm['metadata'] as SkillMetadata
    const files: RegistryFile[] = []
    let totalTokens = 0
    for (const file of await walkFiles(skill.dir)) {
      if (isExcludedFromPayload(file.path)) continue
      const buffer = await readFile(file.absolutePath)
      files.push({ path: file.path, sha256: sha256(buffer), bytes: buffer.length, executable: file.executable })
      if (file.path.endsWith('.md')) totalTokens += estimateTokens(buffer)
    }
    const rawReviewed: unknown = metadata.reviewed
    const reviewed = rawReviewed instanceof Date ? rawReviewed.toISOString().slice(0, 10) : String(rawReviewed)
    const entry: RegistrySkill = {
      name: String(fm['name']),
      description: String(fm['description']),
      category: metadata.category,
      tags: metadata.tags,
      owner: metadata.owner,
      version: String(metadata.version),
      reviewed,
      path: `skills/${folder}`,
      files,
      contentHash: contentHashOf(files),
      tokens: { skillMd: estimateTokens(skill.raw), total: totalTokens },
    }
    if (typeof fm['license'] === 'string') entry.license = fm['license']
    if (typeof fm['compatibility'] === 'string') entry.compatibility = fm['compatibility']
    if (metadata.requires) entry.requires = metadata.requires
    if (metadata.source) entry.source = metadata.source
    skills.push(entry)
  }

  const sortedCategories = Object.fromEntries(sortedCategoryIds(categories).map((id) => [id, categories[id]!]))
  return {
    $schema: './schemas/skills-registry.schema.json',
    registryVersion: 1,
    catalogVersion: pkg.version,
    repo: REPO,
    rawBase: RAW_BASE,
    categories: sortedCategories,
    skills: skills.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    deprecated,
  }
}

export function renderReadmeTable(registry: SkillsRegistry): string {
  const lines: string[] = []
  for (const categoryId of Object.keys(registry.categories)) {
    const skills = registry.skills.filter((skill) => skill.category === categoryId)
    if (skills.length === 0) continue
    const category = registry.categories[categoryId]!
    lines.push(`### ${category.name}`, '', category.description, '', '| Skill | What it does | Owner | Tokens |', '|---|---|---|---|')
    for (const skill of skills) {
      const what = skill.description.split(/\.\s+Use when/)[0]!.replace(/\|/g, '\\|')
      lines.push(`| [\`${skill.name}\`](skills/${skill.name}/SKILL.md) | ${what}. | ${skill.owner} | ~${skill.tokens.skillMd} |`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

const README_START = '<!-- catalog:start -->'
const README_END = '<!-- catalog:end -->'

export function injectReadmeTable(readme: string, table: string): string {
  const start = readme.indexOf(README_START)
  const end = readme.indexOf(README_END)
  if (start === -1 || end === -1 || end < start) throw new Error(`README.md must contain ${README_START} and ${README_END} markers`)
  return `${readme.slice(0, start + README_START.length)}\n\n${table}\n\n${readme.slice(end)}`
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      check: { type: 'boolean', default: false },
      readme: { type: 'boolean', default: false },
      root: { type: 'string', default: '.' },
    },
  })
  const rootDir = resolve(values.root!)
  const registry = await generateRegistry({ rootDir })
  const output = `${JSON.stringify(registry, null, 2)}\n`
  const target = join(rootDir, 'skills-registry.json')

  if (values.check) {
    const current = await readFile(target, 'utf8').catch(() => '')
    if (current !== output) {
      console.error('skills-registry.json is out of date. Run `npm run registry` and commit the result.')
      process.exit(1)
    }
    if (values.readme) {
      const readme = await readFile(join(rootDir, 'README.md'), 'utf8')
      if (injectReadmeTable(readme, renderReadmeTable(registry)) !== readme) {
        console.error('README.md catalog table is out of date. Run `npm run registry -- --readme` and commit the result.')
        process.exit(1)
      }
    }
    console.log(`skills-registry.json is up to date (${registry.skills.length} skills)`)
    return
  }

  await writeFile(target, output)
  console.log(`wrote skills-registry.json with ${registry.skills.length} skill(s)`)
  if (values.readme) {
    const readmePath = join(rootDir, 'README.md')
    const readme = await readFile(readmePath, 'utf8')
    await writeFile(readmePath, injectReadmeTable(readme, renderReadmeTable(registry)))
    console.log('updated README.md catalog table')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
