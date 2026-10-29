import { Lock } from 'lucide-react'

/** "View only" chip next to the board title (04-board-read-only). */
export function ViewOnlyChip() {
  return (
    <span
      data-testid="view-only-chip"
      className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--fill-hover)] px-3 text-[length:var(--text-sm)] font-medium text-[var(--text-secondary)]"
    >
      <Lock size={12} /> View only
    </span>
  )
}

/** Status pill at the bottom of a read-only canvas. */
export function ViewOnlyPill() {
  return (
    <div
      data-testid="view-only-pill"
      role="status"
      className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--text)] px-4 text-[length:var(--text-sm)] text-white"
    >
      <Lock size={14} /> You can view this board but not change it.
    </div>
  )
}
