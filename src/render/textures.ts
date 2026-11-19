import * as THREE from 'three'

/** Mulberry32: tiny seeded PRNG so every procedural texture is identical on every run. */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type HeightFn = (u: number, v: number) => number

/** Converts a tileable height function into a tangent-space normal map. */
function normalMapFromHeight(size: number, height: HeightFn, strength: number) {
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = height(x / size, y / size)
  const data = new Uint8Array(size * size * 4)
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }
  return data
}

function dataTexture(data: Uint8Array, size: number, repeat = 1) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  tex.userData.shared = true
  return tex
}

function valueNoise(seed: number, cells: number): HeightFn {
  const rand = seededRandom(seed)
  const grid = Array.from({ length: cells * cells }, () => rand())
  const g = (x: number, y: number) => grid[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)]
  return (u, v) => {
    const x = u * cells
    const y = v * cells
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx
    return a + (b - a) * sy
  }
}

const cache = new Map<string, THREE.Texture>()
function cached(key: string, make: () => THREE.Texture) {
  let tex = cache.get(key)
  if (!tex) {
    tex = make()
    cache.set(key, tex)
  }
  return tex
}

export function fabricNormal() {
  return cached('fabric', () => {
    const noise = valueNoise(7, 16)
    const size = 256
    const threads = 48
    return dataTexture(
      normalMapFromHeight(
        size,
        (u, v) => {
          const warp = Math.sin(u * Math.PI * 2 * threads)
          const weft = Math.sin(v * Math.PI * 2 * threads)
          const over = Math.sin((u + v) * Math.PI * threads) > 0 ? warp : weft
          return over * 0.5 + noise(u, v) * 1.5
        },
        1.4,
      ),
      size,
      6,
    )
  })
}

export function knitNormal() {
  return cached('knit', () => {
    const size = 256
    const ribs = 32
    const noise = valueNoise(11, 12)
    return dataTexture(
      normalMapFromHeight(
        size,
        (u, v) => {
          const rib = Math.abs(Math.sin(u * Math.PI * ribs))
          const loop = Math.abs(Math.sin((v + (Math.floor(u * ribs) % 2) * 0.5 / ribs) * Math.PI * ribs * 1.6))
          return rib * 1.4 + loop * 0.5 + noise(u, v)
        },
        2.2,
      ),
      size,
      4,
    )
  })
}

export function paperNormal() {
  return cached('paper', () => {
    const size = 128
    const fine = valueNoise(3, 48)
    const coarse = valueNoise(5, 8)
    return dataTexture(normalMapFromHeight(size, (u, v) => fine(u, v) * 0.6 + coarse(u, v) * 0.4, 0.8), size, 3)
  })
}

export function brushedNormal() {
  return cached('brushed', () => {
    const size = 256
    const rand = seededRandom(19)
    const lines = Array.from({ length: size }, () => rand())
    return dataTexture(
      normalMapFromHeight(size, (_u, v) => lines[Math.floor(v * size) % size], 0.5),
      size,
      2,
    )
  })
}

export function grooveNormal() {
  return cached('groove', () => {
    const size = 256
    return dataTexture(
      normalMapFromHeight(
        size,
        (u, v) => {
          const r = Math.hypot(u - 0.5, v - 0.5)
          return Math.sin(r * Math.PI * 2 * 90) * 0.5
        },
        1.5,
      ),
      size,
      1,
    )
  })
}

/** Alpha mask for trucker mesh backs: grid of holes. */
export function meshAlpha() {
  return cached('meshAlpha', () => {
    const size = 64
    const data = new Uint8Array(size * size * 4)
    const holes = 8
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = ((x / size) * holes) % 1
        const fy = ((y / size) * holes + (Math.floor((x / size) * holes) % 2) * 0.5) % 1
        const d = Math.hypot(fx - 0.5, fy - 0.5)
        const v = d < 0.3 ? 0 : 255
        const i = (y * size + x) * 4
        data[i] = data[i + 1] = data[i + 2] = v
        data[i + 3] = 255
      }
    }
    return dataTexture(data, size, 10)
  })
}

/** Vertical gradient used for soft contact shadows under standing objects. */
export function radialShadow() {
  return cached('shadow', () => {
    const size = 128
    const data = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.min(1, Math.hypot(x / size - 0.5, y / size - 0.5) * 2)
        const a = Math.pow(1 - d, 2.2) * 150
        const i = (y * size + x) * 4
        data[i] = data[i + 1] = data[i + 2] = 0
        data[i + 3] = a
      }
    }
    const tex = dataTexture(data, size, 1)
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    return tex
  })
}

/** Month grid for wall calendars. */
export function calendarGrid() {
  return cached('calendar', () => {
    const size = 256
    const data = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * 7
        const gy = (y / size) * 6
        const line = Math.min(gx % 1, 1 - (gx % 1)) < 0.02 || Math.min(gy % 1, 1 - (gy % 1)) < 0.025
        const dot = (gx % 1) > 0.12 && (gx % 1) < 0.3 && (gy % 1) > 0.66 && (gy % 1) < 0.86
        const v = line ? 200 : dot ? 150 : 255
        const i = (y * size + x) * 4
        data[i] = data[i + 1] = data[i + 2] = v
        data[i + 3] = 255
      }
    }
    const tex = dataTexture(data, size, 1)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  })
}
