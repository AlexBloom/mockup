import { del, get, set } from 'idb-keyval'
import { normalizeDesign } from '@/features/upload/normalize'
import { sampleLogoBlob } from '@/features/upload/sample'
import type { Overrides } from './resolve'
import { type Design, useApp } from './store'

const DESIGN_KEY = 'mockup:design:v1'
const OVERRIDES_KEY = 'mockup:overrides:v1'
const SAMPLE_NAME = 'sample-logo.svg'

type StoredDesign = { name: string; original: Blob; removeWhite: boolean }

export async function designFromBlob(original: Blob, name: string, removeWhite: boolean): Promise<Design> {
  const n = await normalizeDesign(original, { removeWhite, name })
  return { id: n.id, name, width: n.width, height: n.height, source: n.source, original, removeWhite }
}

export async function loadPersisted() {
  try {
    const [stored, overrides] = await Promise.all([get<StoredDesign>(DESIGN_KEY), get<Overrides>(OVERRIDES_KEY)])
    const design = stored ? await designFromBlob(stored.name === SAMPLE_NAME ? sampleLogoBlob() : stored.original, stored.name, stored.removeWhite) : null
    useApp.getState().hydrate({ design, ...(overrides ?? {}) })
  } catch (err) {
    console.warn('Could not restore saved session', err)
    useApp.getState().hydrate({})
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

export function startPersisting() {
  return useApp.subscribe((state, prev) => {
    if (!state.hydrated) return
    if (state.design !== prev.design) {
      if (state.design) {
        const { name, original, removeWhite } = state.design
        void set(DESIGN_KEY, { name, original, removeWhite } satisfies StoredDesign)
      } else {
        void del(DESIGN_KEY)
      }
    }
    if (state.global !== prev.global || state.items !== prev.items) {
      clearTimeout(timer)
      timer = setTimeout(() => void set(OVERRIDES_KEY, { global: state.global, items: state.items }), 300)
    }
  })
}
