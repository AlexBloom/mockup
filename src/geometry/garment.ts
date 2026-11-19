import * as THREE from 'three'
import type { BuilderParams } from '@/catalog/types'
import type { BuildContext } from '@/render/types'
import { at, chaikin, fixed, getZone, group, mirrorHalf, num, part, type Pt, str, tube, zoneMesh } from './kit'
import { clipToMask, folds, type HeightFn, inflate, zoneOnBack, zoneOnSurface } from './inflate'

export type GarmentKind =
  | 'tee'
  | 'vneck'
  | 'longsleeve'
  | 'tank'
  | 'ringer'
  | 'fitted'
  | 'crop'
  | 'kids'
  | 'onesie'
  | 'polo'
  | 'jersey'
  | 'crewneck'
  | 'hoodie'
  | 'zipHoodie'
  | 'quarterZip'
  | 'bomber'
  | 'denim'
  | 'joggers'
  | 'shorts'
  | 'leggings'
  | 'socks'
  | 'apron'

type Torso = {
  L: number
  neckW: number
  neckDrop: number
  shoulderW: number
  shoulderDrop: number
  chestW: number
  waistW: number
  hemW: number
  sleeve: 'none' | 'short' | 'long' | 'cap'
  sleeveLen: number
  /** Width at the armhole. */
  sleeveW: number
  /** Width at the cuff. Narrower than the armhole, so the sleeve tapers. */
  sleeveEnd: number
  sleeveAngle: number
  vneck?: boolean
}

// Flat-lay proportions: sleeves nearly out to the side, a shallow neck, and a chest wider than it is deep.
const TEE: Torso = {
  L: 1.28,
  neckW: 0.14,
  neckDrop: 0.085,
  shoulderW: 0.4,
  shoulderDrop: 0.05,
  chestW: 0.44,
  waistW: 0.42,
  hemW: 0.435,
  sleeve: 'short',
  sleeveLen: 0.38,
  sleeveW: 0.22,
  sleeveEnd: 0.16,
  sleeveAngle: 0.3,
}

function torsoSpec(kind: GarmentKind): Torso {
  switch (kind) {
    case 'vneck':
    case 'jersey':
      return { ...TEE, vneck: true, neckDrop: 0.24, chestW: kind === 'jersey' ? 0.47 : 0.44, hemW: kind === 'jersey' ? 0.47 : 0.435 }
    case 'longsleeve':
      return { ...TEE, sleeve: 'long', sleeveLen: 0.72, sleeveW: 0.2, sleeveEnd: 0.13, sleeveAngle: 0.58 }
    case 'tank':
      return { ...TEE, sleeve: 'none', neckW: 0.15, neckDrop: 0.22, chestW: 0.42, shoulderW: 0.34 }
    case 'fitted':
      return { ...TEE, shoulderW: 0.34, chestW: 0.36, waistW: 0.32, hemW: 0.36, sleeve: 'cap', sleeveLen: 0.16, sleeveW: 0.16, sleeveEnd: 0.14, sleeveAngle: 0.35, neckDrop: 0.12 }
    case 'crop':
      return { ...TEE, L: 0.82, chestW: 0.44, waistW: 0.42, hemW: 0.44 }
    case 'crewneck':
    case 'quarterZip':
      return { ...TEE, L: 1.3, shoulderW: 0.43, chestW: 0.48, waistW: 0.46, hemW: 0.44, sleeve: 'long', sleeveLen: 0.74, sleeveW: 0.21, sleeveEnd: 0.14, sleeveAngle: 0.6 }
    case 'hoodie':
    case 'zipHoodie':
      return { ...TEE, L: 1.34, neckW: 0.15, shoulderW: 0.44, chestW: 0.5, waistW: 0.48, hemW: 0.45, sleeve: 'long', sleeveLen: 0.76, sleeveW: 0.22, sleeveEnd: 0.15, sleeveAngle: 0.58 }
    case 'bomber':
    case 'denim':
      return { ...TEE, L: 1.16, neckW: 0.13, shoulderW: 0.44, chestW: 0.5, waistW: 0.48, hemW: 0.47, sleeve: 'long', sleeveLen: 0.7, sleeveW: 0.21, sleeveEnd: 0.15, sleeveAngle: 0.55 }
    default:
      return TEE
  }
}

