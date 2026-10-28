import { generateKeyBetween } from 'fractional-indexing'
import type { CanvasElement } from './types'

/** Children of a column, in stack order. */
export function childrenOf(elements: Record<string, CanvasElement>, columnId: string): CanvasElement[] {
  return Object.values(elements)
    .filter((e) => e.parentId === columnId)
    .sort((a, b) => cmpKey(a.sortKey, b.sortKey) || (a.id < b.id ? -1 : 1))
}

const cmpKey = (a: string | null, b: string | null): number => {
  const x = a ?? ''
  const y = b ?? ''
  return x < y ? -1 : x > y ? 1 : 0
}

/** Sort key for inserting at `index` among siblings with `keys` (already ordered). */
export function sortKeyAt(keys: (string | null)[], index: number): string {
  const i = Math.max(0, Math.min(index, keys.length))
  return generateKeyBetween(keys[i - 1] ?? null, keys[i] ?? null)
}

/** `n` ascending keys appended after `keys`. */
export function keysAppended(keys: (string | null)[], n: number): string[] {
  const out: string[] = []
  let last = keys.length ? keys[keys.length - 1] : null
  for (let i = 0; i < n; i++) {
    last = generateKeyBetween(last, null)
    out.push(last)
  }
  return out
}

/** Insert position for a pointer at `y` given the vertical midpoints of the children. */
export function insertIndex(midpoints: number[], y: number): number {
  let i = 0
  while (i < midpoints.length && y > midpoints[i]) i++
  return i
}

/** The element itself plus every descendant (columns hold one level). */
export function withChildren(elements: Record<string, CanvasElement>, ids: string[]): CanvasElement[] {
  const set = new Set(ids)
  return Object.values(elements).filter((e) => set.has(e.id) || (e.parentId !== null && set.has(e.parentId)))
}

/** Top-level ancestor (the element itself when it is not in a column). */
export function rootOf(elements: Record<string, CanvasElement>, id: string): CanvasElement | undefined {
  let e = elements[id]
  let guard = 0
  while (e?.parentId && elements[e.parentId] && guard++ < 8) e = elements[e.parentId]
  return e
}
