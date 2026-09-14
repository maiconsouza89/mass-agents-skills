#!/usr/bin/env node
/**
 * Scaffolds a new skill folder that already passes the validator's structural rules.
 *
 *   npm run new-skill -- mass-my-skill --category frontend --owner @handle --tags react,hooks
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { KEBAB_CASE } from '../src/core/paths.ts'
import { loadCategories } from '../src/core/categories.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    category: { type: 'string', short: 'c' },
    owner: { type: 'string', short: 'o', default: '@maiconsouza89' },
    tags: { type: 'string', short: 't' },
    'skills-dir': { type: 'string', default: 'skills' },
  },
})

const name = positionals[0]
if (!name || !KEBAB_CASE.test(name)) {
  console.error('usage: new-skill <kebab-case-name> --category <id> [--owner @handle] [--tags a,b]')
  process.exit(2)
}
if (!name.startsWith('mass-')) console.warn('warning: catalog skills are expected to start with "mass-"')

const skillsDir = resolve(values['skills-dir']!)
const categories = await loadCategories(skillsDir)
const category = values.category ?? ''
if (!categories[category]) {
  console.error(`--category must be one of: ${Object.keys(categories).join(', ')}`)
  process.exit(2)
}

const dir = join(skillsDir, name)
try {
  await access(dir)
  console.error(`${dir} already exists`)
  process.exit(1)
} catch {
  // does not exist, proceed
}

const today = new Date().toISOString().slice(0, 10)
const tags = (values.tags ?? category).split(',').map((tag) => tag.trim()).filter(Boolean)
const title = name.replace(/^mass-/, '').split('-').map((word) => word[0]!.toUpperCase() + word.slice(1)).join(' ')

const skillMd = `---
name: ${name}
description: TODO one sentence saying what this skill does and the outcome it produces. Use when the user says "TODO trigger phrase", "TODO second trigger" or asks to TODO. Do NOT use for TODO out-of-scope task (use mass-other-skill).
license: MIT
metadata:
  owner: "${values.owner}"
  version: 0.1.0
  reviewed: ${today}
  category: ${category}
  tags: [${tags.join(', ')}]
---

# ${title}

One or two sentences on the purpose of this skill and the result the agent must deliver.

## Instructions

### Step 1: TODO

Concrete, imperative instructions. Prefer a script in \`scripts/\` for deterministic checks.

### Step 2: TODO

## Examples

### Example: TODO common scenario

User says: "TODO"
Actions: 1. TODO 2. TODO
Result: TODO

## Troubleshooting

### TODO error or ambiguity

Cause: TODO
Fix: TODO
`

const triggers = `# Prompts used by tools/eval-triggers.ts. Keep them realistic and varied.
positive:
  - "TODO a prompt that must trigger this skill"
  - "TODO a paraphrased request"
  - "TODO an informal or partial request"
negative:
  - prompt: "TODO a request another skill should handle"
    expect: mass-other-skill
  - prompt: "TODO an unrelated coding request"
  - prompt: "TODO a generic question"
`

await mkdir(join(dir, 'evals'), { recursive: true })
await writeFile(join(dir, 'SKILL.md'), skillMd)
await writeFile(join(dir, 'evals', 'triggers.yaml'), triggers)
console.log(`created ${dir}`)
console.log('next: fill in the TODOs, then run `npm run validate` and `npm run registry`')
