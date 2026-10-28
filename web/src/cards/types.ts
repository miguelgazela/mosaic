import type { ComponentType } from 'react'
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
  /** Shown in the left toolbar when set. */
  toolbar?: { label: string }
  toPlainText(el: CanvasElement): string
  toMarkdown(el: CanvasElement): string
  onDropFiles?: (files: File[], at: { x: number; y: number }) => void
}
