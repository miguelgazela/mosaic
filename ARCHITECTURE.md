# Architecture

## Stack (mirrors KangarooSplit)

| Layer | Choice | Why |
|---|---|---|
| App | React 19 + Vite + TypeScript | Same as KangarooSplit; fast dev. |
| Styling | Tailwind CSS 4 + tokens in `design/tokens.css` | |
| Routing | react-router-dom 7 | `/`, `/b/:boardId`, `/tasks`, `/trash`, `/s/:token`, `/login` |
| Server state | TanStack Query | Board list, search, tasks, trash, shares. |
| Canvas state | Zustand (+ immer) store per open board | Hot path; must not re-render whole tree on drag. |
| Rich text | TipTap 2/3 (ProseMirror) | Notes, to-do item text, captions. |
| Ordering | `fractional-indexing` | z-order and column order without renumbering. |
| IDs | `crypto.randomUUID()` client-side | Optimistic create, offline queue. |
| Images | `browser-image-compression` (or canvas) + `heic2any` | Resize + thumbnails before upload. |
| Export | `html-to-image` (PNG), `jspdf` (PDF), `jszip` (Markdown) | |
| Backend | Supabase: Postgres, Auth, Storage, Realtime, Edge Functions | |
| Hosting | Vercel (static SPA) | Same rewrite config as KangarooSplit. |
| Tests | Vitest + Playwright | |
| Lint | oxlint | |

## Canvas engine — custom DOM, not a library

Decision: build our own DOM canvas instead of tldraw / React Flow / Konva.

- Cards hold rich text, embeds, images → DOM is natural; canvas-2D libs (Konva, Pixi) would need text editing re-implemented.
- tldraw: licence (commercial watermark/licence key) and its shape model fights Milanote's card+column feel.
- React Flow: good for arrows, weak for columns (auto-stacking containers with drag in/out) and grid snapping feel.

Structure:

```
<CanvasViewport>             // captures pointer/wheel, owns pan/zoom
  <div style="transform: translate(x,y) scale(z)">   // world layer
    <ConnectionsLayer/>      // one SVG, absolute, under cards
    <CardLayer>              // absolutely positioned cards, sorted by z
      <CardShell id>         // drag, select, resize handles; renders registry[type]
    </CardLayer>
    <SelectionOverlay/>      // marquee, bbox, snap guides
  </div>
  <Toolbar/> <ZoomControls/> <Breadcrumbs/> (screen space)
</CanvasViewport>
```

Rules:
- Card components subscribe to their own element by id (`useElement(id)` with Zustand selector) — dragging one card re-renders only that card.
- During drag, update the store each animation frame; persist only on pointer-up.
- Card registry: `cardRegistry[type] = { Component, defaultSize, resizable, toPlainText, toMarkdown, onDropFiles? }`. New card types plug in without touching the engine. This is the contract that lets card-type sessions run in parallel.
- Auto-height cards report measured height via `ResizeObserver` to the store (needed for arrows, columns, marquee, export bounds) but height is not persisted for auto-height types.
- Viewport culling: skip rendering cards far outside viewport when > 200 cards.
- Coordinates: world units = CSS px at zoom 1. Grid = 8.

### Engine extension points (added in P3)

Contract lives in `web/src/cards/types.ts`. Cards only register hooks; the engine never imports a card type.

