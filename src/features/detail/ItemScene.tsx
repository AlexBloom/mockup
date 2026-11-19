import { OrbitControls } from '@react-three/drei'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { CameraPose, MockupItem, Transform } from '@/catalog/types'
import type { DesignSource } from '@/render/composer'
import { createEnvironment } from '@/render/renderer'
import {
  applyColors,
  buildItemObject,
  createLights,
  createZoneSurfaces,
  disposeObject,
  disposeZoneSurfaces,
  frameCamera,
  setZoneVisibility,
  updateZoneSurfaces,
} from '@/render/scene'
import type { ResolvedItemState } from '@/state/resolve'

type Props = {
  item: MockupItem
  design: DesignSource | null
  designId: string | null
  state: ResolvedItemState
  pose: CameraPose
  activeZone: string
  zoneLongEdge: number
  onTransform: (zoneId: string, t: Transform) => void
  onSelectZone: (zoneId: string) => void
}

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

/** Dashed print-area outline shown only while dragging; drawn on the live detail texture, never on exports. */
function drawGuide(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const lw = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) / 160))
  ctx.save()
  ctx.lineWidth = lw
  ctx.setLineDash([lw * 4, lw * 3])
  ctx.strokeStyle = 'rgba(198, 244, 50, 0.95)'
  ctx.strokeRect(lw / 2, lw / 2, canvas.width - lw, canvas.height - lw)
  ctx.restore()
}
type Drag = { zoneId: string; u0: number; v0: number; t0: Transform; pointerId: number }

export function ItemScene({ item, design, designId, state, pose, activeZone, zoneLongEdge, onTransform, onSelectZone }: Props) {
  const { gl, scene, camera, size } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const drag = useRef<Drag | null>(null)
  const lights = useMemo(() => createLights(), [])
  const [guideZone, setGuideZone] = useState<string | null>(null)

  useEffect(() => {
    const env = createEnvironment(gl)
    scene.environment = env
    scene.environmentIntensity = 0.85
    return () => {
      scene.environment = null
      env.dispose()
    }
  }, [gl, scene])

  const geometryKey = item.designDrivenGeometry ? JSON.stringify(state.transforms) : ''
  const built = useMemo(() => {
    const zones = createZoneSurfaces(item, design, state, zoneLongEdge, gl.capabilities.getMaxAnisotropy())
    const object = buildItemObject(item, { item, colors: state.colors, zones })
    return { zones, object }
    // Transforms and colors update in place below; only rebuild when the geometry itself must change.
  }, [item, design, designId, zoneLongEdge, geometryKey, gl])

  useEffect(
    () => () => {
      disposeObject(built.object)
      disposeZoneSurfaces(built.zones)
    },
    [built],
  )

  useEffect(() => {
    if (!item.designDrivenGeometry || guideZone) updateZoneSurfaces(built.zones, design, state)
    const surface = guideZone ? built.zones[guideZone] : null
    if (surface?.canvas && surface.texture) {
      drawGuide(surface.canvas)
      surface.texture.needsUpdate = true
    }
  }, [built, design, state, item.designDrivenGeometry, guideZone])

  useEffect(() => applyColors(built.object, state.colors), [built, state.colors])
  useEffect(() => setZoneVisibility(built.object, state.enabledZones), [built, state.enabledZones])

  const framedFor = useRef('')
  useEffect(() => {
    const key = `${item.id}:${pose.id}:${size.width}x${size.height}`
    if (framedFor.current === key) return
    framedFor.current = key
    const cam = camera as THREE.PerspectiveCamera
    const { center, distance } = frameCamera(cam, built.object, pose, size.width / size.height)
    const c = controls.current
    if (c) {
      c.target.copy(center)
      c.minDistance = distance * 0.55
      c.maxDistance = distance * 1.8
      c.update()
    }
  }, [built, camera, item.id, pose, size.width, size.height])

  const zoneHit = (e: ThreeEvent<PointerEvent>) => {
    const hit = e.intersections.find((i) => i.object.visible)
    if (!hit) return null
    const zoneId = hit.object.userData.zoneId as string | undefined
    return zoneId && hit.uv ? { zoneId, uv: hit.uv } : null
  }

  const uvScale = (zoneId: string) => {
    const zone = item.printZones.find((z) => z.id === zoneId)!
    const [u0, v0, u1, v1] = zone.uvRect
    const grid = zone.layout?.kind === 'grid' ? zone.layout : null
    const vDir = item.geometry.kind === 'glb' ? -1 : 1
    return { su: (grid ? grid.cols : 1) / (u1 - u0), sv: (vDir * (grid ? grid.rows : 1)) / (v1 - v0) }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    const hit = zoneHit(e)
    if (!hit) return
    e.stopPropagation()
    if (hit.zoneId !== activeZone) onSelectZone(hit.zoneId)
    drag.current = { zoneId: hit.zoneId, u0: hit.uv.x, v0: hit.uv.y, t0: state.transforms[hit.zoneId], pointerId: e.pointerId }
    setGuideZone(hit.zoneId)
    if (controls.current) controls.current.enabled = false
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    const hit = zoneHit(e)
    if (!hit || hit.zoneId !== d.zoneId) return
    e.stopPropagation()
    const { su, sv } = uvScale(d.zoneId)
    const round = (v: number) => Math.round(v * 1000) / 1000
    onTransform(d.zoneId, { ...d.t0, x: round(d.t0.x + (hit.uv.x - d.u0) * su), y: round(d.t0.y + (hit.uv.y - d.v0) * sv) })
  }

  useEffect(() => {
    const end = () => {
      if (!drag.current) return
      drag.current = null
      setGuideZone(null)
      if (controls.current) controls.current.enabled = true
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  return (
    <>
      <primitive object={lights} />
      <group onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
        <primitive object={built.object} />
      </group>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.7}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI - 0.12}
      />
    </>
  )
}
