import { screenToWorld, type Point } from './geometry'
import { useBoard } from './store'

let el: HTMLElement | null = null

export const setCanvasEl = (e: HTMLElement | null): void => { el = e }

/** Client (page) coordinates → world coordinates. */
export function clientToWorld(clientX: number, clientY: number): Point {
  const r = el?.getBoundingClientRect()
  return screenToWorld(useBoard.getState().viewport, { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) })
}

export function clientToScreen(clientX: number, clientY: number): Point {
  const r = el?.getBoundingClientRect()
  return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) }
}
