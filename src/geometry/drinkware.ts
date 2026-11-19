import * as THREE from 'three'
import type { BuilderParams } from '@/catalog/types'
import type { BuildContext } from '@/render/types'
import { at, cylinderZone, fixed, getZone, group, lathe, num, part, type Pt, str, tube, zoneMesh } from './kit'

type VesselKind =
  | 'mug'
  | 'mug15'
  | 'campMug'
  | 'travelMug'
  | 'tumbler'
  | 'glassCan'
  | 'pint'
  | 'shot'
  | 'coffeeCup'
  | 'canCooler'
  | 'sodaCan'
  | 'candle'

type VesselSpec = {
  r0: number
  r1: number
  h: number
  wall: number
  base: number
  handle?: 'round' | 'flat'
  lid?: 'travel' | 'flat' | 'coffee' | 'bamboo'
  straw?: boolean
  rim?: boolean
  canShape?: boolean
}

const SPECS: Record<VesselKind, VesselSpec> = {
  mug: { r0: 0.42, r1: 0.42, h: 0.95, wall: 0.035, base: 0.08, handle: 'round' },
  mug15: { r0: 0.44, r1: 0.44, h: 1.12, wall: 0.035, base: 0.08, handle: 'round' },
  campMug: { r0: 0.46, r1: 0.46, h: 0.72, wall: 0.02, base: 0.04, handle: 'flat', rim: true },
  travelMug: { r0: 0.32, r1: 0.4, h: 1.5, wall: 0.03, base: 0.06, lid: 'travel', handle: 'round' },
  tumbler: { r0: 0.3, r1: 0.42, h: 1.45, wall: 0.03, base: 0.06, lid: 'flat', straw: true },
  glassCan: { r0: 0.34, r1: 0.34, h: 1.2, wall: 0.015, base: 0.04, lid: 'bamboo', straw: true, canShape: true },
  pint: { r0: 0.3, r1: 0.41, h: 1.3, wall: 0.025, base: 0.14 },
  shot: { r0: 0.24, r1: 0.27, h: 0.42, wall: 0.03, base: 0.12 },
  coffeeCup: { r0: 0.28, r1: 0.4, h: 1.05, wall: 0.01, base: 0.03, lid: 'coffee' },
  canCooler: { r0: 0.37, r1: 0.37, h: 0.9, wall: 0.04, base: 0.04 },
  sodaCan: { r0: 0.33, r1: 0.33, h: 1.22, wall: 0.01, base: 0.03, canShape: true },
  candle: { r0: 0.4, r1: 0.4, h: 0.85, wall: 0.03, base: 0.07 },
}

