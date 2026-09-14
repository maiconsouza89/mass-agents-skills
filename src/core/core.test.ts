import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractTriggerPhrases, jaccard, parseDescription, tokenize, triggerTokens } from './description.ts'
import { FrontmatterError, parseSkillFile } from './frontmatter.ts'
import { contentHashOf, sha256 } from './hash.ts'
import { isExcludedFromPayload, isPathInside, sanitizeName } from './paths.ts'
import { resolveAgents } from './agents.ts'
import { estimateTokens } from './tokens.ts'

test('parseSkillFile splits frontmatter and body', () => {
  const parsed = parseSkillFile('---\nname: x\nmetadata:\n  tags: [a]\n---\n\n# Title\n\nBody\n')
  assert.equal(parsed.frontmatter['name'], 'x')
  assert.deepEqual(parsed.frontmatter['metadata'], { tags: ['a'] })
  assert.equal(parsed.body, '\n# Title\n\nBody\n')
})

test('parseSkillFile rejects missing delimiters and non-mapping YAML', () => {
  assert.throws(() => parseSkillFile('name: x\n'), FrontmatterError)
  assert.throws(() => parseSkillFile('---\nname: x\n'), FrontmatterError)
  assert.throws(() => parseSkillFile('---\n- a\n---\n'), FrontmatterError)
})

test('parseDescription enforces the what / Use when / Do NOT use formula', () => {
  const parts = parseDescription(
    'Reviews pull requests with a severity rubric. Use when the user says "review this PR" or "code review". Do NOT use for writing tests (use mass-testing-strategy).',
  )
  assert.ok(parts)
  assert.equal(parts.what, 'Reviews pull requests with a severity rubric.')
  assert.deepEqual(extractTriggerPhrases(parts.useWhen), ['review this PR', 'code review'])
  assert.equal(parseDescription('Too short. Use when x. Do NOT use y'), null)
  assert.equal(parseDescription('Long enough description of what it does without the required clauses at all.'), null)
})

test('tokenize strips stopwords and stems suffixes', () => {
  assert.deepEqual(tokenize('Reviewing the pull requests, please!'), ['review', 'pull', 'request'])
})

test('jaccard and triggerTokens', () => {
  assert.equal(jaccard(['a', 'b'], ['b', 'c']), 1 / 3)
  assert.equal(jaccard([], []), 0)
  const tokens = triggerTokens('mass-code-review', 'the user says "review this PR"')
  assert.ok(tokens.has('review'))
  assert.ok(tokens.has('pr'))
})

test('sha256 and contentHashOf are order independent', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  const a = contentHashOf([{ path: 'a', sha256: '1' }, { path: 'b', sha256: '2' }])
  const b = contentHashOf([{ path: 'b', sha256: '2' }, { path: 'a', sha256: '1' }])
  assert.equal(a, b)
  assert.notEqual(a, contentHashOf([{ path: 'a', sha256: '1' }]))
})

test('sanitizeName and isPathInside block traversal', () => {
  assert.equal(sanitizeName('../../etc/passwd'), 'etcpasswd')
  assert.equal(sanitizeName(''), 'unnamed-skill')
  assert.equal(sanitizeName('mass-code-review'), 'mass-code-review')
  assert.equal(isPathInside('/tmp/base', '/tmp/base/skill'), true)
  assert.equal(isPathInside('/tmp/base', '/tmp/base'), true)
  assert.equal(isPathInside('/tmp/base', '/tmp/base/../other'), false)
  assert.equal(isPathInside('/tmp/base', '/tmp/basement'), false)
})

test('isExcludedFromPayload drops evals and dotfiles', () => {
  assert.equal(isExcludedFromPayload('evals/triggers.yaml'), true)
  assert.equal(isExcludedFromPayload('.DS_Store'), true)
  assert.equal(isExcludedFromPayload('references/.hidden'), true)
  assert.equal(isExcludedFromPayload('references/guide.md'), false)
})

test('resolveAgents expands all, auto and rejects unknown', () => {
  assert.equal(resolveAgents(['all'], []).agents.length, 8)
  assert.deepEqual(resolveAgents(['auto'], ['cursor']).agents.map((a) => a.id), ['cursor'])
  const result = resolveAgents(['claude-code', 'nope'], [])
  assert.deepEqual(result.agents.map((a) => a.id), ['claude-code'])
  assert.deepEqual(result.unknown, ['nope'])
})

test('estimateTokens uses four bytes per token', () => {
  assert.equal(estimateTokens('12345678'), 2)
  assert.equal(estimateTokens('123456789'), 3)
})
