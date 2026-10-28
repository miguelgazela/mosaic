import type { CardDefinition, CardProps } from '../types'
import { colorVar } from '../../canvas/colors'

function DebugCard({ element: el }: CardProps) {
  return (
    <div
      className="h-full w-full overflow-hidden rounded-[var(--radius-card)] p-2 text-[length:var(--text-sm)]"
      style={{ background: colorVar(el.color) ?? 'var(--card-bg)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="font-medium">Debug {el.id.slice(0, 4)}</div>
      <div className="text-[var(--text-muted)]">
        {Math.round(el.x)}, {Math.round(el.y)} · {Math.round(el.width)}×{el.height ?? 'auto'}
      </div>
    </div>
  )
}

export const debugCard: CardDefinition = {
  type: 'debug',
  label: 'Debug',
  Component: DebugCard,
  defaultSize: { width: 160, height: 96 },
  resize: 'both',
  minWidth: 80,
  minHeight: 48,
  toolbar: { label: 'Debug' },
  toPlainText: (el) => `debug ${el.id}`,
  toMarkdown: (el) => `- debug ${el.id}`,
}
