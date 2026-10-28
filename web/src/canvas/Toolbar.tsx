import { listCards } from '../cards/registry'
import { addCard } from './actions'
import { centerOfView } from './geometry'
import { useBoard } from './store'

export const DRAG_MIME = 'application/x-canvas-card'

const btn =
  'flex h-10 w-10 flex-col items-center justify-center rounded-[var(--radius-ui)] text-[11px] leading-tight hover:bg-black/5 aria-pressed:bg-black/10'

export function Toolbar() {
  const tool = useBoard((s) => s.tool)
  const setTool = useBoard((s) => s.setTool)
  const cards = listCards().filter((c) => c.toolbar)
  return (
    <div
      className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-xl border bg-white p-1"
      style={{ boxShadow: 'var(--shadow-card)', borderColor: 'var(--border)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button className={btn} aria-pressed={tool === 'select'} title="Select (V)" onClick={() => setTool('select')}>
        Select
      </button>
      <button className={btn} aria-pressed={tool === 'hand'} title="Hand (H)" onClick={() => setTool('hand')}>
        Hand
      </button>
      <hr className="my-1" style={{ borderColor: 'var(--border)' }} />
      {cards.map((c) => (
        <button
          key={c.type}
          className={btn}
          draggable
          title={`Add ${c.label} (click or drag)`}
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, c.type)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => {
            const s = useBoard.getState()
            addCard(c.type, centerOfView(s.viewport, s.size))
          }}
        >
          {c.toolbar!.label}
        </button>
      ))}
    </div>
  )
}
