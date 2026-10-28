import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface BoardInfo { title: string; icon: string | null; color: string | null }

/** Everything board cards need from the backend. Swapped for an in-memory copy on the dev pages. */
export interface BoardRepo {
  create(input: { id: string; parentId: string | null; title: string }): Promise<void>
  info(id: string): Promise<BoardInfo>
  count(id: string): Promise<number>
  update(id: string, patch: Partial<BoardInfo>): Promise<void>
}

const supabaseRepo: BoardRepo = {
  async create({ id, parentId, title }) {
    const { error } = await supabase.from('boards').upsert({ id, parent_board_id: parentId, title }, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  },
  async info(id) {
    const { data, error } = await supabase.from('boards').select('title,icon,color').eq('id', id).is('deleted_at', null).single()
    if (error) throw error
    return data as BoardInfo
  },
  async count(id) {
    const { count, error } = await supabase.from('elements').select('id', { count: 'exact', head: true }).eq('board_id', id).is('deleted_at', null)
    if (error) throw error
    return count ?? 0
  },
  async update(id, patch) {
    const { error } = await supabase.from('boards').update(patch).eq('id', id)
    if (error) throw error
  },
}

let repo: BoardRepo = supabaseRepo
export const getBoardRepo = (): BoardRepo => repo
export const setBoardRepo = (r: BoardRepo | null): void => { repo = r ?? supabaseRepo }

/** In-memory repo for auth-free dev pages and tests. */
export function memoryBoardRepo(): BoardRepo {
  const boards = new Map<string, BoardInfo>()
  return {
    async create({ id, title }) { if (!boards.has(id)) boards.set(id, { title, icon: null, color: null }) },
    async info(id) { return boards.get(id) ?? { title: 'Untitled board', icon: null, color: null } },
    async count() { return 0 },
    async update(id, patch) { boards.set(id, { ...(boards.get(id) ?? { title: 'Untitled board', icon: null, color: null }), ...patch }) },
  }
}

export const boardInfoKey = (id: string) => ['board-info', id] as const

export function useBoardInfo(id: string | undefined) {
  return useQuery({
    queryKey: boardInfoKey(id ?? ''),
    queryFn: () => getBoardRepo().info(id!),
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useBoardCount(id: string | undefined) {
  return useQuery({
    queryKey: ['board-count', id ?? ''],
    queryFn: () => getBoardRepo().count(id!),
    enabled: !!id,
    staleTime: 0,
  })
}
