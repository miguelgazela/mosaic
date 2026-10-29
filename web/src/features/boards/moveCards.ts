import { movedLabel, planMove } from '../../canvas/move'
import { selectedIds, useBoard, withoutSync } from '../../canvas/store'
import type { Command } from '../../canvas/undo'
import { queryClient } from '../../lib/queryClient'
import { flushActiveBoard } from '../../lib/sync/boardSync'
import { CLIENT_ID } from '../../lib/sync/clientId'
import { toConnRow } from '../../lib/sync/rows'
import { toast } from '../../ui'
import { getBoardRepo } from './boardRepo'

/** Remote moves run one at a time, in the order they were started (a quick Undo must come after its move). */
let chain: Promise<unknown> = Promise.resolve()
const enqueue = (fn: () => Promise<void>): Promise<void> => {
  const p = chain.then(fn)
  chain = p.catch(() => {})
  return p
}

const refreshLists = () => {
  void queryClient.invalidateQueries({ queryKey: ['board-count'] })
  void queryClient.invalidateQueries({ queryKey: ['board-tree'] })
}

const reason = (e: unknown): string => {
  const m = (e as { message?: string })?.message ?? ''
  return /into itself/i.test(m) ? 'A board can’t go inside itself.' : 'Couldn’t move the cards. Check your connection.'
}

/**
 * Move cards of the open board to another board (drop on a board card, "Move to…").
 * One undoable command: the cards leave the canvas at once (without telling the sync layer), the server moves them
 * through `move_elements` once the queued edits have been sent, and Undo moves them back to where they were.
 * Returns false when there was nothing to do.
 */
export function moveCardsToBoard(ids: string[], dest: { id: string; title: string }): boolean {
  const s = useBoard.getState()
  const src = s.boardId
  if (!src || dest.id === src) return false
  const plan = planMove(s.elements, s.connections, ids)
  if (!plan) return false
  const topIds = plan.top.map((e) => e.id)
  const allIds = plan.all.map((e) => e.id)
  const lines = [...plan.along, ...plan.dropped]
  const lineIds = lines.map((c) => c.id)
  const repo = getBoardRepo()
  // Only touch the canvas while it still shows the board the cards came from.
  const here = () => useBoard.getState().boardId === src
  let away = false

  const leave = () => {
    away = true
    if (!here()) return
    withoutSync(() => { useBoard.getState()._removeConns(lineIds); useBoard.getState()._remove(allIds) })
  }
  const back = () => {
    away = false
    if (!here()) return
    withoutSync(() => {
      const st = useBoard.getState()
      st._add(plan.all)
      st._addConns(lines)
      st.setSelection(topIds)
    })
  }
  const failed = (e: unknown) => {
    toast(reason(e), { tone: 'error' })
    if (away) back()
  }

  const cmd: Command = {
    label: 'Move to board',
    do() {
      if (away) return
      leave()
      void enqueue(async () => {
        await flushActiveBoard()
        await repo.move(topIds, dest.id)
      }).then(refreshLists, failed)
    },
    undo() {
      if (!away) return
      back()
      void enqueue(async () => {
        await repo.move(topIds, src, plan.origin)
        await repo.restoreLines(src, plan.dropped, plan.dropped.map((c) => toConnRow(c, src, CLIENT_ID, false)))
      }).then(refreshLists, failed)
    },
  }
  s.exec(cmd)
  toast(movedLabel(topIds.length, dest.title), {
    action: { label: 'Undo', run: () => { if (!useBoard.getState().undoIfTop(cmd)) cmd.undo() } },
  })
  return true
}

/** "Move to…" for the current selection. */
export const moveSelectionToBoard = (dest: { id: string; title: string }): boolean => moveCardsToBoard(selectedIds(useBoard.getState()), dest)
