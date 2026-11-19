import { Canvas } from '@react-three/fiber'
import { usePinch } from '@use-gesture/react'
import { ChevronLeft, ChevronRight, Crosshair, Download, Expand, Loader2, Maximize, RotateCcw, Share2, X } from 'lucide-react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { CATALOG, CATALOG_BY_ID } from '@/catalog'
import type { CameraPose, MockupItem, PrintZone, Transform } from '@/catalog/types'
import { HexInput } from '@/components/HexInput'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Brand, shellAside, shellMain } from '@/features/shell/Brand'
import { clamp, cn, isTouchDevice } from '@/lib/utils'
import { navigate } from '@/lib/useHashRoute'
import { EXPORT_SIZES, exportName, maxExportSize, renderPng, saveBlob } from '@/render/exportPng'
import { ensureItemAssets } from '@/render/glb'
import { configureRenderer, FOV, getRenderer } from '@/render/renderer'
import { useResolvedItem } from '@/state/hooks'
import { useApp } from '@/state/store'
import { ItemScene } from './ItemScene'

const SCALE_MIN = 0.05
const SCALE_MAX = 3

function posesFor(item: MockupItem): CameraPose[] {
  const seen = new Set<string>()
  return [item.cameras.thumb, ...item.cameras.views].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
}

/** Scale (relative to contain-fit) at which the design covers the whole zone. */
function fillScale(zone: PrintZone, designAspect: number) {
  const cell = zone.layout?.kind === 'grid' ? (zone.aspect * zone.layout.rows) / zone.layout.cols : zone.aspect
  return Math.max(cell, designAspect) / Math.min(cell, designAspect)
}

export default function DetailView({ itemId }: { itemId: string }) {
  const item = CATALOG_BY_ID.get(itemId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && navigate({ name: 'grid' })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!item) {
    return (
      <>
        <aside className={shellAside}>
          <Brand />
        </aside>
        <main className={cn(shellMain, 'items-center justify-center gap-4')}>
          <p className="text-muted">That mockup doesn't exist.</p>
          <Button onClick={() => navigate({ name: 'grid' })}>Back to all mockups</Button>
        </main>
      </>
    )
  }
  return <DetailBody key={item.id} item={item} />
}

