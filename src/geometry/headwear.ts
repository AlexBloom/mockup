import * as THREE from 'three'
import type { BuilderParams } from '@/catalog/types'
import type { BuildContext } from '@/render/types'
import { at, bool, cylinderZone, getZone, group, lathe, num, part, str, tube, zoneMesh } from './kit'

type CapStyle = 'structured' | 'dad' | 'trucker' | 'snapback' | 'camper'

const CAP: Record<CapStyle, { sy: number; sz: number; curve: number; tilt: number; panels: number; brimLen: number }> = {
  structured: { sy: 0.84, sz: 1.12, curve: 0.55, tilt: 0.12, panels: 6, brimLen: 0.44 },
  dad: { sy: 0.72, sz: 1.14, curve: 0.65, tilt: 0.16, panels: 6, brimLen: 0.42 },
  trucker: { sy: 0.9, sz: 1.12, curve: 0.5, tilt: 0.12, panels: 5, brimLen: 0.44 },
  snapback: { sy: 0.9, sz: 1.1, curve: 0, tilt: 0.03, panels: 6, brimLen: 0.46 },
  camper: { sy: 0.62, sz: 1.08, curve: 0.1, tilt: 0.04, panels: 5, brimLen: 0.38 },
}

/** Visor/brim: an annular sector in front of the crown base, then bent down at the sides. */
function brim(r: number, sz: number, length: number, curve: number, tilt: number) {
  const A = 1.3
  const n = 40
  const shape = new THREE.Shape()
  for (let i = 0; i <= n; i++) {
    const a = -A + (2 * A * i) / n
    const x = r * Math.sin(a)
    const z = r * sz * Math.cos(a)
    if (i === 0) shape.moveTo(x, z)
    else shape.lineTo(x, z)
  }
  for (let i = n; i >= 0; i--) {
    const a = -A + (2 * A * i) / n
    const reach = length * Math.pow(Math.cos((a / A) * (Math.PI / 2)), 0.55)
    shape.lineTo(r * 1.04 * Math.sin(a) * (1 + reach * 0.35), r * sz * Math.cos(a) + reach)
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 8 })
  geo.rotateX(Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const forward = Math.max(0, z - r * sz * 0.6)
    pos.setY(i, pos.getY(i) - curve * x * x * Math.min(1, forward * 2.2) - tilt * forward)
  }
  geo.computeVertexNormals()
  return geo
}

function sphereArcLength(r: number, sy: number, sz: number, phi: number, t0: number, t1: number) {
  let len = 0
  let prev: THREE.Vector3 | null = null
  for (let i = 0; i <= 32; i++) {
    const t = t0 + ((t1 - t0) * i) / 32
    const p = new THREE.Vector3(-r * Math.cos(phi) * Math.sin(t), r * sy * Math.cos(t), r * sz * Math.sin(phi) * Math.sin(t))
    if (prev) len += p.distanceTo(prev)
    prev = p
  }
  return len
}

