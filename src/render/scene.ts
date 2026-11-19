import * as THREE from 'three'
import type { CameraPose, MockupItem } from '@/catalog/types'
import { BUILDERS } from '@/geometry'
import type { ResolvedItemState } from '@/state/resolve'
import { composeZone, type DesignSource, hasRelief, zoneCanvasSize } from './composer'
import { instantiateGlb } from './glb'
import type { BuildContext, ZoneSurface } from './types'

export function createZoneSurfaces(item: MockupItem, design: DesignSource | null, state: ResolvedItemState, longEdge: number, anisotropy = 8): Record<string, ZoneSurface> {
  const out: Record<string, ZoneSurface> = {}
  for (const zone of item.printZones) {
    const enabled = state.enabledZones[zone.id] !== false
    if (!design || typeof document === 'undefined') {
      out[zone.id] = { zone, canvas: null, texture: null, normalCanvas: null, normalTexture: null, enabled }
      continue
    }
    const { w, h } = zoneCanvasSize(zone.aspect, longEdge)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const normalCanvas = hasRelief(zone.effect) ? document.createElement('canvas') : null
    composeZone(canvas, zone, design, state.transforms[zone.id], normalCanvas)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = anisotropy
    texture.userData.zone = true
    let normalTexture: THREE.Texture | null = null
    if (normalCanvas) {
      normalTexture = new THREE.CanvasTexture(normalCanvas)
      normalTexture.anisotropy = anisotropy
      normalTexture.userData.zone = true
    }
    out[zone.id] = { zone, canvas, texture, normalCanvas, normalTexture, enabled }
  }
  return out
}

/** Recomposes zone canvases in place (detail view drags), so the 3D object does not need rebuilding. */
export function updateZoneSurfaces(surfaces: Record<string, ZoneSurface>, design: DesignSource | null, state: ResolvedItemState) {
  for (const s of Object.values(surfaces)) {
    if (!s.canvas) continue
    composeZone(s.canvas, s.zone, design, state.transforms[s.zone.id], s.normalCanvas)
    if (s.texture) s.texture.needsUpdate = true
    if (s.normalTexture) s.normalTexture.needsUpdate = true
  }
}

export function disposeZoneSurfaces(surfaces: Record<string, ZoneSurface>) {
  for (const s of Object.values(surfaces)) {
    s.texture?.dispose()
    s.normalTexture?.dispose()
  }
}

export function buildItemObject(item: MockupItem, ctx: BuildContext): THREE.Object3D {
  const root = new THREE.Group()
  root.name = item.id
  const obj = item.geometry.kind === 'procedural' ? BUILDERS[item.geometry.builder](item.geometry.params, ctx) : instantiateGlb(item, ctx)
  root.add(obj)
  return root
}

export function applyColors(root: THREE.Object3D, colors: Record<string, string>) {
  root.traverse((obj) => {
    const target = obj.userData.colorTarget as string | undefined
    if (!target || !(obj instanceof THREE.Mesh)) return
    const hex = colors[target]
    const mat = obj.material as THREE.MeshStandardMaterial
    if (!hex || !mat.color) return
    mat.color.set(hex).multiplyScalar(obj.userData.shade ?? 1)
  })
}

export function setZoneVisibility(root: THREE.Object3D, enabled: Record<string, boolean>) {
  root.traverse((obj) => {
    const zoneId = obj.userData.zoneId as string | undefined
    if (zoneId) obj.visible = enabled[zoneId] !== false
  })
}

const _box = new THREE.Box3()
const _corners = Array.from({ length: 8 }, () => new THREE.Vector3())

/**
 * Positions the camera for a pose and fits the object's bounding box to the frame. Purely geometric, so every
 * render of the same item and pose frames identically.
 */
export function frameCamera(camera: THREE.PerspectiveCamera, root: THREE.Object3D, pose: CameraPose, aspect: number) {
  root.updateMatrixWorld(true)
  _box.setFromObject(root)
  const center = _box.getCenter(new THREE.Vector3())
  const az = THREE.MathUtils.degToRad(pose.azimuth)
  const el = THREE.MathUtils.degToRad(pose.elevation)
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
  camera.aspect = aspect
  camera.updateProjectionMatrix()
  const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0)
  const forward = dir.clone().negate()
  const right = new THREE.Vector3().crossVectors(forward, up).normalize()
  const camUp = new THREE.Vector3().crossVectors(right, forward).normalize()
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const tanH = tanV * aspect
  const { min, max } = _box
  let i = 0
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) _corners[i++].set(x, y, z)
  let dist = 0
  for (const c of _corners) {
    const rel = c.clone().sub(center)
    const depth = rel.dot(dir)
    dist = Math.max(dist, depth + Math.abs(rel.dot(right)) / tanH, depth + Math.abs(rel.dot(camUp)) / tanV)
  }
  dist *= pose.padding ?? 1.1
  camera.position.copy(center).addScaledVector(dir, dist)
  camera.up.copy(camUp)
  camera.lookAt(center)
  camera.near = Math.max(0.01, dist / 100)
  camera.far = dist * 10
  camera.updateProjectionMatrix()
  return { center, distance: dist }
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    if (!obj.geometry.userData.shared) obj.geometry.dispose()
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      for (const value of Object.values(m)) {
        if (value instanceof THREE.Texture && !value.userData.shared && !value.userData.zone) value.dispose()
      }
      m.dispose()
    }
  })
}

export function createLights() {
  const g = new THREE.Group()
  const key = new THREE.DirectionalLight(0xffffff, 1.5)
  key.position.set(-3, 5, 4)
  const fill = new THREE.DirectionalLight(0xffffff, 0.45)
  fill.position.set(4, 1.5, 3)
  const rim = new THREE.DirectionalLight(0xffffff, 0.6)
  rim.position.set(0, 3, -5)
  g.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.35))
  return g
}
