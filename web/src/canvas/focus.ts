import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { elementRect, useBoard } from './store'
import './focus.css'

const FLASH_MS = 1200

/** Viewport that puts the card's centre in the middle of the view, zoom kept (at least 50 % so it is readable). */
export function viewportCenteredOn(r: { x: number; y: number; w: number; h: number }, size: { w: number; h: number }, zoom: number) {
  const z = Math.max(zoom, 0.5)
  return { zoom: z, x: size.w / 2 - (r.x + r.w / 2) * z, y: size.h / 2 - (r.y + r.h / 2) * z }
}

export function flashCard(id: string): void {
  const node = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`)
  if (!node) return
  node.dataset.flash = 'true'
  window.setTimeout(() => { delete node.dataset.flash }, FLASH_MS + 50)
}

/**
 * `?card=<id>` on a board URL: pan to that card, flash it, then drop the param.
 * Mounted once inside CanvasView, which renders only after the board has loaded.
 */
export function useFocusCard(): void {
  const [params, setParams] = useSearchParams()
  const id = params.get('card')
  useEffect(() => {
    if (!id) return
    let done = false
    const run = () => {
      const s = useBoard.getState()
      if (done || !s.elements[id] || s.size.w === 0) return false
      done = true
      s.setViewport(viewportCenteredOn(elementRect(s, id), s.size, s.viewport.zoom))
      // Next frame so the card is positioned at its new place before the ring starts.
      requestAnimationFrame(() => flashCard(id))
      setParams((p) => { p.delete('card'); return p }, { replace: true })
      return true
    }
    if (run()) return
    const unsub = useBoard.subscribe(() => { if (run()) unsub() })
    // Card never shows up (deleted, or another board): give up quietly.
    const t = window.setTimeout(() => { unsub(); if (!done) setParams((p) => { p.delete('card'); return p }, { replace: true }) }, 5000)
    return () => { unsub(); window.clearTimeout(t) }
  }, [id, setParams])
}

