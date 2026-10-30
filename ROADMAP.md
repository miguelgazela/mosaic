# Roadmap — one phase ≈ one dev session

Each phase below is a self-contained brief: paste "Do Phase N from ROADMAP.md" into a new session. Each session reads `CLAUDE.md` first.

## Status

| Phase | State |
| --- | --- |
| P0 Foundation | Done (`69244fb`) |
| P1 Canvas engine | Done (`e9cc9e0`) — built before the mockups; D1 brings it in line |
| Mockups | Done — 46 frames, see `design/README.md` |
| D1 Design alignment | Done (`4421889`) |
| P2 Persistence + sync | Done (`802cf37`); live check pending (see S1) |
| S1 Stabilise D1 + P2 | Done except the manual offline-flush check. Live Supabase (`npx playwright test sync`): edit survives reload ✓, two tabs mirror ✓ (test allows 3 s; <1 s not timed). Offline edit flushes on reconnect: not yet checked by hand |
| P3 Notes, columns, boards, swatch | Done (`da9ad34`, Wave A). Not checked against live Supabase |
| P6 To-dos + Tasks view | Done (`0df4aaf`, merged `cb35203`, Wave A). Migration `0004_tasks.sql` must be run in the SQL Editor; not checked live |
| P4 Images + files | Done (`d36bcd9`, Wave B). Storage mocked in tests; real upload not checked live |
| P5 Links + unfurl | Done (`df1fd2c`, Wave B). `milanote-unfurl` not deployed yet — previews show the failed state until it is |
| P7 Connections | Done (`575e61e`, merged `85a3795`, Wave B). Migration `0005_connections_client_id.sql` must be run in the SQL Editor (after 0004); not checked live |
| P8 Board management | Done (merged `9767540`). Migrations 0006 + 0007 applied 2026-10-29; `milanote-purge` not deployed; live-checked 2026-10-29 |
| P9 Share links + read-only | Done (merged `741e501`). 0009 applied, `milanote-share` deployed 2026-10-29; live-checked 2026-10-29 |
| P10 Search | Done (merged `0a566f8`). Migration 0008 applied; owner tried it on the dev db |
| P11 Export | Done (merged `b7efa70`). No migration. Not checked live |
| D2 Mosaic branding + icons | Done (merged `c3d8686`). Browser keys, clipboard kind and IndexedDB renamed to `mosaic*` (owner had no data). Two icon gaps open, see follow-ups |
| P12 Polish, phone, performance, PWA | Done (merged `eb22b64`). No migration. Needs deploy (service worker + manifest ship with the web build) |
| P13 Leftovers | Done (merged `a390186`, live 2026-10-30). 0010 applied, `milanote-unfurl` redeployed |
| P14 Owner bugs | Not started |

### Open follow-ups

- **Live checks — run 2026-10-29 on `main` at `b8f532c`, real project, browser pane:** ✓ child board + column of notes (via "Move into column…") + to-do + arrow all survive reload (P3/P6/P7); ✓ due item shows on `/tasks` under Today with board path, ticking it there updates the open board live (P6); ✓ two tabs mirror, new card seen in the other tab ~0.9 s after the click (P2); ✓ offline edit (simulated by failing requests) shows "Offline – changes will sync", reaches the other tab after reconnect, status back to "Saved" (S1). Not covered: real image upload (P4), link unfurl (P5, not deployed).
- **Bugs found in live check:**
  - ~~Board card context menu crash (`menuItems`, `el` undefined)~~ — fixed in P8 (`ContextMenu.tsx` guard + test).
  - Once, right after opening a just-created child board, Add note / double-click created nothing until reload. Console showed network errors and 401s just before (likely expired session). Did not reproduce afterwards; watch for it.
  - Double-click on empty canvas didn't create a note in the browser pane (Playwright test passes). Check by hand.
  - Name typed straight after "Add board" sometimes doesn't stick (board stays "Untitled board").
- **P8 live check — 2026-10-29 on `main` at `5ee0e97`, real project:** ✓ Move to… picker (tree, current board disabled) moves a note to another board, toast Undo moves it back (checked in DB); ✓ Duplicate board = deep copy (8 cards, 1 line, no shared ids, child board copied with its own new id, card on Home); ✓ Move to Trash → back to Home + toast; listed in `/trash` as "Board, 8 items"; Restore brings back board, its card, its child board and all cards; ✓ Recent strip on Home lists visited boards and skips trashed ones. Not checked: Delete forever (irreversible), drag-onto-board-card, purge.
- **Bugs found in P8 live check:**
  - Auto-discarded empty notes are soft-deleted, so `/trash` fills with "Empty note" rows (15 on the test account). They should be hard-deleted, or Trash should hide notes with empty `plain_text`.
  - Once, with a card selected, clicking the board menu "⋯" did not open it; after Esc it opened. Not reproduced.
