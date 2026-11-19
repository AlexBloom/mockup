import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { BUILDERS } from '@/geometry'
import { buildItemObject, createZoneSurfaces } from '@/render/scene'
import { DEFAULT_GLOBAL, normalizeHex, resolveItem } from '@/state/resolve'
import { CATALOG, CATALOG_BY_ID, searchCatalog } from '.'
import type { MockupItem } from './types'

function build(item: MockupItem) {
  const state = resolveItem(item, { global: DEFAULT_GLOBAL, items: {} })
  const zones = createZoneSurfaces(item, null, state, 256)
  return buildItemObject(item, { item, colors: state.colors, zones })
}

function geometrySignature(root: THREE.Object3D) {
  let sum = 0
  let count = 0
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const pos = obj.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i += 7) sum += pos.getX(i) * 3 + pos.getY(i) * 5 + pos.getZ(i) * 7
    count += pos.count
  })
  return `${count}:${sum.toFixed(6)}`
}

describe('catalog schema', () => {
  it('has broad coverage', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(100)
  })

  it('has unique ids', () => {
    expect(CATALOG_BY_ID.size).toBe(CATALOG.length)
  })

  it.each(CATALOG.map((i) => [i.id, i] as const))('%s is well formed', (_, item) => {
    if (item.geometry.kind === 'procedural') expect(BUILDERS[item.geometry.builder]).toBeTypeOf('function')
    expect(item.printZones.length).toBeGreaterThan(0)
    expect(new Set(item.printZones.map((z) => z.id)).size).toBe(item.printZones.length)
    for (const z of item.printZones) {
      expect(z.aspect).toBeGreaterThan(0)
      const [u0, v0, u1, v1] = z.uvRect
      expect(u1).toBeGreaterThan(u0)
      expect(v1).toBeGreaterThan(v0)
      expect(z.defaultTransform.scale).toBeGreaterThan(0)
    }
    for (const c of item.colorTargets) expect(normalizeHex(c.default)).toBe(c.default.toLowerCase())
    expect(item.cameras.views.some((v) => v.id === item.cameras.thumb.id)).toBe(true)
  })
})

describe('procedural builders', () => {
  it.each(CATALOG.filter((i) => i.geometry.kind === 'procedural').map((i) => [i.id, i] as const))(
    '%s builds every zone and color target',
    (_, item) => {
      const root = build(item)
      const zones = new Set<string>()
      const colors = new Set<string>()
      let meshes = 0
      root.traverse((obj) => {
        if (obj.userData.zoneId) zones.add(obj.userData.zoneId)
        if (obj.userData.colorTarget) colors.add(obj.userData.colorTarget)
        if (obj instanceof THREE.Mesh) {
          meshes++
          const pos = obj.geometry.getAttribute('position')
          for (let i = 0; i < pos.count; i += 13) expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true)
        }
      })
      expect(meshes).toBeGreaterThan(0)
      for (const z of item.printZones) expect(zones, `zone ${z.id}`).toContain(z.id)
      for (const c of item.colorTargets) expect(colors, `color ${c.id}`).toContain(c.id)

      const box = new THREE.Box3().setFromObject(root)
      expect(box.isEmpty()).toBe(false)
      expect(box.getSize(new THREE.Vector3()).length()).toBeGreaterThan(0.05)
    },
  )

  it('builds identical geometry on every run', () => {
    for (const id of ['crew-tee', 'structured-cap', 'mug-11oz', 'die-cut-sticker', 'flag', 'tote-bag']) {
      const item = CATALOG_BY_ID.get(id)!
      expect(geometrySignature(build(item))).toBe(geometrySignature(build(item)))
    }
  })
})

describe('searchCatalog', () => {
  it('matches names, tags and categories', () => {
    expect(searchCatalog('hoodie', 'all').map((i) => i.id)).toContain('zip-hoodie')
    expect(searchCatalog('', 'headwear').every((i) => i.category === 'headwear')).toBe(true)
    expect(searchCatalog('mug', 'stickers')).toHaveLength(0)
  })
})
