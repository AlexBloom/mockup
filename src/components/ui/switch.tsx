import * as SwitchPrimitive from '@radix-ui/react-switch'
import type * as React from 'react'
import { cn } from '@/lib/utils'

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-surface-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60 data-[state=checked]:bg-accent',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-foreground shadow transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-foreground" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