- **P9 live check — 2026-10-29 on `main` at `52a0862`, real project, deployed `milanote-share`:** ✓ Share dialog empty state → Create link (auto-copied, "Copied", Revoke); ✓ function called with no auth returns the board (8 cards, 1 line), no owner id or email; ✓ `/s/:token` viewer: no tool rail, "Shared by …, view only", line drawn; double-click, Add item + typing, Backspace on a note change nothing; ✓ sub-boards off → sub-board card shows "Private board · Not shared", its URL shows the revoked screen; ✓ sub-boards on → sub-board opens with breadcrumb; ✓ Revoke asks first, link then shows "This link doesn't work any more". Not checked: images/files signed URLs, phone.
- **Bugs found in P9 live check:**
  - Viewer still shows edit affordances that do nothing: "+ Add item" on to-dos, "Drag cards here to stack them" in empty columns (plus the known clickable-looking checkboxes).
  - An empty shared sub-board is a blank canvas with no empty-state message.
  - "Shared by" uses `members.display_name`, which is "Milanote E2e" on the owner's row — owner should set a real name.
  - Share dialog's "Include sub-boards" starts off; `shares.include_subboards` defaults true. Pick one.
- **D2 design check — 2026-10-29 on `main`, 1440 × 900 (headless, signed out):** ✓ sign-in, Not a member, 404, Home, shared viewer header and board menu all show the Mosaic icon/lockup and "Made with Mosaic"; no "Milanote" text seen.
- **Gaps found in D2 design check:**
  - Coloured board cards: `BoardTile` with `onCard` mixes the tint 62 % toward text, so lilac/mint boards get a dark grey tile with a white glyph. `00-card-board-and-swatch` ("Hero film") wants a saturated tile in the board's hue (orange tile on a peach card).
  - Icon picker shows bare glyphs; `00-pickers` shows each icon on a grey `--board-tile` with violet glyph and a violet ring on the selected one.
  - Not D2: sign-in "Sign in" button looks disabled until fields are filled and "Email me a magic link" is a text button (mock: violet button, outlined secondary button).
- **Owner bugs from first real use — 2026-10-30 (P14), mosaic.miguelgazela.com (personal account):**
  - Trash: select several or all items and restore / delete them together.
  - Switching boards re-renders the whole page: top bar and tool rail vanish and come back. Only the canvas should change.
  - Dragging a link card fails: the card leaves its spot and jumps up and to the left.
  - Link previews look poor. `milanote-unfurl` deployed 2026-10-30. Cards that failed before stay failed (`failed: true` is never retried): add a "Retry preview" action or retry failed cards once on load. Then improve the card.
  - "Can't add images?": Upload button on the tool rail and drag-drop exist (P4) but were not found, or failed on production. Check upload on the live site; make adding an image obvious.
  - Renaming a board: the title field is too narrow to show its placeholder.
  - Uploaded images look low quality (blurry).
  - Connection dots show on every side of every card. Show one (or none) by default; reveal the rest with a key or on demand.
- **P8 (done):** board-card duplicate now deep-copies; board cards register `dropTarget`. Also added undo/redo buttons and empty notes now survive while selected (replaces the P3 discard-on-blur rule).
- **P6 leftovers:** (P13: due date from the Tasks list done) keyboard reorder of to-do items only tested with Alt+Arrow.
- **P3 leftovers:** Home hint doesn't highlight the Board button / draw the arrow; note checkboxes tick only while editing; swatch edit panel and board "Icon & colour" menu lack Playwright tests.
- **Deploy:** `supabase functions deploy milanote-unfurl --project-ref varnswkomuckwgobplld` (JWT verification on, no secrets). Then check YouTube, GitHub, a news site and Pinterest unfurl.
- **P4 leftovers:** selected-image size badge (engine; P12), selection ring should include the caption, lightbox should cap at ~960 px, drop zone should show cards faintly not dimmed, PDF first-page preview not built. Image `caption` is plain text now (P10 search reads it as a string). Deleted image/file objects stay in the bucket until `milanote-purge` (P8). `Toolbar.tsx` has a special Upload button because the `toolbar` field can't express a non-card tool.
- **P5 leftovers:** DNS-rebinding gap in the SSRF guard (resolve-then-fetch; see the function README); preview images are hotlinked, not re-hosted; no keyboard shortcut for links.
- **Flaky test:** `e2e/todo.spec.ts` › "T adds a card; add, check, date, hide completed, undo" failed once in a full run after the P7 merge, then passed alone twice and in two full runs. Make it stable.
- **Parallel testing:** run Playwright with `E2E_PORT=<free port> npx playwright test` so a session never tests another worktree's dev server.

## Dependency graph

```
P0 ✓ ─ P1 ✓ ─ D1 ✓ ─ P2 ✓ ─ S1 ✓
                             ├─ Wave A (parallel): P3 Notes, columns, boards, swatch  +  P6 To-dos + Tasks view
                             │     merge P3, then P6 (rebased)
                             └─ Wave B (parallel, after Wave A merged): P4 Images + files  +  P5 Links  +  P7 Connections
                                   merge P4, P5, then P7 (each rebased)
                                   └─ P8 Boards mgmt: move, duplicate, trash
                                        ├─ P9  Share links + read-only ─┐
                                        ├─ P10 Search                   │  (parallel)
                                        └─ P11 Export                  ─┘
                                             └─ D2 Mosaic branding + icons (sequential: touches shared UI)
                                                  └─ P12 Polish, phone, perf, PWA
```

Why waves (checked against the code after S1):
- P3 and P7 both rework engine files (`canvas/interactions.ts`, `CardShell.tsx`, `store.ts`, `lib/sync/`): columns change how card positions work, and arrows need those positions. They must not run together.
- P3 adds the engine extension points the card phases need: `onPaste` on `CardDefinition` (text / URL / image routing, used by P3 notes, P4 images, P5 links) and a drop-target API (columns, board cards). P4 and P5 then only register hooks.
- P6 is mostly self-contained (`cards/todo/`, `features/tasks/`, a route, migration 0004), so it runs beside P3.

