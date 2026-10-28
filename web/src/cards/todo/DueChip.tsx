import { CalendarDays, CircleAlert, Clock } from 'lucide-react'
import { dueKind, dueLabel } from './logic'

const STYLE = {
  overdue: 'bg-[var(--danger-soft)] text-[var(--danger-ink)]',
  today: 'bg-[var(--warning-soft)] text-[var(--warning-ink)]',
  upcoming: 'bg-[var(--fill-hover)] text-[var(--text-secondary)]',
} as const

/** Due chip: icon + words, so state never relies on colour alone. */
export function DueChip({ due, today }: { due: string; today: string }) {
  const kind = dueKind(due, today)
  const Icon = kind === 'overdue' ? CircleAlert : kind === 'today' ? Clock : CalendarDays
  return (
    <span
      data-testid="due-chip"
      data-due-kind={kind}
      className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-chip)] px-1.5 py-0.5 text-[length:var(--text-caption)] font-semibold leading-4 ${STYLE[kind]}`}
    >
      <Icon size={12} aria-hidden />
      {dueLabel(due, today)}
    </span>
  )
}
