import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { MockupItem } from '@/catalog/types'
import { createZoneMaterial } from './materials'
import type { BuildContext } from './types'

const cache = new Map<string, THREE.Group>()
const pending = new Map<string, Promise<THREE.Group>>()
let loader: GLTFLoader | null = null

function getLoader(renderer?: THREE.WebGLRenderer) {
  if (!loader) {
    loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}decoders/basis/`)
    if (renderer) ktx2.detectSupport(renderer)
    loader.setKTX2Loader(ktx2)
  }
  return loader
}

/** Adds a loaded scene to the cache. Instances clone it, so its geometry and textures are marked shared. */
export function registerGlb(url: string, scene: THREE.Group) {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    obj.geometry.userData.shared = true
    for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.userData.shared = true
    }
  })
  cache.set(url, scene)
  return scene
}

export function preloadGlb(url: string, renderer?: THREE.WebGLRenderer): Promise<THREE.Group> {
  const hit = cache.get(url)
  if (hit) return Promise.resolve(hit)
  let p = pending.get(url)
  if (!p) {
    p = getLoader(renderer)
      .loadAsync(url)
      .then((gltf) => registerGlb(url, gltf.scene))
      .finally(() => pending.delete(url))
    pending.set(url, p)
  }
  return p
}

export async function ensureItemAssets(item: MockupItem, renderer?: THREE.WebGLRenderer) {
  if (item.geometry.kind === 'glb') await preloadGlb(item.geometry.url, renderer)
}

/**
 * Instantiates a loaded GLB for an item. Print zones are found by mesh name and get the composed canvas, remapped
 * from the zone's uvRect to the full texture. Color targets are tagged by mesh name so `applyColors` can tint them.
 */
export function instantiateGlb(item: MockupItem, ctx: BuildContext): THREE.Object3D {
  if (item.geometry.kind !== 'glb') throw new Error('not a glb item')
  const source = cache.get(item.geometry.url)
  if (!source) throw new Error(`GLB not loaded: ${item.geometry.url}`)
  const root = source.clone(true)
  if (item.geometry.scale) root.scale.setScalar(item.geometry.scale)
  const targetByMesh = new Map<string, string>()
  for (const t of item.colorTargets) for (const name of t.meshNames) targetByMesh.set(name, t.id)

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const zone = item.printZones.find((z) => z.meshName === obj.name)
    if (zone) {
      const surface = ctx.zones[zone.id]
      const mat = createZoneMaterial(item.material, surface)
      const [u0, v0, u1, v1] = zone.uvRect
      for (const tex of [surface?.texture, surface?.normalTexture]) {
        if (!tex) continue
        tex.flipY = false
        tex.repeat.set(1 / (u1 - u0), 1 / (v1 - v0))
        tex.offset.set(-u0 / (u1 - u0), -v0 / (v1 - v0))
      }
      obj.material = mat
      obj.userData.zoneId = zone.id
      obj.visible = surface?.enabled !== false
      obj.renderOrder = 3
      return
    }
    const target = targetByMesh.get(obj.name)
    obj.material = (obj.material as THREE.Material).clone()
    if (target) {
      obj.userData.colorTarget = target
      obj.userData.shade = 1
    }
  })
  return root
}
