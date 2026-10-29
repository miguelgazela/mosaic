# Data model — schema `milanote`

Implemented in `supabase/migrations/0001_init.sql` (P0 applies: schema, enum, tables, RLS, `is_member`, `ensure_home`, `board_path`, storage, realtime). Other RPCs below arrive in later phases. Keep this doc in sync when the SQL changes.

P3: no schema change. The client now writes `parent_id`, `sort_key` (column stacking) and `plain_text` (from each card's `toPlainText`) on every element upsert; the `debug` dev card is no longer stored.

Notes on the P0 SQL: `members` is select-only for users (insert via SQL Editor); `ensure_home()` raises `42501` for non-members; `board_path` returns `[{id,title,icon}]` root-first as jsonb.

## Tables

### members
Allow-list. Auth is shared with other apps, so being signed in is not enough.

| col | type | notes |
|---|---|---|
| user_id | uuid PK → auth.users | |
| display_name | text | |
| created_at | timestamptz | |

`milanote.is_member()` — `security definer`, `stable`: `exists(select 1 from members where user_id = auth.uid())`.

### boards
| col | type | notes |
|---|---|---|
| id | uuid PK | client generated |
| owner_id | uuid → auth.users | default `auth.uid()` |
| parent_board_id | uuid → boards null | null only for Home |
| is_home | bool | unique partial index `(owner_id) where is_home` |
| title | text | default 'Untitled board' |
| icon | text null | emoji or icon key |
| color | text null | palette key |
| viewport | jsonb null | `{x, y, zoom}` last view |
| created_at / updated_at | timestamptz | `updated_at` via trigger |
| deleted_at | timestamptz null | soft delete (trash) |

### elements
One polymorphic table for all card types.

| col | type | notes |
|---|---|---|
| id | uuid PK | client generated |
| board_id | uuid → boards | canvas it lives on |
| owner_id | uuid | default `auth.uid()` |
| type | `element_type` enum | `note, image, file, link, todo, column, board, swatch` |
| parent_id | uuid → elements null | set when inside a column |
| x, y | double precision | world coords; ignored when `parent_id` set |
| width | double precision | |
| height | double precision null | only for fixed-height types (image, file) |
| z | text | fractional index, canvas stacking |
| sort_key | text null | fractional index inside column |
| color | text null | palette key |
| content | jsonb | per-type payload, see below |
| plain_text | text | client-extracted, for search |
| search | tsvector | generated: `to_tsvector('simple', coalesce(plain_text,''))`, GIN index |
| client_id | text null | tab id of last writer (echo suppression) |
| created_at / updated_at | timestamptz | |
| deleted_at | timestamptz null | |

Indexes: `(board_id) where deleted_at is null`, `(parent_id)`, GIN `search`, `(type) where type='todo'`.

#### `content` shapes (TypeScript source of truth in `web/src/cards/types.ts`)

```ts
note:   { doc: TipTapJSON }   // schema: web/src/cards/note/extensions.ts
image:  { path: string; thumbPath: string; w: number; h: number; caption?: string; name: string; bytes: number }  // caption is plain text (P4); path/thumbPath are set once the upload finishes
file:   { path: string; name: string; mime: string; bytes: number; previewPath?: string }
link:   { url: string; title?: string; description?: string; image?: string; favicon?: string; embed?: { provider: 'youtube'|'vimeo'; id: string }; duration?: number /* seconds, oEmbed */; failed?: true /* unfurl failed: show plain URL */ }
todo:   { title?: string; hideCompleted: boolean; items: { id: string; text: string; done: boolean; due?: string /* ISO date */ }[] }
column: { title: string; collapsed: boolean }
board:  { boardId: string }   // child board; boards.parent_board_id = this element's board_id. Title, icon (lucide key from features/boards/icons.ts, or an emoji) and colour live on the boards row, not here.
swatch: { hex: string; name?: string }
```

### connections
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| board_id | uuid → boards | |
| owner_id | uuid | |
| from_element_id / to_element_id | uuid → elements null | null = free point |
| from_point / to_point | jsonb null | `{x,y}` when free, or `{side, t}` anchor on card |
| style | jsonb | `{ curve: 'straight'|'curved', bend?: {x,y}, dash: bool, head: 'none'|'start'|'end'|'both', color }` |
| label | text null | |
| client_id | text null | (0005) id of the browser tab that wrote the row; the writer ignores its own Realtime echo |
| created_at / updated_at / deleted_at | timestamptz | |

Attached end: `*_element_id` set and `*_point = {side: 'top'|'right'|'bottom'|'left', t: 0..1}` (position along that side of the card). Free end: element null and `*_point = {x, y}` in world space. `style.bend` (curved lines) is the offset of the curve's midpoint from the middle of the chord, in world px; unset = default bow. Lines follow their cards (positions are never stored), including cards inside columns. Cards that are soft-deleted take their lines with them (the client soft-deletes both).

### shares
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| board_id | uuid → boards | |
| owner_id | uuid | |
| token | text unique | `encode(gen_random_bytes(24), 'hex')` |
| include_subboards | bool | default true |
| created_at | timestamptz | |
| revoked_at | timestamptz null | |

## RLS

Every table: `enable row level security`; policies for `authenticated`:
`using (owner_id = auth.uid() and milanote.is_member())`, same `with check`.
No `anon` grants — shared view goes through `milanote-share` edge function (service role). (0009) `service_role` gets `select` on `milanote.shares` (boards, elements, connections came with 0007). Revoking sets `revoked_at`; rows are never deleted by the app. The function treats unknown, revoked, trashed-board and out-of-tree requests alike (404).

## RPC functions (`security invoker` unless noted)

| function | does |
|---|---|
| `ensure_home()` | create Home board if member has none; return its id |
| `move_elements(p_ids uuid[], p_target uuid, p_at_x, p_at_y)` | (0006) move cards (and the cards inside moved columns) to another board. Lines between moved cards go along (free line ends shift with the cards); lines joining a moved card to a card left behind are soft-deleted. Board cards re-parent their child board (`parent_board_id`). `p_at_x/y` = where the group's top-left lands, null = below the target's content; moving back with the old top-left restores the layout exactly (Undo). Raises if the target is missing or is inside a moved board. Clears `client_id` so open boards apply the change. Z keys are kept (ties in the target are possible). |
| `duplicate_board(p_board, p_target_parent, p_new_id default null, p_with_card default false)` | (0006) deep copy of the board and every sub-board below it: cards, column nesting, lines; board cards point at the copied sub-boards. Storage paths in image/file cards are reused (objects shared; `milanote-purge` only removes unreferenced objects). Copy is titled "<title> copy". `p_new_id` lets the client pick the id (paste / duplicate of a board card); `p_with_card` adds a board card next to the original's (board menu). The source may be trashed (cut then paste). Home cannot be duplicated. Returns the new board id |
| `trash_board(p_board)` / `restore_board(p_board)` | (0006) soft delete / restore a subtree with one `deleted_at` timestamp; the board's card in its parent is deleted / restored with it. Restore brings back only what was trashed together (same timestamp) and raises if the parent board is trashed. Home cannot be trashed |
| trigger `elements_board_trash` | (0006) deleting a board card (Delete key, cut, undo of a paste) trashes its child board; un-deleting the card (undo) restores it |
| `trash_items()` | (0006) the trash page: boards whose parent is live (sub-boards of a trashed board are hidden, they go with it) and non-board cards on live boards whose column is live. Columns: `kind` (`board`/`element`), `id`, `type`, `title`, `item_count`, `icon`, `color`, `content`, `plain_text`, `was_in` (board path jsonb), `deleted_at` |
| `restore_element(p_id)` | (0006) bring a trashed card back with the cards and lines deleted within 5 s of it; raises if its board is trashed |
| `delete_forever(p_kind, p_id)` | (0006) hard-delete a trashed board (sub-boards, cards, lines cascade) or card. Storage objects stay until `milanote-purge` |
| `board_subtree(p_root)` | (0006) the board and all boards below it |
| `search(q text, lim int)` | elements + boards hits with `ts_headline` and board breadcrumb path |
| `tasks()` | (0004) every item of live to-do cards on live boards, flattened via `jsonb_array_elements(content->'items')`: `element_id, board_id, board_path jsonb, card_title, item_id, item_text, done, due (ISO date text or null), item_pos`. Client groups Overdue / Today / Upcoming / No date |
| `set_task_done(p_element uuid, p_item text, p_done boolean)` | (0004) flip one item's `done` in place; clears `client_id` so open boards apply the Realtime update |
| `board_path(board uuid)` | recursive CTE → breadcrumb array |

## Trash and purge

Trashed rows keep `deleted_at`; nothing is moved. A trashed board's cards are not touched (the board is simply hidden: `fetchBoard`, `tasks()` and the board tree filter on `boards.deleted_at`). Items stay 30 days; `milanote-purge` (daily, `supabase/functions/milanote-purge`) then deletes cards and lines with `deleted_at` older than that and boards likewise (foreign keys cascade), and removes `milanote-files` objects that no `elements.content.path / thumbPath / previewPath` refers to, skipping objects younger than 24 h.

## Storage

Bucket `milanote-files`, private, `file_size_limit` 10 MB.
Policies on `storage.objects`: select/insert/update/delete where `bucket_id = 'milanote-files' and (storage.foldername(name))[1] = auth.uid()::text and milanote.is_member()`.

## Realtime

```sql
alter publication supabase_realtime add table milanote.boards, milanote.elements, milanote.connections;
grant select on all tables in schema milanote to authenticated;
```

## Setup checklist (manual, once)

1. SQL Editor → run `0001_init.sql`.
   (Later migrations: `0004_tasks.sql` for the Tasks view, `0005_connections_client_id.sql` for line sync, `0006_board_management.sql` for move / duplicate / trash, `0007_purge_grants.sql` so `milanote-purge` (service role) can read and delete trash rows — run each once in the SQL Editor, in order. Without 0005 lines still load, but saving them fails until it runs. Without 0006 "Move to…", Duplicate board, the board menu's Move to Trash and the Trash page fail. 0002 and 0003 were reserved but never used.)
2. Settings → API → Exposed schemas → add `milanote` (keep existing entries).
3. `insert into milanote.members (user_id, display_name) values ('<your auth uid>', 'Miguel');`
4. Deploy edge functions; set secrets.
