/**
 * Turns the YAML front matter of DESIGN.md into CSS custom properties, so the design file stays
 * the single source of truth for the site's colours, type scale, radii and spacing.
 */
import { parse as parseYaml } from 'yaml'

interface TypographyToken {
  fontFamily?: string
  fontSize?: string
  fontWeight?: number | string
  lineHeight?: number | string
  letterSpacing?: string | number
}

interface DesignTokens {
  colors?: Record<string, string>
  typography?: Record<string, TypographyToken>
  rounded?: Record<string, string>
  spacing?: Record<string, string>
}

const FONT_SUBSTITUTES: Record<string, string> = {
  'Linear Display': "'Inter', 'SF Pro Display', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
  'Linear Text': "'Inter', 'SF Pro Text', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
  'Linear Mono': "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
}

export function parseDesignTokens(designMd: string): DesignTokens {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(designMd)
  if (!match) throw new Error('DESIGN.md has no YAML front matter')
  return parseYaml(match[1]!) as DesignTokens
}

export function tokensToCss(tokens: DesignTokens): string {
  const lines: string[] = [':root {']
  for (const [key, value] of Object.entries(tokens.colors ?? {})) lines.push(`  --color-${key}: ${value};`)
  for (const [key, value] of Object.entries(tokens.rounded ?? {})) lines.push(`  --radius-${key}: ${value};`)
  for (const [key, value] of Object.entries(tokens.spacing ?? {})) lines.push(`  --space-${key}: ${value};`)
  const families = new Map<string, string>()
  for (const [key, value] of Object.entries(tokens.typography ?? {})) {
    const family = value.fontFamily ?? 'Linear Text'
    const stack = FONT_SUBSTITUTES[family] ?? `'${family}', system-ui, sans-serif`
    families.set(family, stack)
    lines.push(`  --type-${key}-family: ${stack};`)
    if (value.fontSize) lines.push(`  --type-${key}-size: ${value.fontSize};`)
    if (value.fontWeight !== undefined) lines.push(`  --type-${key}-weight: ${value.fontWeight};`)
    if (value.lineHeight !== undefined) lines.push(`  --type-${key}-lh: ${value.lineHeight};`)
    if (value.letterSpacing !== undefined) lines.push(`  --type-${key}-ls: ${typeof value.letterSpacing === 'number' ? `${value.letterSpacing}px` : value.letterSpacing};`)
  }
  for (const [family, stack] of families) lines.push(`  --font-${family.toLowerCase().replace(/\s+/g, '-')}: ${stack};`)
  lines.push('}')
  return `${lines.join('\n')}\n`
}
