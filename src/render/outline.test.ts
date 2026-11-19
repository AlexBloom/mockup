import { describe, expect, it } from 'vitest'
import { designContour, type Mask, type Pt, simplify, traceBoundary } from './outline'

function mask(w: number, h: number, inside: (x: number, y: number) => boolean): Mask {
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = inside(x + 0.5, y + 0.5) ? 1 : 0
  return { data, w, h }
}

function area(pts: Pt[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    a += x0 * y1 - x1 * y0
  }
  return Math.abs(a / 2)
}

describe('traceBoundary', () => {
  it('traces a filled square', () => {
    const pts = traceBoundary(mask(20, 20, (x, y) => x > 5 && x < 15 && y > 5 && y < 15))
    expect(area(pts)).toBeGreaterThan(80)
    expect(area(pts)).toBeLessThan(120)
  })
})

describe('simplify', () => {
  it('drops collinear points', () => {
    const line: Pt[] = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 3], [0, 3]]
    expect(simplify(line, 0.1).length).toBeLessThan(line.length)
  })
})

describe('designContour', () => {
  it('returns null for an empty design', () => {
    expect(designContour(mask(10, 10, () => false), 2)).toBeNull()
  })

  it('grows a disc by the border', () => {
    const r = 20
    const contour = designContour(mask(60, 60, (x, y) => (x - 30) ** 2 + (y - 30) ** 2 < r * r), 5)!
    const expected = Math.PI * (r + 5) ** 2
    expect(area(contour)).toBeGreaterThan(expected * 0.9)
    expect(area(contour)).toBeLessThan(expected * 1.1)
  })

  it('wraps separate parts in one hull so nothing floats off', () => {
    const twoDots = mask(80, 30, (x, y) => (x - 15) ** 2 + (y - 15) ** 2 < 64 || (x - 65) ** 2 + (y - 15) ** 2 < 64)
    const contour = designContour(twoDots, 2)!
    const xs = contour.map(([x]) => x)
    expect(Math.min(...xs)).toBeLessThan(8)
    expect(Math.max(...xs)).toBeGreaterThan(72)
  })
})
