# Mosaic — Requirements (v1)

Visual board app for organising ideas: a free-form canvas of notes, images, links, to-dos, columns and nested boards. Goal: feel as close as possible to Milanote on desktop web.

## 1. Constraints

- Web only (desktop browser first). Phones: view only (responsive + PWA install), per FR-54.
- Single owner per board. No live multiplayer. Read-only share links for others.
- Backend: existing Supabase project `varnswkomuckwgobplld` (shared with KangarooSplit + another app).
  - Everything lives in schema `milanote`. Never touch `public`, other apps' schemas, or project-wide auth settings.
  - Edge functions prefixed `milanote-`, storage buckets prefixed `milanote-`.
- Running cost: €0 (Supabase free tier, Vercel free tier). Free tier limits matter:
  - Storage 1 GB, DB 500 MB, egress 5 GB/month → compress images client-side, generate thumbnails.
  - Project pauses after 7 days of no activity (shared with other apps, so unlikely).
- UI language: English.

## 2. Glossary

| Term | Meaning |
|---|---|
| Board | A canvas. Boards nest: a board card on one canvas opens a child board. |
| Home | Each user's root board. Cannot be deleted. |
| Element / card | Anything placed on a canvas: note, image, file, link, to-do, column, board card, colour swatch. |
| Column | Vertical container card. Holds an ordered stack of cards, auto-laid-out. |
| Connection / arrow | Line between two cards, or between free points. |
| Share link | Secret URL giving read-only access to a board (and optionally its sub-boards). |

## 3. Functional requirements

### 3.1 Accounts and access

- FR-1 Email + password sign-in (plus magic link). Session persists long-term.
- FR-2 Access gated by `milanote.members` allow-list + RLS. Do not rely on project-wide sign-up setting (auth shared with other apps).
- FR-3 First sign-in of a member creates their Home board.

### 3.2 Boards

- FR-4 Create board as a card on current canvas (toolbar or drag from toolbar). New board opens on double-click/click.
- FR-5 Board has title, icon (emoji or preset icon), colour.
- FR-6 Breadcrumb bar shows path from Home to current board; each crumb navigable.
- FR-7 Board card on parent canvas shows icon, title, item count.
- FR-8 Move cards (including board cards) into another board by dropping onto a board card, or via "Move to…" picker.
- FR-9 Duplicate board (deep copy: elements, connections, sub-boards, file references).
- FR-10 Delete = soft delete to Trash. Trash lists deleted boards and cards; restore or delete forever. Auto-purge after 30 days.
- FR-11 Each board URL is stable and deep-linkable: `/b/:boardId`.

### 3.3 Canvas

- FR-12 Infinite canvas. Pan with space+drag, trackpad two-finger scroll, middle mouse, or drag on empty area (hand tool). Zoom with ctrl/cmd+scroll, pinch, +/- keys, zoom menu (25%–400%, "fit to content", "100%").
- FR-13 Cards snap to an 8 px grid while dragging/resizing. Hold alt/option to disable snapping.
- FR-14 Select: click, shift-click to add, marquee drag on empty area. Selection shows bounding box.
- FR-15 Move selection by drag or arrow keys: 8 px step, shift = 80 px.
- FR-16 Resize cards horizontally (notes, links, to-dos, columns); images resize keeping aspect ratio. Height is auto from content except images/files.
- FR-17 Z-order: last-moved card comes to front; "bring to front / send to back" in context menu.
- FR-18 Undo/redo (cmd+z / cmd+shift+z) for all canvas edits within session, at least 100 steps.
- FR-19 Copy/cut/paste cards within and across boards (internal clipboard + system clipboard JSON). Duplicate with cmd+d or alt-drag.
- FR-20 Delete selection with backspace/delete.
- FR-21 Context menu on cards: colour, duplicate, move to, move into column, copy link, bring front/back, delete.
- FR-22 Left tool rail, icon + 12 px label per tool: Select, Hand, then card types Note, Link, To-do, Line, Board, Column, Colour, Upload; Trash at the bottom. Click adds at viewport centre; drag places at drop point (ghost card follows cursor). Tooltip shows name + shortcut key. (Select/Hand are kept on purpose although the mockups omit them.)
- FR-23 Double-click empty canvas creates a note there and focuses it.
- FR-24 Drop files from desktop → image/file cards at drop point. Paste image from clipboard → image card. Paste URL → link card. Paste plain text → note.
- FR-25 Board remembers last viewport (pan + zoom) per user.
- FR-50 Single-key shortcuts when nothing is being edited: N note, T to-do, C column, B board (plus V select, H hand). Shown in tooltips, canvas menu and shortcuts sheet.
- FR-51 "Move into column…" in the card context menu: pick a column on the current board; card is appended to it. Keyboard/menu alternative to dropping into a column (WCAG 2.2 dragging movements).
- FR-52 Selection toolbar floats above the selection: colour, duplicate, move to board, layer order, delete; shows "N cards" for multi-select.
- FR-53 Snap guides: thin primary-colour lines when a dragged card's edges or centre align with another card.

