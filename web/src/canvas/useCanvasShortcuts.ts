import { useEffect } from 'react'
import {
  addCard, copySelection, cutSelection, deleteSelection, duplicateSelection, nudge, pasteClipboard, reorder, selectAll,
} from './actions'
import { getCardByShortcut } from '../cards/registry'
import { centerOfView } from './geometry'
import { fitToContent, zoomBy, zoomTo } from './viewport'
import { useBoard } from './store'

const isEditable = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}

export function useCanvasShortcuts(): void {
  useEffect(() => {
    const st = () => useBoard.getState()

    const keydown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
        st().setSpaceHeld(true)
        return
      }
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod) {
        if (k === 'z') (e.shiftKey ? st().redo : st().undo)()
        else if (k === 'y') st().redo()
        else if (k === 'a') selectAll()
        else if (k === 'd') duplicateSelection()
        else return // copy/cut/paste/zoom keys: leave to browser / clipboard events
        e.preventDefault()
        return
      }
      if (e.altKey) return
      if (ARROWS[e.key]) {
        const [x, y] = ARROWS[e.key]
        const step = e.shiftKey ? 80 : 8
        nudge(x * step, y * step)
      } else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection()
      else if (e.key === 'Escape') st().setSelection([])
      else if (e.key === '+' || e.key === '=') zoomBy(1.25)
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.25)
      else if (e.key === '0') zoomTo(1)
      else if (e.code === 'Digit1' && e.shiftKey) fitToContent()
      else if (k === 'v') st().setTool('select')
      else if (k === 'h') st().setTool('hand')
      else if (e.key === ']') reorder(true)
      else if (e.key === '[') reorder(false)
      else if (getCardByShortcut(k)) {
        const s = st()
        addCard(getCardByShortcut(k)!.type, centerOfView(s.viewport, s.size))
      } else return
      e.preventDefault()
    }
    const keyup = (e: KeyboardEvent) => {
      if (e.code === 'Space') st().setSpaceHeld(false)
    }
    const blur = () => st().setSpaceHeld(false)

    const copy = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return
      const text = copySelection()
      if (!text) return
      e.clipboardData?.setData('text/plain', text)
      e.preventDefault()
    }
    const cut = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return
      const text = cutSelection()
      if (!text) return
      e.clipboardData?.setData('text/plain', text)
      e.preventDefault()
    }
    const paste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return
      if (pasteClipboard(e.clipboardData?.getData('text/plain'))) e.preventDefault()
    }

    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', blur)
    document.addEventListener('copy', copy)
    document.addEventListener('cut', cut)
    document.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', blur)
      document.removeEventListener('copy', copy)
      document.removeEventListener('cut', cut)
      document.removeEventListener('paste', paste)
    }
  }, [])
}
