import type { MockupItem, PrintZone, Transform } from '@/catalog/types'
import { hashString } from '@/lib/utils'

export type Background = { mode: 'transparent' } | { mode: 'color'; color: string }

export type ItemOverrides = {
  transforms?: Record<string, Transform>
  colors?: Record<string, string>
  background?: Background
  zones?: Record<string, boolean>
}

export type GlobalSettings = {
  /** Applied to every zone that has no per-item transform. Undefined means each zone keeps its own default. */
  transform?: Transform
  /** Keyed by color target id (body, trim, brim...), applied to any item with that target. */
  colors: Record<string, string>
  background: Background
}

export type Overrides = { global: GlobalSettings; items: Record<string, ItemOverrides> }

export const DEFAULT_GLOBAL: GlobalSettings = { colors: {}, background: { mode: 'transparent' } }

export function resolveTransform(item: MockupItem, zone: PrintZone, o: Overrides): Transform {
  return o.items[item.id]?.transforms?.[zone.id] ?? o.global.transform ?? zone.defaultTransform
}

export function resolveColors(item: MockupItem, o: Overrides): Record<string, string> {
  const own = o.items[item.id]?.colors ?? {}
  const out: Record<string, string> = {}
  for (const target of item.colorTargets) {
    out[target.id] = own[target.id] ?? o.global.colors[target.id] ?? target.default
  }
  return out
}

export function resolveBackground(item: MockupItem, o: Overrides): Background {
  return o.items[item.id]?.background ?? o.global.background
}

export function resolveZoneEnabled(item: MockupItem, zone: PrintZone, o: Overrides): boolean {
  return o.items[item.id]?.zones?.[zone.id] ?? !zone.optional
}

export type ResolvedItemState = {
  transforms: Record<string, Transform>
  enabledZones: Record<string, boolean>
  colors: Record<string, string>
  background: Background
}

export function resolveItem(item: MockupItem, o: Overrides): ResolvedItemState {
  const transforms: Record<string, Transform> = {}
  const enabledZones: Record<string, boolean> = {}
  for (const zone of item.printZones) {
    transforms[zone.id] = resolveTransform(item, zone, o)
    enabledZones[zone.id] = resolveZoneEnabled(item, zone, o)
  }
  return { transforms, enabledZones, colors: resolveColors(item, o), background: resolveBackground(item, o) }
}

/** Cache key for a rendered mockup. Same inputs, same key, same pixels. */
export function renderKey(item: MockupItem, designId: string | null, state: ResolvedItemState, extra = '') {
  return `${item.id}:${hashString(JSON.stringify([designId, state, extra]))}`
}

export function normalizeHex(input: string): string | null {
  let v = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(v)) v = v.split('').map((c) => c + c).join('')
  if (/^[0-9a-f]{8}$/.test(v)) v = v.slice(0, 6)
  return /^[0-9a-f]{6}$/.test(v) ? `#${v}` : null
}
