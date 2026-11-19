import * as THREE from 'three'
import type { BuilderParams, MaterialPreset } from '@/catalog/types'
import { createMaterial } from '@/render/materials'
import { grooveNormal } from '@/render/textures'
import type { BuildContext } from '@/render/types'
import {
  at,
  bool,
  chaikin,
  cylinderZone,
  displacedGrid,
  extrudeShape,
  fixed,
  getZone,
  group,
  mirrorHalf,
  num,
  part,
  type Pt,
  roundedBox,
  roundCorners,
  roundedRectShape,
  shapeFromPoints,
  shapeOverlay,
  str,
  tube,
  zoneMesh,
} from './kit'
import { clipToMask, folds, inflate, zoneOnSurface } from './inflate'

/** Plain boxes: mailers, gift boxes, jewel cases, AirPods-style cases. */
export function buildBox(params: BuilderParams, ctx: BuildContext) {
  const kind = str<'plain' | 'mailer' | 'jewel' | 'pebble'>(params, 'kind', 'plain')
  const zone = getZone(ctx, 'front')
  const g = group()

  if (kind === 'mailer') {
    const w = num(params, 'w', 1.3)
    const h = num(params, 'h', 0.36)
    const d = num(params, 'd', 1.0)
    g.add(part(ctx, roundedBox(w, h, d, 0.02, 0.01), 'body', 'paper'))
    const zd = d * 0.8
    const zw = zone.aspect * zd
    const top = shapeOverlay(roundedRectShape(zw, zd, 0.001), zw, zd, 0)
    top.rotateX(-Math.PI / 2)
    top.translate(0, h / 2 + 0.003, 0)
    g.add(zoneMesh(ctx, 'front', top, 'paper'))
    const seam = new THREE.BoxGeometry(w * 0.98, 0.006, 0.004)
    g.add(at(part(ctx, seam, 'body', 'paper', 0.6), 0, h / 2 - 0.05, d / 2 + 0.002))
    return g
  }

  if (kind === 'jewel') {
    const s = 1.0
    const zw = zone.aspect * s * 0.95
    g.add(part(ctx, new THREE.BoxGeometry(s * 1.1, s, 0.04), 'tray', 'plastic'))
    g.add(at(part(ctx, new THREE.BoxGeometry(zw, s * 0.95, 0.004), 'paper', 'glossyPaper'), 0.03, 0, 0.026))
    g.add(at(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(zw, s * 0.95, 0.001), zw, s * 0.95, 0.03), 'glossyPaper'), 0.03, 0, 0))
    const lid = new THREE.Mesh(new THREE.BoxGeometry(s * 1.1, s, 0.02), createMaterial('acrylic', '#ffffff'))
    lid.name = 'fixed'
    g.add(at(lid, 0, 0, 0.045))
    g.add(at(fixed(new THREE.BoxGeometry(0.06, s, 0.07), 'plastic', '#d8d8dc'), -s * 0.52, 0, 0.02))
    return g
  }

  if (kind === 'pebble') {
    const w = 0.8
    const h = 0.95
    const d = 0.38
    g.add(part(ctx, roundedBox(w, h, d, 0.3, 0.16), 'body', 'plastic'))
    g.add(at(fixed(new THREE.BoxGeometry(w * 0.9, 0.006, d * 0.9), 'plastic', '#bbbbbb'), 0, h * 0.22, 0))
    const zh = 0.4
    const zw = zone.aspect * zh
    g.add(zoneMesh(ctx, 'front', displacedGrid(zw, zh, 24, 24, (x) => d / 2 + 0.004 - x * x * 0.4, 0, -0.08), 'plastic'))
    return g
  }

  const w = num(params, 'w', 1)
  const h = num(params, 'h', 1)
  const d = num(params, 'd', 0.5)
  g.add(part(ctx, roundedBox(w, h, d, 0.02, 0.01), 'body'))
  const zh = h * 0.8
  g.add(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(zone.aspect * zh, zh, 0.001), zone.aspect * zh, zh, d / 2 + 0.003)))
  return g
}

