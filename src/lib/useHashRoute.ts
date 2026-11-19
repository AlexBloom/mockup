import { useSyncExternalStore } from 'react'

export type Route = { name: 'grid' } | { name: 'item'; id: string } | { name: 'test' }

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h.startsWith('item/')) return { name: 'item', id: decodeURIComponent(h.slice(5)) }
  if (h === 'test') return { name: 'test' }
  return { name: 'grid' }
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn)
  return () => window.removeEventListener('hashchange', fn)
}

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}

export function navigate(route: Route) {
  window.location.hash = route.name === 'item' ? `#/item/${encodeURIComponent(route.id)}` : route.name === 'test' ? '#/test' : '#/'
}
