import { useBoard } from './store'

/** Shown on a board with no cards (00-empty-and-loading / 04-board-empty). */
export function EmptyHint() {
  const empty = useBoard((s) => Object.keys(s.elements).length === 0)
  if (!empty) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      <div className="relative mb-4 h-[72px] w-[120px]" aria-hidden>
        <div className="absolute left-0 top-3 h-[48px] w-[70px] -rotate-6 rounded-[var(--radius-card)] bg-white" style={{ boxShadow: 'var(--shadow-card)' }} />
        <div className="absolute left-[34px] top-0 h-[52px] w-[72px] rotate-3 rounded-[var(--radius-card)] bg-[var(--card-color-1)]" style={{ boxShadow: 'var(--shadow-card-hover)' }} />
      </div>
      <h2 className="text-[length:var(--text-body)] font-semibold">This board is empty</h2>
      <p className="mt-2 max-w-[360px] text-[length:var(--text-card)] text-[var(--text-secondary)]">
        Double-click anywhere to add a note, or drag a card from the toolbar on the left.
      </p>
    </div>
  )
}