export function buildNotebook(params: BuilderParams, ctx: BuildContext) {
  const spiral = str<'hardcover' | 'spiral'>(params, 'kind', 'hardcover') === 'spiral'
  const zone = getZone(ctx, 'front')
  const h = 1.3
  const w = zone.aspect * h
  const cover = spiral ? 0.012 : 0.03
  const pages = 0.14
  const g = group()
  g.add(at(part(ctx, roundedBox(w, h, cover, 0.03, 0.006), 'cover', spiral ? 'paper' : 'fabric'), 0, 0, pages / 2 + cover / 2))
  g.add(at(part(ctx, roundedBox(w, h, cover, 0.03, 0.006), 'cover', spiral ? 'paper' : 'fabric', 0.95), 0, 0, -pages / 2 - cover / 2))
  g.add(at(fixed(new THREE.BoxGeometry(w - 0.04, h - 0.04, pages), 'paper', '#f4f1ea'), 0.01, 0, 0))
  if (spiral) {
    const n = Math.round(h / 0.06)
    for (let i = 0; i < n; i++) {
      const coil = new THREE.TorusGeometry(0.05, 0.006, 6, 20)
      coil.rotateX(Math.PI / 2)
      coil.rotateZ(Math.PI / 2)
      g.add(at(fixed(coil, 'metal', '#c8c8cc'), -w / 2 - 0.01, -h / 2 + (i + 0.5) * (h / n), 0))
    }
  } else {
    const spine = new THREE.CylinderGeometry(pages / 2 + cover, pages / 2 + cover, h, 24, 1, true, Math.PI, Math.PI)
    g.add(at(part(ctx, spine, 'cover', 'fabric', 0.9), -w / 2, 0, 0))
    if (bool(params, 'band', true)) {
      const band = new THREE.BoxGeometry(0.035, h + 0.004, pages + cover * 2 + 0.01)
      g.add(at(part(ctx, band, 'band', 'rubber'), w / 2 - 0.12, 0, 0))
    }
  }
  const zh = h * 0.8
  const zw = zone.aspect * zh
  g.add(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(zw, zh, 0.001), zw, zh, pages / 2 + cover + 0.003), spiral ? 'paper' : 'fabric'))
  return g
}

export function buildCassette(_params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const w = 1.0
  const h = 0.64
  const d = 0.1
  const g = group(part(ctx, roundedBox(w, h, d, 0.03, 0.01), 'body', 'plastic'))
  const zh = 0.36
  const zw = zone.aspect * zh
  g.add(at(part(ctx, new THREE.BoxGeometry(zw, zh, 0.003), 'label', 'paper'), 0, 0.08, d / 2 + 0.001))
  g.add(at(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(zw, zh, 0.02), zw, zh, d / 2 + 0.004), 'paper'), 0, 0.08, 0))
  const windowGeo = new THREE.BoxGeometry(0.42, 0.12, 0.004)
  g.add(at(fixed(windowGeo, 'glass', '#333333'), 0, 0.06, d / 2 + 0.006))
  for (const sx of [-0.14, 0.14]) {
    const reel = new THREE.CylinderGeometry(0.045, 0.045, 0.01, 6)
    reel.rotateX(Math.PI / 2)
    g.add(at(fixed(reel, 'plastic', '#f2f2f2'), sx, 0.06, d / 2 + 0.002))
  }
  const trap = shapeFromPoints([[-0.3, -0.31], [0.3, -0.31], [0.24, -0.18], [-0.24, -0.18]])
  g.add(at(part(ctx, extrudeShape(trap, 0.01), 'body', 'plastic', 0.9), 0, 0, d / 2 + 0.003))
  return g
}

export function buildVinyl(params: BuilderParams, ctx: BuildContext) {
  const kind = str<'sleeve' | 'record'>(params, 'kind', 'sleeve')
  const g = group()
  const record = (x: number, z: number) => {
    const disc = new THREE.CylinderGeometry(0.58, 0.58, 0.008, 128)
    disc.rotateX(Math.PI / 2)
    const mat = createMaterial('plastic', '#111111') as THREE.MeshPhysicalMaterial
    mat.normalMap = grooveNormal()
    mat.roughness = 0.3
    const mesh = new THREE.Mesh(disc, mat)
    mesh.name = 'fixed'
    const r = group(mesh)
    const labelR = 0.2
    r.add(at(part(ctx, new THREE.CircleGeometry(labelR, 64), 'label', 'paper'), 0, 0, 0.0045))
    if (ctx.item.printZones.some((z) => z.id === 'label')) {
      r.add(zoneMesh(ctx, 'label', new THREE.CircleGeometry(labelR, 64).translate(0, 0, 0.006), 'paper'))
    }
    r.add(at(fixed(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 16).rotateX(Math.PI / 2), 'rubber', '#000000'), 0, 0, 0))
    r.position.set(x, 0, z)
    return r
  }
  if (kind === 'record') {
    g.add(record(0, 0))
    return g
  }
  const s = 1.2
  g.add(part(ctx, new THREE.BoxGeometry(s, s, 0.016), 'sleeve', 'paper'))
  g.add(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(s, s, 0.001), s, s, 0.0105), 'paper'))
  g.add(record(0.38, -0.016))
  return g
}

