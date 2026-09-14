import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Lockfile } from '../../core/types.ts'
import { CliError, exists, type CliContext } from './context.ts'

export const LOCKFILE_NAME = '.mass-skills.lock.json'

export function lockfilePath(context: Pick<CliContext, 'global' | 'home' | 'projectRoot'>): string {
  return context.global ? join(context.home, LOCKFILE_NAME) : join(context.projectRoot, LOCKFILE_NAME)
}

export function emptyLockfile(repo: string, ref: string): Lockfile {
  return { lockVersion: 1, registry: { repo, ref }, skills: {} }
}

export async function readLockfile(path: string): Promise<Lockfile | null> {
  if (!(await exists(path))) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    throw new CliError(`${path} is not valid JSON (${(error as Error).message}); fix or delete it`)
  }
  const lock = parsed as Partial<Lockfile>
  if (lock.lockVersion !== 1 || typeof lock.skills !== 'object' || lock.skills === null) {
    throw new CliError(`${path} has an unsupported format; delete it and reinstall`)
  }
  return { lockVersion: 1, registry: lock.registry ?? { repo: '', ref: 'main' }, skills: lock.skills }
}

/** Atomic write: temp file in the same directory, then rename. */
export async function writeLockfile(path: string, lock: Lockfile): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const sorted: Lockfile = { ...lock, skills: Object.fromEntries(Object.entries(lock.skills).sort(([a], [b]) => (a < b ? -1 : 1))) }
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(sorted, null, 2)}\n`)
  await rename(temp, path)
}
