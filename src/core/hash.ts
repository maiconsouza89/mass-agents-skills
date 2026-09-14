import { createHash } from 'node:crypto'
import type { RegistryFile } from './types.ts'

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Hash of hashes: stable across platforms, cheap to recompute from a file list.
 * Input order does not matter because entries are sorted by path first.
 */
export function contentHashOf(files: Array<Pick<RegistryFile, 'path' | 'sha256'>>): string {
  const lines = files
    .map((file) => `${file.path}:${file.sha256}`)
    .sort()
    .join('\n')
  return sha256(lines)
}
