import { assertEquals } from 'jsr:@std/assert@1'
import { type BoardRow, boardCardTarget, contentPaths, displayName, type ElementRow, handleShare, type ShareRow, type ShareStore } from './share.ts'

const OWNER = '11111111-1111-4111-8111-111111111111'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ROOT = id(1), SUB = id(2), DEEP = id(3), OTHER = id(4), TRASHED = id(5)
const TOKEN = 'a'.repeat(48)

const board = (b: Partial<BoardRow> & { id: string }): BoardRow => ({ title: b.id, icon: null, color: null, parent_board_id: null, viewport: null, deleted_at: null, ...b })
const el = (e: Partial<ElementRow> & { id: string }): ElementRow => ({ board_id: ROOT, type: 'note', parent_id: null, x: 0, y: 0, width: 100, height: null, z: 'a', sort_key: null, color: null, content: {}, ...e })

function fakeStore(over: { share?: Partial<ShareRow> | null } = {}) {
  const boards = [
    board({ id: ROOT, title: 'Root' }),
    board({ id: SUB, title: 'Sub', parent_board_id: ROOT }),
    board({ id: DEEP, title: 'Deep', parent_board_id: SUB }),
    board({ id: OTHER, title: 'Other' }),
    board({ id: TRASHED, title: 'Gone', parent_board_id: ROOT, deleted_at: '2026-01-01' }),
  ]
  const elements: ElementRow[] = [
    el({ id: 'e1', content: { doc: {} } }),
    el({ id: 'e2', type: 'board', content: { boardId: SUB } }),
    el({ id: 'e3', type: 'image', content: { path: `${OWNER}/e3/original.jpg`, thumbPath: `${OWNER}/e3/thumb.jpg` } }),
    el({ id: 'e4', type: 'image', content: { path: 'someone-else/e4/original.jpg' } }),
    el({ id: 'e5', board_id: SUB, type: 'board', content: { boardId: DEEP } }),
  ]
  const signed: string[][] = []
  const share: ShareRow | null = over.share === null ? null : { id: 's', board_id: ROOT, owner_id: OWNER, include_subboards: true, revoked_at: null, ...over.share }
  const store: ShareStore = {
    findShare: (t) => Promise.resolve(t === TOKEN ? share : null),
    board: (i) => Promise.resolve(boards.find((b) => b.id === i) ?? null),
    elements: (b) => Promise.resolve(elements.filter((e) => e.board_id === b)),
    connections: () => Promise.resolve([
      { id: 'c1', board_id: ROOT, from_element_id: 'e1', to_element_id: 'e2', from_point: null, to_point: null, style: {}, label: null },
      { id: 'c2', board_id: ROOT, from_element_id: 'e1', to_element_id: 'gone', from_point: null, to_point: null, style: {}, label: null },
    ]),
    boards: (ids) => Promise.resolve(boards.filter((b) => ids.includes(b.id) && !b.deleted_at)),
    counts: (ids) => Promise.resolve(Object.fromEntries(ids.map((i) => [i, 3]))),
    ownerName: () => Promise.resolve('Miguel Oliveira'),
    sign: (paths) => { signed.push(paths); return Promise.resolve(Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`]))) },
  }
  return { store, signed }
}

// deno-lint-ignore no-explicit-any
const ok = async (s: ShareStore, req: Record<string, unknown>): Promise<any> => {
  const r = await handleShare(s, req)
  assertEquals(r.status, 200)
  return r.body
}

Deno.test('root board: cards, live lines only, child info, signed own files only', async () => {
  const { store, signed } = fakeStore()
  const b = await ok(store, { token: TOKEN })
  assertEquals(b.status, 'ok')
  assertEquals(b.ownerName, 'Miguel Oliveira')
  assertEquals(b.board.id, ROOT)
  assertEquals(b.path.map((p: { id: string }) => p.id), [ROOT])
  assertEquals(b.elements.length, 4)
  assertEquals(b.connections.map((c: { id: string }) => c.id), ['c1'])
  assertEquals(b.children, { [SUB]: { title: 'Sub', icon: null, color: null, count: 3 } })
  assertEquals(Object.keys(b.urls).sort(), [`${OWNER}/e3/original.jpg`, `${OWNER}/e3/thumb.jpg`])
  assertEquals(signed.length, 1)
})

Deno.test('payload carries no owner id or client ids', async () => {
  const { store } = fakeStore()
  const text = JSON.stringify(await ok(store, { token: TOKEN }))
  assertEquals(text.includes('owner_id'), false)
  assertEquals(text.includes('client_id'), false)
})

Deno.test('sub-board and deep board open when sub-boards are included; path runs from the root', async () => {
  const { store } = fakeStore()
  const b = await ok(store, { token: TOKEN, boardId: DEEP })
  assertEquals(b.path.map((p: { id: string }) => p.id), [ROOT, SUB, DEEP])
  assertEquals(b.root.id, ROOT)
  assertEquals(b.board.id, DEEP)
})

Deno.test('this-board-only link: sub-boards refused, no child info', async () => {
  const { store } = fakeStore({ share: { include_subboards: false } })
  assertEquals((await handleShare(store, { token: TOKEN, boardId: SUB })).status, 404)
  const b = await ok(store, { token: TOKEN })
  assertEquals(b.children, {})
  assertEquals(b.includeSubboards, false)
})

Deno.test('boards outside the shared tree, trashed boards, and a trashed root are refused', async () => {
  const { store } = fakeStore()
  assertEquals((await handleShare(store, { token: TOKEN, boardId: OTHER })).status, 404)
  assertEquals((await handleShare(store, { token: TOKEN, boardId: TRASHED })).status, 404)
  const trashedRoot = fakeStore({ share: { board_id: TRASHED } })
  assertEquals((await handleShare(trashedRoot.store, { token: TOKEN })).status, 404)
})

Deno.test('revoked, unknown and malformed tokens are all not found; bad board id is a bad request', async () => {
  assertEquals((await handleShare(fakeStore({ share: { revoked_at: '2026-02-01' } }).store, { token: TOKEN })).status, 404)
  assertEquals((await handleShare(fakeStore({ share: null }).store, { token: TOKEN })).status, 404)
  const { store } = fakeStore()
  assertEquals((await handleShare(store, { token: 'short' })).status, 404)
  assertEquals((await handleShare(store, {})).status, 404)
  assertEquals((await handleShare(store, { token: TOKEN, boardId: 'x' })).status, 400)
})

Deno.test('contentPaths and boardCardTarget', () => {
  assertEquals(contentPaths('image', { path: 'u/a.jpg', thumbPath: 'u/b.jpg' }), ['u/a.jpg', 'u/b.jpg'])
  assertEquals(contentPaths('file', { path: 'u/a.pdf', previewPath: 'u/p.png' }), ['u/a.pdf', 'u/p.png'])
  assertEquals(contentPaths('note', { path: 'u/a.jpg' }), [])
  assertEquals(contentPaths('image', null), [])
  assertEquals(boardCardTarget({ type: 'board', content: { boardId: SUB } }), SUB)
  assertEquals(boardCardTarget({ type: 'board', content: { boardId: 'nope' } }), null)
  assertEquals(boardCardTarget({ type: 'note', content: { boardId: SUB } }), null)
})

Deno.test('displayName prefers profile name, never returns the address', () => {
  assertEquals(displayName({ full_name: 'Miguel Oliveira' }, 'm@x.io'), 'Miguel Oliveira')
  assertEquals(displayName({}, 'miguel.oliveira@x.io'), 'Miguel Oliveira')
  assertEquals(displayName(null, null), 'Someone')
})
