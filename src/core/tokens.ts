/** Rough token estimate: one token per four bytes of UTF-8 text. Good enough for budgets. */
export function estimateTokens(text: string | Buffer): number {
  const bytes = typeof text === 'string' ? Buffer.byteLength(text, 'utf8') : text.length
  return Math.ceil(bytes / 4)
}

export const TOKEN_BUDGET = {
  skillMdError: 6000,
  skillMdWarn: 3000,
  totalWarn: 20000,
} as const
