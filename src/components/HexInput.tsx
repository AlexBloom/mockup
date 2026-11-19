import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { normalizeHex } from '@/state/resolve'

type Props = { value: string; onChange: (hex: string) => void; label?: string; className?: string }

/** Hex text field with a native color swatch. Commits live while the text is a valid color. */
export function HexInput({ value, onChange, label, className }: Props) {
  const [text, setText] = useState(value.replace('#', '').toUpperCase())
  const valid = normalizeHex(text) !== null

  useEffect(() => setText(value.replace('#', '').toUpperCase()), [value])

  const commit = (raw: string) => {
    const hex = normalizeHex(raw)
    if (hex) onChange(hex)
  }

  return (
    <div className={cn('flex h-9 items-center gap-2 rounded-lg border bg-surface pl-1 pr-2 transition-colors focus-within:border-accent/70', valid ? 'border-border' : 'border-danger', className)}>
      <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label ? `${label} color picker` : 'Color picker'} />
      </label>
      <span className="text-sm text-muted">#</span>
      <input
        value={text}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9a-fA-F#]/g, '').replace('#', '').slice(0, 8)
          setText(v.toUpperCase())
          if (v.length === 3 || v.length === 6) commit(v)
        }}
        onBlur={() => {
          if (valid) commit(text)
          else setText(value.replace('#', '').toUpperCase())
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-full min-w-0 bg-transparent font-mono text-sm uppercase outline-none"
        aria-label={label ? `${label} hex code` : 'Hex code'}
        aria-invalid={!valid}
        inputMode="text"
        autoCapitalize="characters"
        spellCheck={false}
      />
    </div>
  )
}
