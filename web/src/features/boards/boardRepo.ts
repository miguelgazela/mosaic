import { useQuery } from '@tanstack/react-query'
import type { Connection } from '../../canvas/connections'
import { supabase } from '../../lib/supabase'
import type { PathItem } from '../../lib/sync/boardApi'
import type { ConnRow } from '../../lib/sync/rows'
import { getCard } from '../../cards/registry'
import type { SearchRow } from '../search/parse'
import { DevDb } from './devDb'

export interface BoardInfo {
  title: string
  icon: string | null
  color: string | null
  /** Shared view only: a board the link does not open. */
  locked?: true
}

/** A live board in the tree the Move to… picker shows. */
export interface BoardNode { id: string; parentId: string | null; title: string; icon: string | null; color: string | null; isHome: boolean }

/** One row of the trash page: a board (with everything below it) or a single card. */
export interface TrashItem {
  kind: 'board' | 'element'
  id: string
  /** `board` or the card type. */
  type: string
  /** Board title; empty for cards (the page derives it from `content` / `plainText`). */
  title: string
  itemCount: number
  icon: string | null
  color: string | null
  content: Record<string, unknown> | null
  plainText: string | null
  wasIn: PathItem[]
  deletedAt: string
}

/** Everything board cards need from the backend. Swapped for an in-memory copy on the dev pages. */
export interface BoardRepo {
  create(input: { id: string; parentId: string | null; title: string }): Promise<void>
  info(id: string): Promise<BoardInfo>
  count(id: string): Promise<number>
  update(id: string, patch: Partial<BoardInfo>): Promise<void>
  tree(): Promise<BoardNode[]>
  /** `move_elements`: `at` = where the group's top-left lands (Undo passes the old one); omitted = below the content. */
  move(ids: string[], targetId: string, at?: { x: number; y: number }): Promise<void>
  /** Put lines back on a board (Undo of a move re-creates the lines the move removed). */
  restoreLines(boardId: string, lines: Connection[], rows: ConnRow[]): Promise<void>
  /** `duplicate_board`: returns the id of the copy. `withCard` also adds a board card for it next to the original's. */
  duplicate(input: { id: string; parentId: string; newId?: string; withCard?: boolean }): Promise<string>
  trash(id: string): Promise<void>
  restore(id: string): Promise<void>
  trashItems(): Promise<TrashItem[]>
  restoreElement(id: string): Promise<void>
  deleteForever(kind: TrashItem['kind'], id: string): Promise<void>
  /** `search` (0008): board titles + card text, boards first. */
  search(q: string, lim?: number): Promise<SearchRow[]>
}

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data
}

/**
 * Boards being created right now. A rename typed straight after "Add board" reaches `update` before the insert has
 * landed; an update of a row that doesn't exist yet changes nothing and the board stays "Untitled board". So `update`
 * waits for the create of the same board.
 */
const creating = new Map<string, Promise<void>>()

