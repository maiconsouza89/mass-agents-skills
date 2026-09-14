#!/usr/bin/env node
/**
 * Offline trigger evaluation. No LLM calls: each prompt from evals/triggers.yaml is scored
 * against every skill description with weighted token overlap, and the best match is the
 * predicted skill. Reports precision, recall and F1 per skill and explains every miss.
 *
 *   node tools/eval-triggers.ts [--threshold 1] [--min-f1 0.6] [--json] [--strict]
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { extractTriggerPhrases, parseDescription, tokenize } from '../src/core/description.ts'
import { listSkillFolders, loadGlobalNegatives, loadSkill, loadTriggerEvals } from '../src/core/skill-loader.ts'
import type { SkillMetadata } from '../src/core/types.ts'

interface Scorer {
  name: string
  weights: Map<string, number>
  phrases: string[]
}

interface Case {
  prompt: string
  from: string
  expected: string | null
}

export interface SkillScore {
  skill: string
  tp: number
  fp: number
  fn: number
  precision: number
  recall: number
  f1: number
}

export interface Miss {
  prompt: string
  from: string
  expected: string | null
  predicted: string | null
  score: number
}

export interface EvalReport {
  threshold: number
  scores: SkillScore[]
  misses: Miss[]
  cases: number
}

export function buildScorer(name: string, description: string, tags: string[]): Scorer {
  const weights = new Map<string, number>()
  const add = (tokens: string[], weight: number) => {
    for (const token of tokens) weights.set(token, Math.max(weights.get(token) ?? 0, weight))
  }
  const parts = parseDescription(description)
  const phrases: string[] = []
  add(tokenize(name.replace(/^mass-/, '').replace(/-/g, ' ')), 2)
  if (parts) {
    for (const phrase of extractTriggerPhrases(parts.useWhen)) {
      phrases.push(tokenize(phrase).join(' '))
      add(tokenize(phrase), 2.5)
    }
    add(tokenize(parts.useWhen), 2)
    add(tokenize(parts.what), 1)
    // Words that only appear in the "Do NOT use" clause push the score down: that clause exists to hand
    // prompts to a neighbouring skill, so matching it is evidence against this skill.
    for (const token of tokenize(parts.doNotUse)) if (!weights.has(token)) weights.set(token, -1)
  } else {
    add(tokenize(description), 1)
  }
  add(tokenize(tags.join(' ')), 1.5)
  return { name, weights, phrases: phrases.filter((phrase) => phrase.length > 0) }
}

export function scorePrompt(prompt: string, scorer: Scorer): number {
  const tokens = tokenize(prompt)
  if (tokens.length === 0) return 0
  const unique = [...new Set(tokens)]
  let sum = 0
  let matched = 0
  for (const token of unique) {
    const weight = scorer.weights.get(token) ?? 0
    sum += weight
    if (weight > 0) matched++
  }
  const joined = unique.join(' ')
  const phraseHit = scorer.phrases.some((phrase) => joined.includes(phrase) || tokens.join(' ').includes(phrase))
  if (phraseHit) sum += 3
  // A single shared word is not a trigger: require two positive matches or a whole trigger phrase.
  if (matched < 2 && !phraseHit) return 0
  return sum / Math.sqrt(unique.length)
}

export function predict(prompt: string, scorers: Scorer[], threshold: number): { skill: string | null; score: number } {
  let best: { skill: string | null; score: number } = { skill: null, score: 0 }
  for (const scorer of scorers) {
    const score = scorePrompt(prompt, scorer)
    if (score > best.score) best = { skill: scorer.name, score }
  }
  return best.score >= threshold ? best : { skill: null, score: best.score }
}

export function evaluate(scorers: Scorer[], cases: Case[], threshold: number): EvalReport {
  const counters = new Map<string, { tp: number; fp: number; fn: number }>()
  for (const scorer of scorers) counters.set(scorer.name, { tp: 0, fp: 0, fn: 0 })
  const misses: Miss[] = []
  for (const item of cases) {
    const { skill: predicted, score } = predict(item.prompt, scorers, threshold)
    if (predicted === item.expected) {
      if (predicted) counters.get(predicted)!.tp++
      continue
    }
    if (item.expected) counters.get(item.expected)!.fn++
    if (predicted) counters.get(predicted)!.fp++
    misses.push({ prompt: item.prompt, from: item.from, expected: item.expected, predicted, score: Number(score.toFixed(2)) })
  }
  const scores: SkillScore[] = [...counters.entries()].map(([skill, c]) => {
    const precision = c.tp + c.fp === 0 ? 1 : c.tp / (c.tp + c.fp)
    const recall = c.tp + c.fn === 0 ? 1 : c.tp / (c.tp + c.fn)
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
    return { skill, ...c, precision, recall, f1 }
  })
  return { threshold, scores, misses, cases: cases.length }
}

export async function runEvals(skillsDir: string, threshold: number): Promise<EvalReport> {
  const scorers: Scorer[] = []
  const cases: Case[] = []
  for (const folder of await listSkillFolders(skillsDir)) {
    const skill = await loadSkill(skillsDir, folder)
    const metadata = (skill.frontmatter['metadata'] ?? {}) as Partial<SkillMetadata>
    scorers.push(buildScorer(folder, String(skill.frontmatter['description'] ?? ''), metadata.tags ?? []))
    const evals = await loadTriggerEvals(skill.dir)
    if (!evals) continue
    for (const prompt of evals.positive) cases.push({ prompt, from: folder, expected: folder })
    for (const item of evals.negative) cases.push({ prompt: item.prompt, from: folder, expected: item.expect ?? null })
  }
  for (const prompt of await loadGlobalNegatives(skillsDir)) cases.push({ prompt, from: '_evals/negatives.yaml', expected: null })
  return evaluate(scorers, cases, threshold)
}

export function formatReport(report: EvalReport): string {
  const lines: string[] = []
  lines.push(`threshold ${report.threshold}  cases ${report.cases}`, '')
  lines.push('skill                              precision  recall    f1   tp fp fn')
  for (const score of [...report.scores].sort((a, b) => a.f1 - b.f1 || a.skill.localeCompare(b.skill))) {
    lines.push(
      `${score.skill.padEnd(34)} ${score.precision.toFixed(2).padStart(9)} ${score.recall.toFixed(2).padStart(7)} ${score.f1.toFixed(2).padStart(5)}   ${String(score.tp).padStart(2)} ${String(score.fp).padStart(2)} ${String(score.fn).padStart(2)}`,
    )
  }
  if (report.misses.length) {
    lines.push('', 'misses:')
    for (const miss of report.misses) {
      lines.push(`  "${miss.prompt}"`, `     from ${miss.from}: expected ${miss.expected ?? 'none'}, predicted ${miss.predicted ?? 'none'} (score ${miss.score})`)
    }
  }
  const macroF1 = report.scores.reduce((sum, score) => sum + score.f1, 0) / Math.max(report.scores.length, 1)
  lines.push('', `macro F1 ${macroF1.toFixed(3)}  misses ${report.misses.length}/${report.cases}`)
  return lines.join('\n')
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      threshold: { type: 'string', default: '1' },
      'min-f1': { type: 'string', default: '0.6' },
      'skills-dir': { type: 'string', default: 'skills' },
      json: { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
    },
  })
  const report = await runEvals(resolve(values['skills-dir']!), Number(values.threshold))
  if (values.json) console.log(JSON.stringify(report, null, 2))
  else console.log(formatReport(report))
  const minF1 = Number(values['min-f1'])
  const failing = report.scores.filter((score) => score.f1 < minF1)
  if (failing.length) {
    const message = `${failing.length} skill(s) below F1 ${minF1}: ${failing.map((score) => score.skill).join(', ')}`
    if (values.strict) {
      console.error(message)
      process.exit(1)
    }
    console.warn(`warning: ${message}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
