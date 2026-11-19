import { describe, expect, it } from 'vitest'
import { CATALOG_BY_ID } from '@/catalog'
import { DEFAULT_GLOBAL, normalizeHex, type Overrides, renderKey, resolveItem } from './resolve'

const tee = CATALOG_BY_ID.get('crew-tee')!
const sleeve = CATALOG_BY_ID.get('vinyl-sleeve')!
const base: Overrides = { global: DEFAULT_GLOBAL, items: {} }

describe('override cascade', () => {
  it('falls back to zone defaults and item colors', () => {
    const s = resolveItem(tee, base)
    expect(s.transforms.front).toEqual(tee.printZones.find((z) => z.id === 'front')!.defaultTransform)
    expect(s.colors.body).toBe(tee.colorTargets.find((c) => c.id === 'body')!.default)
    expect(s.background).toEqual({ mode: 'transparent' })
  })

  it('prefers item overrides over global, and global over defaults', () => {
    const globalT = { x: 0.1, y: 0.1, scale: 0.5, rotation: 0 }
    const itemT = { x: -0.2, y: 0, scale: 1, rotation: 15 }
    const o: Overrides = {
      global: { transform: globalT, colors: { body: '#111111' }, background: { mode: 'color', color: '#ffffff' } },
      items: { 'crew-tee': { transforms: { front: itemT }, colors: { body: '#ff0000' } } },
    }
    const s = resolveItem(tee, o)
    expect(s.transforms.front).toEqual(itemT)
    expect(s.transforms.back).toEqual(globalT)
    expect(s.colors.body).toBe('#ff0000')
    expect(s.background).toEqual({ mode: 'color', color: '#ffffff' })
  })

  it('keeps optional zones off unless enabled', () => {
    const label = sleeve.printZones.find((z) => z.optional)!
    expect(resolveItem(sleeve, base).enabledZones[label.id]).toBe(false)
    const on: Overrides = { ...base, items: { [sleeve.id]: { zones: { [label.id]: true } } } }
    expect(resolveItem(sleeve, on).enabledZones[label.id]).toBe(true)
  })
})

describe('renderKey', () => {
  it('is stable for equal inputs and changes with any input', () => {
    const s = resolveItem(tee, base)
    expect(renderKey(tee, 'd1', s)).toBe(renderKey(tee, 'd1', resolveItem(tee, base)))
    expect(renderKey(tee, 'd2', s)).not.toBe(renderKey(tee, 'd1', s))
    expect(renderKey(tee, 'd1', { ...s, colors: { body: '#000000' } })).not.toBe(renderKey(tee, 'd1', s))
  })
})

describe('normalizeHex', () => {
  it.each([
    ['#FFAA00', '#ffaa00'],
    ['ffaa00', '#ffaa00'],
    ['#fa0', '#ffaa00'],
    ['  abc ', '#aabbcc'],
    ['#11223344', '#112233'],
  ])('%s -> %s', (input, out) => expect(normalizeHex(input)).toBe(out))

  it.each(['', '#12', '#12345', 'red', '#gggggg'])('rejects %j', (input) => expect(normalizeHex(input)).toBeNull())
})
