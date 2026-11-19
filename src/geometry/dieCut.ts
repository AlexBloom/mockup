import * as THREE from 'three'
import type { BuilderParams } from '@/catalog/types'
import { designContour, type Mask } from '@/render/outline'
import type { BuildContext } from '@/render/types'
import { at, chaikin, extrudeShape, fixed, getZone, group, num, part, type Pt, roundedRectShape, shapeFromPoints, shapeOverlay, str, tube, zoneMesh } from './kit'
import { bounds } from './inflate'

const MASK_SIZE = 160

function maskFromCanvas(canvas: HTMLCanvasElement): Mask {
  const scale = MASK_SIZE / Math.max(canvas.width, canvas.height)
  const w = Math.max(1, Math.round(canvas.width * scale))
  const h = Math.max(1, Math.round(canvas.height * scale))
  const small = document.createElement('canvas')
  small.width = w
  small.height = h
  const c = small.getContext('2d', { willReadFrequently: true })!
  c.drawImage(canvas, 0, 0, w, h)
  const px = c.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) data[i] = px[i * 4 + 3] > 40 ? 1 : 0
  return { data, w, h }
}

/** Outline in zone units (centered, y up) following the composed design plus a border. */
export function dieCutOutline(ctx: BuildContext, zoneId: string, zw: number, zh: number, border: number): Pt[] {
  const canvas = ctx.zones[zoneId]?.canvas
  if (canvas) {
    const mask = maskFromCanvas(canvas)
    const contour = designContour(mask, border * Math.max(mask.w, mask.h))
    if (contour && contour.length >= 3) {
      const pts = contour.map(([x, y]) => [(x / mask.w - 0.5) * zw, (0.5 - y / mask.h) * zh] as Pt)
      return chaikin(pts, 2)
    }
  }
  const s = roundedRectShape(zw * 0.8, zh * 0.8, Math.min(zw, zh) * 0.12)
  return s.getPoints(8).map((p) => [p.x, p.y] as Pt)
}

type DieCutKind = 'sticker' | 'holo' | 'acrylic' | 'enamel' | 'patch' | 'magnet'

export function buildDieCut(params: BuilderParams, ctx: BuildContext) {
  const kind = str<DieCutKind>(params, 'kind', 'sticker')
  const zone = getZone(ctx, 'main')
  const zh = num(params, 'size', 1)
  const zw = zone.aspect * zh
  const border = num(params, 'border', 0.035)
  const pts = dieCutOutline(ctx, 'main', zw, zh, border)
  const shape = shapeFromPoints(pts)
  const g = group()

  switch (kind) {
    case 'sticker':
    case 'holo':
    case 'magnet': {
      const d = kind === 'magnet' ? 0.03 : 0.012
      g.add(part(ctx, extrudeShape(shape, d, 0.003), 'backing', kind === 'holo' ? 'holographic' : 'vinyl'))
      g.add(zoneMesh(ctx, 'main', shapeOverlay(shape, zw, zh, d / 2 + 0.002), kind === 'holo' ? 'holographic' : 'vinyl'))
      break
    }
    case 'acrylic': {
      const d = 0.06
      g.add(part(ctx, extrudeShape(shape, d, 0.01), 'acrylic', 'acrylic'))
      g.add(zoneMesh(ctx, 'main', shapeOverlay(shape, zw, zh, 0.0), 'plastic'))
      const b = bounds(pts)
      const top = pts.reduce((best, p) => (p[1] > best[1] ? p : best), pts[0])
      const holeX = Math.max(b.minX + 0.08, Math.min(b.maxX - 0.08, top[0]))
      const ring = new THREE.TorusGeometry(0.06, 0.012, 10, 32)
      g.add(at(fixed(ring, 'metal', '#c8c8cc'), holeX, top[1] + 0.04, 0))
      const keyring = new THREE.TorusGeometry(0.17, 0.014, 10, 48)
      keyring.rotateY(Math.PI / 2.4)
      g.add(at(fixed(keyring, 'metal', '#c8c8cc'), holeX, top[1] + 0.25, 0))
      break
    }
    case 'enamel': {
      const d = 0.05
      g.add(part(ctx, extrudeShape(shape, d, 0.012), 'metal', 'gold'))
      g.add(zoneMesh(ctx, 'main', shapeOverlay(shape, zw, zh, d / 2 + 0.003), 'enamel'))
      const post = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12)
      post.rotateX(Math.PI / 2)
      g.add(at(fixed(post, 'metal', '#b0b0b4'), 0, 0, -0.08))
      const clutch = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 32)
      clutch.rotateX(Math.PI / 2)
      g.add(at(fixed(clutch, 'rubber', '#1a1a1a'), 0, 0, -0.13))
      break
    }
    case 'patch': {
      const d = 0.03
      g.add(part(ctx, extrudeShape(shape, d, 0.006), 'backing', 'embroidery'))
      const border3d = pts.map(([x, y]) => [x, y, d / 2] as [number, number, number])
      g.add(part(ctx, tube(border3d, 0.022, true, Math.min(400, pts.length * 2), 8), 'border', 'embroidery'))
      g.add(zoneMesh(ctx, 'main', shapeOverlay(shape, zw, zh, d / 2 + 0.004), 'embroidery'))
      break
    }
  }
  return g
}

