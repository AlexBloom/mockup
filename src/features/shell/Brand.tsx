/** Shared column sizes for the studio shell: controls on the left, the canvas on the right. */
export const shellAside =
  'flex max-h-[46dvh] w-full shrink-0 flex-col overflow-y-auto border-b border-border bg-surface md:max-h-none md:h-auto md:w-[300px] md:border-b-0 md:border-r'
export const shellMain = 'relative flex min-h-0 min-w-0 flex-1 flex-col bg-background'

export function Brand({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold leading-none tracking-tight">mockup</h1>
        <p className="mt-1 text-[11px] text-muted">Saved on this device</p>
      </div>
      {children && <div className="ml-auto flex items-center gap-1">{children}</div>}
    </div>
  )
}
