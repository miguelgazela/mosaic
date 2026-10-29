// Pure logic of milanote-share: token + optional board id in, one board's read-only view out.
// The store (database, storage, auth) is injected so everything here runs in tests without a network.

export interface ShareRow { id: string; board_id: string; owner_id: string; include_subboards: boolean; revoked_at: string | null }
export interface BoardRow {
  id: string
  title: string
  icon: string | null
  color: string | null
  parent_board_id: string | null
  viewport: unknown
  deleted_at: string | null
}
export interface ElementRow {
  id: string
  board_id: string
  type: string
  parent_id: string | null
  x: number
  y: number
  width: number
  height: number | null
  z: string
  sort_key: string | null
  color: string | null
  content: unknown
}
export interface ConnectionRow {
  id: string
  board_id: string
  from_element_id: string | null
  to_element_id: string | null
  from_point: unknown
  to_point: unknown
  style: unknown
  label: string | null
}

export interface ShareStore {
  /** The share row for this token (revoked ones included), or null. */
  findShare(token: string): Promise<ShareRow | null>
  /** One board row by id (trashed ones included), or null. */
  board(id: string): Promise<BoardRow | null>
  /** Live (not trashed) cards and lines of a board. */
  elements(boardId: string): Promise<ElementRow[]>
  connections(boardId: string): Promise<ConnectionRow[]>
  /** Live board rows by id. */
  boards(ids: string[]): Promise<BoardRow[]>
  /** Number of live cards per board id. */
  counts(ids: string[]): Promise<Record<string, number>>
  ownerName(ownerId: string): Promise<string>
  /** Signed read URLs (1 h) for storage paths; paths that fail are left out. */
  sign(paths: string[]): Promise<Record<string, string>>
}

export interface ShareRequest { token?: unknown; boardId?: unknown }
export interface ShareResult { status: number; body: unknown }

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_DEPTH = 64

export const NOT_FOUND: ShareResult = { status: 404, body: { status: 'not_found' } }
export const BAD_REQUEST: ShareResult = { status: 400, body: { status: 'bad_request' } }

/** Storage paths a card refers to (`path`, `thumbPath`, `previewPath` of image and file cards). */
export function contentPaths(type: string, content: unknown): string[] {
  if (type !== 'image' && type !== 'file') return []
  if (!content || typeof content !== 'object') return []
  const c = content as Record<string, unknown>
  return ['path', 'thumbPath', 'previewPath'].map((k) => c[k]).filter((v): v is string => typeof v === 'string' && v.length > 0)
}

/** Child board id a board card points at. */
export const boardCardTarget = (e: Pick<ElementRow, 'type' | 'content'>): string | null => {
  if (e.type !== 'board' || !e.content || typeof e.content !== 'object') return null
  const id = (e.content as Record<string, unknown>).boardId
  return typeof id === 'string' && UUID.test(id) ? id : null
}

/** Name shown as "Shared by …": profile name, else the e-mail's local part ("miguel.oliveira" → "Miguel Oliveira"). Never the address itself. */
export function displayName(meta: Record<string, unknown> | null | undefined, email: string | null | undefined): string {
  for (const k of ['full_name', 'name']) {
    const v = meta?.[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  const local = (email ?? '').split('@')[0].split(/[._\-+\s]+/).filter(Boolean)
  return local.length ? local.map((p) => p[0].toUpperCase() + p.slice(1)).join(' ') : 'Someone'
}

const info = (b: BoardRow) => ({ id: b.id, title: b.title, icon: b.icon, color: b.color })

/**
 * Walks up from `id` to the shared root. Returns the boards root → id, or null when `id` is not inside the shared tree
 * (or any board on the way is trashed or missing).
 */
async function chainToRoot(store: ShareStore, rootId: string, id: string): Promise<BoardRow[] | null> {
  const chain: BoardRow[] = []
  let cur: string | null = id
  for (let i = 0; i < MAX_DEPTH && cur; i++) {
    const b = await store.board(cur)
    if (!b || b.deleted_at) return null
    chain.push(b)
    if (b.id === rootId) return chain.reverse()
    cur = b.parent_board_id
  }
  return null
}

export async function handleShare(store: ShareStore, req: ShareRequest): Promise<ShareResult> {
  if (typeof req.token !== 'string' || !TOKEN.test(req.token)) return NOT_FOUND
  if (req.boardId !== undefined && req.boardId !== null && (typeof req.boardId !== 'string' || !UUID.test(req.boardId))) return BAD_REQUEST

  const share = await store.findShare(req.token)
  if (!share || share.revoked_at) return NOT_FOUND

  const targetId = typeof req.boardId === 'string' ? req.boardId : share.board_id
  if (targetId !== share.board_id && !share.include_subboards) return NOT_FOUND
  const chain = await chainToRoot(store, share.board_id, targetId)
  if (!chain) return NOT_FOUND
  const root = chain[0]
  const board = chain[chain.length - 1]

  const [elements, connections] = await Promise.all([store.elements(board.id), store.connections(board.id)])
  const liveIds = new Set(elements.map((e) => e.id))
  const lines = connections.filter((c) => (!c.from_element_id || liveIds.has(c.from_element_id)) && (!c.to_element_id || liveIds.has(c.to_element_id)))

  // Titles and counts for the board cards on this board; only boards the link may open.
  const children: Record<string, { title: string; icon: string | null; color: string | null; count: number }> = {}
  if (share.include_subboards) {
    const ids = [...new Set(elements.map(boardCardTarget).filter((x): x is string => !!x))]
    if (ids.length) {
      const [rows, counts] = await Promise.all([store.boards(ids), store.counts(ids)])
      for (const b of rows) if (b.parent_board_id === board.id) children[b.id] = { title: b.title, icon: b.icon, color: b.color, count: counts[b.id] ?? 0 }
    }
  }

  // Only the owner's own files: a card may not point the link at someone else's objects.
  const wanted = [...new Set(elements.flatMap((e) => contentPaths(e.type, e.content)))].filter((p) => p.startsWith(`${share.owner_id}/`))
  const urls = wanted.length ? await store.sign(wanted) : {}

  return {
    status: 200,
    body: {
      status: 'ok',
      ownerName: await store.ownerName(share.owner_id),
      includeSubboards: share.include_subboards,
      root: info(root),
      board: { ...info(board), viewport: board.viewport ?? null },
      path: chain.map(info),
      elements,
      connections: lines,
      children,
      urls,
    },
  }
}
