import { readFile } from 'node:fs/promises'
import type { Categories, CategoryInfo } from './types.ts'

export const CATEGORIES_FILE = '_categories.json'

export async function loadCategories(skillsDir: string): Promise<Categories> {
  const raw = await readFile(`${skillsDir}/${CATEGORIES_FILE}`, 'utf8')
  const parsed = JSON.parse(raw) as Record<string, Partial<CategoryInfo>>
  const categories: Categories = {}
  for (const [id, info] of Object.entries(parsed)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`category id "${id}" must be kebab-case`)
    if (!info.name) throw new Error(`category "${id}" is missing a name`)
    categories[id] = { name: info.name, description: info.description ?? '', order: info.order ?? 999 }
  }
  return categories
}

export function sortedCategoryIds(categories: Categories): string[] {
  return Object.keys(categories).sort((a, b) => {
    const diff = categories[a]!.order - categories[b]!.order
    return diff !== 0 ? diff : a.localeCompare(b)
  })
}
