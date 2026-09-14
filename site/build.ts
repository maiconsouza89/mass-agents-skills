#!/usr/bin/env node
/**
 * Builds the static catalog site into site/dist from skills-registry.json, the SKILL.md bodies
 * and the DESIGN.md tokens. No framework: plain HTML, one CSS file generated from the design tokens.
 *
 *   node site/build.ts [--out site/dist] [--base /mass-agents-skills/]
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { parseSkillFile } from '../src/core/frontmatter.ts'
import { loadTriggerEvals } from '../src/core/skill-loader.ts'
import type { SkillsRegistry } from '../src/core/types.ts'
import { renderAgentsPage, renderIndex, renderNotFound, renderSkillBody, renderSkillPage, type SiteContext } from './render.ts'
import { parseDesignTokens, tokensToCss } from './tokens.ts'

const here = dirname(fileURLToPath(import.meta.url))

export interface BuildOptions {
  rootDir: string
  outDir: string
}

export async function buildSite(options: BuildOptions): Promise<{ pages: number }> {
  const rootDir = resolve(options.rootDir)
  const outDir = resolve(options.outDir)
  const registry = JSON.parse(await readFile(join(rootDir, 'skills-registry.json'), 'utf8')) as SkillsRegistry
  const context: SiteContext = { registry, repoUrl: `https://github.com/${registry.repo}`, siteTitle: 'Mass Solutions' }

  await rm(outDir, { recursive: true, force: true })
  await mkdir(join(outDir, 'assets'), { recursive: true })

  const design = await readFile(join(rootDir, 'DESIGN.md'), 'utf8')
  await writeFile(join(outDir, 'assets', 'tokens.css'), tokensToCss(parseDesignTokens(design)))
  for (const asset of ['base.css', 'search.js', 'copy.js', 'favicon.svg']) {
    await cp(join(here, 'assets', asset), join(outDir, 'assets', asset))
  }

  await writeFile(join(outDir, 'index.html'), renderIndex(context))
  await mkdir(join(outDir, 'agents'), { recursive: true })
  await writeFile(join(outDir, 'agents', 'index.html'), renderAgentsPage(context))
  await writeFile(join(outDir, '404.html'), renderNotFound(context))
  await writeFile(join(outDir, '.nojekyll'), '')

  let pages = 3
  for (const skill of registry.skills) {
    const raw = await readFile(join(rootDir, skill.path, 'SKILL.md'), 'utf8')
    const { body } = parseSkillFile(raw)
    const evals = await loadTriggerEvals(join(rootDir, skill.path))
    const dir = join(outDir, 'skills', skill.name)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'index.html'), renderSkillPage(context, skill, renderSkillBody(body, skill, context.repoUrl), evals))
    pages++
  }

  const catalog = registry.skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tags: skill.tags,
    owner: skill.owner,
    version: skill.version,
    reviewed: skill.reviewed,
    tokens: skill.tokens,
    requires: skill.requires ?? {},
    url: `skills/${skill.name}/`,
  }))
  await writeFile(join(outDir, 'catalog.json'), `${JSON.stringify({ catalogVersion: registry.catalogVersion, categories: registry.categories, skills: catalog }, null, 2)}\n`)
  return { pages }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: join(here, 'dist') },
      base: { type: 'string', default: '/' },
      root: { type: 'string', default: join(here, '..') },
    },
  })
  const result = await buildSite({ rootDir: values.root!, outDir: values.out! })
  console.log(`built ${result.pages} page(s) into ${resolve(values.out!)} (base ${values.base})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
