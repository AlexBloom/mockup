import * as THREE from 'three'
import type { BuilderParams, MaterialPreset } from '@/catalog/types'
import { createMaterial } from '@/render/materials'
import { calendarGrid } from '@/render/textures'
import type { BuildContext } from '@/render/types'
import {
  at,
  bool,
  displacedGrid,
  extrudeShape,
  fixed,
  getZone,
  group,
  num,
  part,
  roundedRectShape,
  shapeOverlay,
  str,
  tube,
  zoneMesh,
} from './kit'

/** Slab with an optional paper curl, used for posters, flyers, cards, mats, pads and banners. */
export function buildFlat(params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const h = num(params, 'h', 1.4)
  const inset = num(params, 'inset', 0)
  const zh = h - inset * 2
  const zw = zone.aspect * zh
  const w = zw + inset * 2
  const d = num(params, 'd', 0.01)
  const r = num(params, 'r', 0)
  const curl = num(params, 'curl', 0)
  const target = str(params, 'target', 'paper')
  const preset = str<MaterialPreset>(params, 'preset', ctx.item.material)
  const zonePreset = str<MaterialPreset>(params, 'zonePreset', preset)
  const g = group()
  const bend = (x: number) => -curl * Math.pow(x / (w / 2), 2)

  if (r > 0) {
    g.add(part(ctx, extrudeShape(roundedRectShape(w, h, r), d, Math.min(d * 0.3, 0.01)), target, preset))
    g.add(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(zw, zh, Math.max(0.001, r - inset)), zw, zh, d / 2 + 0.002), zonePreset))
  } else {
    const box = new THREE.BoxGeometry(w, h, d, 48, 1, 1)
    const pos = box.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + bend(pos.getX(i)))
    box.computeVertexNormals()
    g.add(part(ctx, box, target, preset))
    g.add(zoneMesh(ctx, 'front', displacedGrid(zw, zh, 48, 1, (x) => d / 2 + 0.002 + bend(x)), zonePreset))
  }

  if (bool(params, 'grommets')) {
    for (const [gx, gy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const ring = new THREE.TorusGeometry(0.03, 0.01, 8, 24)
      g.add(at(fixed(ring, 'metal', '#c0c0c4'), gx * (w / 2 - 0.06), gy * (h / 2 - 0.06), d / 2 + bend(gx * (w / 2 - 0.06))))
    }
  }
  if (bool(params, 'stacked')) {
    const under = part(ctx, extrudeShape(roundedRectShape(w, h, r || 0.001), d), target, preset, 0.9)
    g.add(at(under, w * 0.12, -h * 0.1, -d * 1.5, 0, 0, -0.12))
  }
  return g
}

export function buildDisc(params: BuilderParams, ctx: BuildContext) {
  const r = num(params, 'r', 0.5)
  const d = num(params, 'd', 0.04)
  const fill = num(params, 'fill', 1)
  const target = str(params, 'target', 'body')
  const g = group()
  const disc = new THREE.CylinderGeometry(r, r, d, 96)
  disc.rotateX(Math.PI / 2)
  g.add(part(ctx, disc, target))
  const overlay = new THREE.CircleGeometry(r * fill, 96)
  overlay.translate(0, 0, d / 2 + 0.002)
  g.add(zoneMesh(ctx, 'front', overlay))
  if (bool(params, 'lay')) g.rotation.x = -Math.PI / 2
  return group(g)
}

/** Domed pin-back button. The zone uses planar UVs over a displaced polar grid so the print wraps over the dome. */
export function buildDome(params: BuilderParams, ctx: BuildContext) {
  const r = num(params, 'r', 0.5)
  const dh = num(params, 'dome', 0.12)
  const R = (r * r + dh * dh) / (2 * dh)
  const z = (rho: number) => Math.sqrt(Math.max(0, R * R - rho * rho)) - (R - dh)
  const make = (offset: number) => {
    const geo = new THREE.RingGeometry(0, r, 96, 24)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setZ(i, z(Math.hypot(pos.getX(i), pos.getY(i))) + offset)
    geo.computeVertexNormals()
    return geo
  }
  const g = group(part(ctx, make(0), 'body', 'glossyPaper'), zoneMesh(ctx, 'front', make(0.003), 'glossyPaper'))
  const rim = new THREE.CylinderGeometry(r, r * 0.97, 0.05, 96, 1, true)
  rim.rotateX(Math.PI / 2)
  g.add(at(part(ctx, rim, 'body', 'glossyPaper'), 0, 0, -0.025))
  const back = new THREE.CircleGeometry(r * 0.97, 64)
  back.rotateY(Math.PI)
  g.add(at(fixed(back, 'metal', '#b8b8bc'), 0, 0, -0.05))
  return g
}