const supabaseRepo: BoardRepo = {
  async create({ id, parentId, title }) {
    const run = (async () => {
      const { error } = await supabase.from('boards').upsert({ id, parent_board_id: parentId, title }, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
    })()
    const settled = run.then(() => undefined, () => undefined).finally(() => { if (creating.get(id) === settled) creating.delete(id) })
    creating.set(id, settled)
    return run
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
    await creating.get(id)
    const { error } = await supabase.from('boards').update(patch).eq('id', id)
    if (error) throw error
  },
  async tree() {
    const { data, error } = await supabase.from('boards').select('id,parent_board_id,title,icon,color,is_home').is('deleted_at', null)
    if (error) throw error
    return (data ?? []).map((b) => ({ id: b.id, parentId: b.parent_board_id, title: b.title, icon: b.icon, color: b.color, isHome: b.is_home }))
  },
  async move(ids, targetId, at) {
    await rpc('move_elements', { p_ids: ids, p_target: targetId, p_at_x: at?.x ?? null, p_at_y: at?.y ?? null })
  },
  async restoreLines(_boardId, _lines, rows) {
    if (!rows.length) return
    const { error } = await supabase.from('connections').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  },
  async duplicate({ id, parentId, newId, withCard }) {
    return (await rpc('duplicate_board', { p_board: id, p_target_parent: parentId, p_new_id: newId ?? null, p_with_card: withCard ?? false })) as string
  },
  async trash(id) { await rpc('trash_board', { p_board: id }) },
  async restore(id) { await rpc('restore_board', { p_board: id }) },
  async trashItems() {
    const rows = (await rpc('trash_items', {})) as Record<string, unknown>[]
    return rows.map((r) => ({
      kind: r.kind as TrashItem['kind'],
      id: r.id as string,
      type: r.type as string,
      title: (r.title as string) ?? '',
      itemCount: (r.item_count as number) ?? 0,
      icon: (r.icon as string | null) ?? null,
      color: (r.color as string | null) ?? null,
      content: (r.content as Record<string, unknown> | null) ?? null,
      plainText: (r.plain_text as string | null) ?? null,
      wasIn: (r.was_in as PathItem[]) ?? [],
      deletedAt: r.deleted_at as string,
    }))
  },
  async restoreElement(id) { await rpc('restore_element', { p_id: id }) },
  async deleteForever(kind, id) { await rpc('delete_forever', { p_kind: kind, p_id: id }) },
  async search(q, lim = 30) {
    const rows = (await rpc('search', { q, lim })) as Record<string, unknown>[]
    return rows.map((r) => ({
      kind: r.kind as SearchRow['kind'],
      id: r.id as string,
      boardId: r.board_id as string,
      type: r.type as string,
      title: (r.title as string) ?? '',
      snippet: (r.snippet as string) ?? '',
      path: (r.board_path as SearchRow['path']) ?? [],
      icon: (r.icon as string | null) ?? null,
      color: (r.color as string | null) ?? null,
    }))
  },
}

let repo: BoardRepo = supabaseRepo
export const getBoardRepo = (): BoardRepo => repo
export const setBoardRepo = (r: BoardRepo | null): void => { repo = r ?? supabaseRepo }

/** In-memory repo for auth-free dev pages and tests, on top of `DevDb` (a stand-in for the milanote schema). */
export function memoryBoardRepo(db: DevDb = new DevDb()): BoardRepo & { db: DevDb } {
  const need = (id: string) => {
    const b = db.boards.get(id)
    if (!b || b.deletedAt !== null) throw Object.assign(new Error('board not found'), { code: 'PGRST116' })
    return b
  }
  return {
    db,
    async create({ id, parentId, title }) { if (!db.boards.has(id)) db.ensure(id, parentId ?? 'home', title) },
    async info(id) {
      const b = db.boards.get(id)
      if (b && b.deletedAt !== null) need(id)
      return b ? { title: b.title, icon: b.icon, color: b.color } : { title: 'Untitled board', icon: null, color: null }
    },
    async count(id) { return db.itemCount(id) },
    async update(id, patch) { Object.assign(db.ensure(id), patch) },
    async tree() { return db.tree() },
    async move(ids, targetId, at) { db.move(ids, targetId, at) },
    async restoreLines(boardId, lines) { db.saveLines(boardId, lines) },
    async duplicate({ id, parentId, newId, withCard }) { return db.duplicate(id, parentId, newId, withCard) },
    async trash(id) { db.trash(id) },
    async restore(id) { db.restore(id) },
    async trashItems() { return db.trashItems() },
    async restoreElement(id) { db.restoreElement(id) },
    async deleteForever(kind, id) { db.deleteForever(kind, id) },
    async search(q, lim = 30) { return db.search(q, lim, (e) => getCard(e.type)?.toPlainText(e) ?? '') },
  }
}

/** One repo for the whole dev session (survives navigation between dev pages). */
export function ensureDevRepo(): ReturnType<typeof memoryBoardRepo> {
  const w = window as unknown as { __devRepo?: ReturnType<typeof memoryBoardRepo> }
  w.__devRepo ??= memoryBoardRepo()
  setBoardRepo(w.__devRepo)
  return w.__devRepo
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
