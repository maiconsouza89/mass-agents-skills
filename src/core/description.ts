/**
 * The description formula every skill must follow:
 *   [What it does]. Use when [triggers]. Do NOT use for [negatives].
 * Shared by the validator, the trigger evaluator and the site so they never disagree.
 */
export interface DescriptionParts {
  what: string
  useWhen: string
  doNotUse: string
}

const FORMULA = /^(?<what>[\s\S]{20,}?)\bUse when\b(?<useWhen>[\s\S]+?)\bDo NOT use\b(?<doNotUse>[\s\S]*)$/

export function parseDescription(description: string): DescriptionParts | null {
  const match = FORMULA.exec(description.trim())
  if (!match?.groups) return null
  return {
    what: match.groups['what']!.trim(),
    useWhen: match.groups['useWhen']!.trim(),
    doNotUse: match.groups['doNotUse']!.trim(),
  }
}

/** Quoted phrases inside the "Use when" clause, e.g. "review this PR". */
export function extractTriggerPhrases(useWhen: string): string[] {
  const phrases: string[] = []
  const pattern = /"([^"]{3,})"/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(useWhen)) !== null) {
    phrases.push(match[1]!.trim())
  }
  return phrases
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'be', 'this', 'that',
  'it', 'as', 'at', 'by', 'from', 'my', 'our', 'your', 'you', 'i', 'we', 'me', 'can', 'do', 'does', 'not',
  'use', 'when', 'user', 'says', 'asks', 'please', 'some', 'into', 'about', 'up', 'out', 'so', 'if', 'then',
  'than', 'too', 'very', 'just', 'also', 'how', 'what', 'which', 'like', 'should', 'before', 'after',
  'while', 'have', 'has', 'had', 'its', 'their', 'them', 'they', 'there', 'here', 'via', 'one', 'two',
])

/** Very light stemmer: strips common English suffixes so "reviewing" and "review" collide. */
export function stem(word: string): string {
  if (word.length <= 4) return word
  return word
    .replace(/(ations|ation|ities|ity|ness|ments|ment)$/, '')
    .replace(/(ings|ing|ies|ers|ied|ed|es|er|ly|s|y)$/, '')
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`'".,;:!?()[\]{}<>/\\|*_#=+-]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem)
    .filter((word) => word.length > 1)
}

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size === 0 && setB.size === 0) return 0
  let intersection = 0
  for (const item of setA) if (setB.has(item)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** Token set that represents what a skill "listens for": name, trigger phrases and the Use-when clause. */
export function triggerTokens(name: string, useWhen: string): Set<string> {
  const phrases = extractTriggerPhrases(useWhen)
  const tokens = new Set<string>()
  for (const token of tokenize(name.replace(/^mass-/, '').replace(/-/g, ' '))) tokens.add(token)
  for (const phrase of phrases) for (const token of tokenize(phrase)) tokens.add(token)
  for (const token of tokenize(useWhen)) tokens.add(token)
  return tokens
}