### Rules for running sessions

- **One session per checkout.** Two sessions never write in the same folder. A phase that runs alongside another gets its own git worktree and branch (`phase/p3-notes`, …).
- **Commit before the next phase starts.** Each phase ends with its own commit (or merged branch) on `main`; the next phase starts from that commit.
- **Sequential when phases share files.** D1 → P2 had to be sequential: both edit `BoardPage.tsx`, `TopBar`, `SaveStatus`, `CanvasView.tsx`. Treat a phase as parallel-safe only if it does not touch `app/`, `canvas/` or `lib/sync/` beyond one-line registrations.
- **Parallel groups merge one at a time.** For P3–P7 and P9–P11: each in its own worktree, merged into `main` in order (lowest number first); later branches rebase onto `main` before merging.
- Within a wave, phases each own `web/src/cards/<type>/` plus a reserved migration number (P4=0002, P5=0003, P6=0004, P7=0005). Shared files (`cards/registry.ts`, `Toolbar.tsx`, `ContextMenu.tsx`) — one-line edits only; anything bigger, stop and note it as a follow-up for the merge.

## How to use the designs (every phase with UI)

1. Read `design/README.md` first — its decisions win over the brief and over this roadmap's wording.
2. Open every PNG in the phase's **Design refs** before writing UI. Rebuild in React + Tailwind using `design/tokens.css` variables; do not copy pixel values that a token already covers.
3. Mockup images are placeholders (flat colour blocks); use real content.
4. Before finishing, screenshot the built screen in the browser at 1440 × 900 and compare it with the PNG. List visible differences in the final report; fix the ones that are not deliberate.
5. If the mockup is unclear or missing a state, follow the closest frame and note it as an open question — do not invent new colours or sizes.

---

## P0 — Foundation ✓
Done. Scaffold, auth, routes, migration 0001, placeholder tokens.

## P1 — Canvas engine ✓
Done. Viewport, store, commands/undo, card shell, selection + marquee, clipboard, toolbar, context menu, zoom controls, debug card.
Gaps vs designs (handled in D1): no snap guides, no top bar, no selection toolbar, no ghost card on tool drag, ad-hoc styling (11 px labels, `bg-black/5`, `bg-white`).

## D1 — Design alignment (retrofit P0 + P1 to the mockups)
**Goal:** everything built so far looks like the mockups; shared UI kit ready for later phases.
- Load Plus Jakarta Sans in `web/index.html`; confirm `tokens.css` is the only source of colours, sizes, radii, shadows, motion. Replace ad-hoc Tailwind colours (`bg-white`, `black/5`, `text-[11px]`) with tokens.
- `web/src/ui/` kit per `00-buttons-and-inputs.png`: Button (primary, secondary, ghost, destructive, icon-only), TextField, SearchField, Toggle, Checkbox, Menu/MenuItem, Tooltip (with shortcut key chip), Toast host, Dialog shell. All states incl. focus ring `--ring-focus`.
- Sign in + Not a member screens per frames.
- Board page layout: top bar (logo mark, breadcrumb slot, save-status slot, Search button with ⌘K hint, Tasks, Share, avatar) — wired to placeholders; breadcrumb overflow menu + inline rename UI.
- Tool rail per `00-canvas-chrome-states.png`: icon (Lucide) + 12 px label, states default/hover+tooltip/pressed/active/focus, Trash at bottom, ghost card while dragging a tool. **Keep Select and Hand at the top** (deliberate deviation).
- Registry gains `shortcut` field; single-key shortcuts N/T/C/B/V/H (FR-50) — card types fill their key in later phases.
- Canvas: dotted warm-grey background, card shared states per `00-card-shared-states.png` (hover, selected outline `--primary`, dragging tilt + shadow, reduced-motion), resize handles, marquee style, **snap guides** (FR-53).
- **Selection toolbar** (FR-52) and restyled card / canvas context menus per `00-menus.png` (items whose features come later are hidden, not disabled).
- Zoom controls + zoom menu (25/50/100/200 %, Fit to content ⇧1).
- Empty board hint, 404 page, toast + offline banner components (`00-toasts-banner-highlight.png`).
- Update P1 Playwright tests for new selectors; add one visual check per screen above.

**Design refs:** `00-foundations`, `00-buttons-and-inputs`, `00-canvas-chrome-states`, `00-card-shared-states`, `00-menus` (card + canvas menus), `00-toasts-banner-highlight`, `00-empty-and-loading` (empty board), `01-sign-in-default`, `01-sign-in-error-and-link-sent`, `02-not-a-member-default`, `04-board-empty`, `04-board-card-selected`, `04-board-marquee`, `04-board-drag-snap-guides`, `09-not-found-default`.
**Done when:** those frames match the running app (screenshots compared); lint, tests, build pass.

## P2 — Persistence + sync
**Goal:** board loads from and saves to Supabase; live across tabs.
- Load board: elements + connections in one go; TanStack Query cache.
- Write queue: patch coalescing, debounce, batch upsert, IndexedDB persistence, retry with backoff.
- Realtime subscription per board; echo suppression via `client_id`; apply newer remote rows.
- Viewport persisted per board (debounced).
- Wire D1's save status (Saved / Saving… / Offline – changes will sync), offline banner, breadcrumbs from `board_path`, inline board rename.
- Board-opening skeleton.

