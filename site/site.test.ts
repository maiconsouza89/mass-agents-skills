import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { buildSite } from './build.ts'
import { parseDesignTokens, tokensToCss } from './tokens.ts'

const here = dirname(fileURLToPath(import.meta.url))
const rootDir = join(here, '..')

test('DESIGN.md tokens become CSS custom properties', async () => {
  const css = tokensToCss(parseDesignTokens(await readFile(join(rootDir, 'DESIGN.md'), 'utf8')))
  assert.match(css, /--color-canvas: #010102;/)
  assert.match(css, /--color-primary: #5e6ad2;/)
  assert.match(css, /--radius-lg: 12px;/)
  assert.match(css, /--space-section: 96px;/)
  assert.match(css, /--type-display-lg-size: 56px;/)
  assert.match(css, /--type-mono-family: 'JetBrains Mono'/)
})

test('site build produces index, agents, skill pages and catalog.json', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'mass-site-'))
  try {
    const result = await buildSite({ rootDir, outDir })
    assert.ok(result.pages >= 4)
    const index = await readFile(join(outDir, 'index.html'), 'utf8')
    assert.match(index, /data-skill="mass-code-review"/)
    assert.match(index, /assets\/tokens\.css/)
    const skillPage = await readFile(join(outDir, 'skills', 'mass-code-review', 'index.html'), 'utf8')
    assert.match(skillPage, /npx github:maiconsouza89\/mass-agents-skills install mass-code-review/)
    assert.match(skillPage, /href="https:\/\/github\.com\/maiconsouza89\/mass-agents-skills\/blob\/main\/skills\/mass-code-review\/references\/severity-rubric\.md"/)
    assert.match(skillPage, /references\/review-checklist\.md/)
    assert.match(skillPage, /Requires skills/)
    const catalog = JSON.parse(await readFile(join(outDir, 'catalog.json'), 'utf8')) as { skills: Array<{ name: string }> }
    assert.ok(catalog.skills.some((skill) => skill.name === 'mass-skill-architect'))
    await stat(join(outDir, 'agents', 'index.html'))
    await stat(join(outDir, '.nojekyll'))
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})
