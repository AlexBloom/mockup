import { useMemo } from 'react'
import type { MockupItem } from '@/catalog/types'
import { renderKey, resolveItem } from './resolve'
import { useApp } from './store'

export function useResolvedItem(item: MockupItem) {
  const global = useApp((s) => s.global)
  const own = useApp((s) => s.items[item.id])
  const designId = useApp((s) => s.design?.id ?? null)
  return useMemo(() => {
    const state = resolveItem(item, { global, items: own ? { [item.id]: own } : {} })
    return { state, key: renderKey(item, designId, state) }
  }, [item, global, own, designId])
}
