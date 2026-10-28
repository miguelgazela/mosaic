import { newId } from '../lib/ids'
import { getCard } from '../cards/registry'
import { cloneElements, parseClipboard, serializeClipboard } from './clipboard'
import { addCmd, patchCmd, patchEntries, removeCmd } from './commands'
import { snap, type Point } from './geometry'
import { keysAfter, keysBefore } from './order'
import { selectedIds, useBoard } from './store'
import type { CanvasElement } from './types'

const st = () => useBoard.getState()
const allZ = function* () { for (const e of Object.values(st().elements)) yield e.z }
const selectedElements = (): CanvasElement[] => {
  const s = st()
  return selectedIds(s).map((id) => s.elements[id]).filter(Boolean)
}

export function addCard(type: string, center: Point): CanvasElement | null {
  const def = getCard(type)
  if (!def) return null
  const { width, height } = def.defaultSize
  const el: CanvasElement = {
    id: newId(),
    type,
    x: snap(center.x - width / 2),
    y: snap(center.y - (height ?? 64) / 2),
    width,
    height,
    z: keysAfter(allZ(), 1)[0],
    color: null,
    content: def.defaultContent?.() ?? {},
  }
  st().exec(addCmd([el]))
  return el
}

export function deleteSelection(): void {
  const els = selectedElements()
  if (els.length) st().exec(removeCmd(els))
}

export function selectAll(): void {
  st().setSelection(Object.keys(st().elements))
}

export function nudge(dx: number, dy: number): void {
  const s = st()
  const afters: Record<string, Partial<CanvasElement>> = {}
  for (const e of selectedElements()) afters[e.id] = { x: e.x + dx, y: e.y + dy }
  const entries = patchEntries(s.elements, afters)
  if (entries.length) s.exec(patchCmd('Nudge', entries))
}

export function reorder(toFront: boolean): void {
  const s = st()
  const sel = selectedElements().sort((a, b) => (a.z < b.z ? -1 : 1))
  if (!sel.length) return
  const others = Object.values(s.elements).filter((e) => !s.selected[e.id]).map((e) => e.z)
  const keys = toFront ? keysAfter(others, sel.length) : keysBefore(others, sel.length)
  const afters: Record<string, Partial<CanvasElement>> = {}
  sel.forEach((e, i) => { afters[e.id] = { z: keys[i] } })
  s.exec(patchCmd(toFront ? 'Bring to front' : 'Send to back', patchEntries(s.elements, afters)))
}

export function setColor(color: string | null): void {
  const s = st()
  const afters: Record<string, Partial<CanvasElement>> = {}
  for (const e of selectedElements()) afters[e.id] = { color }
  s.exec(patchCmd('Colour', patchEntries(s.elements, afters)))
}

function pasteItems(items: CanvasElement[], offset: number): void {
  const clones = cloneElements(items, { dx: offset, dy: offset }, newId, keysAfter(allZ(), items.length))
  st().exec(addCmd(clones))
}

export function duplicateSelection(): void {
  const items = selectedElements()
  if (items.length) pasteItems(items, 16)
}

// --- clipboard: system clipboard JSON (via copy/cut/paste events) + in-memory fallback ---

let internalClipboard: string | null = null
let pasteText: string | null = null
let pasteCount = 0

/** Text for the system clipboard, or null when nothing is selected. */
export function copySelection(): string | null {
  const els = selectedElements()
  if (!els.length) return null
  internalClipboard = serializeClipboard(els)
  pasteCount = 0
  return internalClipboard
}

export function cutSelection(): string | null {
  const text = copySelection()
  if (text) deleteSelection()
  return text
}

/** Returns true when the text (or internal clipboard when text is empty) held cards. */
export function pasteClipboard(text: string | null | undefined): boolean {
  const source = text ? text : internalClipboard
  const items = parseClipboard(source)
  if (!items) return false
  if (source !== pasteText) { pasteText = source; pasteCount = 0 }
  pasteCount += 1
  pasteItems(items, 16 * pasteCount)
  return true
}
