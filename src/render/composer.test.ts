import { describe, expect, it } from 'vitest'
import { computePlacement, zoneCanvasSize } from './composer'

const t = (x = 0, y = 0, scale = 1, rotation = 0) => ({ x, y, scale, rotation })

describe('computePlacement', () => {
  it('contain-fits a wide design into a square box at scale 1', () => {
    const p = computePlacement(400, 200, 100, 100, t())
    expect(p).toEqual({ cx: 50, cy: 50, w: 100, h: 50, rotation: 0 })
  })

  it('contain-fits a tall design by height', () => {
    const p = computePlacement(100, 400, 200, 100, t())
    expect(p.h).toBe(100)
    expect(p.w).toBe(25)
  })

  it('scales relative to the contain fit', () => {
    const p = computePlacement(100, 100, 200, 200, t(0, 0, 0.5))
    expect(p.w).toBe(100)
    expect(p.h).toBe(100)
  })

  it('moves x right and y up as fractions of the box', () => {
    const p = computePlacement(100, 100, 200, 100, t(0.25, 0.25))
    expect(p.cx).toBe(150)
    expect(p.cy).toBe(25)
  })

  it('converts rotation to radians', () => {
    expect(computePlacement(1, 1, 1, 1, t(0, 0, 1, 90)).rotation).toBeCloseTo(Math.PI / 2)
  })
})

describe('zoneCanvasSize', () => {
  it('puts the long edge on the longer side', () => {
    expect(zoneCanvasSize(2, 1024)).toEqual({ w: 1024, h: 512 })
    expect(zoneCanvasSize(0.5, 1024)).toEqual({ w: 512, h: 1024 })
  })

  it('never collapses extreme aspects to zero', () => {
    expect(zoneCanvasSize(1000, 1024).h).toBeGreaterThanOrEqual(4)
  })
})
