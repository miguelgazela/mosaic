import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { CanvasElement } from '../canvas/types'

export interface CardProps {
  element: CanvasElement
  selected: boolean
}

export type ResizeMode = 'none' | 'width' | 'both' | 'aspect'

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
  /** Single-key shortcut (FR-50), e.g. 'N'. Also shown in tooltips and the canvas menu. */
  shortcut?: string
  /** false for card types without a colour (links, images, files). Default true. */
  colorable?: boolean
  /** Shown in the left tool rail when set. Label is 12 px under a Lucide icon. */
  toolbar?: { label: string; icon: LucideIcon }
  toPlainText(el: CanvasElement): string
  toMarkdown(el: CanvasElement): string
  onDropFiles?: (files: File[], at: { x: number; y: number }) => void
}
