# Milanote Clone — Mockup Brief

Oct 27, 2026 · Miguel Oliveira · Live doc: https://claude.ai/artifact/QFmT5WHFuaKDXEok9n3P98

## Overview

We need mockups for 9 screens and 8 card types, plus the toolbars, menus and states listed below, for a web clone of Milanote. The mockups will be the visual reference developers rebuild in React + Tailwind.

**Product in one line:** an infinite canvas where you arrange notes, images, links, to-do lists, columns and nested boards to organise ideas visually.

**Look and feel:** as close as possible to Milanote. Calm, light, warm-grey canvas; white cards with soft shadows; minimal chrome so content leads; a vertical tool rail on the left; breadcrumbs across the top. Dark mode is not needed for v1.

**Viewports**

| Viewport | Size | Coverage |
| --- | --- | --- |
| Desktop (primary) | 1440 × 900 | Every screen and state in this brief |
| Laptop | 1280 × 800 | Board canvas only, to check toolbar fit |
| Phone (view only) | 390 × 844 | Board canvas, shared board view, sign-in |

**Deliverables**

- One frame per screen and state listed under Screens.
- A component sheet with every card type and state, the chrome pieces, the overlays and the feedback states.
- The foundation tokens exported so they can become `design/tokens.css`: colours, type scale, radii, shadows, spacing.

**Out of scope:** comments, live collaborator cursors, templates gallery, web clipper, drawing tool, native mobile apps.

## Foundations

Define these first: every screen and card reuses them, and developers turn them into tokens.

| Token group | What to define |
| --- | --- |
| Canvas | Canvas background colour; optional faint dot or grid texture at 100% zoom |
| Card palette | About 10 card background colours (white default, plus pastel options) usable on notes, to-dos and columns; each must keep text readable |
| Accent | One brand/accent colour for selection outlines, focus rings, primary buttons, links |
| Neutrals | Text primary/secondary/muted, borders, dividers, hover and pressed fills |
| Status | Success, warning, danger (overdue), info |
| Typography | Font family (Inter or system); sizes for H1, H2, H3, body, small, caption; card title vs card body |
| Spacing and grid | 8 px base grid (cards snap to it); card inner padding; gap between stacked cards in a column |
| Radii | Cards, buttons, inputs, menus, dialogs |
| Shadows / elevation | Card at rest, card hovered, card being dragged, menu/popover, dialog |
| Icons | One icon set (e.g. Lucide) covering every toolbar tool, card type and menu action; board icon set for the board picker |
| Motion | Hover, drag lift, menu open, toast in/out durations and easing |

## Screens

Nine screens, each with the states it needs. The board canvas is the core of the product and needs the most frames.

| # | Screen | Route | What it shows | States to mock |
| --- | --- | --- | --- | --- |
| 1 | Sign in | `/login` | Email + password, "Email me a magic link", app logo | Default; error (wrong password); magic link sent |
| 2 | Not a member | `/login` | Signed in but not on the allow-list: short message + sign out | Default |
| 3 | Home board | `/` | The user's root board: same canvas as screen 4, plus a "Recent boards" strip or panel | Empty (first visit, onboarding hint); populated with board cards, notes, images |
| 4 | Board canvas | `/b/:id` | Infinite canvas with cards, columns, arrows; tool rail left; breadcrumbs, search, share, menu top; zoom controls bottom-right | Populated board; empty board; card selected; multi-select with marquee; dragging a card (snap guides); dragging into a column (insert indicator); zoomed out to 25% (thumbnails); read-only mode |
| 5 | Tasks | `/tasks` | Every to-do item with a due date across boards, grouped Overdue / Today / Upcoming / No date; board name per item | Populated; empty ("No tasks with due dates") |
| 6 | Trash | `/trash` | Deleted boards and cards, deleted date, days until auto-delete, Restore / Delete forever | Populated; empty |
| 7 | Shared board (public) | `/s/:token` | Read-only canvas with slim header: board title, owner name, "Made with …" link; no tool rail | Default; sub-board opened; link revoked / not found |
| 8 | Image lightbox | over 4 or 7 | Full-size image, caption, download, close, previous/next on board | Default; loading |
| 9 | 404 / error page | any | Board not found or no access; button back to Home | Default |

## Canvas chrome

The fixed UI around the board canvas. It stays the same size whatever the zoom.

| Element | Position | Contents | States |
| --- | --- | --- | --- |
| Tool rail | Left edge, vertical | Note, Link, To-do, Line, Board, Column, Colour, Upload; divider; Trash at bottom | Default, hover with tooltip, pressed, active (line tool on), item being dragged out onto canvas (ghost card) |
| Top bar | Top, full width | Breadcrumbs (Home › Board › Sub-board, overflow collapses to …); right side: search button (⌘K), Tasks, Share, account/avatar menu | Default; long breadcrumb overflow; board title being renamed inline |
| Save status | Top bar, near breadcrumbs | Saved / Saving… / Offline – changes will sync | All three |
| Zoom controls | Bottom-right | −, zoom % (opens menu: 25/50/100/200%, Fit to content), + | Default; menu open |
| Selection toolbar | Floating above selection | Colour, duplicate, move to board, bring to front, delete | One card; several cards |
| Snap guides | On canvas while dragging | Thin accent lines when edges/centres align | Shown during drag |
| Marquee | On canvas | Translucent accent rectangle while drag-selecting | Shown during drag |
| Recent boards | Home only | Small strip or side panel of recently opened boards | Populated; empty |

