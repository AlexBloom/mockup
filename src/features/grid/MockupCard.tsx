import { Check, Download, Loader2 } from 'lucide-react'
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { MockupItem } from '@/catalog/types'
import { exportName, renderPng, saveBlob } from '@/render/exportPng'
import { getThumb, requestThumb, setVisible, subscribe, THUMB_SIZE } from '@/render/thumbQueue'
import { useResolvedItem } from '@/state/hooks'
import { useApp } from '@/state/store'
import { cn } from '@/lib/utils'

type Props = {
  item: MockupItem
  onOpen: (item: MockupItem) => void
  selecting: boolean
  selected: boolean
  onToggle: (item: MockupItem) => void
}

export const MockupCard = memo(function MockupCard({ item, onOpen, selecting, selected, onToggle }: Props) {
  const design = useApp((s) => s.design)
  const { state, key } = useResolvedItem(item)
  const ref = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const thumb = useSyncExternalStore(
    (cb) => subscribe(item.id, cb),
    () => getThumb(item.id),
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(item.id, entry.isIntersecting), { rootMargin: '300px' })
    io.observe(el)
    return () => {
      io.disconnect()
      setVisible(item.id, false)
    }
  }, [item.id])

  useEffect(() => {
    requestThumb(item.id, key, () => ({ item, design: design?.source ?? null, state, size: THUMB_SIZE }))
  }, [item, key, design, state])

  const pending = thumb?.key !== key
  const bg = state.background.mode === 'color' ? state.background.color : undefined

  const quickDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setDownloading(true)
    try {
      const blob = await renderPng(item, design?.source ?? null, state, { size: 2048 })
      await saveBlob(blob, exportName(item, design?.name))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={() => (selecting ? onToggle(item) : onOpen(item))}
      onKeyDown={(e) => e.key === 'Enter' && (selecting ? onToggle(item) : onOpen(item))}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-white text-left outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-accent/40',
        selected && 'border-accent ring-1 ring-accent',
      )}
      data-item={item.id}
      data-ready={!pending ? 'true' : 'false'}
    >
      <div className={cn('relative aspect-square', !bg && 'checkerboard')} style={bg ? { background: bg } : undefined}>
        {thumb && <img src={thumb.url} alt={item.name} className={cn('absolute inset-0 size-full object-contain transition-opacity', pending && 'opacity-60')} draggable={false} />}
        {(!thumb || pending) && (
          <div className="absolute right-2 top-2">
            <Loader2 className="size-4 animate-spin text-muted" />
          </div>
        )}
        {selecting && (
          <div className={cn('absolute left-2 top-2 flex size-6 items-center justify-center rounded-md border', selected ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-background/80')}>
            {selected && <Check className="size-4" />}
          </div>
        )}
        {!selecting && (
          <button
            type="button"
            onClick={quickDownload}
            disabled={downloading}
            title="Download transparent PNG"
            className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-background/85 text-foreground shadow-lg backdrop-blur transition-opacity hover:bg-accent hover:text-accent-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="truncate text-xs font-medium sm:text-sm">{item.name}</span>
      </div>
    </div>
  )
})