**Design refs:** `00-canvas-chrome-states` (save status, breadcrumbs), `00-toasts-banner-highlight` (offline banner), `00-empty-and-loading` (board skeleton), `04-board-file-drop-offline` (offline banner only).
**Done when:** edits survive reload; two tabs mirror each other < 1 s; offline edit flushes on reconnect.

## S1 — Stabilise D1 + P2 (after D1 finishes)
**Goal:** D1 and P2 verified together, committed as two commits on `main`, gaps closed. Start only when the D1 session has ended.
- Review the mixed working tree; split into a D1 commit (`web/src/ui/`, chrome, styling, auth screens) and a P2 commit (`web/src/lib/sync/`, `features/boards/`, `BoardPage` data wiring). If a file can't be split cleanly, commit it with P2 and say so.
- `BoardPage.tsx`: was overwritten by P2 mid-D1. Compare with D1's design refs; restore any D1 UI lost (known: board load error should use `FullPageMessage`, not ad-hoc buttons).
- Save status gains an **error** state ("Couldn't save – retrying", icon + word) for failed sends while retrying; P2 currently shows "Saving…".
- On app start, flush queued edits for **all** boards in IndexedDB, not just the one being opened.
- Playwright test for P2: edit → reload → edit present; two tabs mirror.
- Run against live Supabase (`varnswkomuckwgobplld`): edits survive reload, two tabs < 1 s, offline edit flushes on reconnect. Report results.
- Screenshot comparison for D1 and P2 design refs (see "How to use the designs").
- Carried to P7: connections are fetched but not stored, subscribed or written.

**Done when:** two commits on `main`; lint, tests, build pass; live checks reported; frames match.

## P3 — Notes, columns, board cards, colour swatch
- Note card with TipTap: format toolbar + heading/highlight menus, markdown shortcuts, auto-height, colour; `toPlainText`, `toMarkdown`. Shortcut N.
- Double-click canvas → new focused note. Paste plain text → note.
- Column card: title, count, stacked children by `sort_key`, drag in/out with insert line, collapse, width resize, colour. Shortcut C.
- **Move into column…** in card menu (FR-51).
- Board card: create child board, icon + colour picker, item count, open on click, drop-target highlight; navigation + breadcrumbs. Shortcut B.
- Colour swatch card: hex, optional name, click copies (with "Copied" state).
- Card colour picker (shared, `00-pickers`).
- Home: empty state with onboarding hint.
- **Engine extension points for Wave B** (P3 owns these engine changes):
  - `onPaste?: (data: { text?: string; url?: string; files?: File[] }, at) => boolean` on `CardDefinition`; the engine's paste handler asks each registered card in turn, falling back to a note for plain text. P4 (images) and P5 (links) only register a hook.
  - Drop-target API on `CardDefinition` (used by columns and board cards; P8 reuses it for move-to-board).
  - Replace the `debug` card's mapping to a `note` row (added in S1) with the real note card; keep `debug` dev-only.

**Design refs:** `00-card-note`, `00-card-column`, `00-card-board-and-swatch`, `00-card-shared-states`, `00-pickers` (card colour, board icon + colour), `04-board-populated`, `04-board-drag-into-column`, `03-home-empty`.
**Done when:** can build nested boards with columns of notes and swatches; all persists; frames match.

## P4 — Images + files
- Upload pipeline: drag-drop from desktop (drop-zone overlay), paste (via P3's `onPaste` hook), tool rail Upload; HEIC convert, resize 2560, thumb 512; uploading + failed (retry) states.
- Image card: aspect-locked resize, caption, lightbox (default + loading), download. Thumb below 100 % zoom.
- File card: icon, name, size, download; PDF first-page preview optional.
- Signed URL cache + batch fetch on board open; image placeholders while loading.
- Upload failed toast with Retry.

**Design refs:** `00-card-image-and-file`, `08-lightbox-default`, `08-lightbox-loading`, `04-board-file-drop-offline` (drop zone), `00-empty-and-loading` (image placeholder), `00-toasts-banner-highlight` (upload failed).
**Done when:** 50 images on a board load lazily; storage paths under `{uid}/`; frames match.

## P5 — Links + `milanote-unfurl`
- Edge function: OG/Twitter meta + oEmbed for YouTube/Vimeo, SSRF guard, timeout, size cap; tests.
- Link card: full preview, text-only, loading, failed (plain URL), video before play + playing; edit URL. Text links use `--link`, not `--teal`.
- Paste URL anywhere → link card, via the `onPaste` hook P3 added (no engine edits).

**Design refs:** `00-card-link`, `00-empty-and-loading` (link placeholder).
**Done when:** common sites (YouTube, GitHub, news, Pinterest) unfurl; private IPs rejected; frames match.

## P6 — To-dos + Tasks view
- To-do card: title, items, check, reorder, progress bar + "2/4", due date chip (upcoming / Today / Overdue — icon + word, never colour alone), due date picker, hide completed, colour. Shortcut T.
- `tasks()` RPC + `/tasks` page grouped Overdue / Today / Upcoming / No date; check from list; jump to card with highlight flash; empty state.
- Runs beside P3 (Wave A), so stay out of engine files: item text is a plain text input (no TipTap — P3 adds it); jump-to-card uses a `?card=<id>` URL param read in a new `canvas/focus.ts` plus one line in `CanvasView.tsx`; migration `0004`.

**Design refs:** `00-card-todo`, `05-tasks-populated`, `05-tasks-empty`, `00-toasts-banner-highlight` (highlight flash).
**Done when:** due items from nested boards appear in Tasks; toggling syncs both ways; frames match.

## P7 — Connections (arrows)
- Sync for connections (carried from P2): store, Realtime subscription, write queue — reuse `lib/sync/`.
- SVG layer; Line tool (active state on rail); drag from card edge handles; attach/detach endpoints; follow cards.
- Straight/curved with bend handle; dash; arrowheads; colours; label; hover, selected, drawing, snapping states; line style popover.
- Selection, delete, undo integration; hit-testing on thin lines.

**Design refs:** `00-connections`, `04-board-populated` (labelled curved arrow).
**Done when:** arrows survive moving cards, column moves, copy/paste of connected cards; frames match.

**Status:** built on `claude/p7-connections-3483dd`. Run `0005_connections_client_id.sql` (adds `connections.client_id`; without it lines load but saving them fails). Line tool is `L`; it returns to Select after one line. Follow-ups: lines are not in marquee selection or the right-click menu; no keyboard way to select a line; lines are not yet moved/duplicated by P8's board operations (`move_elements` RPC already moves lines between moved cards); queued line edits of *other* boards are not flushed at app start (only the open board's queue, unlike elements).

