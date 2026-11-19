import { zipSync } from 'fflate'
import type { CameraPose, MockupItem } from '@/catalog/types'
import { isTouchDevice, slugify } from '@/lib/utils'
import type { ResolvedItemState } from '@/state/resolve'
import type { DesignSource } from './composer'
import { getRenderer } from './renderer'

export const EXPORT_SIZES = [1024, 2048, 4096] as const

export function maxExportSize() {
  return getRenderer().maxSize
}

export function renderPng(item: MockupItem, design: DesignSource | null, state: ResolvedItemState, opts: { size: number; pose?: CameraPose }) {
  return getRenderer().render({ item, design, state, size: opts.size, pose: opts.pose, zoneLongEdge: Math.min(2048, opts.size) })
}

export function exportName(item: MockupItem, designName?: string, pose?: CameraPose) {
  const base = designName ? `${slugify(designName.replace(/\.[a-z0-9]+$/i, ''))}-` : ''
  const view = pose && pose.id !== item.cameras.thumb.id ? `-${pose.id}` : ''
  return `${base}${item.id}${view}.png`
}

function anchorDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** On phones, the share sheet is the only way to land a PNG in Photos; desktops get a normal download. */
export async function saveBlob(blob: Blob, filename: string) {
  if (isTouchDevice() && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: blob.type })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename })
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
  }
  anchorDownload(blob, filename)
}

export async function zipBlobs(entries: { name: string; blob: Blob }[]) {
  const files: Record<string, Uint8Array> = {}
  for (const e of entries) files[e.name] = new Uint8Array(await e.blob.arrayBuffer())
  const zipped = zipSync(files, { level: 0 })
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
}

export function downloadZip(blob: Blob, filename: string) {
  anchorDownload(blob, filename)
}
