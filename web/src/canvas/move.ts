import { withChildren } from './columns'
import { connectionsAmong, connectionsTouching, type Connection } from './connections'
import type { CanvasElement } from './types'

export interface MovePlan {
  /** Selected cards that are not inside another selected card (what the user counts: "Moved 3 cards"). */
  top: CanvasElement[]
  /** `top` plus the cards inside any selected column. */
  all: CanvasElement[]
  /** Lines between moved cards: they go to the other board with them. */
  along: Connection[]
  /** Lines that join a moved card to a card left behind: removed by `move_elements`. */
  dropped: Connection[]
  /** Top-left of the moved group; moving back to this point restores every position. */
  origin: { x: number; y: number }
}

/** What `move_elements` will do to the open board for `ids`. Nothing to move → null. */
export function planMove(
  elements: Record<string, CanvasElement>,
  connections: Record<string, Connection>,
  ids: string[],
): MovePlan | null {
  const picked = ids.filter((id) => elements[id])
  if (!picked.length) return null
  const pickedSet = new Set(picked)
  const top = picked.map((id) => elements[id]).filter((e) => !e.parentId || !pickedSet.has(e.parentId))
  const all = withChildren(elements, picked)
  const allIds = new Set(all.map((e) => e.id))
  const lines = Object.values(connections)
  const along = connectionsAmong(lines, allIds)
  const alongIds = new Set(along.map((c) => c.id))
  const dropped = connectionsTouching(lines, allIds).filter((c) => !alongIds.has(c.id))
  // Cards inside a column have no position of their own; a selected child lands top-level on the other board.
  const placed = top.filter((e) => !e.parentId)
  const box = placed.length ? placed : top
  return {
    top,
    all,
    along,
    dropped,
    origin: { x: Math.min(...box.map((e) => e.x)), y: Math.min(...box.map((e) => e.y)) },
  }
}

export const movedLabel = (n: number, boardTitle: string): string =>
  `Moved ${n} ${n === 1 ? 'card' : 'cards'} to ${boardTitle || 'Untitled board'}`
