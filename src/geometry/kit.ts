import * as THREE from 'three'
import type { MaterialPreset, PrintZone } from '@/catalog/types'
import { createMaterial, createZoneMaterial } from '@/render/materials'
import type { BuildContext } from '@/render/types'

export type Pt = [number, number]

/** A mesh tinted by a user-editable color target. `shade` darkens it for linings and seams. */
export function part(ctx: BuildContext, geo: THREE.BufferGeometry, target: string, preset?: MaterialPreset, shade = 1) {
  const mat = createMaterial(preset ?? ctx.item.material, ctx.colors[target] ?? '#ffffff')
  if ('color' in mat) mat.color.multiplyScalar(shade)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = `color:${target}`
  mesh.userData.colorTarget = target
  mesh.userData.shade = shade
  return mesh
}

/** A mesh with a fixed color (zippers, grommets, screws). */
export function fixed(geo: THREE.BufferGeometry, preset: MaterialPreset, hex: string) {
  const mesh = new THREE.Mesh(geo, createMaterial(preset, hex))
  mesh.name = 'fixed'
  return mesh
}

/** The overlay that displays a print zone's composed canvas. Always created so drag hit-testing and tests can find it. */
export function zoneMesh(ctx: BuildContext, zoneId: string, geo: THREE.BufferGeometry, preset?: MaterialPreset) {
  const surface = ctx.zones[zoneId]
  const mesh = new THREE.Mesh(geo, createZoneMaterial(preset ?? ctx.item.material, surface))
  mesh.name = `zone:${zoneId}`
  mesh.userData.zoneId = zoneId
  mesh.visible = surface?.enabled !== false
  mesh.renderOrder = 3
  return mesh
}

export function getZone(ctx: BuildContext, zoneId: string): PrintZone {
  const zone = ctx.item.printZones.find((z) => z.id === zoneId)
  if (!zone) throw new Error(`${ctx.item.id} has no zone "${zoneId}"`)
  return zone
}

/** Width for a zone of the given height, honoring the catalog aspect so the canvas is never stretched. */
export function zoneWidth(ctx: BuildContext, zoneId: string, height: number) {
  return getZone(ctx, zoneId).aspect * height
}

export function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key]
  return typeof v === 'number' ? v : fallback
}

export function str<T extends string>(params: Record<string, unknown>, key: string, fallback: T): T {
  const v = params[key]
  return (typeof v === 'string' ? v : fallback) as T
}

export function bool(params: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = params[key]
  return typeof v === 'boolean' ? v : fallback
}

export function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  const rr = Math.min(r, w / 2, h / 2)
  s.moveTo(x + rr, y)
  s.lineTo(x + w - rr, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rr)
  s.lineTo(x + w, y + h - rr)
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  s.lineTo(x + rr, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rr)
  s.lineTo(x, y + rr)
  s.quadraticCurveTo(x, y, x + rr, y)
  return s
}

export function shapeFromPoints(points: Pt[]) {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
}

/** Planar UVs mapping the rectangle (cx±w/2, cy±h/2) to [0,1]. */
export function planarUV(geo: THREE.BufferGeometry, w: number, h: number, cx = 0, cy = 0) {
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - cx) / w + 0.5
    uv[i * 2 + 1] = (pos.getY(i) - cy) / h + 0.5
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

/** Flat shape overlay with planar UVs over the zone rectangle, so rounded corners clip the design naturally. */
export function shapeOverlay(shape: THREE.Shape, w: number, h: number, z: number, cx = 0, cy = 0) {
  const geo = new THREE.ShapeGeometry(shape, 24)
  planarUV(geo, w, h, cx, cy)
  geo.translate(0, 0, z)
  return geo
}

/** Subdivided plane whose Z follows `zfn`, used for surfaces that bend (paper curl, cloth, flags). */
export function displacedGrid(w: number, h: number, sx: number, sy: number, zfn: (x: number, y: number) => number, cx = 0, cy = 0) {
  const geo = new THREE.PlaneGeometry(w, h, sx, sy)
  geo.translate(cx, cy, 0)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, zfn(pos.getX(i), pos.getY(i)))
  geo.computeVertexNormals()
  return geo
}

/**
 * Open cylinder segment centered on the front (+Z). Width along the surface is r * theta, so callers pass the
 * zone aspect and height and get the matching arc.
 */
export function cylinderZone(rBottom: number, rTop: number, height: number, yCenter: number, aspect: number, segs = 72) {
  const rMid = (rBottom + rTop) / 2
  const theta = Math.min(Math.PI * 1.96, (aspect * height) / rMid)
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, segs, 8, true, -theta / 2, theta)
  geo.translate(0, yCenter, 0)
  return geo
}

export function lathe(points: Pt[], segs = 96) {
  const geo = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segs)
  geo.computeVertexNormals()
  return geo
}

export function tube(points: [number, number, number][], radius: number, closed = false, segs = 64, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.5)
  return new THREE.TubeGeometry(curve, segs, radius, radial, closed)
}

export function chaikin(points: Pt[], iterations = 2, closed = true): Pt[] {
  let pts = points
  for (let it = 0; it < iterations; it++) {
    const out: Pt[] = []
    const n = pts.length
    const last = closed ? n : n - 1
    if (!closed) out.push(pts[0])
    for (let i = 0; i < last; i++) {
      const [x0, y0] = pts[i]
      const [x1, y1] = pts[(i + 1) % n]
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75])
    }
    if (!closed) out.push(pts[n - 1])
    pts = out
  }
  return pts
}

/** Rounds the corners of a polygon by roughly `radius` while keeping straight edges straight. */
export function roundCorners(points: Pt[], radius: number): Pt[] {
  const dense: Pt[] = []
  const n = points.length
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % n]
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / radius))
    for (let s = 0; s < steps; s++) dense.push([x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps])
  }
  return chaikin(dense, 3)
}

/** Builds a symmetric closed outline from its right half, listed from top-center to bottom-center. */
export function mirrorHalf(rightHalf: Pt[]): Pt[] {
  const left = rightHalf
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y] as Pt)
  return [...rightHalf, ...left]
}

export function roundedBox(w: number, h: number, d: number, r: number, bevel = 0.02) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
    depth: Math.max(0.001, d - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 16,
  })
  geo.translate(0, 0, -(d - bevel * 2) / 2)
  return geo
}

export function extrudeShape(shape: THREE.Shape, depth: number, bevel = 0, curveSegments = 24) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  })
  geo.translate(0, 0, -(depth - bevel * 2) / 2)
  return geo
}

export function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group()
  for (const c of children) g.add(c)
  return g
}

export function at<T extends THREE.Object3D>(obj: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): T {
  obj.position.set(x, y, z)
  obj.rotation.set(rx, ry, rz)
  return obj
}