**Paste routing — `onPaste?(data, at): boolean`.** `data = { text?, url?, files? }` (`url` is set only when the clipboard text is a single http(s) URL; built by `canvas/paste.ts`). The paste handler (`useCanvasShortcuts` → `actions.pasteData`) first tries our own clipboard JSON (copied cards), then asks each registered card in registry order; the first to return `true` owns the paste and creates its card (`addCard(type, at, { content })`). If nobody takes it, plain text becomes a note (via the note card's `contentFromText`). P4 registers files/images, P5 registers `url`; neither touches the engine. Registry order matters: put specific hooks (link, image) before anything greedy.

**Drop targets — `dropTarget?: { accepts(target, dragged), hover?(target, pointer), drop(ctx) }`.** While cards are dragged, the engine hit-tests the pointer against top-level cards that have a `dropTarget` and `accepts` the dragged set (topmost wins), and stores `{ targetId, hint }` in `useBoard().dropHint` (cards read it to draw the highlight and insert line). On release it calls `drop`, which returns element patches (`parentId`, `sortKey`, `width`, …); the engine merges them into the one undoable "Move" command. Columns implement it (insert index from child midpoints). **P8:** board cards register a `dropTarget` whose `moveTo(target)` names the destination board: the engine then puts the dragged cards back, calls `moveCardsToBoard` (`features/boards/moveCards.ts`) and `drop` is not used. Alt-drag copies ignore `moveTo` targets.

**Moving cards between boards.** `moveCardsToBoard(ids, dest)` is one undoable command: the cards and the lines touching them leave the store through `withoutSync` (`store.syncMuted`, so the write queue sends no tombstones), the queued edits are flushed (`flushActiveBoard`), then `move_elements` runs (`BoardRepo.move`). Undo moves them back to the old top-left and re-saves the lines the move removed. Remote moves are serialised so a quick Undo comes after its move. The "Moved N cards to X" toast carries the Undo button. Known gap: another tab on the source board keeps showing the cards until it re-syncs (Realtime filters on `board_id` and the updated row no longer matches).

**Copies of board cards.** `CardDefinition.onClone(clone, source)` is called for every copy (paste, duplicate, Alt-drag). The board card gives the copy a new `boardId` and calls `duplicate_board` with that id, so a copy never shares its child board.

**Children of a column.** `CanvasElement.parentId` + `sortKey` (DB: `parent_id`, `sort_key`). A card with `parentId` set is not in the top-level `CardLayer`; the column renders it through `renderChild(id)` (passed in `CardProps`), stacked by `sortKey`, full column width; its `x/y` are ignored. Dragging a child lifts it out first (position from its DOM box), so after that it behaves like any card. Delete, copy and duplicate take a column's children along (`columns.ts › withChildren`). `elementRect()` of a child returns its column's rect (for the selection toolbar).

**Other `CardDefinition` fields:** `onCreate(el)` (side effect after add; board card creates the child board row), `editOnCreate` (new card enters edit mode through `useBoard().editing`), `menuItems(el)` (extra single-selection context-menu items, optionally with a side panel), `contentFromText`. The "Move into column…" menu item lists every card whose `dropTarget` accepts the selection and calls `actions.moveSelectionInto`.

**Edit mode.** `useBoard().editing` is the id of the card being edited (note text, column title, board name, swatch). Clearing the selection ends it. While it is set, single-key shortcuts are off. Notes render read-only HTML from the TipTap schema (`generateHTML`) and mount an editor only while editing, so big boards stay light.

**Read-only mode (P9, FR-54).** `useBoard().readOnly` makes `exec / commit / undo / redo / setSelection / setEditing / setTool` no-ops, so nothing mutates even if a card calls them. On top of that `CanvasView` drops the tool rail, selection toolbar, context menu, drop zone and undo buttons and shows the "View only" pill; left-drag pans; `CardShell` skips drag, resize and edge handles; shortcuts keep only pan/zoom keys. Used by the shared viewer (`/s/:token`, `features/share/SharedBoardPage.tsx`: loads from `milanote-share`, seeds `signedUrls`, swaps the board repo for one answered from the payload, board cards the link does not open show "Not shared"), by `/dev/board/x?view=1`, and by `BoardPage` on phone widths (< 768 px) with a "View only on phone" strip.

**Boards.** Board cards talk to the backend through `features/boards/boardRepo.ts` (`create / info / count / update`, and since P8 `tree / move / restoreLines / duplicate / trash / restore / trashItems / restoreElement / deleteForever`); the dev pages swap in an in-memory copy (`devDb.ts`, mirrors the 0006 RPCs) so `/dev/board/<id>` and `/dev/trash` work without auth, including move, duplicate and trash flows. Navigation goes through `useBoardHref()` (`/b/:id`, or `/dev/board/:id` on the dev pages).

## Data flow and sync

```
UI event → command (undoable) → Zustand store (instant) → write queue → Supabase
                                                    ↑
                     Supabase Realtime (postgres_changes) ← other tabs/devices
```

- **Commands**: every mutation is a command `{ do(), undo(), patches }`. Undo stack lives in the store.
- **Write queue**: coalesces patches per element (debounce 300 ms, flush on pointer-up / blur / `visibilitychange`). Upsert in batches via PostgREST. Persists pending queue to IndexedDB so a reload/offline does not lose edits.
- **Realtime**: subscribe to `elements`, `connections`, `boards` filtered by `board_id`. Ignore echoes of own writes (compare `client_id` column or pending queue). Apply remote change if `updated_at` newer.
- **Conflicts**: last write wins per row. Single-owner app → rare (only two own tabs editing same card).
- **Multi-element ops** (move to board, duplicate board, delete board tree) go through Postgres RPC functions so they are atomic.

## Files

- Bucket `milanote-files` (private). Path: `{user_id}/{element_id}/{original|thumb}.{ext}`.
- Client uploads directly with user JWT; RLS on `storage.objects` checks first path segment = `auth.uid()`.
- Display via signed URLs (cache in memory ~50 min, TTL 60 min). Use `createSignedUrls` batch per board open.

## Edge functions (Deno)

| Function | Purpose | Auth |
|---|---|---|
| `milanote-unfurl` | Fetch URL, parse OpenGraph/oEmbed, return `{title, description, image, favicon, embed}`. Block private IPs (SSRF), 5 s timeout, 1 MB cap. Optionally re-host preview image into bucket. | Member JWT |
| `milanote-share` | Given share token (+ optional board id): validate, return that board's elements + connections + child-board info + signed URLs; honours `include_subboards`, `revoked_at`, trashed boards. Service role inside function only. Written in P9, deploy steps in its README. | Public (token, `--no-verify-jwt`) |
| `milanote-purge` | Cron daily: hard-delete trash > 30 days, remove orphaned storage files. Written in P8; deploy and schedule steps in its README. | `x-cron-secret` header (`--no-verify-jwt`) |

## Search

`elements.plain_text` written by client (each card type's `toPlainText`). Generated `tsvector` column + GIN index. RPC `milanote.search(q text)` returns hits with board path + `ts_headline` snippet. Board titles indexed the same way. Use `websearch_to_tsquery('simple', q)` + prefix match for typeahead.

## Export

- PNG: `html-to-image` renders the live world layer (`[data-testid=world]`) with its transform overridden to the content bounds (or the current view), so cards, SVG lines and arrowheads look exactly as on screen. Chosen over a hand-written canvas renderer because every card type is React/DOM and a second renderer would have to duplicate each one. While exporting, `lib/storage/exportMode` makes image cards load full-size files even off-screen, and the export waits for every image card's `<img>` to finish. Images come from signed URLs; Supabase storage sends CORS headers, so the canvas is not tainted. Google Fonts CSS is cross-origin, so `image.ts` inlines the font itself (`fontEmbedCSS`). Pixel ratio 2, reduced so no edge exceeds 8192 px.
- PDF: the PNG on one page sized to the picture (`jspdf`, px units).
- Markdown: pure function (`features/export/markdown.ts`) over elements via each card's `toMarkdown(el, ctx)`; `ctx` gives relative links for sub-boards, assets and column children. Reading order = top to bottom, then left to right. `jszip` writes one `.md` per board mirroring the board tree (`Home.md`, `Home/Ideas.md`) and `assets/<id8>-<name>` for images/files fetched through signed URLs.
- `html-to-image`, `jspdf` and `jszip` are dynamic imports (separate chunks), loaded on the first export.

## Deployment / env

```
VITE_SUPABASE_URL=https://varnswkomuckwgobplld.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Supabase client must be created with `db: { schema: 'milanote' }`. Schema `milanote` must be added to Settings → API → Exposed schemas (keep existing ones!).

## Folder layout

```
milanote_clone/
  CLAUDE.md  REQUIREMENTS.md  ARCHITECTURE.md  DATA_MODEL.md  ROADMAP.md
  design/            tokens.css, README.md, reference screenshots
  supabase/
    migrations/      0001_init.sql, 0002_..., applied by hand in SQL editor
    functions/       milanote-unfurl/, milanote-share/, milanote-purge/
  web/
    src/
      app/           routes, layout, providers
      auth/
      lib/           supabase client, queries, geometry, fractional index helpers
      canvas/        engine: viewport, store, commands, selection, snapping, drag, connections
      cards/         one folder per card type + registry.ts
      features/      boards, tasks, search, export, share, trash
      ui/            shared components (menus, dialogs, toolbar buttons)
    e2e/             Playwright
```
