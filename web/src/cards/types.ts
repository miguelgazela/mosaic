import type { ComponentType, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { CanvasElement } from '../canvas/types'
import type { Point } from '../canvas/geometry'

export interface CardProps {
  element: CanvasElement
  selected: boolean
  /** True while the card sits inside a column (width comes from the column). */
  inColumn?: boolean
  /** Renders a child card by id. Only containers (columns) call this. */
  renderChild: (id: string) => ReactNode
}

export type ResizeMode = 'none' | 'width' | 'both' | 'aspect'

/** Export-time lookups a card's `toMarkdown` may use. Links are relative to the markdown file being written. */
export interface MarkdownContext {
  /** Title and link target for a board card's sub-board (its `.md` file in the zip); undefined when it isn't exported. */
  boardLink(boardId: string): { title: string; href: string } | undefined
  /** Link target for an image / file card's bytes inside the zip; undefined when the card has no file. */
  assetLink(el: CanvasElement): string | undefined
  /** Markdown of the cards inside a column, in column order, one string per card. */
  childrenMarkdown(columnId: string): string[]
}

/** What the clipboard (or a drop) held. `url` is set when `text` is a single http(s) URL. */
export interface PasteData {
  text?: string
  url?: string
  files?: File[]
}

/** Result of hovering a dragged card over a drop target. */
export interface DropHint {
  /** Slot inside the target (e.g. column insert position). */
  index?: number
}

export interface DropContext {
  target: CanvasElement
  dragged: CanvasElement[]
  hint: DropHint
}

/**
 * Lets a card receive other cards dropped on it (columns today; board cards in P8).
 * The engine hit-tests the pointer against registered cards, topmost first, and asks `accepts`.
 */
export interface DropTarget {
  accepts(target: CanvasElement, dragged: CanvasElement[]): boolean
  /** Called while dragging over the target. Return the slot to highlight. */
  hover?(target: CanvasElement, pointer: { clientX: number; clientY: number }): DropHint
  /**
   * Called on release. Return element patches (typically parentId / sortKey / width). Anything not
   * returned stays as the drag left it. The engine wraps all patches in one undoable command.
   */
  drop(ctx: DropContext): Record<string, Partial<CanvasElement>>
  /**
   * Set when a drop sends the cards to another board instead of rearranging this one (board cards). The engine
   * then puts the cards back, calls `move_elements` for them and shows the "Moved N cards to <label>" toast;
   * `drop` is not called. `label` is the destination's name.
   */
  moveTo?(target: CanvasElement): { id: string; title: string } | null
}

/** Extra item in the card context menu (single selection only). */
export interface CardMenuItem {
  id: string
  label: string
  icon?: LucideIcon
  /** Runs when picked, then the menu closes. */
  run?: () => void
  /** Opens as a side panel instead of running. */
  panel?: (close: () => void) => ReactNode
}

/** Contract every card type implements; the canvas engine only talks to this. */
export interface CardDefinition {
  type: string
  label: string
  Component: ComponentType<CardProps>
  /** height null = auto-height (measured). */
  defaultSize: { width: number; height: number | null }
  resize: ResizeMode
  minWidth: number
  minHeight: number
  defaultContent?: () => Record<string, unknown>
  /** Side effect after the engine adds a new card (e.g. creating the child board row). */
  onCreate?: (el: CanvasElement) => void
  /** Put the new card straight into edit mode (notes, columns, boards, swatches). */
  editOnCreate?: boolean
  /** Single-key shortcut (FR-50), e.g. 'N'. Also shown in tooltips and the canvas menu. */
  shortcut?: string
  /** false for card types without a colour (links, images, files, boards). Default true. */
  colorable?: boolean
  /** true when the card draws its own selection ring (e.g. to include a caption hanging below it). Default: the shell draws it. */
  ownSelectionRing?: boolean
  /** Shown in the left tool rail when set. Label is 12 px under a Lucide icon. */
  toolbar?: { label: string; icon: LucideIcon }
  toPlainText(el: CanvasElement): string
  /** Markdown for export. `ctx` is set by the export; without it, cards fall back to plain names. */
  toMarkdown(el: CanvasElement, ctx?: MarkdownContext): string
  onDropFiles?: (files: File[], at: Point) => void
  /**
   * Paste routing. The engine asks every registered card in registry order; the first to return
   * true owns the paste. With no taker, plain text becomes a note.
   */
  onPaste?: (data: PasteData, at: Point) => boolean
  /** Content for a new card made from pasted plain text (used by the note card). */
  contentFromText?: (text: string) => Record<string, unknown>
  dropTarget?: DropTarget
  /**
   * Called for every copy the engine makes of a card (paste, duplicate, Alt-drag) before the copy is added.
   * May change `clone.content`; board cards give the copy its own child board.
   */
  onClone?: (clone: CanvasElement, source: CanvasElement) => void
  menuItems?: (el: CanvasElement) => CardMenuItem[]
}
