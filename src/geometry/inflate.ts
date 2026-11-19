import * as THREE from 'three'
import type { Pt } from './kit'

export type HeightFn = (x: number, y: number) => number

export type InflateOptions = {
  /** Peak bulge at the center of the shape. */
  height: number
  /** Distance from the edge over which the bulge reaches full height. */
  falloff: number
  /** Extra deterministic surface detail (folds), already scaled by the caller. */
  wrinkle?: HeightFn
  /** Surface this shape sits on (pockets sit on garment bodies). */
  base?: HeightFn
  /** Back bulge relative to the front. 0 makes a flat-backed shape. */
  back?: number
  segments?: number
  maskRes?: number
}

export function pointInPolygon(x: number, y: number, pts: Pt[]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function distanceToPolygon(x: number, y: number, pts: Pt[]) {
  let best = Infinity
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j]
    const [bx, by] = pts[i]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy || 1e-9
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
    if (d < best) best = d
  }
  return best
}

export function bounds(pts: Pt[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/** Circular profile: steep at the edge, flat on top, like stuffed fabric. */
function bulge(d: number, falloff: number) {
  const t = Math.min(1, d / falloff)
  return Math.sqrt(1 - (1 - t) * (1 - t))
}

export function heightField(pts: Pt[], opts: InflateOptions): HeightFn {
  return (x, y) => {
    const base = opts.base?.(x, y) ?? 0
    if (!pointInPolygon(x, y, pts)) return base
    const e = bulge(distanceToPolygon(x, y, pts), opts.falloff)
    return base + opts.height * e + (opts.wrinkle?.(x, y) ?? 0) * e
  }
}

const maskCache = new Map<string, THREE.DataTexture>()

/** Anti-aliased coverage mask of the outline over its bounds, used as an alpha map so edges stay crisp at any grid density. */
export function outlineMask(pts: Pt[], res = 512): THREE.DataTexture {
  const key = `${res}:${pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(';')}`
  const hit = maskCache.get(key)
  if (hit) return hit
  const b = bounds(pts)
  const pad = Math.max(b.w, b.h) * 0.02
  const minX = b.minX - pad
  const minY = b.minY - pad
  const bw = b.w + pad * 2
  const bh = b.h + pad * 2
  const rw = bw >= bh ? res : Math.max(8, Math.round((res * bw) / bh))
  const rh = bh >= bw ? res : Math.max(8, Math.round((res * bh) / bw))
  const cover = new Float32Array(rw * rh)
  const SUB = 4
  for (let py = 0; py < rh; py++) {
    for (let s = 0; s < SUB; s++) {
      const yy = minY + ((py + (s + 0.5) / SUB) / rh) * bh
      const xs: number[] = []
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]
        const [xj, yj] = pts[j]
        if (yi > yy !== yj > yy) xs.push(((xj - xi) * (yy - yi)) / (yj - yi) + xi)
      }
      xs.sort((a, c) => a - c)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = ((xs[k] - minX) / bw) * rw
        const c = ((xs[k + 1] - minX) / bw) * rw
        const ia = Math.floor(a)
        const ic = Math.floor(c)
        const row = py * rw
        if (ia === ic) {
          if (ia >= 0 && ia < rw) cover[row + ia] += (c - a) / SUB
          continue
        }
        if (ia >= 0 && ia < rw) cover[row + ia] += (ia + 1 - a) / SUB
        for (let x = Math.max(0, ia + 1); x < Math.min(rw, ic); x++) cover[row + x] += 1 / SUB
        if (ic >= 0 && ic < rw) cover[row + ic] += (c - ic) / SUB
      }
    }
  }
  const data = new Uint8Array(rw * rh * 4)
  for (let i = 0; i < rw * rh; i++) {
    const v = Math.round(Math.min(1, cover[i]) * 255)
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, rw, rh, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  tex.userData.shared = true
  tex.userData.bounds = { minX, minY, bw, bh }
  maskCache.set(key, tex)
  return tex
}

export type InflatedSurface = {
  front: THREE.BufferGeometry
  back: THREE.BufferGeometry
  mask: THREE.DataTexture
  height: HeightFn
}

/** Front and back grids clipped by the outline mask. Front and back meet at the outline, so the shape is closed from any angle. */
export function inflate(pts: Pt[], opts: InflateOptions): InflatedSurface {
  const mask = outlineMask(pts, opts.maskRes ?? 512)
  const { minX, minY, bw, bh } = mask.userData.bounds as { minX: number; minY: number; bw: number; bh: number }
  const segs = opts.segments ?? 96
  const sx = bw >= bh ? segs : Math.max(4, Math.round((segs * bw) / bh))
  const sy = bh >= bw ? segs : Math.max(4, Math.round((segs * bh) / bw))
  const height = heightField(pts, opts)
  const backScale = opts.back ?? 1
  const base = opts.base
  const make = (sign: 1 | -1) => {
    const geo = new THREE.PlaneGeometry(bw, bh, sx, sy)
    geo.translate(minX + bw / 2, minY + bh / 2, 0)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const b = base?.(x, y) ?? 0
      const h = height(x, y) - b
      pos.setZ(i, sign > 0 ? b + h : b - h * backScale)
    }
    if (sign < 0) {
      const index = geo.index!
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i + 1)
        index.setX(i + 1, index.getX(i + 2))
        index.setX(i + 2, a)
      }
    }
    geo.computeVertexNormals()
    return geo
  }
  return { front: make(1), back: make(-1), mask, height }
}

/** Applies the outline mask to a mesh so only the inside of the shape renders. */
export function clipToMask(mesh: THREE.Mesh, mask: THREE.Texture) {
  const mat = mesh.material as THREE.MeshStandardMaterial
  mat.alphaMap = mask
  mat.alphaTest = 0.5
  mat.alphaToCoverage = true
  mat.side = THREE.DoubleSide
  return mesh
}

/** Zone overlay that rides on a height field. */
export function zoneOnSurface(w: number, h: number, cx: number, cy: number, height: HeightFn, offset = 0.004, segs = 40) {
  const geo = new THREE.PlaneGeometry(w, h, segs, segs)
  geo.translate(cx, cy, 0)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, height(pos.getX(i), pos.getY(i)) + offset)
  geo.computeVertexNormals()
  return geo
}

/** Back-facing version of `zoneOnSurface`: sits on the back of the shape and reads correctly from behind. */
export function zoneOnBack(w: number, h: number, cx: number, cy: number, depth: HeightFn, offset = 0.004, segs = 40) {
  const geo = new THREE.PlaneGeometry(w, h, segs, segs)
  geo.translate(-cx, cy, 0)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, depth(-pos.getX(i), pos.getY(i)) + offset)
  geo.rotateY(Math.PI)
  geo.computeVertexNormals()
  return geo
}

/** Deterministic cloth folds: a few directional ripples, no randomness. */
export function folds(amplitude: number, waves: [kx: number, ky: number, phase: number][]): HeightFn {
  return (x, y) => {
    let v = 0
    for (const [kx, ky, p] of waves) v += Math.sin(kx * x + ky * y + p)
    return (v / waves.length) * amplitude
  }
}