function torsoOutline(t: Torso): Pt[] {
  const top = t.L
  const half: Pt[] = [[0, top], [t.neckW, top + 0.01]]
  const armpitY = top - (t.sleeve === 'none' ? 0.34 : 0.28)
  if (t.sleeve === 'none') {
    half.push([t.neckW + 0.05, top - 0.015], [t.shoulderW, top - t.shoulderDrop], [t.chestW - 0.03, armpitY + 0.1], [t.chestW, armpitY])
  } else {
    const S: Pt = [t.shoulderW, top - t.shoulderDrop]
    const a = t.sleeveAngle
    const dir: Pt = [Math.cos(a), -Math.sin(a)]
    const n: Pt = [Math.sin(a), Math.cos(a)]
    const O: Pt = [S[0] + dir[0] * t.sleeveLen, S[1] + dir[1] * t.sleeveLen]
    const I: Pt = [O[0] - n[0] * t.sleeveEnd, O[1] - n[1] * t.sleeveEnd]
    const arm: Pt = [t.chestW, armpitY]
    // Midpoints survive the corner-rounding pass, so the sleeve keeps straight edges and a real cuff.
    half.push(S, [(S[0] + O[0]) / 2, (S[1] + O[1]) / 2], O, I, [(I[0] + arm[0]) / 2, (I[1] + arm[1]) / 2], arm)
  }
  half.push([t.waistW, top * 0.46], [t.hemW, 0.012], [t.hemW * 0.55, 0], [0, 0])
  return mirrorHalf(half)
}

function legsOutline(kind: GarmentKind): Pt[] {
  const top = 1
  if (kind === 'shorts') {
    // Wide leg openings with a real crotch notch, instead of one stuffed cushion.
    return mirrorHalf([
      [0, top],
      [0.34, top],
      [0.38, top - 0.22],
      [0.4, top - 0.6],
      [0.15, top - 0.64],
      [0.11, top - 0.38],
      [0, top - 0.28],
    ])
  }
  const bottom = kind === 'leggings' ? -0.3 : -0.22
  const hip = kind === 'leggings' ? 0.22 : 0.32
  const ankle = kind === 'leggings' ? 0.16 : 0.17
  // Both inseams lie on the center line, so the legs sit together the way a flat lay does,
  // instead of leaving a background gap between them.
  return mirrorHalf([
    [0, top],
    [hip, top],
    [hip + 0.01, top - 0.1],
    [(hip + ankle) / 2, top - 0.5],
    [ankle, bottom + 0.04],
    [0, bottom],
    [0, top - 0.2],
  ])
}

function outlineFor(kind: GarmentKind): Pt[] {
  switch (kind) {
    case 'joggers':
    case 'shorts':
    case 'leggings':
      return legsOutline(kind)
    case 'socks':
      return [[-0.15, 1.0], [0.15, 1.0], [0.15, 0.36], [0.22, 0.2], [0.5, 0.12], [0.62, 0.04], [0.6, -0.06], [0.45, -0.09], [-0.06, -0.09], [-0.18, 0.0], [-0.19, 0.2], [-0.16, 0.36]]
    case 'apron':
      return mirrorHalf([[0, 1.3], [0.19, 1.3], [0.21, 1.25], [0.23, 0.9], [0.3, 0.8], [0.42, 0.76], [0.42, 0.02], [0.2, -0.01], [0, 0]])
    case 'onesie':
      return mirrorHalf([[0, 1.0], [0.12, 1.02], [0.24, 0.96], [0.4, 0.8], [0.33, 0.68], [0.26, 0.76], [0.28, 0.25], [0.24, 0.07], [0.13, -0.04], [0.06, -0.06], [0, -0.06]])
    default: {
      const pts = torsoOutline(torsoSpec(kind))
      return kind === 'kids' ? pts.map(([x, y]) => [x * 0.78, y * 0.74] as Pt) : pts
    }
  }
}

function parseZone(value: unknown): { back: boolean; cx: number; cy: number; h: number } | null {
  if (typeof value !== 'string') return null
  const back = value.startsWith('b:')
  const [cx, cy, h] = value.replace(/^b:/, '').split(',').map(Number)
  return { back, cx, cy, h }
}

