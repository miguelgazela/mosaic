import { memo, useEffect, useRef, type CSSProperties } from 'react'
import { getCard } from '../cards/registry'
import { EdgeHandles } from './EdgeHandles'
import { startCardDrag, startResize } from './interactions'
import { useBoard } from './store'

const handleBase: CSSProperties = {
  position: 'absolute',
  background: 'var(--card-bg)',
  border: 'calc(1.5px / var(--zoom)) solid var(--primary)',
  borderRadius: 'calc(2px / var(--zoom))',
  touchAction: 'none',
}

const renderChild = (id: string) => <CardShell key={id} id={id} inColumn />

export const CardShell = memo(function CardShell({ id, inColumn = false }: { id: string; inColumn?: boolean }) {
  const el = useBoard((s) => s.elements[id])
  const selected = useBoard((s) => !!s.selected[id])
  const rank = useBoard((s) => s.rank[id])
  const lifted = useBoard((s) => s.dragging && !!s.selected[id])
  const readOnly = useBoard((s) => s.readOnly)
  const single = useBoard((s) => s.selected[id] === true && Object.keys(s.selected).length === 1)
  const ref = useRef<HTMLDivElement>(null)
  const def = el ? getCard(el.type) : undefined
  const autoHeight = el?.height == null

  useEffect(() => {
    const node = ref.current
    if (!node || !autoHeight) return
    const ro = new ResizeObserver(([entry]) => {
      useBoard.getState().reportHeight(id, entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [id, autoHeight])

  if (!el) return null
  const Component = def?.Component
  const resize = def?.resize ?? 'none'

  return (
    <div
      ref={ref}
      data-card-id={id}
      className="group/card"
      data-x={el.x}
      data-y={el.y}
      data-w={el.width}
      data-h={el.height ?? ''}
      data-selected={selected}
      data-parent={el.parentId ?? undefined}
      style={{
        ...(inColumn
          ? { position: 'relative', width: '100%', height: el.height ?? undefined, zIndex: lifted ? 1_000_000 : undefined }
          : {
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${el.x}px, ${el.y}px)`,
              width: el.width,
              height: el.height ?? undefined,
              zIndex: lifted ? 1_000_000 : rank,
            }),
        outline: selected && !def?.ownSelectionRing ? 'calc(2px / var(--zoom)) solid var(--primary)' : undefined,
        borderRadius: 'var(--radius-card)',
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-nodrag]')) return
        if (readOnly) return
        if (startCardDrag(e, id)) e.stopPropagation()
      }}
    >
      {!lifted && !readOnly && <EdgeHandles id={id} skip={single && !inColumn && resize === 'width' ? 'right' : undefined} />}
      <div className="card-inner" data-lifted={lifted}>
        {Component ? (
          <Component element={el} selected={selected} inColumn={inColumn} renderChild={renderChild} />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-dashed bg-[var(--card-bg)] p-2 text-[length:var(--text-sm)]">Unknown card “{el.type}”</div>
        )}
      </div>
      {single && !inColumn && (resize === 'width' || resize === 'both' || resize === 'aspect') && (
        <>
          {resize === 'width' && (
            <div
              data-handle="e"
              style={{ ...handleBase, width: 'calc(8px / var(--zoom))', height: 'calc(22px / var(--zoom))', right: 'calc(-4px / var(--zoom))', top: '50%', marginTop: 'calc(-11px / var(--zoom))', cursor: 'ew-resize' }}
              onPointerDown={(e) => { e.stopPropagation(); startResize(e, id, 'x') }}
            />
          )}
          {(resize === 'both' || resize === 'aspect') && (
            <div
              data-handle="se"
              style={{ ...handleBase, width: 'calc(10px / var(--zoom))', height: 'calc(10px / var(--zoom))', right: 'calc(-5px / var(--zoom))', bottom: 'calc(-5px / var(--zoom))', cursor: 'nwse-resize' }}
              onPointerDown={(e) => { e.stopPropagation(); startResize(e, id, 'xy') }}
            />
          )}
        </>
      )}
    </div>
  )
})
