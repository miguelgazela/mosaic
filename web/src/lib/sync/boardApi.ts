import { supabase } from '../supabase'
import { ELEMENT_COLUMNS, type ElementRow } from './rows'
import type { Viewport } from '../../canvas/geometry'

export interface BoardMeta {
  id: string
  title: string
  icon: string | null
  color: string | null
  parent_board_id: string | null
  is_home: boolean
  viewport: Viewport | null
}

export interface PathItem { id: string; title: string; icon: string | null }

export interface BoardData {
  board: BoardMeta
  elements: ElementRow[]
  connections: Record<string, unknown>[]
  path: PathItem[]
}

const BOARD_COLUMNS = 'id,title,icon,color,parent_board_id,is_home,viewport'

/** Board, its live elements and connections, and breadcrumb path in one round of parallel requests. */
export async function fetchBoard(id: string): Promise<BoardData> {
  const [board, elements, connections, path] = await Promise.all([
    supabase.from('boards').select(BOARD_COLUMNS).eq('id', id).is('deleted_at', null).single(),
    supabase.from('elements').select(ELEMENT_COLUMNS).eq('board_id', id).is('deleted_at', null),
    supabase.from('connections').select('*').eq('board_id', id).is('deleted_at', null),
    supabase.rpc('board_path', { board: id }),
  ])
  for (const r of [board, elements, connections, path]) if (r.error) throw r.error
  return {
    board: board.data as BoardMeta,
    elements: (elements.data ?? []) as ElementRow[],
    connections: (connections.data ?? []) as Record<string, unknown>[],
    path: (path.data ?? []) as PathItem[],
  }
}

export async function fetchElements(boardId: string): Promise<ElementRow[]> {
  const { data, error } = await supabase.from('elements').select(ELEMENT_COLUMNS).eq('board_id', boardId).is('deleted_at', null)
  if (error) throw error
  return (data ?? []) as ElementRow[]
}

export async function upsertElements(rows: ElementRow[]): Promise<void> {
  const { error } = await supabase.from('elements').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function renameBoard(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('boards').update({ title }).eq('id', id)
  if (error) throw error
}

export async function saveViewport(id: string, viewport: Viewport): Promise<void> {
  const { error } = await supabase.from('boards').update({ viewport }).eq('id', id)
  if (error) throw error
}
