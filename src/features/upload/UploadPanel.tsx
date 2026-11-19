import { ImagePlus, Loader2, Sparkles, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { usePasteUpload, useUpload } from './useUpload'

function useDesignPreview(source: HTMLCanvasElement | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!source) {
      setUrl(null)
      return
    }
    let revoked = false
    let made: string | null = null
    source.toBlob((b) => {
      if (!b || revoked) return
      made = URL.createObjectURL(b)
      setUrl(made)
    })
    return () => {
      revoked = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [source])
  return url
}

export function UploadPanel({ compact = false }: { compact?: boolean }) {
  const { design, busy, error, uploadFile, loadSample, setRemoveWhite, clear } = useUpload()
  usePasteUpload(uploadFile)
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const preview = useDesignPreview(design?.source)
  const dims = useMemo(() => (design ? `${design.width}×${design.height}` : ''), [design])

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) uploadFile(f)
        e.target.value = ''
      }}
    />
  )

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files?.[0]
      if (f) uploadFile(f)
    },
  }

  if (!design || !compact) {
    return (
      <div
        {...dropHandlers}
        className={cn(
          'relative flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-background px-4 py-5 text-center transition-colors',
          dragging && 'border-accent bg-accent/5',
        )}
      >
        {picker}
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl checkerboard">
          {busy ? <Loader2 className="size-6 animate-spin text-muted" /> : preview ? <img src={preview} alt="" className="max-h-full max-w-full object-contain p-1" /> : <ImagePlus className="size-7 text-muted" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{design ? design.name : 'Drop a logo once. See it everywhere.'}</p>
          <p className="mt-1 text-sm text-muted">
            {design ? dims : 'PNG, JPG, WebP or SVG. Drag & drop, paste, or pick a file. Transparent PNGs and SVGs look best.'}
          </p>
          {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => input.current?.click()} disabled={busy}>
            <Upload /> {design ? 'Replace' : 'Upload design'}
          </Button>
          {!design && (
            <Button variant="secondary" onClick={loadSample} disabled={busy}>
              <Sparkles /> Try sample logo
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div {...dropHandlers} className={cn('flex items-center gap-3 rounded-xl border border-border bg-surface p-2 pr-3', dragging && 'border-accent')}>
      {picker}
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg checkerboard"
        title="Replace design"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : preview && <img src={preview} alt="" className="max-h-full max-w-full object-contain p-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{design.name}</p>
        <label className="mt-1 flex items-center gap-2 text-[11px] leading-tight text-muted">
          <Switch checked={design.removeWhite} onCheckedChange={setRemoveWhite} disabled={busy} />
          Remove white
        </label>
      </div>
      <Button size="icon-sm" variant="ghost" onClick={() => input.current?.click()} title="Replace design">
        <Upload />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={clear} title="Remove design">
        <Trash2 />
      </Button>
    </div>
  )
}
