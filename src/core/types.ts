export interface SkillSource {
  url: string
  ref: string
  license: string
}

export interface SkillRequires {
  skills?: string[]
  tools?: string[]
  mcp?: string[]
}

export interface SkillMetadata {
  owner: string
  version: string
  reviewed: string
  category: string
  tags: string[]
  requires?: SkillRequires
  source?: SkillSource
}

export interface SkillFrontmatter {
  name: string
  description: string
  license?: string
  compatibility?: string
  'allowed-tools'?: string
  metadata: SkillMetadata
}

export interface ParsedSkill {
  frontmatter: Record<string, unknown>
  body: string
  raw: string
}

export interface CategoryInfo {
  name: string
  description: string
  order: number
}

export type Categories = Record<string, CategoryInfo>

export interface DeprecatedSkill {
  name: string
  message: string
  alternatives: string[]
}

export interface RegistryFile {
  path: string
  sha256: string
  bytes: number
  executable: boolean
}

export interface RegistrySkill {
  name: string
  description: string
  category: string
  tags: string[]
  owner: string
  version: string
  reviewed: string
  license?: string
  compatibility?: string
  requires?: SkillRequires
  source?: SkillSource
  path: string
  files: RegistryFile[]
  contentHash: string
  tokens: { skillMd: number; total: number }
}

export interface SkillsRegistry {
  $schema?: string
  registryVersion: 1
  catalogVersion: string
  repo: string
  rawBase: string
  categories: Categories
  skills: RegistrySkill[]
  deprecated: DeprecatedSkill[]
}

export type InstallMethod = 'copy' | 'symlink'

export interface LockEntry {
  version: string
  contentHash: string
  method: InstallMethod
  agents: string[]
  installedAt: string
  updatedAt: string
}

export interface Lockfile {
  lockVersion: 1
  registry: { repo: string; ref: string }
  skills: Record<string, LockEntry>
}

export interface TriggerEvals {
  positive: string[]
  negative: Array<{ prompt: string; expect?: string }>
}
