#!/usr/bin/env node
/**
 * Validates every skill in the catalog against the Mass Solutions contract.
 * Exit code 1 on any error. Warnings never fail the run.
 *
 *   node tools/validate-skills.ts [skill-names...] [--json] [--max-age 90] [--budget-error 6000] [--budget-warn 3000]
 */
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { loadCategories } from '../src/core/categories.ts'
import { extractTriggerPhrases, jaccard, parseDescription, triggerTokens } from '../src/core/description.ts'
import { FrontmatterError } from '../src/core/frontmatter.ts'
import { isExcludedFromPayload, KEBAB_CASE, walkFiles } from '../src/core/paths.ts'
import { listSkillFolders, loadDeprecated, loadSkill, loadTriggerEvals, type LoadedSkill } from '../src/core/skill-loader.ts'
import { estimateTokens, TOKEN_BUDGET } from '../src/core/tokens.ts'
import type { Categories, DeprecatedSkill } from '../src/core/types.ts'

export type Severity = 'error' | 'warning'

export interface Finding {
  skill: string
  rule: string
  severity: Severity
  message: string
}

export interface ValidateOptions {
  skillsDir: string
  only?: string[]
  maxAgeDays?: number
  budgetError?: number
  budgetWarn?: number
  /** Injectable for deterministic tests. */
  today?: Date
}

