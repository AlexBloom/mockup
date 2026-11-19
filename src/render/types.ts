import type * as THREE from 'three'
import type { MockupItem, PrintZone } from '@/catalog/types'

export type ZoneSurface = {
  zone: PrintZone
  /** Composed design in zone space. Null when rendering without a DOM (tests) or before a design is uploaded. */
  canvas: HTMLCanvasElement | null
  texture: THREE.Texture | null
  normalCanvas: HTMLCanvasElement | null
  normalTexture: THREE.Texture | null
  enabled: boolean
}

export type BuildContext = {
  item: MockupItem
  colors: Record<string, string>
  zones: Record<string, ZoneSurface>
}