export function buildDrinkware(params: BuilderParams, ctx: BuildContext) {
  const kind = str<VesselKind>(params, 'kind', 'mug')
  const s = SPECS[kind]
  const g = group()
  const rAt = (y: number) => s.r0 + (s.r1 - s.r0) * (y / s.h)
  const isGlass = ctx.item.material === 'glass'

  if (s.canShape) {
    const neck = 0.08
    const outer: Pt[] = [
      [0, 0.02],
      [s.r0 * 0.75, 0],
      [s.r0 * 0.92, 0.015],
      [s.r0, 0.08],
      [s.r0, s.h - 0.12],
      [s.r0 * 0.86, s.h - neck * 0.25],
      [s.r0 * 0.82, s.h],
    ]
    if (kind === 'sodaCan') {
      outer.push([s.r0 * 0.78, s.h], [s.r0 * 0.74, s.h - 0.03], [0, s.h - 0.03])
      g.add(part(ctx, lathe(outer), 'body', 'metal'))
      const tab = new THREE.BoxGeometry(0.12, 0.008, 0.2)
      g.add(at(fixed(tab, 'brushedMetal', '#c8c8cc'), 0, s.h - 0.02, 0.05))
    } else {
      outer.push([s.r0 * 0.8, s.h])
      const inner: Pt[] = [
        [s.r0 * 0.8, s.h],
        [s.r0 * 0.8 - s.wall, s.h - 0.01],
        [s.r0 - s.wall, s.h - 0.13],
        [s.r0 - s.wall, s.base],
        [0, s.base],
      ]
      g.add(part(ctx, lathe(outer), 'body'), part(ctx, lathe(inner), 'body'))
    }
  } else if (kind === 'canCooler') {
    const outer: Pt[] = [
      [0, 0],
      [s.r0 - 0.03, 0],
      [s.r0, 0.03],
      [s.r0, s.h - 0.02],
      [s.r0 - 0.04, s.h],
    ]
    g.add(part(ctx, lathe(outer), 'body', 'fabric'))
    const can: Pt[] = [
      [s.r0 - 0.04, s.h - 0.02],
      [s.r0 - 0.045, s.h + 0.2],
      [(s.r0 - 0.045) * 0.86, s.h + 0.27],
      [(s.r0 - 0.045) * 0.82, s.h + 0.3],
      [0, s.h + 0.28],
    ]
    g.add(fixed(lathe(can), 'brushedMetal', '#c9ccd2'))
  } else {
    const outer: Pt[] = [
      [0, 0],
      [s.r0 - 0.03, 0],
      [s.r0, 0.03],
      [rAt(s.h * 0.98), s.h * 0.98],
      [s.r1 - s.wall * 0.3, s.h],
    ]
    const inner: Pt[] = [
      [s.r1 - s.wall * 0.3, s.h],
      [s.r1 - s.wall, s.h - 0.01],
      [rAt(s.base) - s.wall, s.base + 0.02],
      [rAt(s.base) - s.wall - 0.03, s.base],
      [0, s.base],
    ]
    g.add(part(ctx, lathe(outer), 'body'))
    const hasInterior = ctx.item.colorTargets.some((c) => c.id === 'interior')
    g.add(part(ctx, lathe(inner), hasInterior ? 'interior' : 'body'))
    if (isGlass) {
      const base: Pt[] = [
        [0, 0.005],
        [s.r0 - s.wall * 1.2, 0.005],
        [s.r0 - s.wall * 1.2, s.base - 0.005],
        [0, s.base - 0.005],
      ]
      g.add(part(ctx, lathe(base), 'body'))
    }
    if (s.rim) {
      const rim = new THREE.TorusGeometry(s.r1 - 0.004, 0.014, 12, 96)
      rim.rotateX(Math.PI / 2)
      g.add(at(part(ctx, rim, 'rim', 'enamel'), 0, s.h, 0))
    }
    if (kind === 'candle') {
      const wax: Pt[] = [
        [0, s.h * 0.72],
        [s.r0 - s.wall - 0.002, s.h * 0.72],
        [s.r0 - s.wall - 0.002, s.base + 0.01],
      ]
      g.add(part(ctx, lathe(wax), 'wax', 'plastic'))
      g.add(at(fixed(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), 'rubber', '#222222'), 0, s.h * 0.72 + 0.05, 0))
    }
  }

  if (s.handle) {
    const hh = s.h * (s.handle === 'flat' ? 0.5 : 0.56)
    const handleR = hh / 2
    const handle =
      s.handle === 'round'
        ? new THREE.TorusGeometry(handleR, 0.045, 16, 48, Math.PI)
        : new THREE.TorusGeometry(handleR, 0.022, 8, 48, Math.PI)
    if (s.handle === 'flat') handle.scale(1, 1, 2.2)
    handle.rotateZ(-Math.PI / 2)
    const y = s.h * 0.54
    const target = ctx.item.colorTargets.some((c) => c.id === 'handle') ? 'handle' : 'body'
    g.add(at(part(ctx, handle, target), rAt(y) - 0.02, y, 0))
  }

  if (s.lid === 'travel' || s.lid === 'flat') {
    const lidH = s.lid === 'travel' ? 0.16 : 0.07
    const lid: Pt[] = [
      [0, s.h + lidH],
      [s.r1 * 0.9, s.h + lidH],
      [s.r1 + 0.012, s.h + lidH * 0.4],
      [s.r1 + 0.012, s.h - 0.02],
      [s.r1 - 0.02, s.h - 0.02],
    ]
    g.add(part(ctx, lathe(lid), 'lid', 'plastic'))
  }
  if (s.lid === 'coffee') {
    const lid: Pt[] = [
      [0, s.h + 0.1],
      [s.r1 * 0.75, s.h + 0.1],
      [s.r1 * 0.85, s.h + 0.05],
      [s.r1 + 0.025, s.h + 0.03],
      [s.r1 + 0.025, s.h - 0.03],
      [s.r1 - 0.01, s.h - 0.03],
    ]
    g.add(part(ctx, lathe(lid), 'lid', 'plastic'))
  }
  if (s.lid === 'bamboo') {
    const lid = new THREE.CylinderGeometry(s.r0 * 0.84, s.r0 * 0.84, 0.05, 64)
    g.add(at(fixed(lid, 'wood', '#c89b63'), 0, s.h + 0.02, 0))
  }
  if (s.straw) {
    const top = s.h + (s.lid === 'flat' ? 0.07 : 0.04)
    g.add(fixed(tube([[0.05, s.h * 0.2, 0], [0.08, top, 0.02], [0.12, top + 0.42, 0.04]], 0.022, false, 24, 10), 'plastic', '#f2f2f2'))
  }

  const zone = getZone(ctx, 'wrap')
  const zh = num(params, 'zoneHeight', s.h * 0.7)
  const yc = num(params, 'zoneY', s.h * 0.5)
  const off = isGlass ? 0.003 : 0.004
  const rb = (s.canShape || kind === 'canCooler' ? s.r0 : rAt(yc - zh / 2)) + off
  const rt = (s.canShape || kind === 'canCooler' ? s.r0 : rAt(yc + zh / 2)) + off
  if (kind === 'candle' || params.label === true) {
    g.add(part(ctx, cylinderZone(rb - 0.001, rt - 0.001, zh, yc, zone.aspect), 'label', 'paper'))
  }
  g.add(zoneMesh(ctx, 'wrap', cylinderZone(rb, rt, zh, yc, zone.aspect), kind === 'candle' || params.label === true ? 'paper' : undefined))
  g.position.y = -s.h / 2
  return group(g)
}