function DetailBody({ item }: { item: MockupItem }) {
  const design = useApp((s) => s.design)
  const setItemTransform = useApp((s) => s.setItemTransform)
  const setItemColor = useApp((s) => s.setItemColor)
  const setItemBackground = useApp((s) => s.setItemBackground)
  const setZoneEnabled = useApp((s) => s.setZoneEnabled)
  const applyItemToAll = useApp((s) => s.applyItemToAll)
  const resetItem = useApp((s) => s.resetItem)
  const hasOverrides = useApp((s) => !!s.items[item.id])
  const { state } = useResolvedItem(item)

  const poses = useMemo(() => posesFor(item), [item])
  const [pose, setPose] = useState(poses[0])
  const [activeZone, setActiveZone] = useState(item.printZones[0]?.id ?? '')
  const [assetsReady, setAssetsReady] = useState(item.geometry.kind === 'procedural')
  const [applied, setApplied] = useState(false)
  const zone = item.printZones.find((z) => z.id === activeZone) ?? item.printZones[0]
  const t = zone ? state.transforms[zone.id] : null
  const designAspect = design ? design.width / design.height : 1
  const zoneLongEdge = isTouchDevice() ? 1024 : 2048

  useEffect(() => {
    if (item.geometry.kind === 'procedural') return
    let live = true
    ensureItemAssets(item, getRenderer().webgl).then(() => live && setAssetsReady(true))
    return () => {
      live = false
    }
  }, [item])

  const index = CATALOG.indexOf(item)
  const prev = CATALOG[(index - 1 + CATALOG.length) % CATALOG.length]
  const next = CATALOG[(index + 1) % CATALOG.length]

  const update = (patch: Partial<Transform>, zoneId = zone?.id) => {
    if (!zoneId) return
    setItemTransform(item.id, zoneId, { ...state.transforms[zoneId], ...patch })
  }

  const stage = useRef<HTMLDivElement>(null)
  const pinchBase = useRef<Transform | null>(null)
  usePinch(
    ({ first, last, movement: [ms, ma], event }) => {
      event.preventDefault()
      if (!zone || !t || !design) return
      if (first) pinchBase.current = t
      const base = pinchBase.current ?? t
      update({
        scale: Math.round(clamp(base.scale * ms, SCALE_MIN, SCALE_MAX) * 1000) / 1000,
        rotation: Math.round(((((base.rotation + ma + 180) % 360) + 360) % 360) - 180),
      })
      if (last) pinchBase.current = null
    },
    { target: stage, eventOptions: { passive: false }, scaleBounds: { min: 0.05, max: 20 } },
  )

  const bg = state.background.mode === 'color' ? state.background.color : null

  return (
    <>
      <aside className={shellAside} aria-label={`${item.name} mockup`}>
        <Brand>
          <Button variant="ghost" size="icon-sm" onClick={() => navigate({ name: 'item', id: prev.id })} aria-label={`Previous: ${prev.name}`}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => navigate({ name: 'item', id: next.id })} aria-label={`Next: ${next.name}`}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => navigate({ name: 'grid' })} aria-label="Close">
            <X className="size-4" />
          </Button>
        </Brand>
        <div className="border-b border-border px-4 py-3">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {index + 1} of {CATALOG.length}
          </p>
        </div>

        {zone && t && (
          <Section title="Design placement" hint={isTouchDevice() ? 'Drag the design on the object. Pinch to scale and rotate.' : 'Drag the design on the object. Pinch or ctrl-scroll to scale.'}>
            {item.printZones.length > 1 && (
              <div className="flex flex-col gap-1.5">
                {item.printZones.map((z) => (
                  <div key={z.id} className={cn('flex items-center gap-2 rounded-lg border px-2 py-1.5', z.id === zone.id ? 'border-accent/70 bg-surface-2' : 'border-border')}>
                    <button type="button" onClick={() => setActiveZone(z.id)} className="flex-1 text-left text-sm">
                      {z.label}
                    </button>
                    <Switch checked={state.enabledZones[z.id] !== false} onCheckedChange={(v) => setZoneEnabled(item.id, z.id, v)} aria-label={`Show design on ${z.label}`} />
                  </div>
                ))}
              </div>
            )}
            {item.printZones.length === 1 && zone.optional && (
              <label className="flex items-center justify-between text-sm">
                Show design
                <Switch checked={state.enabledZones[zone.id] !== false} onCheckedChange={(v) => setZoneEnabled(item.id, zone.id, v)} />
              </label>
            )}

            <NumberSlider label="Horizontal" value={t.x} min={-1} max={1} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(x) => update({ x })} />
            <NumberSlider label="Vertical" value={t.y} min={-1} max={1} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(y) => update({ y })} />
            <NumberSlider label="Scale" value={t.scale} min={SCALE_MIN} max={SCALE_MAX} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(scale) => update({ scale })} />
            <NumberSlider label="Rotation" value={t.rotation} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(rotation) => update({ rotation })} />

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => update({ x: 0, y: 0 })} title="Center">
                <Crosshair className="size-3.5" /> Center
              </Button>
              <Button variant="outline" size="sm" onClick={() => update({ x: 0, y: 0, scale: 1, rotation: 0 })} title="Fit inside the print area">
                <Maximize className="size-3.5" /> Fit
              </Button>
              <Button variant="outline" size="sm" onClick={() => update({ x: 0, y: 0, scale: Math.round(fillScale(zone, designAspect) * 1000) / 1000, rotation: 0 })} title="Fill the print area">
                <Expand className="size-3.5" /> Fill
              </Button>
              <Button variant="outline" size="sm" onClick={() => update({ ...zone.defaultTransform })} title="Back to this item's default placement">
                <RotateCcw className="size-3.5" /> Default
              </Button>
            </div>
          </Section>
        )}

        {item.colorTargets.length > 0 && (
          <Section title="Colors">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {item.colorTargets.map((c) => (
                <div key={c.id} className="flex flex-col gap-1">
                  <span className="text-xs text-muted">{c.label}</span>
                  <HexInput label={c.label} value={state.colors[c.id] ?? c.default} onChange={(hex) => setItemColor(item.id, c.id, hex)} />
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Background">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
            {(['transparent', 'color'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setItemBackground(item.id, mode === 'color' ? { mode, color: bg ?? '#f2f2f2' } : { mode })}
                className={cn('rounded-md py-1.5 text-sm transition-colors', state.background.mode === mode ? 'bg-foreground text-background' : 'text-muted hover:text-foreground')}
              >
                {mode === 'transparent' ? 'Transparent' : 'Solid color'}
              </button>
            ))}
          </div>
          {bg && <HexInput label="Background" value={bg} onChange={(hex) => setItemBackground(item.id, { mode: 'color', color: hex })} />}
        </Section>

        <Section title="Apply">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (!t) return
                applyItemToAll({ transform: t, colors: state.colors, background: state.background })
                setApplied(true)
                setTimeout(() => setApplied(false), 1600)
              }}
              title="Use this placement, these colors and this background as the default for every mockup"
            >
              {applied ? 'Applied' : 'Apply to all'}
            </Button>
            <Button variant="outline" onClick={() => resetItem(item.id)} disabled={!hasOverrides}>
              Reset item
            </Button>
          </div>
        </Section>

        <ExportSection item={item} pose={pose} />
      </aside>

      <main className={shellMain}>
        <div ref={stage} className={cn('relative min-h-0 flex-1 touch-none select-none', !bg && 'checkerboard')} style={bg ? { background: bg } : undefined} data-testid="detail-stage">
          {assetsReady ? (
            <Canvas
              dpr={[1, 2]}
              camera={{ fov: FOV, near: 0.01, far: 100, position: [0, 0, 5] }}
              gl={{ antialias: true, alpha: true }}
              onCreated={({ gl }) => {
                configureRenderer(gl)
                gl.setClearColor(0x000000, 0)
              }}
              className="!absolute inset-0"
            >
              <Suspense fallback={null}>
                <ItemScene
                  item={item}
                  design={design?.source ?? null}
                  designId={design?.id ?? null}
                  state={state}
                  pose={pose}
                  activeZone={zone?.id ?? ''}
                  zoneLongEdge={zoneLongEdge}
                  onTransform={(zoneId, nt) => setItemTransform(item.id, zoneId, nt)}
                  onSelectZone={setActiveZone}
                />
              </Suspense>
            </Canvas>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted" />
            </div>
          )}
          {!design && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <span className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted">Upload a design to place it on this mockup</span>
            </div>
          )}
        </div>
        <div className="flex justify-center gap-1 overflow-x-auto border-t border-border px-3 py-2">
          {poses.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPose({ ...p })}
              className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors', p.id === pose.id ? 'bg-foreground text-background' : 'text-muted hover:bg-surface-2 hover:text-foreground')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </main>
    </>
  )
}