### 3.4 Card types

- FR-26 **Note**: rich text — headings (H1–H3), bold, italic, underline, strike, inline code, bullet/numbered list, checklist, link, quote, highlight colour. Floating format toolbar on selection. Markdown shortcuts (`# `, `- `, `**x**`, `[] `).
- FR-27 **Image**: upload (jpg/png/gif/webp/heic→jpg), client-side resize to max 2560 px long edge, thumbnail 512 px. Optional caption. Open in lightbox on double-click. Download original.
- FR-28 **File**: any file up to 10 MB (free-tier budget). Shows icon, name, size; click downloads. PDF shows first-page preview if cheap, else icon.
- FR-29 **Link**: URL with unfurled preview (title, description, image, favicon) via edge function. YouTube/Vimeo show embedded player on click.
- FR-30 **To-do list**: title + items. Each item: text, done, optional due date. Add/reorder/delete items. Toggle "hide completed". Progress shown (3/5).
- FR-31 **Column**: title + ordered stack of cards. Drag cards in/out; drop indicator shows insert position. Collapse/expand. Column width resizable; child cards take column width.
- FR-32 **Board card**: see 3.2.
- FR-33 **Colour swatch**: hex colour + optional name. Click copies hex.
- FR-34 Card background colour selectable from a fixed palette (`--card-color-1…10`) for notes, to-dos, columns and board cards. Links, images and files are not colourable.

### 3.5 Connections (arrows)

- FR-35 Draw line from toolbar "Line" tool, or drag from a card's edge handle to another card.
- FR-36 Line endpoints attach to cards (follow them when moved) or to free points.
- FR-37 Line style: straight or curved; solid or dashed; arrowheads none/start/end/both; colour; optional text label at midpoint.
- FR-38 Curved lines adjustable via midpoint handle.

### 3.6 Tasks

- FR-39 "Tasks" view lists every to-do item with a due date across all boards, grouped Overdue / Today / Upcoming / No date. Each links to its board + highlights the card.
- FR-40 Checking an item in Tasks view updates the card.

### 3.7 Search

- FR-41 Global search (cmd+k): board titles, note text, to-do items, link titles/URLs, file names, image captions.
- FR-42 Results show snippet + board path; selecting opens board, pans to card, highlights it.

### 3.8 Export

- FR-43 Export current board as PNG (whole content bounds or current viewport) and PDF.
- FR-44 Export board as Markdown (notes→markdown, to-dos→checklists, links→links, images→links, columns→sections, sub-boards→nested headings), zipped with images.

### 3.9 Sharing

- FR-45 Create share link per board: read-only, optional "include sub-boards". Revoke anytime. Multiple links allowed.
- FR-46 Shared view `/s/:token` works without sign-in: pan/zoom, open sub-boards (if allowed), open images, follow links. No editing.
- FR-54 Read-only boards (shared view, and the owner's own board on phone) hide the tool rail, show a "View only" chip in the top bar and a status pill at the bottom. Phone board view shows a "View only on phone" strip.

### 3.10 Sync

- FR-47 Edits save automatically (no save button). Status indicator: Saved / Saving… / Offline.
- FR-48 Same user's other tabs/devices update live via Supabase Realtime.
- FR-49 Short offline periods: queued writes flush on reconnect. Conflict rule: last write wins per element field set.

## 4. Non-functional

- NFR-1 60 fps pan/zoom/drag with 500 cards on a board on a mid-range laptop.
- NFR-2 Board open < 1 s for 300 cards on warm cache.
- NFR-3 Images lazy-loaded; thumbnails at zoom < 100%.
- NFR-4 Keyboard accessible toolbars and menus; focus visible.
- NFR-5 RLS on every table; no service role key in client.
- NFR-6 Unit tests for pure logic (geometry, ordering, undo stack, export transforms). Playwright smoke tests for canvas flows.
- NFR-7 UI matches the mockups in `design/screens/` using only `design/tokens.css` values (see `design/README.md`).
- NFR-8 Text contrast ≥ 4.5:1; no information by colour alone (due states carry icon + word); minimum text 12 px; phone inputs 16 px and targets 44 px; `prefers-reduced-motion` respected.

## 5. Out of scope (v1)

Live multiplayer, comments, presence/cursors, templates, web clipper / share extension, drawing/sketch, native mobile apps, audio/video uploads, teams/billing, public board gallery.