type BottleKind = 'water' | 'sports' | 'wine' | 'beer' | 'jar'

export function buildBottle(params: BuilderParams, ctx: BuildContext) {
  const kind = str<BottleKind>(params, 'kind', 'water')
  const g = group()
  let body: Pt[]
  let bodyR: number
  let bodyTop: number
  let bodyBottom: number
  switch (kind) {
    case 'water':
      bodyR = 0.32
      bodyBottom = 0.08
      bodyTop = 1.45
      body = [[0, 0], [0.29, 0], [0.32, 0.04], [0.32, 1.5], [0.3, 1.62], [0.22, 1.72], [0.2, 1.8], [0.2, 1.84], [0, 1.84]]
      g.add(part(ctx, lathe(body), 'body', 'plastic'))
      g.add(part(ctx, lathe([[0, 2.1], [0.17, 2.1], [0.22, 2.04], [0.22, 1.82], [0.19, 1.8]]), 'cap', 'plastic'))
      g.add(at(part(ctx, new THREE.TorusGeometry(0.1, 0.025, 10, 32), 'cap', 'plastic'), 0, 2.16, 0))
      break
    case 'sports':
      bodyR = 0.33
      bodyBottom = 0.12
      bodyTop = 1.3
      body = [[0, 0], [0.3, 0], [0.33, 0.05], [0.33, 0.6], [0.3, 0.75], [0.33, 0.9], [0.33, 1.4], [0.27, 1.52], [0.24, 1.56], [0, 1.56]]
      g.add(part(ctx, lathe(body), 'body', 'plastic'))
      g.add(part(ctx, lathe([[0, 1.9], [0.06, 1.9], [0.08, 1.8], [0.24, 1.72], [0.26, 1.54], [0.22, 1.52]]), 'cap', 'plastic'))
      break
    case 'wine':
      bodyR = 0.3
      bodyBottom = 0.15
      bodyTop = 1.25
      body = [[0, 0.08], [0.22, 0], [0.29, 0.01], [0.3, 0.06], [0.3, 1.45], [0.26, 1.7], [0.13, 1.95], [0.11, 2.1], [0.11, 2.5], [0.12, 2.55], [0, 2.55]]
      g.add(part(ctx, lathe(body), 'glass', 'plastic'))
      g.add(part(ctx, lathe([[0, 2.6], [0.12, 2.6], [0.12, 2.18], [0.11, 2.16]]), 'cap', 'metal'))
      break
    case 'beer':
      bodyR = 0.28
      bodyBottom = 0.1
      bodyTop = 1.05
      body = [[0, 0.05], [0.25, 0], [0.28, 0.04], [0.28, 1.2], [0.24, 1.4], [0.12, 1.65], [0.1, 1.9], [0.11, 1.94], [0, 1.94]]
      g.add(part(ctx, lathe(body), 'glass', 'plastic'))
      g.add(part(ctx, lathe([[0, 1.99], [0.12, 1.99], [0.125, 1.93], [0.11, 1.92]]), 'cap', 'metal'))
      break
    case 'jar':
      bodyR = 0.42
      bodyBottom = 0.12
      bodyTop = 0.7
      body = [[0, 0], [0.38, 0], [0.42, 0.05], [0.42, 0.78], [0.36, 0.86], [0.35, 0.92], [0, 0.92]]
      g.add(part(ctx, lathe(body), 'glass', 'glass'))
      g.add(part(ctx, lathe([[0, 1.04], [0.36, 1.04], [0.38, 1.02], [0.38, 0.9], [0.36, 0.89]]), 'cap', 'metal'))
      break
  }
  const zone = getZone(ctx, 'wrap')
  const zh = (bodyTop - bodyBottom) * num(params, 'zoneFill', 0.85)
  const yc = (bodyTop + bodyBottom) / 2
  const labeled = params.label === true
  if (labeled) g.add(part(ctx, cylinderZone(bodyR + 0.003, bodyR + 0.003, zh, yc, zone.aspect), 'label', 'paper'))
  g.add(zoneMesh(ctx, 'wrap', cylinderZone(bodyR + 0.005, bodyR + 0.005, zh, yc, zone.aspect), labeled ? 'paper' : undefined))
  const box = new THREE.Box3().setFromObject(g)
  g.position.y = -(box.max.y + box.min.y) / 2
  return group(g)
}
