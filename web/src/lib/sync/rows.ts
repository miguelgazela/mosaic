import type { CanvasElement } from '../../canvas/types'

/** Subset of `milanote.elements` the canvas owns. parent_id/sort_key/plain_text are left to their own phases. */
export interface ElementRow {
  id: string
  board_id: string
  type: string
  x: number
  y: number
  width: number
  height: number | null
  z: string
  color: string | null
  content: Record<string, unknown>
  client_id: string | null
  deleted_at: string | null
  updated_at?: string
}

export const ELEMENT_COLUMNS = 'id,board_id,type,x,y,width,height,z,color,content,client_id,deleted_at,updated_at'

/**
 * The dev-only `debug` card is not in the DB enum `milanote.element_type`. Store it as a `note` row
 * marked in `content`, and map it back on read. Remove once real card types cover it (P3+).
 */
const DEBUG_MARK = '__debug'

export function toRow(el: CanvasElement, boardId: string, clientId: string, deleted: boolean): ElementRow {
  return {
    id: el.id,
    board_id: boardId,
    type: el.type === 'debug' ? 'note' : el.type,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    z: el.z,
    color: el.color,
    content: el.type === 'debug' ? { ...el.content, [DEBUG_MARK]: true } : el.content,
    client_id: clientId,
    deleted_at: deleted ? new Date().toISOString() : null,
  }
}

export function fromRow(r: ElementRow): CanvasElement {
  const { [DEBUG_MARK]: isDebug, ...content } = r.content ?? {}
  return {
    id: r.id,
    type: isDebug ? 'debug' : r.type,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    z: r.z,
    color: r.color,
    content: isDebug ? content : (r.content ?? {}),
  }
}

/** True when `incoming` is at least as new as `known`; a missing timestamp counts as newer. */
export function isNewer(incoming: string | undefined, known: string | undefined): boolean {
  if (!incoming || !known) return true
  return Date.parse(incoming) >= Date.parse(known)
}
