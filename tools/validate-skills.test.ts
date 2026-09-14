import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { validateCatalog, type Finding } from './validate-skills.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '__fixtures__')
const today = new Date('2026-09-14T12:00:00Z')

function rules(findings: Finding[], skill: string): string[] {
  return findings.filter((finding) => finding.skill === skill).map((finding) => finding.rule).sort()
}

test('good fixture passes without errors', async () => {
  const findings = await validateCatalog({ skillsDir: join(fixtures, 'good'), today })
  const errors = findings.filter((finding) => finding.severity === 'error')
  assert.deepEqual(errors, [])
})

test('bad fixtures trigger the expected rules', async () => {
  const findings = await validateCatalog({ skillsDir: join(fixtures, 'bad'), today })
  const badName = rules(findings, 'Bad_Name')
  assert.ok(badName.includes('S01'), 'folder not kebab-case')
  assert.ok(badName.includes('F02'), 'name differs from folder')
  assert.ok(badName.includes('F06'), 'formula missing')
  assert.ok(badName.includes('F09'), 'metadata incomplete')
  assert.ok(badName.includes('B04'), 'empty body')
  assert.ok(badName.includes('E01'), 'evals missing')

  const broken = rules(findings, 'mass-broken')
  assert.ok(broken.includes('S05'), 'claude-only key rejected')
  assert.ok(broken.includes('F06'), 'formula missing')
  assert.ok(broken.includes('F09'), 'owner invalid')
  assert.ok(broken.includes('F10'), 'version not semver')
  assert.ok(broken.includes('F11'), 'reviewed in the future')
  assert.ok(broken.includes('F13'), 'unknown category')
  assert.ok(broken.includes('F14'), 'empty tags')
  assert.ok(broken.includes('F15'), 'requires self and unknown')
  assert.ok(broken.includes('B04'), 'body missing heading')
  assert.ok(broken.includes('B05'), 'missing reference')
  assert.ok(broken.includes('X01'), 'script without shebang')
  assert.ok(broken.includes('Z01'), 'secret detected')
  assert.ok(broken.includes('Z02'), 'curl pipe sh')
  assert.ok(broken.includes('E01'), 'not enough evals')
})

test('stale review date is a warning, not an error', async () => {
  const findings = await validateCatalog({ skillsDir: join(fixtures, 'good'), today: new Date('2027-06-01T00:00:00Z') })
  const stale = findings.find((finding) => finding.rule === 'F12')
  assert.ok(stale)
  assert.equal(stale.severity, 'warning')
})

test('only filter limits the skills checked', async () => {
  const findings = await validateCatalog({ skillsDir: join(fixtures, 'bad'), only: ['mass-broken'], today })
  assert.equal(findings.some((finding) => finding.skill === 'Bad_Name'), false)
})
