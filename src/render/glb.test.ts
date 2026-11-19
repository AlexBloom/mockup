import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { color, item, zone } from '@/catalog/define'
import { instantiateGlb, registerGlb } from './glb'
import { applyColors, disposeObject } from './scene'
import type { ZoneSurface } from './types'

function fakeModel() {
  const scene = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())
  body.name = 'Body'
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial())
  print.name = 'zone:front'
  const prop = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({ color: '#00ff00' }))
  prop.name = 'Button'
  scene.add(body, print, prop)
  return scene
}

describe('GLB swap-in', () => {
  const url = '/models/test.glb'
  registerGlb(url, fakeModel())
  const glbItem = item({
    id: 'glb-test',
    name: 'GLB test',
    category: 'tops',
    builder: 'garment',
    glb: { url },
    zones: [zone('front', { aspect: 1, uvRect: [0.25, 0.5, 0.75, 1] })],
    colors: [color('body', '#123456', 'Body', ['Body'])],
    material: 'fabric',
  })

  function surfaces(): Record<string, ZoneSurface> {
    return {
      front: { zone: glbItem.printZones[0], canvas: null, texture: new THREE.Texture(), normalCanvas: null, normalTexture: null, enabled: true },
    }
  }

  it('maps zones and color targets by mesh name', () => {
    const zones = surfaces()
    const root = instantiateGlb(glbItem, { item: glbItem, colors: { body: '#123456' }, zones })
    applyColors(root, { body: '#ff0000' })
    const byName = (n: string) => root.getObjectByName(n) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

    expect(byName('zone:front').userData.zoneId).toBe('front')
    expect(byName('zone:front').material.map).toBe(zones.front.texture)
    expect(byName('Body').material.color.getHexString()).toBe('ff0000')
    expect(byName('Button').material.color.getHexString()).toBe('00ff00')

    const tex = zones.front.texture!
    expect(tex.flipY).toBe(false)
    expect(tex.repeat.toArray()).toEqual([2, 2])
    expect(tex.offset.x).toBeCloseTo(-0.5)
    expect(tex.offset.y).toBeCloseTo(-1)
  })

  it('does not dispose geometry shared with the cached model', () => {
    const root = instantiateGlb(glbItem, { item: glbItem, colors: {}, zones: surfaces() })
    const geom = (root.getObjectByName('Body') as THREE.Mesh).geometry
    let disposed = false
    geom.addEventListener('dispose', () => (disposed = true))
    disposeObject(root)
    expect(disposed).toBe(false)
  })
})
