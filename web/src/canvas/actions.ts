import { newId } from '../lib/ids'
import { getCard, listCards } from '../cards/registry'
import type { PasteData } from '../cards/types'
import { sortKeyAt, withChildren } from './columns'
import { cloneElements, parseClipboard, parseClipboardConnections, serializeClipboard } from './clipboard'
import { addCmd, addConnsCmd, patchCmd, patchConnCmd, patchEntries, removeCmd, removeConnsCmd } from './commands'
import { cloneConnections, connectionsAmong, connectionsTouching, type Connection } from './connections'
import { batch } from './undo'
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
/** Selection plus the cards inside any selected column (delete, copy and duplicate take them along). */
const selectedWithChildren = (): CanvasElement[] => {
  const s = st()
  return withChildren(s.elements, selectedIds(s))
}
const selectedTopLevel = (): CanvasElement[] => selectedElements().filter((e) => !e.parentId)

export interface AddOptions {
  content?: Record<string, unknown>
  /** Skip the edit-on-create behaviour (used when the card is filled from a paste). */
  noEdit?: boolean
}

export function addCard(type: string, center: Point, opts: AddOptions = {}): CanvasElement | null {
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
    parentId: null,
    sortKey: null,
    content: opts.content ?? def.defaultContent?.() ?? {},
  }
  st().exec(addCmd([el]))
  def.onCreate?.(el)
  if (def.editOnCreate && !opts.noEdit) st().setEditing(el.id)
  return el
}

/**
 * Route clipboard data: cards get first refusal via `onPaste`, then plain text becomes a note.
 * Returns true when something took it.
 */
export function pasteData(data: PasteData, at: Point): boolean {
  for (const def of listCards()) if (def.onPaste?.(data, at)) return true
  const text = data.text?.trim()
  const note = getCard('note')
  if (text && note?.contentFromText) {
    addCard('note', at, { content: note.contentFromText(data.text!), noEdit: true })
    return true
  }
  return false
}

/** Move the selected cards into `targetId` (a card with a drop target, e.g. a column), appended at the end. */
export function moveSelectionInto(targetId: string): void {
  const s = st()
  const target = s.elements[targetId]
  const dt = target && getCard(target.type)?.dropTarget
  if (!target || !dt) return
  const dragged = selectedTopLevel().filter((e) => e.id !== targetId)
  if (!dragged.length || !dt.accepts(target, dragged)) return
  const patches = dt.drop({ target, dragged, hint: {} })
  const entries = patchEntries(s.elements, patches)
  if (entries.length) s.exec(patchCmd('Move into column', entries))
}

export function deleteSelection(): void {
  const s = st()
  if (s.selectedConn && s.connections[s.selectedConn]) {
    s.exec(removeConnsCmd([s.connections[s.selectedConn]]))
    return
  }
  const els = selectedWithChildren()
  if (!els.length) return
  // Lines attached to a deleted card go with it (and come back on undo).
  const lines = connectionsTouching(Object.values(s.connections), new Set(els.map((e) => e.id)))
  s.exec(lines.length ? batch('Delete', [removeCmd(els), removeConnsCmd(lines)]) : removeCmd(els))
}

/** Change the style, label or ends of one line (one undo step). */
export function updateConnection(id: string, patch: Partial<Connection>, label = 'Edit line'): void {
  const s = st()
  const cur = s.connections[id]
  if (!cur) return
  const before: Record<string, unknown> = {}
  for (const k of Object.keys(patch)) before[k] = cur[k as keyof Connection]
  s.exec(patchConnCmd(label, [{ id, before: before as Partial<Connection>, after: patch }]))
}

export function selectAll(): void {
  const els = st().elements
  st().setSelection(Object.keys(els).filter((id) => !els[id].parentId))
}

export function nudge(dx: number, dy: number): void {
  const s = st()
  const afters: Record<string, Partial<CanvasElement>> = {}
  for (const e of selectedTopLevel()) afters[e.id] = { x: e.x + dx, y: e.y + dy }
  const entries = patchEntries(s.elements, afters)
  if (entries.length) s.exec(patchCmd('Nudge', entries))
}

export function reorder(toFront: boolean): void {
  const s = st()
  const sel = selectedTopLevel().sort((a, b) => (a.z < b.z ? -1 : 1))
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

function pasteItems(items: CanvasElement[], offset: number, stayInColumn = false, lines: Connection[] = []): void {
  const idMap = new Map<string, string>()
  const clones = cloneElements(items, { dx: offset, dy: offset }, newId, keysAfter(allZ(), items.length), idMap)
  const bySource = new Map(items.map((e) => [idMap.get(e.id), e]))
  for (const c of clones) getCard(c.type)?.onClone?.(c, bySource.get(c.id)!)
  if (stayInColumn) {
    // Duplicating a card that sits in a column: the copy goes right after it, in the same column.
    const sorted = [...items].sort((a, b) => (a.z < b.z ? -1 : 1))
    clones.forEach((c, i) => {
      const src = sorted[i]
      if (!src.parentId || c.parentId) return
      const sibs = Object.values(st().elements).filter((e) => e.parentId === src.parentId).sort((a, b) => ((a.sortKey ?? '') < (b.sortKey ?? '') ? -1 : 1))
      const at = sibs.findIndex((e) => e.id === src.id)
      c.parentId = src.parentId
      c.sortKey = sortKeyAt(sibs.map((e) => e.sortKey), at + 1)
    })
  }
  const copies = cloneConnections(lines, idMap, newId, { x: offset, y: offset })
  st().exec(copies.length ? batch('Paste', [addCmd(clones), addConnsCmd(copies, false)]) : addCmd(clones))
}

export function duplicateSelection(): void {
  const items = selectedWithChildren()
  if (!items.length) return
  const lines = connectionsAmong(Object.values(st().connections), new Set(items.map((e) => e.id)))
  pasteItems(items, 16, true, lines)
}

// --- clipboard: system clipboard JSON (via copy/cut/paste events) + in-memory fallback ---

let internalClipboard: string | null = null
let pasteText: string | null = null
let pasteCount = 0

/** Text for the system clipboard, or null when nothing is selected. */
export function copySelection(): string | null {
  const els = selectedWithChildren()
  if (!els.length) return null
  const lines = connectionsAmong(Object.values(st().connections), new Set(els.map((e) => e.id)))
  internalClipboard = serializeClipboard(els, lines)
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
  pasteItems(items, 16 * pasteCount, false, parseClipboardConnections(source))
  return true
}
