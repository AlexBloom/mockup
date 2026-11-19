import DOMPurify from 'dompurify'
import { hashBytes } from '@/lib/utils'

export const MAX_DESIGN_EDGE = 2048

export function isSvg(blob: Blob, name = '') {
  return blob.type === 'image/svg+xml' || name.toLowerCase().endsWith('.svg')
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = url
  })
}

/** Strips scripts and external references, then rasterizes at MAX_DESIGN_EDGE on the long side. */
export async function rasterizeSvg(text: string): Promise<HTMLCanvasElement> {
  const clean = DOMPurify.sanitize(text, { USE_PROFILES: { svg: true, svgFilters: true } })
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('Not a valid SVG')
  let vw = parseFloat(svg.getAttribute('width') ?? '')
  let vh = parseFloat(svg.getAttribute('height') ?? '')
  const vb = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
  if (vb && vb.length === 4 && vb.every(Number.isFinite)) {
    if (!vw || !vh) {
      vw = vb[2]
      vh = vb[3]
    }
  } else if (vw && vh) {
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`)
  }
  if (!vw || !vh) {
    vw = 1024
    vh = 1024
  }
  const scale = MAX_DESIGN_EDGE / Math.max(vw, vh)
  const w = Math.round(vw * scale)
  const h = Math.round(vh * scale)
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
  try {
    const img = await loadImage(url)
    const canvas = makeCanvas(w, h)
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function rasterizeBitmap(blob: Blob): Promise<HTMLCanvasElement> {
  let source: ImageBitmap | HTMLImageElement
  let url: string | null = null
  try {
    source = await createImageBitmap(blob)
  } catch {
    url = URL.createObjectURL(blob)
    source = await loadImage(url)
  }
  const scale = Math.min(1, MAX_DESIGN_EDGE / Math.max(source.width, source.height))
  const canvas = makeCanvas(source.width * scale, source.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  if ('close' in source) source.close()
  if (url) URL.revokeObjectURL(url)
  return canvas
}

export async function canvasFromBlob(blob: Blob): Promise<HTMLCanvasElement> {
  return isSvg(blob) ? rasterizeSvg(await blob.text()) : rasterizeBitmap(blob)
}

/** Crops fully transparent margins so "scale 1" means the visible artwork fills the zone. */
export function trimAlpha(canvas: HTMLCanvasElement, threshold = 8): HTMLCanvasElement {
  const { width: w, height: h } = canvas
  const data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return canvas
  if (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1) return canvas
  const out = makeCanvas(maxX - minX + 1, maxY - minY + 1)
  out.getContext('2d')!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

/**
 * Flood-fills near-white pixels connected to the image border and makes them transparent, feathering the edge so
 * anti-aliased outlines don't keep a white halo. Interior whites (inside the logo) are kept.
 */
export function removeWhiteBackground(canvas: HTMLCanvasElement, threshold = 236): HTMLCanvasElement {
  const { width: w, height: h } = canvas
  const out = makeCanvas(w, h)
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(canvas, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data
  const whiteness = (i: number) => {
    const o = i * 4
    const min = Math.min(px[o], px[o + 1], px[o + 2])
    const max = Math.max(px[o], px[o + 1], px[o + 2])
    return max - min < 24 ? min : 0
  }
  const visited = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  const push = (i: number) => {
    if (visited[i] || px[i * 4 + 3] === 0) return
    if (whiteness(i) < threshold) return
    visited[i] = 1
    queue[tail++] = i
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  while (head < tail) {
    const i = queue[head++]
    px[i * 4 + 3] = 0
    const x = i % w
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (i >= w) push(i - w)
    if (i < w * (h - 1)) push(i + w)
  }
  for (let i = 0; i < w * h; i++) {
    if (visited[i] || px[i * 4 + 3] === 0) continue
    const x = i % w
    const near = (x > 0 && visited[i - 1]) || (x < w - 1 && visited[i + 1]) || (i >= w && visited[i - w]) || (i < w * (h - 1) && visited[i + w])
    if (!near) continue
    const wv = whiteness(i)
    if (wv > 160) px[i * 4 + 3] = Math.round(px[i * 4 + 3] * Math.max(0, (255 - wv) / (255 - 160)))
  }
  ctx.putImageData(img, 0, 0)
  return out
}

export type NormalizedDesign = { id: string; source: HTMLCanvasElement; blob: Blob; width: number; height: number }

export async function normalizeDesign(original: Blob, opts: { removeWhite: boolean; name?: string }): Promise<NormalizedDesign> {
  let canvas = isSvg(original, opts.name) ? await rasterizeSvg(await original.text()) : await rasterizeBitmap(original)
  if (opts.removeWhite) canvas = removeWhiteBackground(canvas)
  canvas = trimAlpha(canvas)
  const data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data
  const id = `${canvas.width}x${canvas.height}-${hashBytes(data, 7)}`
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'))
  return { id, source: canvas, blob, width: canvas.width, height: canvas.height }
}
