import { create } from 'zustand'

/**
 * On while a PNG / PDF export renders the board: image cards load their full-size file even when they are far
 * off screen or the view is zoomed out, so the picture holds every image at full quality.
 */
export const useExportMode = create<{ on: boolean }>()(() => ({ on: false }))
export const setExportMode = (on: boolean): void => useExportMode.setState({ on })
