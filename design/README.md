# Design

Mockups are made in Claude Design from the brief (`MOCKUP_BRIEF.md`, copy of the live doc):
https://claude.ai/artifact/QFmT5WHFuaKDXEok9n3P98 (Milanote Clone — Mockup Brief)

Mockup canvas (46 frames, 7 pages): https://claude.ai/artifact/QkoK7NutqreJEkX3m2AKDq (Milanote Clone — Mockups)

**This README wins over the brief when they differ.**

## Files

- `tokens.css` — colours, type scale, spacing, radii, shadows, motion. Imported by `web/src/index.css`. Do not add colours or sizes without a design reason.
- `screens/` — one PNG per frame, exported from the canvas. Named `<nn>-<screen>-<state>.png`, where `nn` is the screen number in the brief. `00-` files are component and foundation sheets, not screens.
- `MOCKUP_BRIEF.md` — the original brief.

## Design decisions

1. **Palette and font come from the ui-ux-pro-max design system, in light mode.** The brief asked for Milanote's look; the owner chose the skill's proposal instead, but kept light mode (no dark mode in v1).
   - Primary violet `--primary` `#7C3AED`: selection outline, focus ring, primary buttons, snap guides, marquee, drop targets.
   - Accent teal `--teal` `#0891B2` for graphics only. Text links use `--link` `#0E7490`, because `#0891B2` is only 3.7:1 on white.
   - Font: Plus Jakarta Sans (400/500/600/700) for everything. **Load it in `web/index.html`** (Google Fonts `css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap`). Until then the system UI font shows.
2. **Layout follows Milanote conventions with an original identity.** Warm-grey dotted canvas, white cards, labelled tool rail on the left, breadcrumbs on top, zoom bottom-right. No Milanote logo, wordmark or assets. The product name is **Mosaic**.
3. **Accessibility rules (from ui-ux-pro-max):**
   - Text contrast at least 4.5:1. `--text-muted` is the lightest text colour; `--icon-subtle` is never used for text.
   - Never colour alone: overdue / today due dates carry an icon and a word ("Overdue, Mar 10", "Today").
   - Minimum text 12 px (tool rail labels are 12 px). Phone frames use 16 px inputs and 44 px targets.
   - Visible focus ring everywhere: `--ring-focus`.
   - Every drag has a keyboard or menu alternative (WCAG 2.2 "dragging movements"): arrow keys nudge 8 px (Shift = 80 px), **Move to…** replaces dropping onto a board card, and **Move into column…** (card menu) replaces dropping into a column. *Move into column… is new — not in REQUIREMENTS.md.*
   - `prefers-reduced-motion`: durations go to 0 and the drag tilt is removed (see `tokens.css`).
4. **Additions beyond the brief — accepted 2026-10-28**, now in REQUIREMENTS (FR-50, FR-51, FR-54). Deviation from the mockups: the tool rail keeps **Select** and **Hand** buttons at the top (FR-22).
   - Single-key card shortcuts: N note, T to-do, C column, B board (shown in canvas menu and shortcuts sheet).
   - "Move into column…" in the card context menu (see above).
   - Read-only board shows a "View only" chip in the top bar and a bottom status pill; the tool rail is hidden.
   - Phone board view shows a "View only on phone" strip.
5. **Card colours.** `--card-color-1…10` keep the keys in `web/src/canvas/colors.ts`. No colour (null) = white card. Links, images and files are not colourable; notes, to-dos, columns and boards are.
6. **Images in the mockups are placeholders** (flat colour blocks). Real thumbnails replace them.

## Screen map