export function buildCap(params: BuilderParams, ctx: BuildContext) {
  const style = str<CapStyle>(params, 'style', 'structured')
  const c = CAP[style]
  const r = 0.5
  const g = group()
  const scale = (geo: THREE.BufferGeometry) => geo.scale(1, c.sy, c.sz)
  const preset = ctx.item.material

  if (style === 'trucker') {
    const frontLen = 2.5
    const front = scale(new THREE.SphereGeometry(r, 64, 32, Math.PI / 2 - frontLen / 2, frontLen, 0, Math.PI / 2))
    const back = scale(new THREE.SphereGeometry(r, 64, 32, Math.PI / 2 + frontLen / 2, Math.PI * 2 - frontLen, 0, Math.PI / 2))
    const liner = scale(new THREE.SphereGeometry(r * 0.985, 48, 24, Math.PI / 2 + frontLen / 2, Math.PI * 2 - frontLen, 0, Math.PI / 2))
    g.add(part(ctx, front, 'body', preset), part(ctx, back, 'mesh', 'mesh'), part(ctx, liner, 'mesh', 'fabric', 0.5))
  } else {
    g.add(part(ctx, scale(new THREE.SphereGeometry(r, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2)), 'body', preset))
  }

  const seamPhis = Array.from({ length: c.panels }, (_, i) => Math.PI / 2 + (c.panels === 6 ? 0 : Math.PI / c.panels) + (i * Math.PI * 2) / c.panels)
  for (const phi of seamPhis) {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 12; i++) {
      const t = 0.06 + ((Math.PI / 2 - 0.06) * i) / 12
      const rr = r * 1.004
      pts.push([-rr * Math.cos(phi) * Math.sin(t), rr * c.sy * Math.cos(t), rr * c.sz * Math.sin(phi) * Math.sin(t)])
    }
    g.add(part(ctx, tube(pts, 0.0035, false, 24, 5), 'body', preset, 0.78))
  }
  g.add(at(part(ctx, new THREE.SphereGeometry(0.035, 16, 12), 'body', preset), 0, r * c.sy, 0))
  g.add(at(part(ctx, brim(r, c.sz, c.brimLen, c.curve, c.tilt), 'brim', preset), 0, 0.015, 0))

  const zone = getZone(ctx, 'front')
  const t0 = num(params, 'zoneTop', style === 'camper' ? 0.5 : 0.45)
  const t1 = num(params, 'zoneBottom', 1.42)
  const height = sphereArcLength(r, c.sy, c.sz, Math.PI / 2, t0, t1)
  const tm = (t0 + t1) / 2
  const phiLen = Math.min(2.3, (zone.aspect * height) / (r * Math.sin(tm) * ((1 + c.sz) / 2)))
  const zr = r * 1.008
  const zoneGeo = new THREE.SphereGeometry(zr, 48, 24, Math.PI / 2 - phiLen / 2, phiLen, t0, t1 - t0)
  zoneGeo.scale(1, c.sy, c.sz)
  g.add(zoneMesh(ctx, 'front', zoneGeo))
  g.position.y = -0.2
  return group(g)
}

export function buildBeanie(params: BuilderParams, ctx: BuildContext) {
  const g = group(
    part(ctx, lathe([[0.41, 0.0], [0.43, 0.02], [0.43, 0.5], [0.4, 0.72], [0.28, 0.87], [0.12, 0.92], [0, 0.93]]), 'body', 'knit'),
    part(ctx, lathe([[0.43, -0.03], [0.455, -0.015], [0.458, 0.29], [0.448, 0.32], [0.43, 0.33]]), 'body', 'knit', 0.96),
  )
  if (bool(params, 'pom')) g.add(at(part(ctx, new THREE.IcosahedronGeometry(0.17, 4), 'pom', 'knit'), 0, 0.98, 0))
  const zone = getZone(ctx, 'cuff')
  g.add(zoneMesh(ctx, 'cuff', cylinderZone(0.462, 0.462, 0.2, 0.15, zone.aspect)))
  g.position.y = -0.4
  return group(g)
}

export function buildBucketHat(_params: BuilderParams, ctx: BuildContext) {
  const preset = ctx.item.material
  const g = group(
    part(ctx, lathe([[0.4, 0.0], [0.395, 0.3], [0.37, 0.42], [0.3, 0.465], [0, 0.47]]), 'body', preset),
    part(ctx, lathe([[0.74, -0.21], [0.7, -0.17], [0.55, -0.06], [0.4, 0.0]]), 'body', preset, 0.97),
  )
  for (const rr of [0.5, 0.58, 0.66]) {
    const stitch = new THREE.TorusGeometry(rr, 0.003, 4, 96)
    stitch.rotateX(Math.PI / 2)
    const y = -0.06 - ((rr - 0.55) / 0.15) * 0.11
    g.add(at(part(ctx, stitch, 'body', preset, 0.8), 0, Math.min(-0.03, y) + 0.004, 0))
  }
  const zone = getZone(ctx, 'front')
  g.add(zoneMesh(ctx, 'front', cylinderZone(0.404, 0.392, 0.24, 0.19, zone.aspect)))
  return g
}

export function buildVisor(_params: BuilderParams, ctx: BuildContext) {
  const preset = ctx.item.material
  const len = Math.PI * 1.55
  const band = new THREE.CylinderGeometry(0.46, 0.47, 0.17, 72, 1, true, -len / 2, len)
  const g = group(part(ctx, band, 'body', preset))
  g.add(at(part(ctx, brim(0.47, 1, 0.42, 0.5, 0.12), 'brim', preset), 0, -0.085, 0))
  const zone = getZone(ctx, 'front')
  g.add(zoneMesh(ctx, 'front', cylinderZone(0.474, 0.466, 0.12, 0.0, zone.aspect)))
  return g
}
