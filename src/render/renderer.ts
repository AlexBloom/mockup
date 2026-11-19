import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { CameraPose, MockupItem } from '@/catalog/types'
import { isTouchDevice } from '@/lib/utils'
import type { ResolvedItemState } from '@/state/resolve'
import type { DesignSource } from './composer'
import { ensureItemAssets } from './glb'
import { applyColors, buildItemObject, createLights, createZoneSurfaces, disposeObject, disposeZoneSurfaces, frameCamera } from './scene'

export type RenderJob = {
  item: MockupItem
  design: DesignSource | null
  state: ResolvedItemState
  size: number
  pose?: CameraPose
  /** Long edge of the composed print canvases. */
  zoneLongEdge?: number
}

export const FOV = 30

export function configureRenderer(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
}

export function createEnvironment(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  return env
}

/**
 * One WebGL context for every thumbnail and export. iOS Safari caps live contexts, so the grid never mounts a
 * canvas per card; it asks this renderer for PNG blobs instead.
 */
class MockupRenderer {
  private canvas = document.createElement('canvas')
  private renderer!: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100)
  private lost = false
  private chain: Promise<unknown> = Promise.resolve()
  maxSize = 2048

  constructor() {
    this.scene.add(createLights())
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.lost = true
    })
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false
      this.init()
    })
    this.init()
  }

  private init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    configureRenderer(this.renderer)
    this.renderer.setPixelRatio(1)
    this.scene.environment = createEnvironment(this.renderer)
    this.scene.environmentIntensity = 0.85
    const gl = this.renderer.getContext()
    const hardMax = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0])
    this.maxSize = Math.min(hardMax, isTouchDevice() ? 2048 : 4096)
  }

  get webgl() {
    return this.renderer
  }

  get anisotropy() {
    return this.renderer.capabilities.getMaxAnisotropy()
  }

  /** Jobs run strictly one at a time so the shared canvas is never resized mid-render. */
  render(job: RenderJob): Promise<Blob> {
    const run = this.chain.then(() => this.renderNow(job))
    this.chain = run.catch(() => undefined)
    return run
  }

  private async renderNow(job: RenderJob): Promise<Blob> {
    if (this.lost) throw new Error('WebGL context lost')
    await ensureItemAssets(job.item, this.renderer)
    const size = Math.min(job.size, this.maxSize)
    const zoneLongEdge = job.zoneLongEdge ?? Math.min(2048, Math.max(512, size))
    const surfaces = createZoneSurfaces(job.item, job.design, job.state, zoneLongEdge, this.anisotropy)
    const obj = buildItemObject(job.item, { item: job.item, colors: job.state.colors, zones: surfaces })
    applyColors(obj, job.state.colors)
    this.scene.add(obj)
    try {
      const bg = job.state.background
      if (bg.mode === 'color') this.renderer.setClearColor(bg.color, 1)
      else this.renderer.setClearColor(0x000000, 0)
      this.renderer.setSize(size, size, false)
      frameCamera(this.camera, obj, job.pose ?? job.item.cameras.thumb, 1)
      this.renderer.render(this.scene, this.camera)
      return await new Promise<Blob>((resolve, reject) =>
        this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'),
      )
    } finally {
      this.scene.remove(obj)
      disposeObject(obj)
      disposeZoneSurfaces(surfaces)
    }
  }
}

let instance: MockupRenderer | null = null

export function getRenderer() {
  if (!instance) instance = new MockupRenderer()
  return instance
}