| Brief # | Screen | State | PNG |
| --- | --- | --- | --- |
| 1 | Sign in | Default | `01-sign-in-default.png` |
| 1 | Sign in | Error (wrong password) + magic link sent | `01-sign-in-error-and-link-sent.png` |
| 1 | Sign in | Phone | `01-sign-in-phone.png` |
| 2 | Not a member | Default | `02-not-a-member-default.png` |
| 3 | Home | Empty (onboarding hint, empty Recent strip) | `03-home-empty.png` |
| 3 | Home | Populated (Recent strip) | `03-home-populated.png` |
| 4 | Board canvas | Populated | `04-board-populated.png` |
| 4 | Board canvas | Empty | `04-board-empty.png` |
| 4 | Board canvas | Card selected (toolbar, resize handles) | `04-board-card-selected.png` |
| 4 | Board canvas | Multi-select with marquee | `04-board-marquee.png` |
| 4 | Board canvas | Dragging, snap guides | `04-board-drag-snap-guides.png` |
| 4 | Board canvas | Dragging into column (insert line) | `04-board-drag-into-column.png` |
| 4 | Board canvas | Zoomed out to 25% | `04-board-zoom-25.png` |
| 4 | Board canvas | Read-only | `04-board-read-only.png` |
| 4 | Board canvas | Laptop 1280 × 800 | `04-board-laptop-1280.png` |
| 4 | Board canvas | File drop zone + offline banner | `04-board-file-drop-offline.png` |
| 4 | Board canvas | Phone (view only) | `04-board-phone.png` |
| 5 | Tasks | Populated | `05-tasks-populated.png` |
| 5 | Tasks | Empty | `05-tasks-empty.png` |
| 6 | Trash | Populated | `06-trash-populated.png` |
| 6 | Trash | Empty | `06-trash-empty.png` |
| 7 | Shared board | Default | `07-shared-board-default.png` |
| 7 | Shared board | Sub-board opened | `07-shared-board-sub-board.png` |
| 7 | Shared board | Link revoked / not found | `07-shared-board-revoked.png` |
| 7 | Shared board | Phone | `07-shared-board-phone.png` |
| 8 | Image lightbox | Default | `08-lightbox-default.png` |
| 8 | Image lightbox | Loading | `08-lightbox-loading.png` |
| 9 | 404 / no access | Default | `09-not-found-default.png` |

### Component and foundation sheets

| Sheet | Covers | PNG |
| --- | --- | --- |
| Foundations | Tokens, palette, type, spacing, radii, elevation, icons, motion | `00-foundations.png` |
| Buttons and inputs | Primary, secondary, ghost, destructive, icon-only; text, search, toggle, checkbox — all states | `00-buttons-and-inputs.png` |
| Canvas chrome | Tool rail states, breadcrumb overflow, inline rename, save status, zoom menu, selection toolbar (one / several), drag alternatives | `00-canvas-chrome-states.png` |
| Connections | Line styles and colours, label, hover, selected, drawing, snapping, edge handles, line style popover | `00-connections.png` |
| Note card | Empty, short, long (all formats), editing, selected + resize, format toolbar, heading and highlight menus | `00-card-note.png` |
| Image and file cards | Landscape, portrait, caption, selected (aspect-locked), uploading, failed; file generic, PDF preview, uploading, failed | `00-card-image-and-file.png` |
| Link card | Full preview, text only, loading, failed, video before play, playing | `00-card-link.png` |
| To-do card | Empty, mixed, due dates (upcoming / today / overdue), hide completed, editing, due date picker | `00-card-todo.png` |
| Column card | Empty, five cards, collapsed, coloured, drop target, selected + resize | `00-card-column.png` |
| Board card and swatch | Default, hover, custom colour, drop target; swatch, hex only, copied | `00-card-board-and-swatch.png` |
| Shared card states | Default, hover, selected, dragging, coloured, inside a column | `00-card-shared-states.png` |
| Menus | Card, canvas, board, export (+ progress), account | `00-menus.png` |
| Pickers | Card colour, board icon and colour, move to board | `00-pickers.png` |
| Search palette | Recent boards, grouped results with keyboard selection, searching, no results | `00-search-palette.png` |
| Share dialog | With links + copied, no links yet | `00-share-dialog.png` |
| Shortcuts and confirm | Shortcuts sheet, delete forever, revoke link | `00-shortcuts-and-confirm.png` |
| Empty and loading | All empty states, board opening skeleton, image / link placeholders | `00-empty-and-loading.png` |
| Toasts, banner, highlight | Move + undo, link copied, export ready, upload failed; offline banner; highlight flash | `00-toasts-banner-highlight.png` |

The PNGs are exports. If a PNG and the canvas differ, the canvas is newer — re-export.
