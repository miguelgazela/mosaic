import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface ShareLink {
  id: string
  boardId: string
  token: string
  includeSubboards: boolean
  createdAt: string
}

/** What the share dialog needs from the backend (`milanote.shares`). Swapped for an in-memory copy on the dev pages. */
export interface ShareRepo {
  /** Active (not revoked) links of a board, newest first. */
  list(boardId: string): Promise<ShareLink[]>
  create(boardId: string, includeSubboards: boolean): Promise<ShareLink>
  revoke(id: string): Promise<void>
  /** Number of boards below `boardId` (for the toggle's hint); titles of up to three. */
  subBoards(boardId: string): Promise<string[]>
}

const COLUMNS = 'id,board_id,token,include_subboards,created_at'
type Row = { id: string; board_id: string; token: string; include_subboards: boolean; created_at: string }
const fromRow = (r: Row): ShareLink => ({ id: r.id, boardId: r.board_id, token: r.token, includeSubboards: r.include_subboards, createdAt: r.created_at })

const supabaseRepo: ShareRepo = {
  async list(boardId) {
    const { data, error } = await supabase.from('shares').select(COLUMNS).eq('board_id', boardId).is('revoked_at', null).order('created_at', { ascending: false })
    if (error) throw error
    return (data as Row[]).map(fromRow)
  },
  async create(boardId, includeSubboards) {
    // owner_id and token come from column defaults (auth.uid(), random 24 bytes).
    const { data, error } = await supabase.from('shares').insert({ board_id: boardId, include_subboards: includeSubboards }).select(COLUMNS).single()
    if (error) throw error
    return fromRow(data as Row)
  },
  async revoke(id) {
    const { error } = await supabase.from('shares').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },
  async subBoards(boardId) {
    const { data, error } = await supabase.from('boards').select('title').eq('parent_board_id', boardId).is('deleted_at', null).order('created_at')
    if (error) throw error
    return (data ?? []).map((b: { title: string }) => b.title)
  },
}

let repo: ShareRepo = supabaseRepo
export const getShareRepo = (): ShareRepo => repo
export const setShareRepo = (r: ShareRepo | null): void => { repo = r ?? supabaseRepo }

/** In-memory repo for the auth-free dev pages and tests. */
export function memoryShareRepo(subBoards: (boardId: string) => string[] = () => []): ShareRepo & { links: Array<ShareLink & { revoked: boolean }> } {
  const links: Array<ShareLink & { revoked: boolean }> = []
  let n = 0
  return {
    links,
    async list(boardId) { return links.filter((l) => l.boardId === boardId && !l.revoked).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) },
    async create(boardId, includeSubboards) {
      const l = { id: `share-${++n}`, boardId, token: `dev${Math.random().toString(36).slice(2, 10)}${n}`, includeSubboards, createdAt: new Date(Date.now() + n).toISOString(), revoked: false }
      links.push(l)
      return l
    },
    async revoke(id) { const l = links.find((x) => x.id === id); if (l) l.revoked = true },
    async subBoards(boardId) { return subBoards(boardId) },
  }
}

export const sharesKey = (boardId: string) => ['shares', boardId] as const
export const subBoardsKey = (boardId: string) => ['share-subboards', boardId] as const

export const useShares = (boardId: string) => useQuery({ queryKey: sharesKey(boardId), queryFn: () => getShareRepo().list(boardId), staleTime: 0 })
export const useSubBoards = (boardId: string) => useQuery({ queryKey: subBoardsKey(boardId), queryFn: () => getShareRepo().subBoards(boardId), staleTime: 30_000 })

/** The address a viewer opens. */
export const shareUrl = (token: string, origin: string = window.location.origin): string => `${origin}/s/${token}`

/** Hint under the toggle: "Viewers can open Moodboard, Shot list and Copy drafts". */
export function subBoardHint(titles: string[]): string {
  if (titles.length === 0) return 'This board has no sub-boards yet.'
  const names = titles.slice(0, 3).map((t) => t || 'Untitled board')
  const more = titles.length - names.length
  const list = more > 0 ? `${names.join(', ')} and ${more} more` : names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  return `Viewers can open ${list}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "Created Mar 12, includes sub-boards" / "…, this board only". */
export function linkMeta(l: Pick<ShareLink, 'createdAt' | 'includeSubboards'>): string {
  const d = new Date(l.createdAt)
  return `Created ${MONTHS[d.getMonth()]} ${d.getDate()}, ${l.includeSubboards ? 'includes sub-boards' : 'this board only'}`
}