function ExportSection({ item, pose }: { item: MockupItem; pose: CameraPose }) {
  const design = useApp((s) => s.design)
  const { state } = useResolvedItem(item)
  const sizes = useMemo(() => {
    const max = maxExportSize()
    return EXPORT_SIZES.filter((s) => s <= max)
  }, [])
  const [size, setSize] = useState<number>(sizes.includes(2048) ? 2048 : sizes[sizes.length - 1])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const share = isTouchDevice() && typeof navigator.canShare === 'function'

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const blob = await renderPng(item, design?.source ?? null, state, { size, pose })
      await saveBlob(blob, exportName(item, design?.name, pose))
    } catch (err) {
      setError((err as Error).message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Download" hint={`PNG from the ${pose.label.toLowerCase()} camera${state.background.mode === 'transparent' ? ', transparent background' : ''}.`}>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
        {sizes.map((s) => (
          <button key={s} type="button" onClick={() => setSize(s)} className={cn('rounded-md py-1.5 text-sm tabular-nums transition-colors', s === size ? 'bg-foreground text-background' : 'text-muted hover:text-foreground')}>
            {s}px
          </button>
        ))}
      </div>
      <Button size="lg" onClick={run} disabled={busy} data-testid="detail-download">
        {busy ? <Loader2 className="size-4 animate-spin" /> : share ? <Share2 className="size-4" /> : <Download className="size-4" />}
        {share ? 'Save PNG' : 'Download PNG'}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </Section>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {hint && <p className="mt-1 text-xs text-muted/80">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

type NumberSliderProps = { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }

function NumberSlider({ label, value, min, max, step, format, onChange }: NumberSliderProps) {
  const [text, setText] = useState<string | null>(null)
  const isPercent = format(1).endsWith('%')
  const display = isPercent ? Math.round(value * 100) : Math.round(value)
  const commit = () => {
    if (text === null) return
    const n = Number.parseFloat(text)
    if (Number.isFinite(n)) onChange(clamp(isPercent ? n / 100 : n, min, max))
    setText(null)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface-2 px-1.5 focus-within:border-accent/70">
          <input
            value={text ?? String(display)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            inputMode="decimal"
            className="h-6 w-12 bg-transparent text-right text-xs tabular-nums outline-none"
            aria-label={label}
          />
          <span className="text-xs text-muted">{isPercent ? '%' : '°'}</span>
        </div>
      </div>
      <Slider value={[clamp(value, min, max)]} min={min} max={max} step={step} onValueChange={([v]) => onChange(Math.round(v * 1000) / 1000)} aria-label={label} />
    </div>
  )
}
