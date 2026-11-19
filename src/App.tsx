import { lazy, Suspense, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Grid } from '@/features/grid/Grid'
import { useHashRoute } from '@/lib/useHashRoute'
import { loadPersisted, startPersisting } from '@/state/persist'
import { useApp } from '@/state/store'

const DetailView = lazy(() => import('@/features/detail/DetailView'))
const TestHarness = lazy(() => import('@/features/test/TestHarness'))

export default function App() {
  const route = useHashRoute()
  const hydrated = useApp((s) => s.hydrated)

  useEffect(() => {
    if (route.name === 'test') return
    void loadPersisted()
    return startPersisting()
  }, [route.name])

  if (route.name === 'test') {
    return (
      <Suspense fallback={null}>
        <TestHarness />
      </Suspense>
    )
  }

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background md:flex-row">
      {route.name === 'item' ? (
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted" />
            </div>
          }
        >
          <DetailView itemId={route.id} />
        </Suspense>
      ) : (
        <Grid />
      )}
    </div>
  )
}
