import { CheckSquare, Download, Loader2, RotateCcw, Search, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { CATALOG, CATEGORIES, searchCatalog } from '@/catalog'
import { CATEGORY_LABELS, type Category, type MockupItem } from '@/catalog/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Brand, shellAside, shellMain } from '@/features/shell/Brand'
import { UploadPanel } from '@/features/upload/UploadPanel'
import { navigate } from '@/lib/useHashRoute'
import { cn } from '@/lib/utils'
import { downloadZip, exportName, renderPng, zipBlobs } from '@/render/exportPng'
import { resolveItem } from '@/state/resolve'
import { useApp } from '@/state/store'
import { MockupCard } from './MockupCard'

const ZIP_SIZE = 1024

export function Grid() {
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const items = useMemo(() => searchCatalog(query, category), [query, category])
  const hasOverrides = useApp((s) => Object.keys(s.items).length > 0 || s.global.transform !== undefined || Object.keys(s.global.colors).length > 0 || s.global.background.mode !== 'transparent')
  const resetAll = useApp((s) => s.resetAll)

  const counts = useMemo(() => {
    const c = new Map<Category, number>()
    for (const i of CATALOG) c.set(i.category, (c.get(i.category) ?? 0) + 1)
    return c
  }, [])

  const onOpen = useCallback((item: MockupItem) => navigate({ name: 'item', id: item.id }), [])
  const onToggle = useCallback((item: MockupItem) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }, [])

  const downloadAll = async () => {
    const targets = selecting && selected.size ? items.filter((i) => selected.has(i.id)) : items
    const { design, global, items: overrides } = useApp.getState()
    setProgress({ done: 0, total: targets.length })
    try {
      const entries: { name: string; blob: Blob }[] = []
      for (const item of targets) {
        const state = resolveItem(item, { global, items: overrides })
        entries.push({ name: exportName(item, design?.name), blob: await renderPng(item, design?.source ?? null, state, { size: ZIP_SIZE }) })
        setProgress({ done: entries.length, total: targets.length })
      }
      const scope = selecting && selected.size ? `${targets.length}-selected` : category
      downloadZip(await zipBlobs(entries), `mockups-${scope}.zip`)
    } finally {
      setProgress(null)
    }
  }

  const design = useApp((s) => s.design)

  return (
    <>
      <aside className={shellAside}>
        <Brand />
        <div className="border-b border-border p-3">
          <UploadPanel compact={!!design} />
        </div>
        <div className="flex items-center gap-1.5 px-3 pt-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-8 pl-8 text-xs" aria-label={`Search ${CATALOG.length} mockups`} />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {hasOverrides && (
            <Button variant="ghost" size="icon-sm" onClick={resetAll} title="Reset all colors and placements">
              <RotateCcw />
            </Button>
          )}
          <Button
            variant={selecting ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => {
              setSelecting((s) => !s)
              setSelected(new Set())
            }}
            title="Select mockups"
            aria-label="Select mockups"
          >
            <CheckSquare />
          </Button>
        </div>
        <nav className="flex flex-col gap-0.5 px-2 py-2" aria-label="Categories">
          <CategoryButton active={category === 'all'} count={CATALOG.length} onClick={() => setCategory('all')}>
            All
          </CategoryButton>
          {CATEGORIES.map((c) => (
            <CategoryButton key={c} active={category === c} count={counts.get(c) ?? 0} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </CategoryButton>
          ))}
        </nav>
        <div className="sticky bottom-0 mt-auto border-t border-border bg-surface p-3">
          <Button onClick={downloadAll} disabled={!!progress || (selecting && selected.size === 0)} className="w-full">
            {progress ? <Loader2 className="animate-spin" /> : <Download />}
            {progress ? `${progress.done}/${progress.total}` : selecting ? `Download ${selected.size}` : `Download ${items.length}`}
          </Button>
        </div>
      </aside>
      <main className={cn(shellMain, 'overflow-y-auto')}>
        <div className="flex items-center justify-between px-4 pt-3 text-[11px] text-muted">
          <span>{items.length === CATALOG.length ? `${CATALOG.length} mockups` : `${items.length} of ${CATALOG.length}`}</span>
        </div>
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">No mockups match “{query}”.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => (
              <MockupCard key={item.id} item={item} onOpen={onOpen} selecting={selecting} selected={selected.has(item.id)} onToggle={onToggle} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

function CategoryButton({ active, count, onClick, children }: { active: boolean; count: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors', active ? 'bg-foreground text-background' : 'text-foreground hover:bg-surface-2')}
    >
      <span className="truncate">{children}</span>
      <span className={cn('ml-2 tabular-nums text-[11px]', active ? 'text-background/70' : 'text-muted')}>{count}</span>
    </button>
  )
}
