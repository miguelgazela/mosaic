# Data model — schema `milanote`

Draft for `supabase/migrations/0001_init.sql`. Final SQL is written in Phase 0; keep this doc in sync when it changes.

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
note:   { doc: TipTapJSON }
image:  { path: string; thumbPath: string; w: number; h: number; caption?: TipTapJSON; name: string; bytes: number }
file:   { path: string; name: string; mime: string; bytes: number; previewPath?: string }
link:   { url: string; title?: string; description?: string; image?: string; favicon?: string; embed?: { provider: 'youtube'|'vimeo'; id: string } }
todo:   { title?: string; hideCompleted: boolean; items: { id: string; text: string; done: boolean; due?: string /* ISO date */ }[] }
column: { title: string; collapsed: boolean }
board:  { boardId: string }   // child board; boards.parent_board_id = this element's board_id
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
| created_at / updated_at / deleted_at | timestamptz | |

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
No `anon` grants — shared view goes through `milanote-share` edge function (service role).

## RPC functions (`security invoker` unless noted)

| function | does |
|---|---|
| `ensure_home()` | create Home board if member has none; return its id |
| `move_elements(ids uuid[], target_board uuid, at_x, at_y)` | move cards (and their column children, connections between moved cards) to another board; update child boards' `parent_board_id` for board cards |
| `duplicate_board(board uuid, target_parent uuid)` | deep copy tree; file paths reused (storage objects shared; purge checks references) |
| `trash_board(board uuid)` / `restore_board(board uuid)` | soft delete / restore subtree |
| `search(q text, lim int)` | elements + boards hits with `ts_headline` and board breadcrumb path |
| `tasks()` | flatten todo items with due dates across boards: `jsonb_array_elements(content->'items')` |
| `board_path(board uuid)` | recursive CTE → breadcrumb array |

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
2. Settings → API → Exposed schemas → add `milanote` (keep existing entries).
3. `insert into milanote.members (user_id, display_name) values ('<your auth uid>', 'Miguel');`
4. Deploy edge functions; set secrets.