## Card types

Eight card types. Each also needs the shared states: **default, hover, selected, dragging, coloured background, inside a column**.

| Card | Content | Card-specific states |
| --- | --- | --- |
| Note | Rich text: H1–H3, bold, italic, underline, strike, code, bullets, numbers, checklist, quote, link, highlight | Empty with placeholder; short; long; editing with cursor; text selected with floating format toolbar |
| Image | Photo, optional caption below | Landscape; portrait; with caption; uploading (progress); upload failed (retry) |
| File | File-type icon, file name, size; PDF may show first-page preview | Generic file; PDF with preview; uploading; failed |
| Link | Preview image, title, description, domain + favicon | Full preview; no image (text only); loading preview; preview failed (plain URL); YouTube/Vimeo before play and playing inline |
| To-do list | Optional title, items with checkbox, progress (3/5), due date per item | Empty; mixed done/undone; item with due date (normal, today, overdue); hide-completed on; editing an item; due date picker open |
| Column | Title, stacked child cards, collapse toggle | Empty (drop hint); with 4–5 mixed cards; collapsed (title + count); drop target highlighted with insert line |
| Board card | Board icon, title, item count | Default; with custom colour; drop target highlighted when a card is dragged over it |
| Colour swatch | Colour block, hex, optional name | Default; "Copied" feedback |

Also show **resize handles** on a selected note, column and image (image keeps aspect ratio).

## Connections (arrows)

Lines link cards, or float freely, and move with the cards they attach to.

- **Styles:** straight and curved; solid and dashed; arrowheads none / end / start / both; 3–4 line colours.
- **Label:** optional text sitting on the line's midpoint.
- **States:** default; hover; selected (endpoint handles + curve bend handle); being drawn from a card's edge handle (dashed preview following cursor); endpoint snapping onto a target card (target highlighted).
- **Card edge handles:** small dots on hover at each side of a card, where a new line starts.
- **Line style popover:** opens on a selected line — curve type, dash, arrowheads, colour, delete.

## Menus, dialogs and pickers

Everything that opens on top of the canvas.

| Overlay | Opens from | Contents |
| --- | --- | --- |
| Card context menu | Right-click a card | Colour, Duplicate, Move to…, Copy link to card, Bring to front, Send to back, Delete |
| Canvas context menu | Right-click empty canvas | Add note / to-do / column / board here, Paste, Select all, Fit to content |
| Text format toolbar | Selecting text in a note | Heading level, bold, italic, underline, strike, code, list types, link, highlight colour |
| Colour picker | Card menu or selection toolbar | Card palette grid with current colour ticked |
| Board icon + colour picker | Board card or breadcrumb title | Emoji/icon grid with search, colour row |
| Move to board | "Move to…" | Searchable tree of boards, current board greyed, Move button |
| Search palette | ⌘K or top-bar search | Input; recent boards when empty; results grouped (Boards, Cards) with snippet, highlighted match and board path; no results; keyboard-selected row |
| Share dialog | Top-bar Share | Create link, include sub-boards toggle, list of existing links (created date, copy, revoke), copied confirmation |
| Export menu | Board menu | PNG (whole board / current view), PDF, Markdown (.zip); exporting progress |
| Board menu | Breadcrumb title or … | Rename, Icon & colour, Duplicate, Export, Share, Move to trash |
| Account menu | Avatar | Name, email, Trash, Keyboard shortcuts, Sign out |
| Keyboard shortcuts sheet | `?` or account menu | Grouped shortcut list (Canvas, Cards, Text, Navigation) |
| Confirm dialog | Delete forever, revoke link | Title, one line of consequence, Cancel + destructive button |
| Due date picker | To-do item | Small calendar, Today / Tomorrow / Next week shortcuts, Clear |

## Feedback states

Small pieces that tell the user what is happening.

- **Empty states:** empty board ("Double-click anywhere to add a note, or drag from the toolbar"), empty Home, empty Tasks, empty Trash, empty column, no search results.
- **Loading:** board opening (skeleton cards or spinner), image/link card placeholders, search typing.
- **Drop zone:** whole-canvas overlay when dragging files from the desktop ("Drop to add to board").
- **Toasts:** "Moved 3 cards to Ideas" with Undo; "Link copied"; "Export ready"; upload failed with Retry.
- **Offline banner:** slim bar – "You're offline. Changes will sync when you reconnect."
- **Highlight flash:** card glow after jumping to it from search or Tasks.
- **Button set:** primary, secondary, ghost, destructive, icon-only — each default, hover, pressed, disabled, focus.
- **Inputs:** text field, search field, toggle, checkbox — default, focus, error, disabled.

## Delivery order

Design in the order development needs it. Items 1–4 unblock the first build phases.

- [ ] 1. Foundations: tokens, palette, type, icons
- [ ] 2. Board canvas with chrome: tool rail, top bar, zoom, save status, selection, marquee, snap guides
- [ ] 3. Note, column and board cards, all states
- [ ] 4. Sign in, Not a member, Home (empty + populated)
- [ ] 5. Image, file and link cards, upload and drop states, lightbox
- [ ] 6. To-do card, due date picker, Tasks screen
- [ ] 7. Connections and line style popover
- [ ] 8. Context menus, colour and icon pickers, Move to board, board menu
- [ ] 9. Search palette
- [ ] 10. Share dialog and public shared board
- [ ] 11. Export menu, Trash, 404
- [ ] 12. Feedback states, buttons, inputs, shortcuts sheet, phone views
