import { FLEECE, TOPS } from './items/apparel'
import { DRINKWARE } from './items/drinkware'
import { BAGS, HOME, PACKAGING, SCREENS } from './items/goods'
import { HEADWEAR } from './items/headwear'
import { PATCHES } from './items/patches'
import { MUSIC, PRINT, STICKERS } from './items/print'
import type { Category, MockupItem } from './types'

export const CATALOG: MockupItem[] = [
  ...TOPS,
  ...FLEECE,
  ...HEADWEAR,
  ...PATCHES,
  ...DRINKWARE,
  ...STICKERS,
  ...PRINT,
  ...MUSIC,
  ...BAGS,
  ...HOME,
  ...PACKAGING,
  ...SCREENS,
]

export const CATALOG_BY_ID = new Map(CATALOG.map((i) => [i.id, i]))

export const CATEGORIES: Category[] = [...new Set(CATALOG.map((i) => i.category))]

export function searchCatalog(query: string, category: Category | 'all'): MockupItem[] {
  const q = query.trim().toLowerCase()
  return CATALOG.filter((i) => {
    if (category !== 'all' && i.category !== category) return false
    if (!q) return true
    return i.name.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q)) || i.category.includes(q)
  })
}
