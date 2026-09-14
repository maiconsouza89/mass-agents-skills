import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { buildScorer, evaluate, predict, runEvals } from './eval-triggers.ts'
import { generateRegistry, injectReadmeTable, renderReadmeTable } from './generate-registry.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '__fixtures__')

test('generateRegistry hashes payload files and skips evals', async () => {
  const registry = await generateRegistry({ rootDir: join(here, '..'), skillsDir: join(fixtures, 'good') })
  assert.equal(registry.skills.length, 1)
  const skill = registry.skills[0]!
  assert.equal(skill.name, 'mass-good-skill')
  assert.deepEqual(skill.files.map((file) => file.path), ['SKILL.md', 'references/guide.md', 'scripts/check.sh'])
  assert.equal(skill.files.find((file) => file.path === 'scripts/check.sh')!.executable, true)
  assert.match(skill.contentHash, /^[a-f0-9]{64}$/)
  assert.ok(skill.tokens.skillMd > 0)
  assert.deepEqual(skill.requires, { tools: ['git'] })
})

test('readme table renders and injects between markers', async () => {
  const registry = await generateRegistry({ rootDir: join(here, '..'), skillsDir: join(fixtures, 'good') })
  const table = renderReadmeTable(registry)
  assert.match(table, /### Meta/)
  assert.match(table, /mass-good-skill/)
  const readme = injectReadmeTable('# Title\n\n<!-- catalog:start -->\nold\n<!-- catalog:end -->\n', table)
  assert.match(readme, /<!-- catalog:start -->\n\n### Meta/)
  assert.doesNotMatch(readme, /\nold\n/)
  assert.throws(() => injectReadmeTable('no markers', table))
})

test('scorer prefers the skill whose triggers match the prompt', () => {
  const review = buildScorer('mass-code-review', 'Reviews a pull request and posts findings. Use when the user says "review this PR" or "code review". Do NOT use for tests.', ['review'])
  const tests = buildScorer('mass-testing-strategy', 'Writes tests with Vitest. Use when the user says "write tests" or "add unit tests". Do NOT use for reviews.', ['testing'])
  assert.equal(predict('please review this PR', [review, tests], 1).skill, 'mass-code-review')
  assert.equal(predict('add unit tests for the service', [review, tests], 1).skill, 'mass-testing-strategy')
  assert.equal(predict('what is the capital of France', [review, tests], 1).skill, null)
  const report = evaluate([review, tests], [
    { prompt: 'review this PR', from: 'a', expected: 'mass-code-review' },
    { prompt: 'write tests please', from: 'b', expected: 'mass-testing-strategy' },
    { prompt: 'capital of France', from: 'c', expected: null },
  ], 1)
  assert.equal(report.misses.length, 0)
  assert.ok(report.scores.every((score) => score.f1 === 1))
})

test('runEvals on the good fixture has no misses', async () => {
  const report = await runEvals(join(fixtures, 'good'), 1)
  assert.equal(report.cases, 6)
  assert.deepEqual(report.misses, [])
})
