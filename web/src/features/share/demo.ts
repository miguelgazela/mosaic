import type { ElementRow } from '../../lib/sync/rows'
import { ShareGone, type SharePayload } from './viewerApi'

// Dev-only stand-in for the milanote-share function: `/s/demo` (sub-boards included), `/s/demo-flat` (this board only),
// anything else starting with `demo` (e.g. `/s/demo-revoked`) is a dead link. Never shipped (import is behind import.meta.env.DEV).

const ROOT = { id: 'demo-root', title: 'Spring campaign', icon: 'rocket', color: '1' }
const MOOD = { id: 'demo-mood', title: 'Moodboard', icon: 'image', color: '4' }
const SHOTS = { id: 'demo-shots', title: 'Shot list', icon: 'camera', color: '6' }

const base = { parent_id: null, height: null, sort_key: null, color: null, client_id: null, deleted_at: null }
const note = (id: string, board: string, x: number, y: number, w: number, text: string, color: string | null = null): ElementRow => ({
  ...base, id, board_id: board, type: 'note', x, y, width: w, z: id, color,
  content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } },
})
const boardCard = (id: string, board: string, x: number, y: number, target: string): ElementRow => ({
  ...base, id, board_id: board, type: 'board', x, y, width: 136, z: id, content: { boardId: target },
})
const todo = (): ElementRow => ({
  ...base, id: 'demo-todo', board_id: ROOT.id, type: 'todo', x: 296, y: 260, width: 300, z: 'c',
  content: { title: 'Before the shoot', hideCompleted: false, items: [
    { id: 'a', text: 'Book the studio', done: true }, { id: 'b', text: 'Confirm models', done: true },
    { id: 'c', text: 'Order props', done: false }, { id: 'd', text: 'Print the shot list', done: false },
  ] },
})

export function demoShare(token: string, boardId?: string): SharePayload {
  if (token !== 'demo' && token !== 'demo-flat') throw new ShareGone()
  const include = token === 'demo'
  const target = boardId ?? ROOT.id
  if (target !== ROOT.id && (!include || target !== MOOD.id)) throw new ShareGone()
  const onRoot = target === ROOT.id
  const elements = onRoot
    ? [
        boardCard('d1', ROOT.id, 40, 40, MOOD.id), boardCard('d2', ROOT.id, 40, 200, SHOTS.id),
        note('d3', ROOT.id, 220, 40, 300, 'Launch the spring range to returning customers first, then open it to everyone a week later.'),
        todo(),
      ]
    : [note('m1', MOOD.id, 40, 40, 200, 'Less contrast than last season. Keep shadows soft.', '3'), note('m2', MOOD.id, 280, 40, 200, 'Linen, clay, pine.')]
  return {
    status: 'ok',
    ownerName: 'Miguel Oliveira',
    includeSubboards: include,
    root: ROOT,
    board: { ...(onRoot ? ROOT : MOOD), viewport: null },
    path: onRoot ? [ROOT] : [ROOT, MOOD],
    elements,
    connections: [],
    children: include && onRoot
      ? { [MOOD.id]: { ...MOOD, count: 14 }, [SHOTS.id]: { ...SHOTS, count: 8 } }
      : {},
    urls: {},
  }
}