type DeviceKind = 'phone' | 'tablet' | 'laptop' | 'monitor' | 'phoneCase' | 'laptopLid'

export function buildDevice(params: BuilderParams, ctx: BuildContext) {
  const kind = str<DeviceKind>(params, 'kind', 'phone')
  const zoneId = ctx.item.printZones[0].id
  const zone = getZone(ctx, zoneId)
  const g = group()
  const screenGlass = (w: number, h: number, r: number, z: number) => {
    const glass = shapeOverlay(roundedRectShape(w, h, r), w, h, z)
    return part(ctx, glass, 'screen', 'screen')
  }

  if (kind === 'phone' || kind === 'tablet' || kind === 'phoneCase') {
    const sh = kind === 'tablet' ? 1.6 : 1.5
    const sw = zone.aspect * sh
    const bezel = kind === 'tablet' ? 0.07 : 0.035
    const w = sw + bezel * 2
    const h = sh + bezel * 2
    const d = kind === 'tablet' ? 0.05 : 0.075
    const r = kind === 'tablet' ? 0.09 : 0.12
    if (kind === 'phoneCase') {
      g.add(part(ctx, roundedBox(w + 0.04, h + 0.04, d + 0.03, r + 0.02, 0.025), 'case', 'plastic'))
      const back = shapeOverlay(roundedRectShape(w, h, r), w, h, 0)
      back.rotateY(Math.PI)
      back.translate(0, 0, -(d + 0.03) / 2 - 0.003)
      g.add(zoneMesh(ctx, zoneId, back, 'plastic'))
      const bump = roundedBox(0.36, 0.36, 0.03, 0.08, 0.01)
      g.add(at(part(ctx, bump, 'case', 'plastic', 0.92), w / 2 - 0.24, h / 2 - 0.24, -(d + 0.03) / 2 - 0.02))
      for (const [lx, ly] of [[-0.08, 0.08], [0.08, 0.08], [-0.08, -0.08]]) {
        const lens = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 24)
        lens.rotateX(Math.PI / 2)
        g.add(at(fixed(lens, 'glass', '#111111'), w / 2 - 0.24 + lx, h / 2 - 0.24 + ly, -(d + 0.03) / 2 - 0.04))
      }
      return g
    }
    g.add(part(ctx, roundedBox(w, h, d, r, 0.02), 'frame', 'metal'))
    g.add(screenGlass(w - 0.012, h - 0.012, r - 0.006, d / 2 + 0.001))
    g.add(zoneMesh(ctx, zoneId, shapeOverlay(roundedRectShape(sw, sh, r - bezel), sw, sh, d / 2 + 0.003), 'screen'))
    if (kind === 'phone') g.add(at(fixed(extrudeShape(roundedRectShape(0.2, 0.05, 0.025), 0.004), 'rubber', '#000000'), 0, sh / 2 - 0.06, d / 2 + 0.006))
    return g
  }

  if (kind === 'laptop' || kind === 'laptopLid') {
    const sh = 1.0
    const sw = zone.aspect * sh
    const w = sw + 0.08
    const h = sh + 0.1
    const lid = group()
    lid.add(at(part(ctx, roundedBox(w, h, 0.03, 0.04, 0.008), 'frame', 'brushedMetal'), 0, h / 2, 0))
    lid.add(at(screenGlass(w - 0.02, h - 0.02, 0.03, 0.016), 0, h / 2, 0))
    if (kind === 'laptop') {
      lid.add(at(zoneMesh(ctx, zoneId, shapeOverlay(roundedRectShape(sw, sh, 0.01), sw, sh, 0.018), 'screen'), 0, h / 2 + 0.01, 0))
    } else {
      const back = shapeOverlay(roundedRectShape(sw, sh, 0.02), sw, sh, 0)
      back.rotateY(Math.PI)
      back.translate(0, h / 2, -0.018)
      lid.add(zoneMesh(ctx, zoneId, back, 'vinyl'))
    }
    lid.rotation.x = kind === 'laptop' ? -0.2 : -0.25
    lid.position.z = -h * 0.42
    const base = roundedBox(w, h * 0.85, 0.035, 0.04, 0.008)
    base.rotateX(-Math.PI / 2)
    g.add(at(part(ctx, base, 'frame', 'brushedMetal'), 0, 0, 0), lid)
    const keys = new THREE.PlaneGeometry(w * 0.85, h * 0.35)
    keys.rotateX(-Math.PI / 2)
    g.add(at(fixed(keys, 'rubber', '#1b1b1d'), 0, 0.019, -h * 0.12))
    return g
  }

  const sh = 1.0
  const sw = zone.aspect * sh
  const w = sw + 0.04
  const h = sh + 0.04
  const screen = group(part(ctx, roundedBox(w, h, 0.05, 0.02, 0.008), 'frame', 'plastic'))
  screen.add(screenGlass(w - 0.01, h - 0.01, 0.015, 0.026))
  screen.add(zoneMesh(ctx, zoneId, shapeOverlay(roundedRectShape(sw, sh, 0.005), sw, sh, 0.028), 'screen'))
  screen.position.y = 0.45 + h / 2
  g.add(screen)
  g.add(at(part(ctx, new THREE.BoxGeometry(0.1, 0.55, 0.04), 'frame', 'brushedMetal'), 0, 0.3, -0.05))
  g.add(at(part(ctx, roundedBox(0.5, 0.3, 0.025, 0.05, 0.008).rotateX(-Math.PI / 2), 'frame', 'brushedMetal'), 0, 0.02, -0.02))
  return g
}

