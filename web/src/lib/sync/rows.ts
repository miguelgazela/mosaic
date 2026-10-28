import { getCard } from '../../cards/registry'
import type { CanvasElement } from '../../canvas/types'

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
