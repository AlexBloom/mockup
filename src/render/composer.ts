import type { PrintZone, Transform, ZoneEffect } from '@/catalog/types'

export type DesignSource = CanvasImageSource & { width: number; height: number }

export function zoneCanvasSize(aspect: number, longEdge: number) {
  if (aspect >= 1) return { w: longEdge, h: Math.max(4, Math.round(longEdge / aspect)) }
  return { w: Math.max(4, Math.round(longEdge * aspect)), h: longEdge }
}

export type Placement = { cx: number; cy: number; w: number; h: number; rotation: number }

/** Where the design lands inside a box of size bw x bh (canvas pixels, y down). scale 1 = contain-fit. */
export function computePlacement(designW: number, designH: number, bw: number, bh: number, t: Transform): Placement {
  const fit = Math.min(bw / designW, bh / designH)
  return {
    cx: bw / 2 + t.x * bw,
    cy: bh / 2 - t.y * bh,
    w: designW * fit * t.scale,
    h: designH * fit * t.scale,
    rotation: (t.rotation * Math.PI) / 180,
  }
}

function clipPath(ctx: CanvasRenderingContext2D, zone: PrintZone, w: number, h: number) {
  if (!zone.clip || zone.clip === 'rect') return
  ctx.beginPath()
  if (zone.clip === 'circle') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  else ctx.roundRect(0, 0, w, h, Math.min(w, h) * 0.12)
  ctx.clip()
}

function drawPlaced(ctx: CanvasRenderingContext2D, design: DesignSource, p: Placement, ox = 0, oy = 0) {
  ctx.save()
  ctx.translate(ox + p.cx, oy + p.cy)
  ctx.rotate(p.rotation)
  ctx.drawImage(design, -p.w / 2, -p.h / 2, p.w, p.h)
  ctx.restore()
}

/**
 * Draws the design into the zone canvas. Effects that need surface relief (embroidery, woven, emboss, engrave)
 * also write a tangent-space normal map into `normalCanvas`.
 */
export function composeZone(canvas: HTMLCanvasElement, zone: PrintZone, design: DesignSource | null, t: Transform, normalCanvas?: HTMLCanvasElement | null) {
  const ctx = canvas.getContext('2d', { willReadFrequently: hasRelief(zone.effect) })!
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  if (!design) return
  ctx.save()
  clipPath(ctx, zone, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const layout = zone.layout ?? { kind: 'single' }
  if (layout.kind === 'grid') {
    const cw = w / layout.cols
    const ch = h / layout.rows
    const inner = 1 - layout.gap
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const p = computePlacement(design.width, design.height, cw * inner, ch * inner, t)
        drawPlaced(ctx, design, p, c * cw + (cw * (1 - inner)) / 2, r * ch + (ch * (1 - inner)) / 2)
      }
    }
  } else {
    drawPlaced(ctx, design, computePlacement(design.width, design.height, w, h, t))
  }
  ctx.restore()
  if (hasRelief(zone.effect)) applyRelief(ctx, w, h, zone.effect!, normalCanvas ?? null)
}

export function hasRelief(effect: ZoneEffect | undefined) {
  return effect === 'embroidery' || effect === 'woven' || effect === 'emboss' || effect === 'engrave'
}

function applyRelief(ctx: CanvasRenderingContext2D, w: number, h: number, effect: ZoneEffect, normalCanvas: HTMLCanvasElement | null) {
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data
  const height = new Float32Array(w * h)
  const period = Math.max(3, Math.round(Math.max(w, h) / 140))
  const levels = effect === 'emboss' ? 6 : 4
  const q = (v: number) => Math.round((v / 255) * (levels - 1)) * (255 / (levels - 1))

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const o = i * 4
      const lum = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255
      const inside = px[o + 3] > 110 && (effect !== 'engrave' || lum < 0.6)
      if (!inside) {
        px[o + 3] = 0
        continue
      }
      px[o + 3] = 255
      if (effect === 'engrave') {
        px[o] = 70
        px[o + 1] = 70
        px[o + 2] = 74
        height[i] = -1
        continue
      }
      let r = q(px[o])
      let g = q(px[o + 1])
      let b = q(px[o + 2])
      let relief = 1
      if (effect === 'embroidery') {
        const stripe = 0.5 + 0.5 * Math.sin(((x + y) * Math.PI * 2) / period)
        const shade = 0.86 + 0.18 * stripe
        r *= shade
        g *= shade
        b *= shade
        relief = 1 + stripe * 0.45
      } else if (effect === 'woven') {
        const line = 0.5 + 0.5 * Math.sin((y * Math.PI * 2) / Math.max(2, period * 0.6))
        const shade = 0.9 + 0.12 * line
        r *= shade
        g *= shade
        b *= shade
        relief = 0.4 + line * 0.3
      }
      px[o] = Math.min(255, r)
      px[o + 1] = Math.min(255, g)
      px[o + 2] = Math.min(255, b)
      height[i] = relief
    }
  }
  ctx.putImageData(img, 0, 0)
  if (!normalCanvas) return

  const blurred = boxBlur(height, w, h, Math.max(1, Math.round(period / 2)))
  normalCanvas.width = w
  normalCanvas.height = h
  const nctx = normalCanvas.getContext('2d')!
  const nimg = nctx.createImageData(w, h)
  const nd = nimg.data
  const strength = effect === 'engrave' ? 3 : effect === 'emboss' ? 4 : 2.5
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const l = blurred[y * w + Math.max(0, x - 1)]
      const r = blurred[y * w + Math.min(w - 1, x + 1)]
      const u = blurred[Math.max(0, y - 1) * w + x]
      const d = blurred[Math.min(h - 1, y + 1) * w + x]
      const nx = -(r - l) * strength
      const ny = (d - u) * strength
      const len = Math.hypot(nx, ny, 1)
      const o = i * 4
      nd[o] = (nx / len) * 127.5 + 127.5
      nd[o + 1] = (ny / len) * 127.5 + 127.5
      nd[o + 2] = (1 / len) * 127.5 + 127.5
      nd[o + 3] = 255
    }
  }
  nctx.putImageData(nimg, 0, 0)
}

function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const n = r * 2 + 1
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}