/** Puffy fabric or film body with an optional height-field print: totes, pouches, pillows, pouches. */
export function buildPillow(params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const s = num(params, 's', 1.2)
  const pts: Pt[] = []
  const n = 24
  const pinch = 0.06
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < n; i++) {
      const t = i / n
      const along = -s / 2 + t * s
      const inward = Math.sin(t * Math.PI) * pinch
      const p: Pt = side === 0 ? [along, -s / 2 + inward] : side === 1 ? [s / 2 - inward, along] : side === 2 ? [-along, s / 2 - inward] : [-s / 2 + inward, -along]
      pts.push(p)
    }
  }
  const body = inflate(pts, { height: 0.2, falloff: 0.45, wrinkle: folds(0.01, [[6, 2, 0.3], [-3, 7, 1.1]]) })
  const g = group(clipToMask(part(ctx, body.front, 'body'), body.mask), clipToMask(part(ctx, body.back, 'body', undefined, 0.96), body.mask))
  const zh = s * num(params, 'fill', 0.8)
  g.add(zoneMesh(ctx, 'front', zoneOnSurface(zone.aspect * zh, zh, 0, 0, body.height)))
  return g
}

export function buildTote(params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const kind = str<'tote' | 'drawstring'>(params, 'kind', 'tote')
  const w = kind === 'tote' ? 1.0 : 0.9
  const h = kind === 'tote' ? 1.1 : 1.15
  const pts: Pt[] = roundCorners([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 0.03)
  const body = inflate(pts, { height: 0.05, falloff: 0.18, wrinkle: folds(0.006, [[7, 3, 0.4], [-4, 9, 2.1], [11, -2, 1.3]]), back: 0.6 })
  const g = group(clipToMask(part(ctx, body.front, 'body'), body.mask), clipToMask(part(ctx, body.back, 'body', undefined, 0.95), body.mask))
  if (kind === 'tote') {
    const loop = (z: number): [number, number, number][] => [
      [-0.22, h / 2 - 0.04, z],
      [-0.24, h / 2 + 0.3, z],
      [-0.12, h / 2 + 0.56, z],
      [0.12, h / 2 + 0.56, z],
      [0.24, h / 2 + 0.3, z],
      [0.22, h / 2 - 0.04, z],
    ]
    g.add(part(ctx, tube(loop(0.03), 0.028, false, 64, 8).scale(1, 1, 0.3), 'handle', 'canvas'))
    g.add(part(ctx, tube(loop(-0.03), 0.028, false, 64, 8).scale(1, 1, 0.3), 'handle', 'canvas', 0.88))
  } else {
    const hem = inflate([[-w / 2, h / 2 - 0.1], [w / 2, h / 2 - 0.1], [w / 2, h / 2], [-w / 2, h / 2]], { height: 0.01, falloff: 0.03, base: body.height })
    g.add(clipToMask(part(ctx, hem.front, 'body', undefined, 0.94), hem.mask))
    for (const sx of [-1, 1]) {
      const cord: [number, number, number][] = [[sx * 0.05, h / 2 - 0.05, 0.05], [sx * 0.3, h / 2 + 0.1, 0.02], [sx * 0.5, h / 2 - 0.3, 0], [sx * 0.48, -h / 2 + 0.02, 0.01]]
      g.add(part(ctx, tube(cord, 0.012, false, 32, 6), 'strap', 'fabric'))
    }
  }
  const p = String(params.zone ?? '0,0,0.62').split(',').map(Number)
  g.add(zoneMesh(ctx, 'front', zoneOnSurface(zone.aspect * p[2], p[2], p[0], p[1], body.height)))
  return g
}

export function buildBackpack(_params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const w = 0.95
  const h = 1.3
  const d = 0.4
  const g = group(part(ctx, roundedBox(w, h, d, 0.3, 0.12), 'body'))
  const pocketPts: Pt[] = roundCorners([[-0.36, -0.55], [0.36, -0.55], [0.36, 0.05], [-0.36, 0.05]], 0.06)
  const pocket = inflate(pocketPts, { height: 0.06, falloff: 0.15, base: () => d / 2 - 0.01 })
  g.add(clipToMask(part(ctx, pocket.front, 'body', undefined, 0.96), pocket.mask))
  const zip = chaikin([[-0.34, 0.03], [0, 0.07], [0.34, 0.03]], 2, false).map(([x, y]) => [x, y, pocket.height(x, y - 0.02) + 0.005] as [number, number, number])
  g.add(fixed(tube(zip, 0.008, false, 24, 6), 'metal', '#2a2a2e'))
  g.add(part(ctx, tube([[-0.12, h / 2 - 0.02, 0], [0, h / 2 + 0.12, 0], [0.12, h / 2 - 0.02, 0]], 0.02, false, 16, 6), 'strap', 'fabric'))
  for (const sx of [-1, 1]) {
    g.add(part(ctx, tube([[sx * 0.2, h / 2 - 0.1, -d / 2], [sx * 0.32, 0, -d / 2 - 0.12], [sx * 0.3, -h / 2 + 0.1, -d / 2]], 0.04, false, 24, 8).scale(1, 1, 0.5), 'strap', 'fabric', 0.9))
  }
  const zh = 0.36
  g.add(zoneMesh(ctx, 'front', zoneOnSurface(zone.aspect * zh, zh, 0, -0.26, pocket.height)))
  return g
}

/** Single-layer cloth with gentle deterministic waves: flags, blankets, towels, bandanas, banners. */
export function buildDrape(params: BuilderParams, ctx: BuildContext) {
  const kind = str<'flag' | 'blanket' | 'towel' | 'bandana' | 'petBandana'>(params, 'kind', 'flag')
  const zone = getZone(ctx, 'front')
  const preset = ctx.item.material
  const g = group()
  if (kind === 'bandana' || kind === 'petBandana') {
    const s = kind === 'bandana' ? 1.2 : 1.0
    const pts: Pt[] = kind === 'bandana' ? [[0, s * 0.7], [s * 0.7, 0], [0, -s * 0.7], [-s * 0.7, 0]] : [[-s * 0.6, s * 0.3], [s * 0.6, s * 0.3], [0, -s * 0.45]]
    const cloth = inflate(roundCorners(pts, 0.04), { height: 0.01, falloff: 0.1, wrinkle: folds(0.012, [[8, 4, 0.2], [-5, 9, 1.4]]), back: 0.4 })
    g.add(clipToMask(part(ctx, cloth.front, 'body', preset), cloth.mask), clipToMask(part(ctx, cloth.back, 'body', preset, 0.95), cloth.mask))
    if (kind === 'petBandana') {
      const collar = tube([[-s * 0.62, s * 0.3, 0], [0, s * 0.36, 0.02], [s * 0.62, s * 0.3, 0]], 0.03, false, 24, 8)
      g.add(part(ctx, collar, 'body', preset, 0.85))
    }
    const zh = s * (kind === 'bandana' ? 0.55 : 0.36)
    g.add(zoneMesh(ctx, 'front', zoneOnSurface(zone.aspect * zh, zh, 0, kind === 'bandana' ? 0 : 0.02, cloth.height, 0.006)))
    return g
  }
  const h = kind === 'towel' ? 1.5 : 1.0
  const w = kind === 'towel' ? 0.9 : zone.aspect * h
  const wave = kind === 'flag' ? (x: number, y: number) => Math.sin((x + w / 2) * 5.2) * 0.05 * ((x + w / 2) / w) + Math.sin(y * 3 + x * 2) * 0.01 : kind === 'towel' ? (x: number) => Math.sin(x * 9) * 0.012 : (x: number, y: number) => Math.sin(x * 4 + 1) * 0.03 + Math.sin(y * 5) * 0.015
  const cloth = displacedGrid(w, h, 60, 40, wave)
  g.add(part(ctx, cloth, 'body', preset))
  const zh = kind === 'towel' ? h * 0.45 : h
  const zw = zone.aspect * zh
  const zy = kind === 'towel' ? -h * 0.05 : 0
  g.add(zoneMesh(ctx, 'front', displacedGrid(zw, zh, 60, 40, (x, y) => wave(x, y) + 0.003, 0, zy), preset))
  if (kind === 'flag') {
    const pole = new THREE.CylinderGeometry(0.02, 0.02, h * 1.8, 16)
    g.add(at(fixed(pole, 'metal', '#c8c8cc'), -w / 2 - 0.02, -h * 0.35, 0))
  }
  if (kind === 'towel') {
    const bar = new THREE.CylinderGeometry(0.025, 0.025, w * 1.25, 16)
    bar.rotateZ(Math.PI / 2)
    g.add(at(fixed(bar, 'metal', '#c8c8cc'), 0, h / 2 + 0.02, 0.02))
  }
  return g
}

/** Ribbon/loop products: wristbands and lanyards. */
export function buildBand(params: BuilderParams, ctx: BuildContext) {
  const kind = str<'wristband' | 'lanyard'>(params, 'kind', 'wristband')
  const zone = getZone(ctx, 'front')
  const g = group()
  if (kind === 'wristband') {
    const r = 0.5
    const width = 0.3
    const profile: Pt[] = [[r, -width / 2], [r + 0.05, -width / 2 + 0.01], [r + 0.06, 0], [r + 0.05, width / 2 - 0.01], [r, width / 2], [r - 0.01, 0]]
    const ring = new THREE.LatheGeometry([...profile, profile[0]].map(([x, y]) => new THREE.Vector2(x, y)), 96)
    ring.computeVertexNormals()
    const band = group(part(ctx, ring, 'body', 'rubber'))
    band.add(zoneMesh(ctx, 'front', cylinderZone(r + 0.063, r + 0.063, width * 0.6, 0, zone.aspect), 'rubber'))
    band.rotation.x = Math.PI / 2 - 0.35
    g.add(band)
    return g
  }
  const width = 0.09
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.32, 1.0, 0),
    new THREE.Vector3(-0.3, 0.3, 0),
    new THREE.Vector3(-0.12, -0.25, 0),
    new THREE.Vector3(0, -0.4, 0),
    new THREE.Vector3(0.12, -0.25, 0),
    new THREE.Vector3(0.3, 0.3, 0),
    new THREE.Vector3(0.32, 1.0, 0),
  ])
  const ribbon = (z: number) => {
    const segs = 200
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      const p = path.getPointAt(t)
      const tan = path.getTangentAt(t)
      const nx = -tan.y
      const ny = tan.x
      positions.push(p.x + (nx * width) / 2, p.y + (ny * width) / 2, z, p.x - (nx * width) / 2, p.y - (ny * width) / 2, z)
      uvs.push(t, 1, t, 0)
      if (i < segs) {
        const a = i * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }
  const strap = part(ctx, ribbon(0), 'body', 'fabric')
  ;(strap.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  g.add(strap, zoneMesh(ctx, 'front', ribbon(0.003), 'fabric'))
  const clip = new THREE.TorusGeometry(0.05, 0.012, 8, 24)
  g.add(at(fixed(clip, 'metal', '#c8c8cc'), 0, -0.48, 0))
  g.add(at(fixed(new THREE.BoxGeometry(0.06, 0.12, 0.02), 'metal', '#c8c8cc'), 0, -0.6, 0))
  return g
}

export function buildSkateboard(_params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const L = 1.6
  const W = zone.aspect * L
  const half: Pt[] = [[0, L / 2]]
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2)
    half.push([Math.sin(a) * W / 2, L / 2 - W / 2 + Math.cos(a) * W / 2])
  }
  for (let i = 1; i < 20; i++) half.push([W / 2, L / 2 - W / 2 - ((L - W) * i) / 20])
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2)
    half.push([Math.cos(a) * W / 2, -L / 2 + W / 2 - Math.sin(a) * W / 2])
  }
  half.push([0, -L / 2])
  const pts = mirrorHalf(half)
  const kick = (y: number) => {
    const t = Math.max(0, Math.abs(y) - L * 0.32) / (L * 0.18)
    return -t * t * 0.08
  }
  const deck = extrudeShape(shapeFromPoints(pts), 0.03, 0.006)
  const pos = deck.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + kick(pos.getY(i)) - Math.pow(pos.getX(i) / (W / 2), 2) * 0.012)
  deck.computeVertexNormals()
  const g = group(part(ctx, deck, 'body', 'wood'))
  const grip = shapeOverlay(shapeFromPoints(pts.map(([x, y]) => [x * 0.98, y * 0.99] as Pt)), W, L, 0)
  const gpos = grip.attributes.position
  for (let i = 0; i < gpos.count; i++) gpos.setZ(i, -0.017 + kick(gpos.getY(i)) - Math.pow(gpos.getX(i) / (W / 2), 2) * 0.012)
  const gripMesh = part(ctx, grip, 'grip', 'rubber')
  ;(gripMesh.material as THREE.MeshStandardMaterial).side = THREE.BackSide
  g.add(gripMesh)
  const art = shapeOverlay(shapeFromPoints(pts), W, L, 0)
  const apos = art.attributes.position
  for (let i = 0; i < apos.count; i++) apos.setZ(i, 0.018 + kick(apos.getY(i)) - Math.pow(apos.getX(i) / (W / 2), 2) * 0.012)
  art.computeVertexNormals()
  g.add(zoneMesh(ctx, 'front', art, 'glossyPaper'))
  return g
}