const STANDARD_TOP_LEVEL_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata'])
const CLAUDE_ONLY_KEYS = new Set([
  'disable-model-invocation', 'user-invocable', 'paths', 'argument-hint', 'arguments', 'model', 'effort',
  'context', 'agent', 'background', 'hooks', 'shell', 'disallowed-tools',
])
const RESERVED_NAME_WORDS = ['claude', 'anthropic']
const OWNER_PATTERN = /^(@[A-Za-z0-9_-]+|team:[a-z0-9-]+)$/
const SEMVER = /^\d+\.\d+\.\d+$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'GitHub token', pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { label: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { label: 'OpenAI-style key', pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { label: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { label: 'JWT', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
]
const DANGEROUS_SHELL: Array<{ label: string; pattern: RegExp }> = [
  { label: 'remote script piped to a shell', pattern: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z)?sh\b/ },
  { label: 'base64 payload piped to a shell', pattern: /base64\s+(-d|--decode)[^\n|]*\|\s*(ba|z)?sh\b/ },
  { label: 'eval of a command substitution', pattern: /\beval\s+"?\$\(/ },
  { label: 'environment dump sent over the network', pattern: /\b(env|printenv)\b[^\n|]*\|\s*(curl|wget|nc)\b/ },
]
const INJECTION_PHRASES = /ignore (all )?(previous|prior|above) instructions|disregard (your|the) system prompt|you are now (dan|unrestricted)/i

export async function validateCatalog(options: ValidateOptions): Promise<Finding[]> {
  const findings: Finding[] = []
  const skillsDir = resolve(options.skillsDir)
  const today = options.today ?? new Date()
  const maxAge = options.maxAgeDays ?? 90
  const budgetError = options.budgetError ?? TOKEN_BUDGET.skillMdError
  const budgetWarn = options.budgetWarn ?? TOKEN_BUDGET.skillMdWarn

  let categories: Categories
  try {
    categories = await loadCategories(skillsDir)
  } catch (error) {
    findings.push({ skill: '_categories.json', rule: 'C00', severity: 'error', message: (error as Error).message })
    return findings
  }
  let deprecated: DeprecatedSkill[] = []
  try {
    deprecated = await loadDeprecated(skillsDir)
  } catch (error) {
    findings.push({ skill: '_deprecated.yaml', rule: 'C03', severity: 'error', message: (error as Error).message })
  }

  const allFolders = await listSkillFolders(skillsDir)
  const folders = options.only?.length ? allFolders.filter((folder) => options.only!.includes(folder)) : allFolders
  const catalogNames = new Set(allFolders)
  const loaded: LoadedSkill[] = []

  for (const folder of folders) {
    const report = (rule: string, severity: Severity, message: string) => findings.push({ skill: folder, rule, severity, message })
    const skillDir = join(skillsDir, folder)

    if (!KEBAB_CASE.test(folder)) report('S01', 'error', 'folder name must be kebab-case')

    let files
    try {
      files = await walkFiles(skillDir)
    } catch (error) {
      report('S02', 'error', `cannot read folder: ${(error as Error).message}`)
      continue
    }
    const fileNames = new Set(files.map((file) => file.path))
    if (!fileNames.has('SKILL.md')) {
      const wrongCase = files.find((file) => file.path.toLowerCase() === 'skill.md')
      report('S02', 'error', wrongCase ? `found ${wrongCase.path}; the file must be named exactly SKILL.md` : 'SKILL.md is missing')
      continue
    }
    for (const file of files) {
      if (/^readme(\..+)?$/i.test(file.path)) report('S03', 'error', `${file.path}: skills are for agents, not humans; remove the README`)
    }

    let skill: LoadedSkill
    try {
      skill = await loadSkill(skillsDir, folder)
    } catch (error) {
      report('S04', 'error', error instanceof FrontmatterError ? error.message : `cannot parse SKILL.md: ${(error as Error).message}`)
      continue
    }
    loaded.push(skill)
    const fm = skill.frontmatter

    for (const key of Object.keys(fm)) {
      if (STANDARD_TOP_LEVEL_KEYS.has(key)) continue
      const hint = CLAUDE_ONLY_KEYS.has(key) ? ' (Claude Code-only key; it breaks portability to other agents)' : ''
      report('S05', 'error', `frontmatter key "${key}" is not part of the Agent Skills standard${hint}; company fields belong under metadata`)
    }

    // name
    const name = fm['name']
    if (typeof name !== 'string' || name.length === 0) report('F01', 'error', 'name is required')
    else {
      if (!KEBAB_CASE.test(name) || name.length < 3 || name.length > 64) report('F01', 'error', 'name must be kebab-case, 3 to 64 characters')
      for (const word of RESERVED_NAME_WORDS) if (name.includes(word)) report('F01', 'error', `name must not contain the reserved word "${word}"`)
      if (name !== folder) report('F02', 'error', `name "${name}" must equal the folder name "${folder}"`)
    }

    // description
    const description = fm['description']
    let useWhen = ''
    if (typeof description !== 'string' || description.trim().length === 0) report('F04', 'error', 'description is required')
    else {
      if (/[\r\n]/.test(description.trim())) report('F04', 'error', 'description must be a single line (no YAML block scalars)')
      if (/[<>]/.test(description)) report('F04', 'error', 'description must not contain < or >')
      if (description.length > 1024) report('F05', 'error', `description is ${description.length} characters; maximum is 1024`)
      else if (description.length < 80) report('F05', 'warning', `description is only ${description.length} characters; add triggers and scope`)
      const parts = parseDescription(description)
      if (!parts) report('F06', 'error', 'description must follow the formula: [What it does]. Use when [triggers]. Do NOT use for [negatives].')
      else {
        useWhen = parts.useWhen
        const phrases = extractTriggerPhrases(parts.useWhen)
        if (phrases.length < 2) report('F07', 'warning', `"Use when" clause has ${phrases.length} quoted trigger phrase(s); include at least 2 so agents match real requests`)
      }
    }

    if (typeof fm['license'] !== 'string' || !fm['license']) report('F08', 'warning', 'license is missing (use MIT for skills authored here)')
    if ('compatibility' in fm && (typeof fm['compatibility'] !== 'string' || fm['compatibility'].length > 500)) report('F16', 'error', 'compatibility must be a string of at most 500 characters')

    // metadata
    const metadata = fm['metadata']
    if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
      report('F09', 'error', 'metadata block is required with owner, version, reviewed, category and tags')
    } else {
      const md = metadata as Record<string, unknown>
      const allowedMetadataKeys = new Set(['owner', 'version', 'reviewed', 'category', 'tags', 'requires', 'source'])
      for (const key of Object.keys(md)) if (!allowedMetadataKeys.has(key)) report('F09', 'error', `metadata.${key} is not a known field`)

      if (typeof md['owner'] !== 'string' || !OWNER_PATTERN.test(md['owner'])) report('F09', 'error', 'metadata.owner must be "@github-handle" or "team:slug"')
      if (typeof md['version'] !== 'string' || !SEMVER.test(md['version'])) report('F10', 'error', 'metadata.version must be a quoted semver string such as 1.0.0')

      const reviewed = md['reviewed'] instanceof Date ? md['reviewed'].toISOString().slice(0, 10) : md['reviewed']
      if (typeof reviewed !== 'string' || !ISO_DATE.test(reviewed) || Number.isNaN(Date.parse(reviewed))) report('F11', 'error', 'metadata.reviewed must be an ISO date (YYYY-MM-DD)')
      else {
        const reviewedDate = new Date(`${reviewed}T00:00:00Z`)
        const ageDays = Math.floor((today.getTime() - reviewedDate.getTime()) / 86_400_000)
        if (ageDays < -1) report('F11', 'error', `metadata.reviewed (${reviewed}) is in the future`)
        else if (ageDays > maxAge) report('F12', 'warning', `last reviewed ${ageDays} days ago (limit ${maxAge}); re-read the skill and bump metadata.reviewed`)
      }

      if (typeof md['category'] !== 'string' || !categories[md['category']]) report('F13', 'error', `metadata.category must be one of: ${Object.keys(categories).join(', ')}`)

      const tags = md['tags']
      if (!Array.isArray(tags) || tags.length < 1 || tags.length > 8 || tags.some((tag) => typeof tag !== 'string' || !KEBAB_CASE.test(tag))) {
        report('F14', 'error', 'metadata.tags must be a list of 1 to 8 kebab-case strings')
      } else if (new Set(tags).size !== tags.length) report('F14', 'error', 'metadata.tags contains duplicates')

      if ('requires' in md) {
        const requires = md['requires']
        if (requires === null || typeof requires !== 'object' || Array.isArray(requires)) report('F15', 'error', 'metadata.requires must be a mapping with skills, tools and/or mcp lists')
        else {
          const req = requires as Record<string, unknown>
          for (const key of Object.keys(req)) {
            if (!['skills', 'tools', 'mcp'].includes(key)) report('F15', 'error', `metadata.requires.${key} is not a known field`)
            else if (!Array.isArray(req[key]) || (req[key] as unknown[]).some((item) => typeof item !== 'string')) report('F15', 'error', `metadata.requires.${key} must be a list of strings`)
          }
          for (const dep of (Array.isArray(req['skills']) ? req['skills'] : []) as string[]) {
            if (dep === folder) report('F15', 'error', 'a skill cannot require itself')
            else if (deprecated.some((entry) => entry.name === dep)) report('F15', 'error', `metadata.requires.skills references deprecated skill "${dep}"`)
            else if (!catalogNames.has(dep)) report('F15', 'error', `metadata.requires.skills references unknown skill "${dep}"`)
          }
        }
      }

      if ('source' in md) {
        const source = md['source']
        if (source === null || typeof source !== 'object' || Array.isArray(source)) report('F16', 'error', 'metadata.source must be a mapping with url, ref and license')
        else {
          const src = source as Record<string, unknown>
          if (typeof src['url'] !== 'string' || !/^https:\/\//.test(src['url'])) report('F16', 'error', 'metadata.source.url must be an https URL')
          if (typeof src['ref'] !== 'string' || !src['ref']) report('F16', 'error', 'metadata.source.ref (tag, branch or commit) is required')
          if (typeof src['license'] !== 'string' || !src['license']) report('F16', 'error', 'metadata.source.license is required')
        }
      } else if (typeof name === 'string' && !name.startsWith('mass-')) {
        report('F03', 'warning', 'skills authored here should be prefixed with "mass-"; vendored skills must declare metadata.source')
      }
    }

    // body
    const body = skill.body
    const skillMdTokens = estimateTokens(skill.raw)
    if (skillMdTokens > budgetError) report('B01', 'error', `SKILL.md is about ${skillMdTokens} tokens; maximum is ${budgetError}. Move detail into references/`)
    else if (skillMdTokens > budgetWarn) report('B02', 'warning', `SKILL.md is about ${skillMdTokens} tokens (soft limit ${budgetWarn}); consider moving detail into references/`)

    if (body.trim().length === 0) report('B04', 'error', 'SKILL.md body is empty')
    else if (!/^#\s+\S/.test(body.trim())) report('B04', 'error', 'SKILL.md body must start with a level-1 heading')

    const mentioned = new Set<string>()
    const pathPattern = /(?:^|[\s(`'"])((?:references|scripts|assets)\/[A-Za-z0-9_./-]+)/g
    let match: RegExpExecArray | null
    while ((match = pathPattern.exec(body)) !== null) mentioned.add(match[1]!.replace(/[.,;:)]+$/, ''))
    const linkPattern = /\]\((?!https?:|mailto:|#)([^)\s]+)\)/g
    while ((match = linkPattern.exec(body)) !== null) {
      const target = match[1]!.replace(/^\.\//, '')
      if (!target.startsWith('..')) mentioned.add(target)
    }
    for (const path of mentioned) {
      if (path.endsWith('/')) continue
      if (!fileNames.has(path)) report('B05', 'error', `SKILL.md mentions ${path} but the file does not exist`)
    }
    for (const file of files) {
      if (!/^(references|scripts|assets)\//.test(file.path)) continue
      if (!mentioned.has(file.path) && !body.includes(file.path)) report('B06', 'warning', `${file.path} is never mentioned in SKILL.md; tell the agent when to read it or delete it`)
    }
    if (/(^|[\s"'`(])(\/home\/|\/Users\/|[A-Z]:\\)/.test(body)) report('B07', 'warning', 'SKILL.md contains an absolute local path; use paths relative to the project')

    let totalMdTokens = skillMdTokens
    for (const file of files) {
      if (isExcludedFromPayload(file.path)) continue
      const buffer = await readFile(file.absolutePath)
      if (buffer.includes(0)) {
        report('X03', 'error', `${file.path} is a binary file; skills must be plain text`)
        continue
      }
      const text = buffer.toString('utf8')
      if (file.path !== 'SKILL.md' && file.path.endsWith('.md')) totalMdTokens += estimateTokens(buffer)
      if (file.path.startsWith('scripts/')) {
        if (!text.startsWith('#!')) report('X01', 'error', `${file.path} must start with a shebang line`)
        if (process.platform !== 'win32' && !file.executable) report('X02', 'error', `${file.path} is not executable; run chmod +x`)
        for (const { label, pattern } of DANGEROUS_SHELL) if (pattern.test(text)) report('Z02', 'warning', `${file.path}: ${label}`)
      }
      for (const { label, pattern } of SECRET_PATTERNS) if (pattern.test(text)) report('Z01', 'error', `${file.path} looks like it contains a ${label}`)
      if (INJECTION_PHRASES.test(text)) report('Z03', 'warning', `${file.path} contains prompt-injection style wording`)
    }
    if (totalMdTokens > TOKEN_BUDGET.totalWarn) report('B03', 'warning', `all markdown in this skill is about ${totalMdTokens} tokens (soft limit ${TOKEN_BUDGET.totalWarn})`)

    // evals
    const evals = await loadTriggerEvals(skillDir).catch((error: Error) => {
      report('E01', 'error', `evals/triggers.yaml cannot be parsed: ${error.message}`)
      return null
    })
    if (!evals) {
      if (!fileNames.has('evals/triggers.yaml')) report('E01', 'error', 'evals/triggers.yaml is missing; add at least 3 positive and 3 negative prompts')
    } else {
      if (evals.positive.length < 3) report('E01', 'error', `evals/triggers.yaml has ${evals.positive.length} positive prompt(s); minimum is 3`)
      if (evals.negative.length < 3) report('E01', 'error', `evals/triggers.yaml has ${evals.negative.length} negative prompt(s); minimum is 3`)
      for (const item of evals.negative) {
        if (item.expect && !catalogNames.has(item.expect)) report('E01', 'error', `evals/triggers.yaml expects unknown skill "${item.expect}"`)
      }
      if ([...evals.positive, ...evals.negative.map((item) => item.prompt)].some((prompt) => /TODO/.test(prompt))) report('E01', 'error', 'evals/triggers.yaml still contains TODO placeholders')
    }
    if (typeof description === 'string' && /TODO/.test(description)) report('F04', 'error', 'description still contains TODO placeholders')
    void useWhen
  }

  // catalog-level checks
  const seen = new Map<string, string>()
  for (const skill of loaded) {
    const name = String(skill.frontmatter['name'] ?? '')
    if (seen.has(name)) findings.push({ skill: skill.folder, rule: 'C01', severity: 'error', message: `duplicate skill name "${name}" (also in ${seen.get(name)})` })
    seen.set(name, skill.folder)
  }
  const tokenSets = loaded
    .map((skill) => {
      const parts = typeof skill.frontmatter['description'] === 'string' ? parseDescription(skill.frontmatter['description']) : null
      return parts ? { folder: skill.folder, tokens: triggerTokens(skill.folder, parts.useWhen) } : null
    })
    .filter((entry): entry is { folder: string; tokens: Set<string> } => entry !== null)
  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      const similarity = jaccard(tokenSets[i]!.tokens, tokenSets[j]!.tokens)
      if (similarity > 0.4) {
        findings.push({ skill: tokenSets[i]!.folder, rule: 'C02', severity: 'warning', message: `trigger phrases overlap ${(similarity * 100).toFixed(0)}% with ${tokenSets[j]!.folder}; sharpen the "Use when" and "Do NOT use" clauses` })
      }
    }
  }
  for (const entry of deprecated) {
    if (!entry.name || !entry.message || !Array.isArray(entry.alternatives)) findings.push({ skill: '_deprecated.yaml', rule: 'C03', severity: 'error', message: `entry "${entry.name ?? '?'}" needs name, message and alternatives` })
    if (catalogNames.has(entry.name)) findings.push({ skill: '_deprecated.yaml', rule: 'C03', severity: 'error', message: `"${entry.name}" is deprecated but still exists in the catalog` })
    for (const alt of entry.alternatives ?? []) if (!catalogNames.has(alt)) findings.push({ skill: '_deprecated.yaml', rule: 'C03', severity: 'error', message: `alternative "${alt}" for "${entry.name}" does not exist` })
  }

  return findings
}

export function formatFindings(findings: Finding[], skillCount: number): string {
  const lines: string[] = []
  const bySkill = new Map<string, Finding[]>()
  for (const finding of findings) {
    const list = bySkill.get(finding.skill) ?? []
    list.push(finding)
    bySkill.set(finding.skill, list)
  }
  for (const [skill, list] of [...bySkill.entries()].sort()) {
    lines.push(`\n${skill}`)
    for (const finding of list) lines.push(`  ${finding.severity === 'error' ? 'ERROR' : 'warn '} ${finding.rule}  ${finding.message}`)
  }
  const errors = findings.filter((finding) => finding.severity === 'error').length
  const warnings = findings.length - errors
  lines.push(`\n${skillCount} skill(s) checked: ${errors} error(s), ${warnings} warning(s)`)
  return lines.join('\n')
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      'skills-dir': { type: 'string', default: 'skills' },
      'max-age': { type: 'string', default: '90' },
      'budget-error': { type: 'string', default: String(TOKEN_BUDGET.skillMdError) },
      'budget-warn': { type: 'string', default: String(TOKEN_BUDGET.skillMdWarn) },
    },
  })
  const skillsDir = resolve(values['skills-dir']!)
  const findings = await validateCatalog({
    skillsDir,
    only: positionals,
    maxAgeDays: Number(values['max-age']),
    budgetError: Number(values['budget-error']),
    budgetWarn: Number(values['budget-warn']),
  })
  const folders = await listSkillFolders(skillsDir)
  const count = positionals.length ? positionals.length : folders.length
  if (values.json) console.log(JSON.stringify({ skills: count, findings }, null, 2))
  else console.log(formatFindings(findings, count))
  process.exit(findings.some((finding) => finding.severity === 'error') ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
