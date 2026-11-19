import { useCallback, useEffect, useState } from 'react'
import { designFromBlob } from '@/state/persist'
import { useApp } from '@/state/store'
import { sampleLogoBlob } from './sample'

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif']

export function isAcceptedFile(file: File) {
  return ACCEPTED.includes(file.type) || /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(file.name)
}

export function useUpload() {
  const setDesign = useApp((s) => s.setDesign)
  const design = useApp((s) => s.design)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (blob: Blob, name: string, removeWhite = false) => {
      setBusy(true)
      setError(null)
      try {
        setDesign(await designFromBlob(blob, name, removeWhite))
      } catch (err) {
        setError((err as Error).message || 'Could not read that file')
      } finally {
        setBusy(false)
      }
    },
    [setDesign],
  )

  const uploadFile = useCallback(
    (file: File) => {
      if (!isAcceptedFile(file)) {
        setError('Use a PNG, JPG, WebP or SVG file')
        return
      }
      void load(file, file.name)
    },
    [load],
  )

  const loadSample = useCallback(() => void load(sampleLogoBlob(), 'sample-logo.svg'), [load])

  const setRemoveWhite = useCallback(
    (removeWhite: boolean) => {
      if (design) void load(design.original, design.name, removeWhite)
    },
    [design, load],
  )

  const clear = useCallback(() => setDesign(null), [setDesign])

  return { design, busy, error, uploadFile, loadSample, setRemoveWhite, clear }
}

/** Paste an image from the clipboard anywhere in the app. */
export function usePasteUpload(uploadFile: (f: File) => void) {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const file = [...(e.clipboardData?.files ?? [])].find(isAcceptedFile)
      if (file) {
        e.preventDefault()
        uploadFile(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [uploadFile])
}