## P8 — Board management
- `move_elements` RPC: drop selection onto board card, **Move to…** picker (board tree) — "Moved 3 cards to Ideas" toast with Undo.
- `duplicate_board` RPC.
- Board menu (rename, icon & colour, duplicate, export slot, share slot, move to trash).
- Trash: `/trash` page (populated + empty), restore, delete forever with confirm dialog; `milanote-purge` cron function.
- Home: Recent boards strip.

**Design refs:** `00-menus` (board menu), `00-pickers` (move to board), `06-trash-populated`, `06-trash-empty`, `00-shortcuts-and-confirm` (delete forever), `03-home-populated`, `00-toasts-banner-highlight` (move + undo).
**Done when:** move/duplicate/trash on nested trees keep children + arrows consistent; frames match.

**Status:** merged (`9767540`) from `claude/p8-board-mgmt-acbb4c`. **Run `0006_board_management.sql`** (functions + one trigger; without it move, duplicate and trash fail) and `0007_purge_grants.sql` (service-role grants the purge needs). Then deploy `milanote-purge` and schedule it (steps in `supabase/functions/milanote-purge/README.md`). Tested: SQL against a local PGlite copy of 0001+0004+0005+0006 (duplicate with sub-board and arrow, move with lines and column children, cycle rejection, trash/restore, trigger, delete forever); Vitest; Playwright `p8.spec.ts` on the in-memory dev database. Not tested against the real project. Choices: Recent strip is per browser (localStorage, `features/boards/recent.ts`; P10's palette can reuse it); deleting a board card trashes its child board (trigger); Trash lists boards and non-board cards. Follow-ups: other tabs on the source board keep moved cards until they re-sync; Export and Share menu items are coded but hidden (`SHOW_EXPORT` / `SHOW_SHARE` in `BoardMenu.tsx`); moved cards keep their z key (ties possible); Move to… tree has no drag and the picker has no section dividers like the mock; no "Copy link to card" item; Trash does not list individual items of a trashed board (they go with it); purge counts are not logged anywhere but the function response.

## P9 — Share links + read-only mode
- Share dialog: create/revoke links (revoke confirm), include sub-boards toggle, copy with "Copied", empty state.
- `milanote-share` edge function: token → board tree subset + signed URLs.
- Read-only canvas mode (FR-54): no tool rail, "View only" chip, bottom status pill.
- `/s/:token` viewer: default, sub-board opened, revoked / not found.

**Design refs:** `00-share-dialog`, `00-shortcuts-and-confirm` (revoke), `04-board-read-only`, `07-shared-board-default`, `07-shared-board-sub-board`, `07-shared-board-revoked`.
**Done when:** incognito window opens shared board; revoked token → revoked screen; sub-board access respects toggle; frames match.

**Status:** merged (`741e501`) from `claude/p9-share-67d2b6`. **Run `0009_share_grants.sql`** (service role may read `shares`), then deploy `milanote-share` (steps in `supabase/functions/milanote-share/README.md`; not deployed yet). Tested: Deno tests for the function logic (8: tree subset, sub-board toggle, revoked/trashed/out-of-tree → 404, own-files-only signing, no owner id leak); Vitest (read-only store, share helpers); Playwright `p9.spec.ts` (share dialog create/copy/revoke-confirm, board menu Share…, read-only board, `/s/demo` viewer with sub-board, `/s/demo-flat`, revoked, stubbed function 404). Not tested against the real project or a real signed-out browser. Choices: `/s/demo`, `/s/demo-flat`, `/s/demo-revoked` are dev-only fixtures (`features/share/demo.ts`, stripped from prod); shared view opens at the owner's saved viewport (or 0,0); phone boards (< 768 px) are read-only with a strip (`BoardPage`). Follow-ups: shared view has no sub-board counts when "this board only"; links list shows `host/s/<10 chars>…` (full link is copied); Revoke confirm uses the shared Dialog shell, so it has a close X the mock lacks; todo checkboxes in the viewer look clickable but do nothing; no `07-shared-board-phone` frame check; Share on Home is allowed.

## P10 — Search
- `search()` RPC with snippets + path; board-title search.
- ⌘K palette: recent boards when empty, grouped results (Boards, Cards) with highlighted match + path, keyboard selection, searching, no results.
- Jump to result: open board, pan/zoom to card, highlight flash.

**Status:** merged (`0a566f8`) from `claude/p10-search-1459ae`; merge fixed a `TopBar.tsx` conflict (Share + palette) and added `search` to the viewer's read-only `BoardRepo` stub. `0008_search.sql` applied by the owner (one function `milanote.search`). Tested: SQL on a local PGlite copy of 0001+0008 (prefix, multi-word, trashed board/card skipped, markers); Vitest (`features/search/parse.test.ts`); Playwright `p10.spec.ts` on the in-memory dev db (`DevDb.search` stand-in). Not tested against the real project. Jump reuses P6's `?card=` focus + flash (`canvas/focus.ts`). Mounts outside P10's folder: `app/TopBar.tsx` (palette, ⌘K/Ctrl+K, button), `boardRepo.search`, `devDb.search`; image `toPlainText` now holds caption and file name. Follow-ups: ⌘K only works on pages with the top bar (not Home-less pages like Tasks/Trash); search covers live boards only (no trashed items); no ranking by recency; `plain_text` of cards saved before this phase is unchanged (image caption-only cards lack the file name until edited); highlight is the whole word (ts_headline), mock shows the same.

**Design refs:** `00-search-palette`, `00-toasts-banner-highlight` (highlight flash).
**Done when:** finds text inside notes, to-do items, link titles, captions, file names across all boards; frames match.

## P11 — Export
- Export menu: PNG (whole board / current view), PDF, Markdown zip; progress state; "Export ready" toast.
- Registry `toMarkdown` per card; Vitest snapshot tests for markdown transform.

**Design refs:** `00-menus` (export + progress), `00-toasts-banner-highlight` (export ready).
**Done when:** exported PNG includes images and arrows; markdown zip opens cleanly.

**Status:** merged (`b7efa70`) from `claude/p11-export-dffaef`. No migration, no function change. Board menu → Export: PNG whole board / current view, PDF, Markdown (.zip); progress panel with Cancel; "Export ready: <file>" toast with Download (the file also downloads on its own). Code in `web/src/features/export/` (`run.ts` orchestrates, loaded lazily: `image.ts`, `zip.ts`); `toMarkdown(el, ctx?)` now takes a `MarkdownContext` (sub-board link, asset link, column children). Tested: Vitest (`export.test.ts`: markdown snapshot of every card type, relative links, zip tree plan, name clashes, pixel ratio) and Playwright `p11.spec.ts` (PNG, PDF, view PNG, zip, cancel, image card → red pixels in PNG and file in `assets/`; storage mocked). Not tested against the real project (signed-URL CORS in a real PNG; sub-boards fetched from Supabase). Follow-ups: PNG/PDF render the live DOM, so cards keep on-screen look but a very large board is scaled down to fit 8192 px; link-card preview images are hotlinked and may be left out of the PNG if the host blocks CORS; PDF is one page sized to the picture; markdown zip skips sub-boards it can't read (placeholder file, toast says how many items were left out); Export is not shown in the shared viewer (the board menu is hidden read-only); engine untouched, `exportMode` flag in `lib/storage` makes image cards load full size off-screen during export.

## D2 — Mosaic branding + icons (retrofit built phases to the new name and icons)
**Goal:** every screen and component shows the Mosaic name, the Mosaic app icon and the new board icon set, matching the updated mockups. Runs alone, after P11 is merged and before P12 (P12's PWA manifest uses these icons). Touches shared UI, so no parallel sessions.
- **App icon:** owner puts the icon PNG in `design/brand/` (2048 px original) — export 512 px to `web/public/` (`mosaic-icon-512.png`) plus `favicon`, `apple-touch-icon` (180 px). Replace the placeholder `LogoMark` in `web/src/ui/Logo.tsx` with the icon image (transparent rounded corners already in the 512 px export); keep the `size` prop. Lockup = icon + "Mosaic" 18 px bold, 10 px gap, clear space ¼ of icon width, minimum 16 px (see `00-foundations`).
- **Name:** no "Milanote" or placeholder name left in UI text, `index.html` title, share viewer ("Made with Mosaic"), sign-in, Not a member, shared-board and 404 screens. **Do not rename** the Supabase schema `milanote`, bucket `milanote-files`, functions `milanote-*` or the `milanote-web` package — they are shared infrastructure (see `CLAUDE.md`).
- **Board icons:** in `web/src/features/boards/icons.tsx` the picker offers 12 icons: star, camera, image, folder, lightbulb, heart, calendar, flag, rocket, palette, book, music. Keep every existing key (`layout`, `pencil`, `bookmark`, `globe`, `home`, `leaf`, `archive`, `film`, …) so saved boards still render; they just leave the picker grid. Style: glyph `--board-icon` (`#5B21B6`) on tile `--board-tile` (`#ECEAE6`), 1.75 stroke, round caps. Add both tokens to `design/tokens.css`.
- **Where the board icon appears:** board cards (`cards/board/boardCard.tsx`, 64 px tile), breadcrumb chip (20 px), Move-to tree, Trash rows, search results, icon picker. A custom board colour still replaces the grey tile (e.g. the orange "Hero film" card in `00-card-board-and-swatch`).
- Re-export the changed frames to `design/screens/` (owner exports from the mockups; filenames unchanged) and update `design/README.md`.
- Update Playwright selectors/snapshots that depend on the old logo or icon set; add one test that a board with a legacy icon key still renders.

**Status:** merged (`c3d8686`) from `claude/d2-branding-cecd0f`; IndexedDB `milanote-sync` → `mosaic-sync` in `797e17c`. No migration. Icon exports via `design/brand/export-icons.mjs`; `BoardTile`/`BoardIcon` in `features/boards/icons.tsx`; legacy keys tested in `icons.test.tsx`; Playwright `d2.spec.ts`.

**Design refs:** `00-foundations` (Logo, Lockup and clear space, Board icons), `00-pickers` (board icon picker), `00-card-board-and-swatch`, `01-sign-in-default`, `01-sign-in-phone`, `02-not-a-member-default`, `03-home-populated`, `04-board-populated`, `07-shared-board-default`, `09-not-found-default`.
**Done when:** those frames match the running app (screenshots compared at 1440 × 900); an existing board with an old icon key still renders; no "Milanote" in visible UI; lint, tests, build pass.

## P12 — Polish, phone, performance, PWA
- Keyboard shortcuts sheet (`?`), every shortcut from REQUIREMENTS incl. FR-50.
- Account menu (name, email, Trash, Keyboard shortcuts, Sign out).
- Phone views (view only, FR-54): board with "View only on phone" strip, shared board, sign in; 16 px inputs, 44 px targets.
- Laptop 1280 × 800 fit check of tool rail and top bar.
- Zoomed-out 25 % rendering (thumbnails, viewport culling), memo audit, 500-card perf test.
- Remaining empty/loading states; PWA manifest + service worker (app shell only); manifest icons come from D2.
- Accessibility pass against NFR-8.
- Fix the gaps logged under "Gaps found in D2 design check" (coloured board tile, icon picker tiles, sign-in buttons) and the open bugs from the P8/P9 live checks.

**Status:** done, merged `eb22b64`. Shortcuts sheet (`features/shortcuts/`, `?` anywhere not typing, also from the account menu); account menu shows the `members.display_name` (falls back to the email's local part). Phone (`lib/usePhone.ts`): compact top bar (back/title/search/account), "View only on phone. Edit on a computer." strip, zoom pill centred with a fit button, 16 px inputs and 44 px targets in chrome (CSS block at the end of `index.css`); shared viewer shows the logo only on phone. PWA: `public/manifest.webmanifest`, `public/sw.js` (same-origin shell + hashed assets only; Supabase and other origins are never touched), registered in production builds only, `mosaic-icon-192.png` added. Perf: viewport culling in `canvas/layers.tsx` (`visibleIds`; selected/editing cards and exports keep everything mounted). Fixed bugs: empty notes hidden from Trash (`visibleTrash`), viewer no longer shows "+ Add item" / "Drag cards here", empty shared board shows "This board is empty", Share dialog "Include sub-boards" now on (DB default), coloured board tile is a saturated hue (`.board-tile-hue`), icon picker tiles grey with violet glyph and ring, sign-in buttons always enabled (validation message instead). `todo.spec.ts` stabilised (key press retried until the card exists; clicks the canvas, not the tool rail). Axe check (`e2e/p12.spec.ts`) clean on sign in, board, Trash, Tasks, shortcuts sheet. Measured (dev server, headless Chromium, 500 notes): pan 60 fps, zoom 52–53 fps (p95 frame 33 ms), fit-to-content 25 % pan 60 fps, 42 of 500 cards mounted at 100 %; 300 notes open in ~110 ms warm. Not reproduced: board menu not opening with a card selected (test added, passes). Follow-ups: 25 % level-of-detail (mock shows bars instead of text), real-project open time for 300 cards (NFR-2 only measured on the dev canvas), PDF preview, Home empty-state copy differs from the mock, "Shared by" name needs the owner to set `members.display_name`, swatch/checkbox clickable-looking in the viewer.

**Design refs:** `00-shortcuts-and-confirm` (shortcuts sheet), `00-menus` (account menu), `04-board-phone`, `07-shared-board-phone`, `01-sign-in-phone`, `04-board-laptop-1280`, `04-board-zoom-25`, `00-empty-and-loading`.
**Done when:** NFRs in REQUIREMENTS §4 measured and met; phone + laptop frames match.

## P13 — Leftovers (cleanup of open follow-ups)
- **Tasks:** "Add date" on the Tasks list works. Needs a `set_task_due` RPC: new migration `0010_set_task_due.sql`, update `DATA_MODEL.md`, tell the owner to run it.
- **Images/files (P4):** PDF first-page preview; size badge on the selected image; selection ring includes the caption; lightbox capped at ~960 px; drop zone shows cards faintly instead of dimmed.
- **Links (P5):** close the DNS-rebinding gap in the `milanote-unfurl` SSRF guard (resolve, check, then fetch that IP). Function code only; the owner deploys it.
- **Zoom 25 %:** level of detail per `04-board-zoom-25` (cards simplify to bars below a zoom threshold).
- **Viewer:** to-do checkboxes and swatches no longer look clickable in read-only mode.
- **P3 leftovers:** Home hint highlights the Board button and draws the arrow; note checkboxes tick without entering edit mode; Playwright tests for the swatch edit panel and the board "Icon & colour" menu.
- **Live-check bugs:** a board name typed straight after "Add board" sometimes doesn't stick; double-click on empty canvas sometimes creates no note. Reproduce, fix, add tests.
- **Home empty state:** copy matches `00-empty-and-loading`.
- **Tests:** find why the first `t` keypress is sometimes lost at page start in e2e and fix the cause.

**Out of scope:** deploying functions, Supabase settings, anything outside schema `milanote`.
**Design refs:** `04-board-zoom-25`, `00-empty-and-loading`, `03-home-empty`, `00-card-image-and-file`, `04-board-file-drop-offline`, `05-tasks-populated`.
**Done when:** each item fixed or logged with a reason; lint, unit tests, build and full Playwright pass.

**Status:** done, merged. Owner must run `supabase/migrations/0010_set_task_due.sql` in the SQL Editor (after 0004) and redeploy `supabase functions deploy milanote-unfurl --project-ref varnswkomuckwgobplld`. Done: Tasks "Add date" (native date input over the label, `set_task_due` RPC, DATA_MODEL updated; without 0010 a toast says so); PDF first-page preview (pdf.js loaded lazily, `preview.jpg` beside the original, `previewPath/pages/pw/ph` in content, best effort); selected image shows its size badge and its ring (drawn by the card via `ownSelectionRing`) covers the caption; lightbox long edge ≤ 960 px; drop zone tint 70 % so cards show faintly; unfurl connects to the validated IP (`pinned.ts`, deno tests incl. a local pinned-IP server; real HTTPS checked against example.com and github.com); 25 % level of detail below zoom 0.4 (`LOW_ZOOM`, CSS bars on `[data-lod='low']`, layout unchanged, column titles stay text); viewer: to-do/note checkboxes and swatch show no pointer cursor, rows don't hover; Home hint ring + arrow on the rail's Board button; note checkboxes tick in view mode (`toggleTaskItem`, undoable); Playwright for swatch panel, board Icon & colour, hint, checkboxes, viewer (`e2e/p13.spec.ts`). Bugs: board rename typed straight after "Add board" was lost because `update` ran before the insert landed, fixed by making `update` wait for the pending create (`boardRepo.ts`, Vitest). Lost first `t`: the shortcut listener was added in a passive `useEffect`, i.e. after paint, so cards could be on screen before it existed; now `useLayoutEffect`; the retry in `todo.spec.ts` is gone (not reproduced either way in 40 loops, cause found by reading). Not fixed: double-click on empty canvas sometimes making no note: not reproducible in Playwright (12 variants: while editing, selected card, after click, slow) and not in this headless run of the real flow; suspect a board refetch (window focus) replacing local state before the note has synced, needs a look in the real browser. Home empty copy: the app already matches the full frame `03-home-empty` word for word (the tile in `00-empty-and-loading` is a shorter abbreviation of it), left as is; Tasks empty matches `05-tasks-empty`. Not verified: PDF preview and upload against the real bucket, `set_task_due` against the real database (SQL not run anywhere; same shape as `set_task_done`), unfurl on Supabase's Deno runtime (tested on local Deno), 25 % LOD compared by eye only with a screenshot of a note (no full-frame comparison with `04-board-zoom-25`).

## P14 — Owner bugs from first real use (after P13 merges)
Source: "Owner bugs from first real use" under Open follow-ups.
- **Trash multi-select:** select several or all items; restore or delete forever together (delete forever still asks first).
- **Board switch keeps chrome:** top bar and tool rail stay mounted when moving between boards; only the canvas area shows the skeleton.
- **Link card drag:** dragging a link card moves it normally (no jump up-left). Reproduce, fix, Playwright test.
- **Link previews:** failed previews can be retried (menu action, and one automatic retry on load); review the card against `00-card-link` refs and polish.
- **Images:** check upload on the live site; make adding an image obvious (tool rail label/tooltip, empty-board hint, paste).
- **Image quality:** uploaded images look blurry. Likely causes in code: right after upload the card shows the 512 px thumbnail (`localUrl` = thumb blob, kept in `keepLocal` for the session) even at 100 %; below 100 % zoom it always uses the 512 px thumb, which is too small for a ~300–600 px card on a 2× screen. Fix: show the full image (or a sharper preview sized to card width × devicePixelRatio, e.g. 1024–1280 px) and keep the thumb only for far zoom-out; check encode quality. Compare against the original file on a retina screen.
- **Board rename:** title field wide enough to show its placeholder; grows with the text.
- **Double-click on empty canvas sometimes makes no note** (P13 could not reproduce; suspect a window-focus board refetch replacing local state before the note syncs). Reproduce in a real browser on the live site, fix, test.
- **Connection dots:** not on every side by default. One dot (or none) until hover or a key reveals the rest; keep drag-to-connect working.

**Design refs:** `06-trash-populated`, `00-card-link`, `00-card-image-and-file`, `04-board-populated` (top bar), `00-connections`.
**Done when:** each item fixed with a test (or logged with a reason); lint, unit tests, build and full Playwright pass.
