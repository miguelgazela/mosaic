# Roadmap — one phase ≈ one dev session

Each phase below is a self-contained brief: paste "Do Phase N from ROADMAP.md" into a new session. Each session reads `CLAUDE.md` first.

Dependency graph:

```
P0 Foundation
  └─ P1 Canvas engine
       └─ P2 Persistence + sync
            ├─ P3 Notes + columns + board cards  ─┐
            ├─ P4 Images + files                  │  (parallel: separate card folders)
            ├─ P5 Links + unfurl fn               │
            ├─ P6 To-dos + Tasks view             │
            └─ P7 Connections (arrows)           ─┘
                 └─ P8 Boards mgmt: move, duplicate, trash
                      ├─ P9  Share links          ─┐
                      ├─ P10 Search               │  (parallel)
                      └─ P11 Export              ─┘
                           └─ P12 Polish + perf + PWA
```

P3–P7 can run as parallel sessions in separate worktrees once P2 is merged: each owns `web/src/cards/<type>/` plus its migration number (reserve: P4=0002, P5=0003, P6=0004, P7=0005). Shared files touched by all (`cards/registry.ts`, `Toolbar.tsx`) — keep edits to one line each to minimise merge conflicts.

Design track (parallel to P0–P2): mockups in Claude Design from the brief linked in `design/README.md`. Delivery items 1–4 should land before P3 starts.

---

## P0 — Foundation
**Goal:** runnable empty app, signed-in user sees an empty Home canvas page; schema applied.
- Scaffold `web/` (Vite React TS, Tailwind 4, router, TanStack Query, Zustand, oxlint, Vitest, Playwright).
- `lib/supabase.ts` with `db.schema = 'milanote'`; `.env.example`.
- Auth pages: sign in (password + magic link), sign out, "not a member" screen.
- `supabase/migrations/0001_init.sql` per `DATA_MODEL.md`: schema, enum, all tables, RLS, `is_member`, `ensure_home`, `board_path`, storage bucket + policies, realtime publication.
- `design/tokens.css` + `design/README.md`: Milanote-like look (light warm-grey canvas, white cards with soft shadow, 8 px grid, Inter/system font, palette of ~10 card colours).
- Routes: `/` → redirect to Home board, `/b/:boardId` placeholder, `/login`.
- `vercel.json` SPA rewrite.
**Done when:** `npm run build`, lint, tests pass; manual SQL steps documented; sign-in works against real project; Home board row created.

## P1 — Canvas engine (local only)
**Goal:** Milanote-feel canvas with placeholder "debug" cards, no persistence.
- Viewport: pan (space-drag, wheel, middle mouse, empty-area drag), zoom (ctrl/cmd-wheel, pinch, keys, menu, fit), zoom around cursor.
- Zustand board store: elements map, order, selection, viewport; per-card selectors.
- Commands + undo/redo stack.
- CardShell: drag (rAF), 8 px snap (alt disables), resize handles per registry flags, z-to-front on move.
- Selection: click, shift-click, marquee, arrow-key nudge, delete, select all, escape.
- Copy/cut/paste/duplicate (internal + system clipboard JSON).
- Card registry contract + `debug` card type.
- Left toolbar shell (buttons click-to-add + drag-to-place), context menu shell, zoom controls.
- Unit tests: geometry, snapping, fractional index helpers, undo stack.
**Done when:** 500 debug cards drag/pan/zoom smoothly; Playwright test drags, marquee-selects, undoes.

## P2 — Persistence + sync
**Goal:** board loads from and saves to Supabase; live across tabs.
- Load board: elements + connections in one go; TanStack Query cache.
- Write queue: patch coalescing, debounce, batch upsert, IndexedDB persistence, retry with backoff, save-status indicator.
- Realtime subscription per board; echo suppression via `client_id`; apply newer remote rows.
- Viewport persisted per board (debounced).
- Breadcrumbs from `board_path`.
**Done when:** edits survive reload; two tabs mirror each other < 1 s; offline edit flushes on reconnect.

## P3 — Notes, columns, board cards
- Note card with TipTap: formatting toolbar, markdown shortcuts, auto-height, colour; `toPlainText`, `toMarkdown`.
- Double-click canvas → new focused note. Paste plain text → note.
- Column card: title, stacked children by `sort_key`, drag in/out with insert indicator, collapse, width resize.
- Board card: create child board, icon/colour picker, item count, open on click; navigation + breadcrumbs.
**Done when:** can build nested boards with columns of notes; all persists.

## P4 — Images + files
- Upload pipeline: drag-drop from desktop, paste, toolbar Upload; HEIC convert, resize 2560, thumb 512; progress placeholder card.
- Image card: aspect-locked resize, caption, lightbox, download. Thumb below 100% zoom.
- File card: icon, name, size, download; PDF first-page preview optional.
- Signed URL cache + batch fetch on board open.
**Done when:** 50 images on a board load lazily; storage paths under `{uid}/`.

## P5 — Links + `milanote-unfurl`
- Edge function: OG/Twitter meta + oEmbed for YouTube/Vimeo, SSRF guard, timeout, size cap; tests.
- Link card: preview layout like Milanote, embed player on click, edit URL.
- Paste URL anywhere → link card.
**Done when:** common sites (YouTube, GitHub, news, Pinterest) unfurl; private IPs rejected.

## P6 — To-dos + Tasks view
- To-do card: title, items (TipTap-lite text), check, reorder (drag), due date picker, hide completed, progress.
- `tasks()` RPC + `/tasks` page grouped Overdue/Today/Upcoming/No date; check from list; jump to card with highlight.
**Done when:** due items from nested boards appear in Tasks; toggling syncs both ways.

## P7 — Connections (arrows)
- SVG layer; line tool; drag from card edge handle; attach/detach endpoints; follow cards.
- Straight/curved with bend handle; dash; arrowheads; colour; label.
- Selection, delete, undo integration; hit-testing on thin lines.
**Done when:** arrows survive moving cards, column moves, copy/paste of connected cards.

## P8 — Board management
- `move_elements` RPC: drop selection onto board card, "Move to…" picker (board tree).
- `duplicate_board` RPC.
- Trash: `/trash` page, restore, delete forever; `milanote-purge` cron function.
- Home dashboard polish: recent boards list.
**Done when:** move/duplicate/trash on nested trees keep children + arrows consistent.

## P9 — Share links
- Share dialog: create/revoke links, include sub-boards toggle, copy URL.
- `milanote-share` edge function: token → board tree subset + signed URLs.
- `/s/:token` read-only viewer reusing canvas in `readOnly` mode.
**Done when:** incognito window opens shared board; revoked token → 404; sub-board access respects toggle.

## P10 — Search
- `search()` RPC with snippets + path; board-title search.
- cmd+k palette: typeahead, keyboard nav, recent boards when empty.
- Jump to result: open board, pan/zoom to card, flash highlight.
**Done when:** finds text inside notes, to-do items, link titles, captions, file names across all boards.

## P11 — Export
- PNG (content bounds / viewport), PDF, Markdown zip (with images). Registry `toMarkdown` per card.
- Vitest snapshot tests for markdown transform.
**Done when:** exported PNG includes images and arrows; markdown zip opens cleanly.

## P12 — Polish, performance, PWA
- Keyboard shortcut sheet (`?`), all shortcuts from REQUIREMENTS.
- Viewport culling, memo audit, 500-card perf test.
- Empty states, loading skeletons, error toasts, offline banner.
- PWA manifest + service worker (app shell only), responsive read-only-ish mobile layout.
- Accessibility pass.
**Done when:** NFRs in REQUIREMENTS §4 measured and met.
