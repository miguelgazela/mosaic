import type { CanvasElement } from '../../canvas/types'

/** File-system safe name (keeps spaces and unicode letters; strips separators and control characters). */
export function safeName(name: string, fallback = 'Untitled'): string {
  const n = name.replace(/[\\/:*?"<>|\p{Cc}]/gu, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '')
  return (n || fallback).slice(0, 80)
}

/** Where an image / file card's bytes live inside the zip. Same id → same path, so cards and the zip builder agree. */
export function assetPathFor(el: Pick<CanvasElement, 'id' | 'content'>): string {
  const name = typeof el.content.name === 'string' && el.content.name ? el.content.name : 'file'
  return `assets/${el.id.slice(0, 8)}-${safeName(name, 'file')}`
}

/** Relative link from the file `from` to the file `to` (both zip paths, `/` separated), URL-encoded for markdown. */
export function relativeLink(from: string, to: string): string {
  const a = from.split('/').slice(0, -1)
  const b = to.split('/')
  let i = 0
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++
  const parts = [...a.slice(i).map(() => '..'), ...b.slice(i)]
  return parts.map(encodeURIComponent).join('/')
}

/** Unique file names among siblings: "Ideas", "Ideas 2", … (case-insensitive). */
export function uniqueName(taken: Set<string>, base: string): string {
  let n = base
  let i = 2
  while (taken.has(n.toLowerCase())) n = `${base} ${i++}`
  taken.add(n.toLowerCase())
  return n
}