/** Polyline sampled on a height field, for collars, zippers and seams that ride on the fabric. */
function onSurface(points: Pt[], height: HeightFn, lift: number): [number, number, number][] {
  return points.map(([x, y]) => [x, y, height(x, y) + lift])
}

export function buildGarment(params: BuilderParams, ctx: BuildContext) {
  const kind = str<GarmentKind>(params, 'kind', 'tee')
  const isTop = !['joggers', 'shorts', 'leggings', 'socks', 'apron', 'onesie'].includes(kind)
  const outline = chaikin(outlineFor(kind), 1)
  // Tops stay close to a flat lay: a thin edge bevel and a nearly flat chest, so the print isn't wrapped over a balloon.
  const puff = num(params, 'puff', kind === 'socks' ? 0.04 : kind === 'shorts' ? 0.022 : isTop ? 0.03 : 0.04)
  const wrinkle = folds(num(params, 'wrinkle', isTop ? 0.002 : 0.0035), [
    [9, 3, 0.5],
    [4, 11, 1.7],
    [13, -6, 2.9],
    [-7, 5, 4.1],
  ])
  const body = inflate(outline, { height: puff, falloff: kind === 'shorts' ? 0.06 : isTop ? 0.085 : 0.12, wrinkle, back: 0.55 })
  const backDepth: HeightFn = (x, y) => body.height(x, y) * 0.8
  const preset = ctx.item.material
  const g = group(
    clipToMask(part(ctx, body.front, 'body', preset), body.mask),
    clipToMask(part(ctx, body.back, 'body', preset, 0.97), body.mask),
  )
  const hasTrim = ctx.item.colorTargets.some((c) => c.id === 'trim')
  const trim = hasTrim ? 'trim' : 'body'
  const t = torsoSpec(kind)
  const k = kind === 'kids' ? 0.78 : 1
  const ky = kind === 'kids' ? 0.74 : 1

  const neckPts = (drop: number, v = false): Pt[] => {
    const w = t.neckW * k
    const top = t.L * ky + 0.015
    return v
      ? [[-w, top], [-w * 0.55, top - drop * ky * 0.45], [0, top - drop * ky], [w * 0.55, top - drop * ky * 0.45], [w, top]]
      : chaikin([[-w, top], [-w * 0.8, top - drop * ky * 0.6], [0, top - drop * ky], [w * 0.8, top - drop * ky * 0.6], [w, top]], 2, false)
  }

  if (isTop && kind !== 'hoodie' && kind !== 'zipHoodie') {
    const drop = kind === 'polo' ? 0.16 : t.neckDrop
    const front = neckPts(drop, t.vneck)
    const backLine: Pt[] = chaikin([[t.neckW * k, t.L * ky + 0.015], [0, t.L * ky - 0.005], [-t.neckW * k, t.L * ky + 0.015]], 2, false)
    const interior = inflate([...front, ...backLine.slice(1, -1)], { height: 0.002, falloff: 0.02, base: body.height })
    g.add(clipToMask(part(ctx, interior.front, 'body', preset, 0.55), interior.mask))
    const collarR = kind === 'crewneck' || kind === 'quarterZip' || kind === 'bomber' ? 0.022 : 0.013
    const collarTarget = kind === 'ringer' || kind === 'jersey' || kind === 'bomber' ? trim : 'body'
    g.add(part(ctx, tube(onSurface(front, body.height, collarR * 0.6), collarR, false, 48, 8), collarTarget, kind === 'crewneck' ? 'knit' : preset, 0.96))
  }

  if (kind === 'hoodie' || kind === 'zipHoodie') {
    const L = t.L
    const hood = inflate(chaikin(mirrorHalf([[0, L + 0.52], [0.1, L + 0.5], [0.19, L + 0.34], [0.23, L + 0.14], [0.2, L - 0.02], [0.06, L - 0.05], [0, L - 0.05]]), 1), { height: 0.026, falloff: 0.1 })
    const hoodGroup = group(clipToMask(part(ctx, hood.front, 'body', preset, 0.9), hood.mask), clipToMask(part(ctx, hood.back, 'body', preset, 0.85), hood.mask))
    hoodGroup.position.z = -0.045
    g.add(hoodGroup)
    const opening: Pt[] = chaikin([[-0.16, L + 0.14], [0, L + 0.18], [0.16, L + 0.14], [0.06, L + 0.02], [0, L - 0.02], [-0.06, L + 0.02]], 1)
    const interior = inflate(opening, { height: 0.003, falloff: 0.02, base: body.height })
    g.add(clipToMask(part(ctx, interior.front, 'body', preset, 0.45), interior.mask))
    const rim: Pt[] = chaikin([[-0.18, L + 0.16], [-0.08, L + 0.04], [0, L], [0.08, L + 0.04], [0.18, L + 0.16]], 1, false)
    g.add(part(ctx, tube(onSurface(rim, body.height, 0.02), 0.03, false, 48, 10), 'body', preset, 0.95))
    if (kind === 'hoodie') {
      for (const sx of [-1, 1]) {
        const cord: [number, number, number][] = [[sx * 0.06, L - 0.06, body.height(sx * 0.06, L - 0.06) + 0.02], [sx * 0.07, L - 0.2, body.height(sx * 0.07, L - 0.2) + 0.02], [sx * 0.075, L - 0.34, body.height(sx * 0.075, L - 0.34) + 0.02]]
        g.add(part(ctx, tube(cord, 0.009, false, 16, 6), trim, 'plastic'))
      }
      const pocket = inflate(chaikin([[-0.3, 0.1], [0.3, 0.1], [0.3, 0.3], [0.2, 0.46], [-0.2, 0.46], [-0.3, 0.3]], 1), { height: 0.012, falloff: 0.05, base: body.height })
      g.add(clipToMask(part(ctx, pocket.front, 'body', preset, 0.97), pocket.mask))
    }
  }

  const zipTop = kind === 'zipHoodie' ? t.L - 0.14 : kind === 'quarterZip' ? t.L + 0.05 : kind === 'bomber' ? t.L : null
  if (zipTop !== null) {
    const zipBottom = kind === 'quarterZip' ? t.L - 0.34 : 0.02
    const pts: Pt[] = Array.from({ length: 24 }, (_, i) => [0, zipBottom + ((zipTop - zipBottom) * i) / 23] as Pt)
    g.add(fixed(tube(onSurface(pts, body.height, 0.004), 0.008, false, 48, 6), 'metal', '#3a3a3e'))
    const pull = new THREE.BoxGeometry(0.03, 0.06, 0.008)
    g.add(at(fixed(pull, 'metal', '#c0c0c4'), 0.0, zipTop - 0.05, body.height(0, zipTop - 0.05) + 0.015))
  }

  if (kind === 'quarterZip' || kind === 'bomber') {
    const collar = inflate(chaikin([[-0.16, t.L + 0.12], [0.16, t.L + 0.12], [0.17, t.L], [0, t.L - 0.03], [-0.17, t.L]], 1), { height: 0.02, falloff: 0.04 })
    g.add(at(clipToMask(part(ctx, collar.front, kind === 'bomber' ? trim : 'body', kind === 'bomber' ? 'knit' : preset), collar.mask), 0, 0, 0.02))
  }

  if (kind === 'polo' || kind === 'denim') {
    for (const sx of [-1, 1]) {
      const flap: Pt[] = [[sx * 0.015, t.L - 0.02], [sx * 0.17, t.L + 0.04], [sx * 0.22, t.L - 0.14], [sx * 0.05, t.L - 0.17]]
      const collar = inflate(sx < 0 ? flap : [...flap].reverse(), { height: 0.008, falloff: 0.03, base: (x, y) => body.height(x, y) + 0.008 })
      g.add(clipToMask(part(ctx, collar.front, 'body', preset, 0.94), collar.mask))
    }
    const buttons = kind === 'polo' ? [t.L - 0.08, t.L - 0.18, t.L - 0.28] : [t.L - 0.1, t.L - 0.35, t.L - 0.6, t.L - 0.85]
    for (const y of buttons) {
      const b = new THREE.CylinderGeometry(0.016, 0.016, 0.006, 16)
      b.rotateX(Math.PI / 2)
      g.add(at(fixed(b, kind === 'denim' ? 'metal' : 'plastic', kind === 'denim' ? '#b08d57' : '#f4f4f4'), 0, y, body.height(0, y) + 0.008))
    }
    if (kind === 'denim') {
      for (const sx of [-1, 1]) {
        const pocket = inflate([[sx * 0.1, t.L - 0.3], [sx * 0.3, t.L - 0.3], [sx * 0.3, t.L - 0.42], [sx * 0.2, t.L - 0.46], [sx * 0.1, t.L - 0.42]], { height: 0.008, falloff: 0.02, base: body.height })
        g.add(clipToMask(part(ctx, pocket.front, 'body', preset, 0.9), pocket.mask))
      }
    }
  }

  const ribbed = ['crewneck', 'hoodie', 'zipHoodie', 'quarterZip', 'bomber'].includes(kind)
  if (ribbed) {
    const band = (pts: Pt[]) => {
      const rib = inflate(pts, { height: 0.006, falloff: 0.02, base: body.height })
      g.add(clipToMask(part(ctx, rib.front, kind === 'bomber' ? trim : 'body', 'knit', 0.95), rib.mask))
    }
    band([[-t.hemW + 0.01, 0.0], [t.hemW - 0.01, 0.0], [t.hemW - 0.01, 0.11], [-t.hemW + 0.01, 0.11]])
    const S: Pt = [t.shoulderW, t.L - t.shoulderDrop]
    const a = t.sleeveAngle
    for (const sx of [-1, 1]) {
      const O: Pt = [S[0] + Math.cos(a) * t.sleeveLen, S[1] - Math.sin(a) * t.sleeveLen]
      const I: Pt = [O[0] - Math.sin(a) * t.sleeveEnd, O[1] - Math.cos(a) * t.sleeveEnd]
      const back: Pt = [-Math.cos(a) * 0.1, Math.sin(a) * 0.1]
      const quad: Pt[] = [O, I, [I[0] + back[0], I[1] + back[1]], [O[0] + back[0], O[1] + back[1]]].map(([x, y]) => [x * sx, y] as Pt)
      band(sx < 0 ? quad.reverse() : quad)
    }
  }
  if (kind === 'ringer') {
    const S: Pt = [t.shoulderW, t.L - t.shoulderDrop]
    const a = t.sleeveAngle
    for (const sx of [-1, 1]) {
      const O: Pt = [S[0] + Math.cos(a) * t.sleeveLen, S[1] - Math.sin(a) * t.sleeveLen]
      const I: Pt = [O[0] - Math.sin(a) * t.sleeveEnd, O[1] - Math.cos(a) * t.sleeveEnd]
      g.add(part(ctx, tube(onSurface([[O[0] * sx, O[1]], [I[0] * sx, I[1]]], body.height, 0.01), 0.014, false, 8, 6), trim, preset))
    }
  }
  if (kind === 'joggers') {
    const waist = inflate([[-0.36, 0.9], [0.36, 0.9], [0.36, 1.0], [-0.36, 1.0]], { height: 0.008, falloff: 0.02, base: body.height })
    g.add(clipToMask(part(ctx, waist.front, 'body', 'knit', 0.95), waist.mask))
    for (const sx of [-1, 1]) {
      g.add(part(ctx, tube([[sx * 0.04, 0.95, body.height(sx * 0.04, 0.95) + 0.012], [sx * 0.05, 0.8, body.height(sx * 0.05, 0.8) + 0.012], [sx * 0.07, 0.68, body.height(sx * 0.07, 0.68) + 0.012]], 0.007, false, 12, 6), trim, 'plastic'))
    }
  }
  if (kind === 'apron') {
    g.add(part(ctx, tube([[-0.18, 1.29, 0], [-0.2, 1.55, -0.02], [0, 1.68, -0.04], [0.2, 1.55, -0.02], [0.18, 1.29, 0]], 0.014, false, 32, 6), 'strap', 'fabric'))
    for (const sx of [-1, 1]) g.add(part(ctx, tube([[sx * 0.42, 0.74, 0], [sx * 0.55, 0.6, 0.01], [sx * 0.6, 0.3, 0.02]], 0.014, false, 16, 6), 'strap', 'fabric'))
  }

  for (const zone of ctx.item.printZones) {
    const placement = parseZone(params[`z_${zone.id}`])
    if (!placement) continue
    const z = getZone(ctx, zone.id)
    const zw = z.aspect * placement.h
    const geo = placement.back
      ? zoneOnBack(zw, placement.h, placement.cx, placement.cy, backDepth)
      : zoneOnSurface(zw, placement.h, placement.cx, placement.cy, body.height)
    g.add(zoneMesh(ctx, zone.id, geo))
  }
  return g
}
