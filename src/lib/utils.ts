import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** FNV-1a, 32-bit. Stable across runs, used for cache keys and design ids. */
export function hashString(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function hashBytes(bytes: Uint8Array | Uint8ClampedArray, step = 1): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += step) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