type PatchShape = 'circle' | 'rect' | 'shield' | 'woven' | 'pvc'

export function buildPatch(params: BuilderParams, ctx: BuildContext) {
  const shapeKind = str<PatchShape>(params, 'shape', 'circle')
  const zone = getZone(ctx, 'front')
  const h = num(params, 'h', 1)
  const w = zone.aspect * h
  let pts: Pt[]
  if (shapeKind === 'circle') {
    pts = Array.from({ length: 96 }, (_, i) => {
      const a = (i / 96) * Math.PI * 2
      return [Math.cos(a) * w * 0.5, Math.sin(a) * h * 0.5] as Pt
    })
  } else if (shapeKind === 'shield') {
    pts = chaikin([[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h * 0.05], [w * 0.25, -h * 0.35], [0, -h / 2], [-w * 0.25, -h * 0.35], [-w / 2, -h * 0.05]], 2)
  } else {
    const r = shapeKind === 'woven' ? 0.01 : shapeKind === 'pvc' ? Math.min(w, h) * 0.2 : Math.min(w, h) * 0.12
    pts = roundedRectShape(w, h, r).getPoints(10).map((p) => [p.x, p.y] as Pt)
  }
  const shape = shapeFromPoints(pts)
  const g = group()

  if (shapeKind === 'woven') {
    const d = 0.01
    g.add(part(ctx, extrudeShape(shape, d), 'backing', 'fabric'))
    for (const sx of [-1, 1]) {
      const fold = new THREE.BoxGeometry(0.08, h, d)
      g.add(at(part(ctx, fold, 'backing', 'fabric', 0.85), sx * (w / 2 + 0.03), 0, -0.02, 0, sx * 0.9, 0))
    }
    g.add(zoneMesh(ctx, 'front', shapeOverlay(shape, w, h, d / 2 + 0.002), 'fabric'))
    return g
  }
  if (shapeKind === 'pvc') {
    const d = 0.05
    g.add(part(ctx, extrudeShape(shape, d, 0.018), 'backing', 'rubber'))
    g.add(zoneMesh(ctx, 'front', shapeOverlay(shape, w, h, d / 2 + 0.003), 'rubber'))
    return g
  }
  const d = 0.03
  g.add(part(ctx, extrudeShape(shape, d, 0.006), 'backing', 'embroidery'))
  const ring = pts.map(([x, y]) => [x, y, d / 2] as [number, number, number])
  g.add(part(ctx, tube(ring, 0.026, true, pts.length * 2, 8), 'border', 'embroidery'))
  const inset = shapeFromPoints(pts.map(([x, y]) => [x * 0.94, y * 0.94] as Pt))
  g.add(zoneMesh(ctx, 'front', shapeOverlay(inset, w, h, d / 2 + 0.004), 'embroidery'))
  return g
}
