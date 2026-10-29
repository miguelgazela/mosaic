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
| P8 … P12 | Not started — each starts only when the owner says so |

### Open follow-ups

- **Live checks — run 2026-10-29 on `main` at `b8f532c`, real project, browser pane:** ✓ child board + column of notes (via "Move into column…") + to-do + arrow all survive reload (P3/P6/P7); ✓ due item shows on `/tasks` under Today with board path, ticking it there updates the open board live (P6); ✓ two tabs mirror, new card seen in the other tab ~0.9 s after the click (P2); ✓ offline edit (simulated by failing requests) shows "Offline – changes will sync", reaches the other tab after reconnect, status back to "Saved" (S1). Not covered: real image upload (P4), link unfurl (P5, not deployed).
- **Bugs found in live check:**
  - Board card context menu crashes (`boardCard.tsx` `menuItems`, `el` undefined) when the menu is open and the card's element is gone — `ContextMenu.tsx` passes `elements[singleId]` without checking it exists.
  - Once, right after opening a just-created child board, Add note / double-click created nothing until reload. Console showed network errors and 401s just before (likely expired session). Did not reproduce afterwards; watch for it.
  - Double-click on empty canvas didn't create a note in the browser pane (Playwright test passes). Check by hand.
  - Name typed straight after "Add board" sometimes doesn't stick (board stays "Untitled board").
- **P8:** copy/paste or duplicate of a board card shares the same child board — duplicate must deep-copy. Board cards don't register the `dropTarget` hook yet; P8 registers it for move-to-board.
- **P6 leftovers:** set a due date from the Tasks list needs a `set_task_due` RPC ("Add date" is inert); keyboard reorder of to-do items only tested with Alt+Arrow.
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

## P9 — Share links + read-only mode
- Share dialog: create/revoke links (revoke confirm), include sub-boards toggle, copy with "Copied", empty state.
- `milanote-share` edge function: token → board tree subset + signed URLs.
- Read-only canvas mode (FR-54): no tool rail, "View only" chip, bottom status pill.
- `/s/:token` viewer: default, sub-board opened, revoked / not found.

**Design refs:** `00-share-dialog`, `00-shortcuts-and-confirm` (revoke), `04-board-read-only`, `07-shared-board-default`, `07-shared-board-sub-board`, `07-shared-board-revoked`.
**Done when:** incognito window opens shared board; revoked token → revoked screen; sub-board access respects toggle; frames match.

## P10 — Search
- `search()` RPC with snippets + path; board-title search.
- ⌘K palette: recent boards when empty, grouped results (Boards, Cards) with highlighted match + path, keyboard selection, searching, no results.
- Jump to result: open board, pan/zoom to card, highlight flash.

**Design refs:** `00-search-palette`, `00-toasts-banner-highlight` (highlight flash).
**Done when:** finds text inside notes, to-do items, link titles, captions, file names across all boards; frames match.

## P11 — Export
- Export menu: PNG (whole board / current view), PDF, Markdown zip; progress state; "Export ready" toast.
- Registry `toMarkdown` per card; Vitest snapshot tests for markdown transform.

**Design refs:** `00-menus` (export + progress), `00-toasts-banner-highlight` (export ready).
**Done when:** exported PNG includes images and arrows; markdown zip opens cleanly.

## P12 — Polish, phone, performance, PWA
- Keyboard shortcuts sheet (`?`), every shortcut from REQUIREMENTS incl. FR-50.
- Account menu (name, email, Trash, Keyboard shortcuts, Sign out).
- Phone views (view only, FR-54): board with "View only on phone" strip, shared board, sign in; 16 px inputs, 44 px targets.
- Laptop 1280 × 800 fit check of tool rail and top bar.
- Zoomed-out 25 % rendering (thumbnails, viewport culling), memo audit, 500-card perf test.
- Remaining empty/loading states; PWA manifest + service worker (app shell only).
- Accessibility pass against NFR-8.

**Design refs:** `00-shortcuts-and-confirm` (shortcuts sheet), `00-menus` (account menu), `04-board-phone`, `07-shared-board-phone`, `01-sign-in-phone`, `04-board-laptop-1280`, `04-board-zoom-25`, `00-empty-and-loading`.
**Done when:** NFRs in REQUIREMENTS §4 measured and met; phone + laptop frames match.
