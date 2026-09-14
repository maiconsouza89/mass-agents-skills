import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { contentHashOf, sha256 } from '../../core/hash.ts'
import type { RegistrySkill } from '../../core/types.ts'
import type { PayloadFile } from './adapters.ts'
import { CliError, exists, type CliContext } from './context.ts'
import type { SkillSource } from './registry.ts'

const CONCURRENCY = 4

/** Content-addressed store: ~/.cache/mass-skills/skills/<name>/<contentHash>/ */
export function storeDir(context: Pick<CliContext, 'cacheDir'>, skill: RegistrySkill): string {
  return join(context.cacheDir, 'skills', skill.name, skill.contentHash)
}

/**
 * Ensures the skill payload is present in the store, downloading and verifying every file if needed.
 * Returns the payload files read from the store.
 */
export async function materialize(context: CliContext, source: SkillSource, skill: RegistrySkill, onProgress?: (message: string) => void): Promise<PayloadFile[]> {
  const dir = storeDir(context, skill)
  const marker = join(dir, '.complete')
  if (await exists(marker)) return readPayload(dir, skill)

  const temp = `${dir}.tmp-${process.pid}-${Date.now()}`
  await rm(temp, { recursive: true, force: true })
  await mkdir(temp, { recursive: true })
  const queue = [...skill.files]
  const downloaded: Array<{ path: string; sha256: string }> = []
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const buffer = await source.readFile(skill, file.path)
      const digest = sha256(buffer)
      if (digest !== file.sha256) throw new CliError(`checksum mismatch for ${skill.name}/${file.path}`)
      const target = join(temp, file.path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, buffer)
      if (file.executable) await chmod(target, 0o755)
      downloaded.push({ path: file.path, sha256: digest })
      onProgress?.(`${skill.name}: ${file.path}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, skill.files.length) }, worker))
  const computed = contentHashOf(downloaded)
  if (computed !== skill.contentHash) {
    await rm(temp, { recursive: true, force: true })
    throw new CliError(`${skill.name}: content hash mismatch (expected ${skill.contentHash.slice(0, 12)}, got ${computed.slice(0, 12)}); the registry and the source are out of sync. Retry with --refresh or pin --ref.`)
  }
  await writeFile(join(temp, '.complete'), new Date().toISOString())
  await rm(dir, { recursive: true, force: true })
  await mkdir(dirname(dir), { recursive: true })
  await rename(temp, dir)
  return readPayload(dir, skill)
}

async function readPayload(dir: string, skill: RegistrySkill): Promise<PayloadFile[]> {
  const files: PayloadFile[] = []
  for (const file of skill.files) {
    files.push({ path: file.path, content: await readFile(join(dir, file.path)), executable: file.executable })
  }
  return files
}
