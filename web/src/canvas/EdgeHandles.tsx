import { startLineFromHandle } from './connectInteractions'
import type { Side } from './connections'

const POS: Record<Side, React.CSSProperties> = {
  top: { left: '50%', top: 0 },
  bottom: { left: '50%', top: '100%' },
  left: { left: 0, top: '50%' },
  right: { left: '100%', top: '50%' },
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

/**
 * Round handles on the four edges of a card, shown while it is hovered (the parent has class `group`).
 * Dragging one draws a line. `skip` hides a side (e.g. where the resize handle sits).
 */
export function EdgeHandles({ id, skip }: { id: string; skip?: Side }) {
  return (
    <>
      {SIDES.filter((s) => s !== skip).map((side) => (
        <div
          key={side}
          data-edge-handle={side}
          data-nodrag
          title="Drag to draw a line"
          className="pointer-events-none absolute opacity-0 transition-opacity duration-[var(--dur-hover)] group-hover/card:pointer-events-auto group-hover/card:opacity-100 hover:!bg-[var(--primary)]"
          style={{
            ...POS[side],
            width: 'calc(10px / var(--zoom))',
            height: 'calc(10px / var(--zoom))',
            marginLeft: 'calc(-5px / var(--zoom))',
            marginTop: 'calc(-5px / var(--zoom))',
            borderRadius: '50%',
            background: 'var(--card-bg)',
            border: 'calc(1.5px / var(--zoom)) solid var(--primary)',
            cursor: 'crosshair',
            zIndex: 3,
            touchAction: 'none',
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.stopPropagation()
            startLineFromHandle(e, id, side)
          }}
        />
      ))}
    </>
  )
}