export function buildPouch(params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const w = 0.9
  const h = 1.3
  const preset = str<MaterialPreset>(params, 'preset', ctx.item.material)
  const pts: Pt[] = roundCorners([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 + 0.02, h / 2 - 0.12], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2 - 0.02, h / 2 - 0.12]], 0.03)
  const body = inflate(pts, { height: 0.09, falloff: 0.3, wrinkle: folds(0.004, [[5, 2, 0.4], [-3, 6, 1.2]]) })
  const g = group(clipToMask(part(ctx, body.front, 'body', preset), body.mask), clipToMask(part(ctx, body.back, 'body', preset, 0.95), body.mask))
  const seal = inflate([[-w / 2, h / 2 - 0.12], [w / 2, h / 2 - 0.12], [w / 2, h / 2], [-w / 2, h / 2]], { height: 0.002, falloff: 0.01, base: body.height })
  g.add(clipToMask(part(ctx, seal.front, 'body', preset, 0.9), seal.mask))
  const zh = 0.7
  g.add(zoneMesh(ctx, 'front', zoneOnSurface(zone.aspect * zh, zh, 0, -0.08, body.height), preset))
  return g
}

export function buildShoppingBag(_params: BuilderParams, ctx: BuildContext) {
  const zone = getZone(ctx, 'front')
  const w = 0.9
  const h = 1.05
  const d = 0.4
  const g = group(part(ctx, new THREE.BoxGeometry(w, h, d), 'body', 'paper'))
  for (const sx of [-1, 1]) {
    g.add(at(part(ctx, new THREE.BoxGeometry(0.004, h * 0.9, d * 0.5), 'body', 'paper', 0.82), sx * (w / 2 + 0.001), 0.02, 0))
  }
  for (const z of [d / 2 - 0.02, -d / 2 + 0.02]) {
    g.add(part(ctx, tube([[-0.16, h / 2 - 0.02, z], [-0.14, h / 2 + 0.24, z], [0.14, h / 2 + 0.24, z], [0.16, h / 2 - 0.02, z]], 0.012, false, 32, 8), 'handle', 'fabric'))
  }
  const zh = 0.62
  g.add(zoneMesh(ctx, 'front', shapeOverlay(roundedRectShape(zone.aspect * zh, zh, 0.001), zone.aspect * zh, zh, d / 2 + 0.003), 'paper'))
  return g
}
