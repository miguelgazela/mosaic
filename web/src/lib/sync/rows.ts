import { getCard } from '../../cards/registry'
import type { CanvasElement } from '../../canvas/types'
import { defaultStyle, type Anchor, type ConnEnd, type Connection, type ConnStyle } from '../../canvas/connections'

/** Subset of `milanote.elements` the canvas owns. */
export interface ElementRow {
  id: string
  board_id: string
  type: string
  parent_id?: string | null
  x: number
  y: number
  width: number
  height: number | null
  z: string
  sort_key?: string | null
  color: string | null
  content: Record<string, unknown>
  /** Client-extracted text for search; written, never read back. */
  plain_text?: string
  client_id: string | null
  deleted_at: string | null
  updated_at?: string
}

export const ELEMENT_COLUMNS = 'id,board_id,type,parent_id,x,y,width,height,z,sort_key,color,content,client_id,deleted_at,updated_at'

export function toRow(el: CanvasElement, boardId: string, clientId: string, deleted: boolean): ElementRow {
  let plain: string | undefined
  try { plain = getCard(el.type)?.toPlainText(el) } catch { plain = undefined }
  return {
    id: el.id,
    board_id: boardId,
    type: el.type,
    parent_id: el.parentId,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    z: el.z,
    sort_key: el.sortKey,
    color: el.color,
    content: el.content,
    ...(plain !== undefined ? { plain_text: plain } : {}),
    client_id: clientId,
    deleted_at: deleted ? new Date().toISOString() : null,
  }
}

export function fromRow(r: ElementRow): CanvasElement {
  return {
    id: r.id,
    type: r.type,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    z: r.z,
    color: r.color,
    parentId: r.parent_id ?? null,
    sortKey: r.sort_key ?? null,
    content: r.content ?? {},
  }
}

/** True when `incoming` is at least as new as `known`; a missing timestamp counts as newer. */
export function isNewer(incoming: string | undefined, known: string | undefined): boolean {
  if (!incoming || !known) return true
  return Date.parse(incoming) >= Date.parse(known)
}

/** Subset of `milanote.connections` the canvas owns. */
export interface ConnRow {
  id: string
  board_id: string
  from_element_id: string | null
  to_element_id: string | null
  /** `{side, t}` when attached, `{x, y}` when free. */
  from_point: Record<string, unknown> | null
  to_point: Record<string, unknown> | null
  style: Partial<ConnStyle> & Record<string, unknown>
  label: string | null
  client_id: string | null
  deleted_at: string | null
  updated_at?: string
}

const SIDES = ['top', 'right', 'bottom', 'left']
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

function endToRow(e: ConnEnd): { id: string | null; point: Record<string, unknown> | null } {
  if (e.elementId) return { id: e.elementId, point: e.anchor ? { side: e.anchor.side, t: e.anchor.t } : null }
  return { id: null, point: e.point ? { x: e.point.x, y: e.point.y } : null }
}

function endFromRow(id: string | null, p: Record<string, unknown> | null): ConnEnd {
  if (id) {
    const side = SIDES.includes(p?.side as string) ? (p!.side as Anchor['side']) : 'right'
    return { elementId: id, anchor: { side, t: num(p?.t, 0.5) } }
  }
  return { elementId: null, point: { x: num(p?.x, 0), y: num(p?.y, 0) } }
}

export function toConnRow(c: Connection, boardId: string, clientId: string, deleted: boolean): ConnRow {
  const from = endToRow(c.from)
  const to = endToRow(c.to)
  return {
    id: c.id,
    board_id: boardId,
    from_element_id: from.id,
    to_element_id: to.id,
    from_point: from.point,
    to_point: to.point,
    style: { ...c.style },
    label: c.label,
    client_id: clientId,
    deleted_at: deleted ? new Date().toISOString() : null,
  }
}

export function fromConnRow(r: ConnRow): Connection {
  const d = defaultStyle()
  const st = r.style ?? {}
  const bend = st.bend as { x?: unknown; y?: unknown } | undefined
  return {
    id: r.id,
    from: endFromRow(r.from_element_id, r.from_point),
    to: endFromRow(r.to_element_id, r.to_point),
    style: {
      curve: st.curve === 'curved' ? 'curved' : st.curve === 'straight' ? 'straight' : d.curve,
      dash: typeof st.dash === 'boolean' ? st.dash : d.dash,
      head: st.head === 'none' || st.head === 'start' || st.head === 'both' || st.head === 'end' ? st.head : d.head,
      color: typeof st.color === 'string' ? st.color : d.color,
      ...(bend && typeof bend.x === 'number' && typeof bend.y === 'number' ? { bend: { x: bend.x, y: bend.y } } : {}),
    },
    label: r.label ?? null,
  }
}
