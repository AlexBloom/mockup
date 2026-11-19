import * as THREE from 'three'
import type { MaterialPreset } from '@/catalog/types'
import { brushedNormal, fabricNormal, knitNormal, meshAlpha, paperNormal } from './textures'
import type { ZoneSurface } from './types'

type Mat = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial

export function createMaterial(preset: MaterialPreset, hex: string): Mat {
  const color = new THREE.Color(hex)
  switch (preset) {
    case 'fabric':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.92, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.2, 0.2), side: THREE.DoubleSide })
    case 'knit':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.97, normalMap: knitNormal(), normalScale: new THREE.Vector2(0.9, 0.9), side: THREE.DoubleSide })
    case 'mesh':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.9, alphaMap: meshAlpha(), alphaTest: 0.5, side: THREE.DoubleSide })
    case 'canvas':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.96, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.9, 0.9), side: THREE.DoubleSide })
    case 'embroidery':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.85, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.6, 0.6) })
    case 'ceramic':
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.08 })
    case 'enamel':
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 })
    case 'metal':
      return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22 })
    case 'brushedMetal':
      return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.34, normalMap: brushedNormal(), normalScale: new THREE.Vector2(0.25, 0.25) })
    case 'gold':
      return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.18 })
    case 'glass':
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 })
    case 'acrylic':
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.03, transparent: true, opacity: 0.4, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.8 })
    case 'paper':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.82, normalMap: paperNormal(), normalScale: new THREE.Vector2(0.15, 0.15) })
    case 'glossyPaper':
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.15 })
    case 'vinyl':
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 })
    case 'holographic':
      return Object.assign(new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0.35, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1, envMapIntensity: 1.6 }), {
        iridescenceThicknessMinimum: 200,
        iridescenceThicknessMaximum: 800,
      })
    case 'plastic':
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.3 })
    case 'rubber':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.78 })
    case 'wood':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.68, normalMap: brushedNormal(), normalScale: new THREE.Vector2(0.4, 0.4) })
    case 'screen':
      return new THREE.MeshBasicMaterial({ color, toneMapped: false })
  }
}

/** Material for a print-zone overlay: the surface preset, with the composed design as a transparent map on top. */
export function createZoneMaterial(preset: MaterialPreset, surface: ZoneSurface | undefined): Mat {
  const effect = surface?.zone.effect ?? 'print'
  let mat: Mat
  if (effect === 'screen' || preset === 'screen') {
    mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  } else if (preset === 'glass' || preset === 'acrylic') {
    mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1 })
  } else {
    mat = createMaterial(preset, '#ffffff')
    if (mat instanceof THREE.MeshStandardMaterial) {
      if (effect === 'embroidery' || effect === 'woven' || effect === 'emboss') {
        mat.roughness = effect === 'emboss' ? 0.45 : 0.72
        mat.normalMap = surface?.normalTexture ?? null
        mat.normalScale = new THREE.Vector2(1, 1)
      }
      if (effect === 'engrave') {
        mat.metalness = 0.85
        mat.roughness = 0.45
        mat.normalMap = surface?.normalTexture ?? null
      }
    }
  }
  mat.map = surface?.texture ?? null
  mat.transparent = true
  mat.depthWrite = false
  mat.side = THREE.FrontSide
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -2
  mat.polygonOffsetUnits = -2
  mat.alphaTest = 0.002
  if (!surface?.texture) mat.opacity = 0
  return mat
}
