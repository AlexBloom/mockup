import { create } from 'zustand'
import type { Transform } from '@/catalog/types'
import { type Background, DEFAULT_GLOBAL, type ItemOverrides, type Overrides } from './resolve'

export type Design = {
  /** Content hash of the normalized pixels, so identical uploads share cache entries. */
  id: string
  name: string
  width: number
  height: number
  source: HTMLCanvasElement
  /** The file as uploaded, kept so processing options can be re-applied. */
  original: Blob
  removeWhite: boolean
}

type AppState = Overrides & {
  design: Design | null
  hydrated: boolean
  setDesign: (design: Design | null) => void
  setItemTransform: (itemId: string, zoneId: string, t: Transform) => void
  setItemColor: (itemId: string, targetId: string, hex: string) => void
  setItemBackground: (itemId: string, bg: Background) => void
  setZoneEnabled: (itemId: string, zoneId: string, enabled: boolean) => void
  /** Promote one item's transform, colors and background to global defaults and drop conflicting per-item overrides. */
  applyItemToAll: (resolved: { transform: Transform; colors: Record<string, string>; background: Background }) => void
  resetItem: (itemId: string) => void
  resetAll: () => void
  hydrate: (data: Partial<Overrides> & { design?: Design | null }) => void
}

function patchItem(items: Record<string, ItemOverrides>, itemId: string, fn: (o: ItemOverrides) => ItemOverrides) {
  return { ...items, [itemId]: fn(items[itemId] ?? {}) }
}

export const useApp = create<AppState>((set) => ({
  design: null,
  hydrated: false,
  global: DEFAULT_GLOBAL,
  items: {},

  setDesign: (design) => set({ design }),

  setItemTransform: (itemId, zoneId, t) =>
    set((s) => ({ items: patchItem(s.items, itemId, (o) => ({ ...o, transforms: { ...o.transforms, [zoneId]: t } })) })),

  setItemColor: (itemId, targetId, hex) =>
    set((s) => ({ items: patchItem(s.items, itemId, (o) => ({ ...o, colors: { ...o.colors, [targetId]: hex } })) })),

  setItemBackground: (itemId, bg) =>
    set((s) => ({ items: patchItem(s.items, itemId, (o) => ({ ...o, background: bg })) })),

  setZoneEnabled: (itemId, zoneId, enabled) =>
    set((s) => ({ items: patchItem(s.items, itemId, (o) => ({ ...o, zones: { ...o.zones, [zoneId]: enabled } })) })),

  applyItemToAll: (resolved) =>
    set((s) => {
      const items: Record<string, ItemOverrides> = {}
      for (const [id, o] of Object.entries(s.items)) {
        const colors = { ...o.colors }
        for (const key of Object.keys(resolved.colors)) delete colors[key]
        items[id] = { zones: o.zones, colors }
      }
      return {
        items,
        global: {
          transform: resolved.transform,
          colors: { ...s.global.colors, ...resolved.colors },
          background: resolved.background,
        },
      }
    }),

  resetItem: (itemId) =>
    set((s) => {
      const items = { ...s.items }
      delete items[itemId]
      return { items }
    }),

  resetAll: () => set({ items: {}, global: DEFAULT_GLOBAL }),

  hydrate: (data) =>
    set((s) => ({
      hydrated: true,
      global: data.global ?? s.global,
      items: data.items ?? s.items,
      design: data.design === undefined ? s.design : data.design,
    })),
}))
