import { Hand, MousePointer2, Trash2 } from 'lucide-react'
import { listCards } from '../cards/registry'
import { Tooltip, toast } from '../ui'
import { addCard } from './actions'
import { centerOfView } from './geometry'
import { useBoard } from './store'

export const DRAG_MIME = 'application/x-canvas-card'

/** Card type being dragged from the rail; dataTransfer data is unreadable during dragover. */
let draggedType: string | null = null
export const getDraggedTool = (): string | null => draggedType

const blank = typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: 1, height: 1 }) : null

const tile =
  'flex w-[60px] flex-col items-center gap-1 rounded-[var(--radius-ui)] py-2 text-[length:var(--text-caption)] font-medium leading-[var(--leading-caption)] ' +
  'text-[var(--text)] transition-colors duration-[var(--dur-hover)] hover:bg-[var(--fill-hover)] active:bg-[var(--fill-pressed)] ' +
  'aria-pressed:bg-[var(--primary-soft)] aria-pressed:text-[var(--primary-ink)]'

function RailButton({ label, tip, shortcut, pressed, ...rest }: {
  label: string
  /** Tooltip / accessible name; defaults to the label. */
  tip?: string
  shortcut?: string
  pressed?: boolean
  icon: React.ReactNode
  onClick: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
}) {
  const { icon, ...btn } = rest
  return (
    <Tooltip label={tip ?? label} shortcut={shortcut}>
      <button className={tile} aria-pressed={pressed} aria-label={tip ?? label} {...btn}>
        {icon}
        <span aria-hidden>{label}</span>
      </button>
    </Tooltip>
  )
}

export function Toolbar() {
  const tool = useBoard((s) => s.tool)
  const setTool = useBoard((s) => s.setTool)
  const cards = listCards().filter((c) => c.toolbar)
  return (
    <nav
      aria-label="Tools"
      className="flex shrink-0 flex-col items-center gap-1 border-r border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-2 py-3"
      style={{ width: 'var(--rail-w)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <RailButton label="Select" shortcut="V" pressed={tool === 'select'} icon={<MousePointer2 size={18} />} onClick={() => setTool('select')} />
      <RailButton label="Hand" shortcut="H" pressed={tool === 'hand'} icon={<Hand size={18} />} onClick={() => setTool('hand')} />
      <hr className="my-1 w-8 border-[var(--divider)]" />
      {cards.map((c) => {
        const Icon = c.toolbar!.icon
        return (
          <RailButton
            key={c.type}
            label={c.toolbar!.label}
            tip={`Add ${c.toolbar!.label.toLowerCase()}`}
            shortcut={c.shortcut?.toUpperCase()}
            icon={<Icon size={18} />}
            draggable
            onDragStart={(e) => {
              draggedType = c.type
              e.dataTransfer.setData(DRAG_MIME, c.type)
              e.dataTransfer.effectAllowed = 'copy'
              if (blank) e.dataTransfer.setDragImage(blank, 0, 0)
            }}
            onDragEnd={() => { draggedType = null }}
            onClick={() => {
              const s = useBoard.getState()
              addCard(c.type, centerOfView(s.viewport, s.size))
            }}
          />
        )
      })}
      <div className="flex-1" />
      <hr className="my-1 w-8 border-[var(--divider)]" />
      <RailButton label="Trash" icon={<Trash2 size={18} />} onClick={() => toast('Trash is coming soon')} />
    </nav>
  )
}
