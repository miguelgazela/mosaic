import type { CanvasElement } from './types'
import type { Connection } from './connections'
import { useBoard } from './store'
import type { Command } from './undo'

const st = () => useBoard.getState()

export const addCmd = (els: CanvasElement[]): Command => {
  const ids = els.map((e) => e.id)
  return {
    label: 'Add',
    do: () => { st()._add(els); st().setSelection(ids) },
    undo: () => st()._remove(ids),
  }
}

export const removeCmd = (els: CanvasElement[]): Command => {
  const ids = els.map((e) => e.id)
  return {
    label: 'Delete',
    do: () => st()._remove(ids),
    undo: () => { st()._add(els); st().setSelection(ids) },
  }
}

export interface PatchEntry {
  id: string
  before: Partial<CanvasElement>
  after: Partial<CanvasElement>
}

export const patchCmd = (label: string, entries: PatchEntry[]): Command => ({
  label,
  do: () => st()._patch(entries.map((e) => ({ id: e.id, patch: e.after }))),
  undo: () => st()._patch(entries.map((e) => ({ id: e.id, patch: e.before }))),
})

/** Build entries for `keys` of each element, given the after-patches. */
export function patchEntries(
  elements: Record<string, CanvasElement>,
  afters: Record<string, Partial<CanvasElement>>,
): PatchEntry[] {
  return Object.entries(afters).flatMap(([id, after]) => {
    const cur = elements[id]
    if (!cur) return []
    const before: Record<string, unknown> = {}
    for (const k of Object.keys(after)) before[k] = cur[k as keyof CanvasElement]
    return [{ id, before: before as Partial<CanvasElement>, after }]
  })
}

// --- connections ------------------------------------------------------------------------

export const addConnsCmd = (conns: Connection[], select = true): Command => {
  const ids = conns.map((c) => c.id)
  return {
    label: 'Add line',
    do: () => { st()._addConns(conns); if (select && ids.length === 1) st().selectConn(ids[0]) },
    undo: () => st()._removeConns(ids),
  }
}

export const removeConnsCmd = (conns: Connection[]): Command => {
  const ids = conns.map((c) => c.id)
  return {
    label: 'Delete line',
    do: () => st()._removeConns(ids),
    undo: () => st()._addConns(conns),
  }
}

export interface ConnPatchEntry {
  id: string
  before: Partial<Connection>
  after: Partial<Connection>
}

export const patchConnCmd = (label: string, entries: ConnPatchEntry[]): Command => ({
  label,
  do: () => st()._patchConns(entries.map((e) => ({ id: e.id, patch: e.after }))),
  undo: () => st()._patchConns(entries.map((e) => ({ id: e.id, patch: e.before }))),
})
