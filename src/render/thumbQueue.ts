import { getRenderer, type RenderJob } from './renderer'

type Job = { itemId: string; key: string; make: () => RenderJob; seq: number }
type Ready = { key: string; url: string }

const DEBOUNCE_MS = 150
const CACHE_LIMIT = 320

const cache = new Map<string, string>()
const latest = new Map<string, Ready>()
const jobs = new Map<string, Job>()
const visible = new Set<string>()
const listeners = new Map<string, Set<() => void>>()
const failures = new Set<string>()
let seq = 0
let lastChange = 0
let running = false

export const THUMB_SIZE =
  typeof window !== 'undefined' && window.devicePixelRatio >= 2 && (navigator.hardwareConcurrency ?? 4) >= 6 ? 512 : 384

function notify(itemId: string) {
  listeners.get(itemId)?.forEach((fn) => fn())
}

function remember(key: string, url: string) {
  cache.set(key, url)
  if (cache.size <= CACHE_LIMIT) return
  const inUse = new Set([...latest.values()].map((r) => r.url))
  for (const [k, u] of cache) {
    if (cache.size <= CACHE_LIMIT) break
    if (inUse.has(u)) continue
    cache.delete(k)
    URL.revokeObjectURL(u)
  }
}

export function subscribe(itemId: string, fn: () => void) {
  let set = listeners.get(itemId)
  if (!set) listeners.set(itemId, (set = new Set()))
  set.add(fn)
  return () => set.delete(fn)
}

/** Most recent finished thumbnail for an item, possibly for older inputs, so cards never flash empty while re-rendering. */
export function getThumb(itemId: string): Ready | undefined {
  return latest.get(itemId)
}

export function isPending(itemId: string) {
  return jobs.has(itemId)
}

export function hasFailed(key: string) {
  return failures.has(key)
}

export function requestThumb(itemId: string, key: string, make: () => RenderJob) {
  const hit = cache.get(key)
  if (hit) {
    if (latest.get(itemId)?.key !== key) {
      latest.set(itemId, { key, url: hit })
      notify(itemId)
    }
    jobs.delete(itemId)
    return
  }
  if (jobs.get(itemId)?.key === key) return
  jobs.set(itemId, { itemId, key, make, seq: seq++ })
  lastChange = performance.now()
  notify(itemId)
  void pump()
}

export function setVisible(itemId: string, isVisible: boolean) {
  if (isVisible) visible.add(itemId)
  else visible.delete(itemId)
}

function nextJob(): Job | undefined {
  let best: Job | undefined
  for (const job of jobs.values()) {
    const score = (visible.has(job.itemId) ? 0 : 1e9) + job.seq
    const bestScore = best ? (visible.has(best.itemId) ? 0 : 1e9) + best.seq : Infinity
    if (score < bestScore) best = job
  }
  return best
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function pump() {
  if (running) return
  running = true
  try {
    while (jobs.size) {
      const wait = DEBOUNCE_MS - (performance.now() - lastChange)
      if (wait > 0) {
        await sleep(wait)
        continue
      }
      const job = nextJob()!
      try {
        const blob = await getRenderer().render(job.make())
        const url = URL.createObjectURL(blob)
        remember(job.key, url)
        latest.set(job.itemId, { key: job.key, url })
      } catch (err) {
        console.error(`Thumbnail failed for ${job.itemId}`, err)
        failures.add(job.key)
      }
      if (jobs.get(job.itemId) === job) jobs.delete(job.itemId)
      notify(job.itemId)
      await sleep(0)
    }
  } finally {
    running = false
  }
}
