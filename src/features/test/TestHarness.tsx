import { useEffect, useState } from 'react'
import { CATALOG } from '@/catalog'
import { sampleLogoBlob } from '@/features/upload/sample'
import { getRenderer } from '@/render/renderer'
import { designFromBlob } from '@/state/persist'
import { DEFAULT_GLOBAL, resolveItem } from '@/state/resolve'

const SIZE = 256

/**
 * Renders every catalog item with the bundled sample logo and default settings, for visual regression tests.
 * Bypasses the thumbnail queue so results never depend on scroll position or timing.
 */
export default function TestHarness() {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      const design = await designFromBlob(sampleLogoBlob(), 'sample-logo.svg', false)
      const renderer = getRenderer()
      for (const item of CATALOG) {
        if (!live) return
        try {
          const state = resolveItem(item, { global: DEFAULT_GLOBAL, items: {} })
          const blob = await renderer.render({ item, design: design.source, state, size: SIZE, zoneLongEdge: 512 })
          const url = URL.createObjectURL(blob)
          setUrls((u) => ({ ...u, [item.id]: url }))
        } catch (err) {
          setFailed((f) => ({ ...f, [item.id]: (err as Error).message }))
        }
      }
      if (live) setDone(true)
    })()
    return () => {
      live = false
    }
  }, [])

  return (
    <main className="grid grid-cols-[repeat(auto-fill,256px)] gap-2 p-2" data-harness-done={done ? 'true' : 'false'}>
      {CATALOG.map((item) => (
        <figure key={item.id} data-test-item={item.id} data-ready={urls[item.id] || failed[item.id] ? 'true' : 'false'} className="checkerboard relative size-[256px]">
          {urls[item.id] && <img src={urls[item.id]} alt={item.name} width={SIZE} height={SIZE} />}
          {failed[item.id] && <figcaption className="absolute inset-x-0 bottom-0 bg-danger p-1 text-xs" data-error>{failed[item.id]}</figcaption>}
        </figure>
      ))}
    </main>
  )
}