export function buildFrame(params: BuilderParams, ctx: BuildContext) {
  const kind = str<'framed' | 'mat' | 'canvas'>(params, 'kind', 'framed')
  const zone = getZone(ctx, 'art')
  const ah = num(params, 'h', 1.2)
  const aw = zone.aspect * ah
  const g = group()

  if (kind === 'canvas') {
    const depth = 0.1
    g.add(part(ctx, new THREE.BoxGeometry(aw, ah, depth), 'paper', 'canvas'))
    g.add(zoneMesh(ctx, 'art', shapeOverlay(roundedRectShape(aw, ah, 0.001), aw, ah, depth / 2 + 0.002), 'canvas'))
    return g
  }

  const mat = kind === 'mat' ? num(params, 'mat', 0.22) : 0
  const fw = num(params, 'frame', 0.09)
  const ow = aw + mat * 2 + fw * 2
  const oh = ah + mat * 2 + fw * 2
  const frameShape = roundedRectShape(ow, oh, 0.004)
  frameShape.holes.push(roundedRectShape(ow - fw * 2, oh - fw * 2, 0.002))
  g.add(at(part(ctx, extrudeShape(frameShape, 0.07, 0.008), 'frame', 'wood'), 0, 0, 0.02))
  g.add(at(part(ctx, new THREE.BoxGeometry(ow - fw, oh - fw, 0.01), 'paper', 'paper'), 0, 0, -0.01))
  if (mat > 0) {
    const matShape = roundedRectShape(aw + mat * 2, ah + mat * 2, 0.001)
    matShape.holes.push(roundedRectShape(aw, ah, 0.001))
    g.add(at(part(ctx, extrudeShape(matShape, 0.012), 'mat', 'paper'), 0, 0, 0.006))
  }
  g.add(zoneMesh(ctx, 'art', shapeOverlay(roundedRectShape(aw, ah, 0.001), aw, ah, -0.003), 'paper'))
  const glass = new THREE.PlaneGeometry(ow - fw * 2, oh - fw * 2)
  const glassMesh = new THREE.Mesh(glass, createMaterial('glass', '#ffffff'))
  glassMesh.material.opacity = 0.08
  glassMesh.name = 'fixed'
  g.add(at(glassMesh, 0, 0, 0.04))
  return g
}

export function buildCard(params: BuilderParams, ctx: BuildContext) {
  const kind = str<'greeting' | 'business'>(params, 'kind', 'greeting')
  const zone = getZone(ctx, 'front')
  const h = num(params, 'h', 1.2)
  const w = zone.aspect * h
  const d = 0.008
  const g = group()
  if (kind === 'greeting') {
    const front = group(
      at(part(ctx, new THREE.BoxGeometry(w, h, d), 'paper', 'paper'), w / 2, 0, 0),
      at(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(w, h, 0.001), w, h, d / 2 + 0.002), 'paper'), w / 2, 0, 0),
    )
    front.rotation.y = 0.32
    const back = at(part(ctx, new THREE.BoxGeometry(w, h, d), 'paper', 'paper', 0.94), w / 2, 0, 0)
    const backPivot = group(back)
    backPivot.rotation.y = 1.25
    g.add(front, backPivot)
    g.position.x = -w * 0.3
    return group(g)
  }
  const r = 0.04
  const card = group(
    part(ctx, extrudeShape(roundedRectShape(w, h, r), 0.012), 'paper', 'paper'),
    zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(w, h, r), w, h, 0.008), 'paper'),
  )
  const under = at(part(ctx, extrudeShape(roundedRectShape(w, h, r), 0.012), 'paper', 'paper', 0.92), w * 0.18, -h * 0.28, -0.03, 0, 0, -0.18)
  g.add(under, at(card, 0, 0, 0, 0, 0, 0.06))
  return g
}

export function buildYardSign(_params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const h = 1
  const w = zone.aspect * h
  const g = group(
    part(ctx, new THREE.BoxGeometry(w, h, 0.012), 'paper', 'plastic'),
    zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(w, h, 0.001), w, h, 0.008), 'plastic'),
  )
  for (const sx of [-0.25, 0.25]) {
    const leg = new THREE.CylinderGeometry(0.008, 0.008, 1.0, 8)
    g.add(at(fixed(leg, 'metal', '#9a9aa0'), sx * w, -h / 2 - 0.35, 0))
  }
  return g
}

export function buildCalendar(_params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const zh = 0.7
  const w = zone.aspect * zh
  const total = zh * 2 + 0.04
  const g = group(at(part(ctx, new THREE.BoxGeometry(w, total, 0.008), 'paper', 'paper'), 0, -total / 2 + zh / 2 + 0.02, 0))
  g.add(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(w, zh, 0.001), w, zh, 0.006), 'paper'))
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, zh * 0.85), new THREE.MeshStandardMaterial({ map: calendarGrid(), roughness: 0.9 }))
  grid.name = 'fixed'
  g.add(at(grid, 0, -zh / 2 - 0.02 - zh * 0.5, 0.006))
  const coils = Math.round(w / 0.05)
  for (let i = 0; i < coils; i++) {
    const coil = new THREE.TorusGeometry(0.018, 0.004, 6, 16)
    coil.rotateY(Math.PI / 2)
    g.add(at(fixed(coil, 'metal', '#d8d8dc'), -w / 2 + (i + 0.5) * (w / coils), zh / 2 + 0.005, 0))
  }
  g.add(fixed(tube([[-0.06, zh / 2 + 0.02, 0], [0, zh / 2 + 0.12, 0], [0.06, zh / 2 + 0.02, 0]], 0.004, false, 16, 6), 'metal', '#d8d8dc'))
  g.position.y = zh / 2 - 0.1
  return group(g)
}
