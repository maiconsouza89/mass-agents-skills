import { readdir, stat } from 'node:fs/promises'
import { join, normalize, relative, resolve, sep } from 'node:path'

/** Removes anything that could escape a directory or break a filesystem. Never returns an empty string. */
export function sanitizeName(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '')
    .replace(/[\0:*?"<>|]/g, '')
    .replace(/\.{2,}/g, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
  return (cleaned || 'unnamed-skill').slice(0, 255)
}

/** True when `target` is `base` or lives underneath it after normalisation. */
export function isPathInside(base: string, target: string): boolean {
  const normalizedBase = normalize(resolve(base))
  const normalizedTarget = normalize(resolve(target))
  if (normalizedTarget === normalizedBase) return true
  const rel = relative(normalizedBase, normalizedTarget)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep)
}

export const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Files that are never part of an installable skill payload. */
export function isExcludedFromPayload(relativePath: string): boolean {
  const parts = relativePath.split('/')
  if (parts[0] === 'evals') return true
  if (parts.some((part) => part.startsWith('.'))) return true
  if (parts.at(-1) === 'Thumbs.db') return true
  return false
}

export interface WalkedFile {
  path: string
  absolutePath: string
  bytes: number
  executable: boolean
}

/** Recursively lists regular files under `dir`, as POSIX relative paths, sorted. */
export async function walkFiles(dir: string): Promise<WalkedFile[]> {
  const out: WalkedFile[] = []
  async function visit(current: string, prefix: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const abs = join(current, entry.name)
      if (entry.isDirectory()) await visit(abs, rel)
      else if (entry.isFile()) {
        const info = await stat(abs)
        out.push({ path: rel, absolutePath: abs, bytes: info.size, executable: (info.mode & 0o111) !== 0 })
      }
    }
  }
  await visit(dir, '')
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}
