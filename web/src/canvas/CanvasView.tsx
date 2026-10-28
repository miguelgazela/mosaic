import { useCallback, useEffect, useRef, useState } from 'react'
import { addCard } from './actions'
import { setCanvasEl, clientToScreen, clientToWorld } from './canvasDom'
import { ContextMenu, type MenuState } from './ContextMenu'
import { clamp, zoomAt } from './geometry'
import { createTouchGestures, startMarquee, startPan } from './interactions'
import { GridBackground, MarqueeOverlay, WorldLayer } from './layers'
import { useBoard } from './store'
import { Toolbar, DRAG_MIME, getDraggedTool } from './Toolbar'
import { getCard } from '../cards/registry'
import { EmptyHint } from './EmptyHint'
import { SelectionToolbar } from './SelectionToolbar'
import { useCanvasShortcuts } from './useCanvasShortcuts'
import { ZoomControls } from './ZoomControls'

export function CanvasView() {
  useCanvasShortcuts()
  const ref = useRef<HTMLDivElement>(null)
  const touch = useRef(createTouchGestures()).current
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [ghost, setGhost] = useState<{ type: string; x: number; y: number } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const grabbing = useBoard((s) => s.panning)
  const grab = useBoard((s) => s.spaceHeld || s.tool === 'hand')

  useEffect(() => {
    const node = ref.current!
    setCanvasEl(node)
    const measure = () => useBoard.getState().setSize({ w: node.clientWidth, h: node.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)

    // Non-passive so ctrl/cmd+wheel (and trackpad pinch) can be captured.
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useBoard.getState()
      if (e.ctrlKey || e.metaKey) {
        const d = clamp(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, -30, 30)
        s.setViewport(zoomAt(s.viewport, s.viewport.zoom * Math.exp(-d * 0.01), clientToScreen(e.clientX, e.clientY)))
      } else {
        const k = e.deltaMode === 1 ? 16 : 1
        s.setViewport({ ...s.viewport, x: s.viewport.x - e.deltaX * k, y: s.viewport.y - e.deltaY * k })
      }
    }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => {
      ro.disconnect()
      node.removeEventListener('wheel', wheel)
      setCanvasEl(null)
    }
  }, [])

  return (
    <div className="flex h-full w-full">
    <Toolbar />
    <div
      ref={ref}
      data-testid="canvas"
      className="relative h-full min-w-0 flex-1 touch-none select-none overflow-hidden bg-[var(--canvas-bg)]"
      style={{ cursor: grabbing ? 'grabbing' : grab ? 'grab' : 'default' }}
      onPointerDown={(e) => {
        setMenu(null)
        if (touch.down(e)) return
        const s = useBoard.getState()
        if (e.button === 1 || (e.button === 0 && (s.spaceHeld || s.tool === 'hand'))) {
          e.preventDefault()
          startPan(e)
        } else if (e.button === 0) {
          startMarquee(e)
        }
      }}
      onPointerMove={(e) => touch.move(e)}
      onPointerUp={(e) => touch.up(e)}
      onPointerCancel={(e) => touch.up(e)}
      onContextMenu={(e) => {
        e.preventDefault()
        const card = (e.target as HTMLElement).closest<HTMLElement>('[data-card-id]')
        const s = useBoard.getState()
        if (card) {
          const id = card.dataset.cardId!
          if (!s.selected[id]) s.setSelection([id])
        }
        setMenu({ x: e.clientX, y: e.clientY, world: clientToWorld(e.clientX, e.clientY), onCard: !!card })
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return
        e.preventDefault()
        const type = getDraggedTool()
        if (type) setGhost({ type, ...clientToScreen(e.clientX, e.clientY) })
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setGhost(null)
      }}
      onDrop={(e) => {
        setGhost(null)
        const type = e.dataTransfer.getData(DRAG_MIME)
        if (!type) return
        e.preventDefault()
        addCard(type, clientToWorld(e.clientX, e.clientY))
      }}
    >
      <GridBackground />
      <WorldLayer />
      <MarqueeOverlay />
      <EmptyHint />
      <SelectionToolbar />
      {ghost && <GhostCard type={ghost.type} x={ghost.x} y={ghost.y} />}
      <ZoomControls />
      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
    </div>
    </div>
  )
}

/** Card-shaped preview that follows the cursor while a tool is dragged onto the canvas. */
function GhostCard({ type, x, y }: { type: string; x: number; y: number }) {
  const zoom = useBoard((s) => s.viewport.zoom)
  const def = getCard(type)
  if (!def) return null
  const { width, height } = def.defaultSize
  return (
    <div
      data-testid="ghost-card"
      className="pointer-events-none absolute z-20 bg-[var(--card-bg)] p-4 text-[length:var(--text-card)] text-[var(--text-muted)]"
      style={{
        left: x,
        top: y,
        width: width * zoom,
        height: (height ?? 80) * zoom,
        transform: 'translate(-50%, -50%) rotate(-1.5deg)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card-drag)',
        opacity: 0.95,
      }}
    >
      {def.label}
    </div>
  )
}
