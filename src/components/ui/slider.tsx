import * as SliderPrimitive from '@radix-ui/react-slider'
import type * as React from 'react'
import { cn } from '@/lib/utils'

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn('relative flex w-full touch-none select-none items-center py-2', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-2">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-5 rounded-full border-2 border-accent bg-background shadow outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
    </SliderPrimitive.Root>
  )
}

export { Slider }
