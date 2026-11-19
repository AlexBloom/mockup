export type Pt = [number, number]

export type Mask = { data: Uint8Array; w: number; h: number }

/** Grows a binary mask by `r` pixels using a two-pass chamfer distance transform (round-ish, O(n)). */
export function dilate(mask: Mask, r: number): Mask {
  const { w, h, data } = mask
  const INF = 1e9
  const d = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = data[i] ? 0 : INF
  const A = 1
  const B = Math.SQRT2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let v = d[i]
      if (x > 0) v = Math.min(v, d[i - 1] + A)
      if (y > 0) {
        v = Math.min(v, d[i - w] + A)
        if (x > 0) v = Math.min(v, d[i - w - 1] + B)
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + B)
      }
      d[i] = v
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      let v = d[i]
      if (x < w - 1) v = Math.min(v, d[i + 1] + A)
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + A)
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + B)
        if (x > 0) v = Math.min(v, d[i + w - 1] + B)
      }
      d[i] = v
    }
  }
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = d[i] <= r ? 1 : 0
  return { data: out, w, h }
}

/** 8-connected component labels. Returns labels (0 = background) and component sizes indexed by label. */
export function components(mask: Mask) {
  const { w, h, data } = mask
  const labels = new Int32Array(w * h)
  const sizes: number[] = [0]
  const stack: number[] = []
  for (let i = 0; i < w * h; i++) {
    if (!data[i] || labels[i]) continue
    const label = sizes.length
    let size = 0
    stack.push(i)
    labels[i] = label
    while (stack.length) {
      const p = stack.pop()!
      size++
      const px = p % w
      const py = (p - px) / w
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx
          const ny = py + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const n = ny * w + nx
          if (data[n] && !labels[n]) {
            labels[n] = label
            stack.push(n)
          }
        }
      }
    }
    sizes.push(size)
  }
  return { labels, sizes }
}

/** Marching-squares outer boundary trace starting at the first filled pixel in scan order. Points are pixel corners. */
export function traceBoundary(mask: Mask): Pt[] {
  const { w, h, data } = mask
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? data[y * w + x] : 0)
  let start = -1
  for (let i = 0; i < w * h; i++) {
    if (data[i]) {
      start = i
      break
    }
  }
  if (start < 0) return []
  const sx = start % w
  const sy = (start - sx) / w
  let x = sx
  let y = sy
  let prev = -1
  const UP = 0
  const RIGHT = 1
  const DOWN = 2
  const LEFT = 3
  const out: Pt[] = []
  const limit = w * h * 4
  for (let steps = 0; steps < limit; steps++) {
    const state = (at(x - 1, y - 1) ? 1 : 0) | (at(x, y - 1) ? 2 : 0) | (at(x - 1, y) ? 4 : 0) | (at(x, y) ? 8 : 0)
    let dir: number
    switch (state) {
      case 1: dir = UP; break
      case 2: dir = RIGHT; break
      case 3: dir = RIGHT; break
      case 4: dir = LEFT; break
      case 5: dir = UP; break
      case 6: dir = prev === UP ? LEFT : RIGHT; break
      case 7: dir = RIGHT; break
      case 8: dir = DOWN; break
      case 9: dir = prev === RIGHT ? UP : DOWN; break
      case 10: dir = DOWN; break
      case 11: dir = DOWN; break
      case 12: dir = LEFT; break
      case 13: dir = UP; break
      case 14: dir = LEFT; break
      default: return out
    }
    if (dir !== prev) out.push([x, y])
    if (dir === UP) y--
    else if (dir === DOWN) y++
    else if (dir === LEFT) x--
    else x++
    prev = dir
    if (x === sx && y === sy) break
  }
  return out
}

export function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3) return pts
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Ramer-Douglas-Peucker on a closed polygon. */
export function simplify(points: Pt[], eps: number): Pt[] {
  if (points.length < 4) return points
  const rdp = (pts: Pt[]): Pt[] => {
    if (pts.length < 3) return pts
    const [ax, ay] = pts[0]
    const [bx, by] = pts[pts.length - 1]
    const len = Math.hypot(bx - ax, by - ay) || 1e-9
    let maxD = 0
    let idx = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD <= eps) return [pts[0], pts[pts.length - 1]]
    const left = rdp(pts.slice(0, idx + 1))
    const right = rdp(pts.slice(idx))
    return [...left.slice(0, -1), ...right]
  }
  const half = Math.floor(points.length / 2)
  const a = rdp(points.slice(0, half + 1))
  const b = rdp([...points.slice(half), points[0]])
  return [...a.slice(0, -1), ...b.slice(0, -1)]
}

/**
 * Die-cut contour for a design mask: dilate by the border, keep the main shape, and fall back to the convex hull when
 * the design has several separate parts (so nothing floats off the sticker).
 */
export function designContour(mask: Mask, border: number): Pt[] | null {
  const pad = Math.ceil(border) + 2
  const w = mask.w + pad * 2
  const h = mask.h + pad * 2
  const padded = new Uint8Array(w * h)
  let any = false
  for (let y = 0; y < mask.h; y++) {
    for (let x = 0; x < mask.w; x++) {
      if (mask.data[y * mask.w + x]) {
        padded[(y + pad) * w + x + pad] = 1
        any = true
      }
    }
  }
  if (!any) return null
  const grown = dilate({ data: padded, w, h }, border)
  const { labels, sizes } = components(grown)
  let largest = 1
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[largest]) largest = i
  const significant = sizes.filter((s, i) => i > 0 && s > sizes[largest] * 0.02).length
  let contour: Pt[]
  if (significant > 1) {
    const corners: Pt[] = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (!grown.data[i]) continue
        const edge = !grown.data[i - 1] || !grown.data[i + 1] || !grown.data[i - w] || !grown.data[i + w]
        if (edge) corners.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1])
      }
    }
    contour = convexHull(corners)
  } else {
    const only = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) only[i] = labels[i] === largest ? 1 : 0
    contour = simplify(traceBoundary({ data: only, w, h }), 0.6)
  }
  return contour.map(([x, y]) => [x - pad, y - pad] as Pt)
}
