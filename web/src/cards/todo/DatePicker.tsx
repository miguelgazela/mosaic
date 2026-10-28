import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { addDays, isoDay, longDate, monthGrid, nextMonday, parseDay } from './logic'

const MONTHS = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
const quick = 'h-8 flex-1 rounded-[var(--radius-ui)] border border-[var(--border)] bg-[var(--card-bg)] text-[length:var(--text-sm)] font-semibold hover:bg-[var(--fill-hover)]'

/** Month picker. Arrow keys move the day, Enter sets it, Esc closes (handled by Popover). */
export function DatePicker({ value, today, onPick, onClear }: {
  value?: string
  today: string
  onPick: (iso: string) => void
  onClear: () => void
}) {
  const [focus, setFocus] = useState(value ?? today)
  const grid = useRef<HTMLDivElement>(null)
  const d = parseDay(focus)
  useEffect(() => { grid.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus() }, [focus])

  const month = (n: number) => { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); setFocus(isoDay(x)) }
  const onKey = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (step) { e.preventDefault(); setFocus(addDays(focus, step)) }
  }

  return (
    <div role="dialog" aria-label="Due date" data-nodrag className="w-[280px] rounded-[var(--radius-menu)] bg-[var(--card-bg)] p-3 shadow-[var(--shadow-menu)]">
      <div className="flex gap-2">
        <button type="button" className={quick} onClick={() => onPick(today)}>Today</button>
        <button type="button" className={quick} onClick={() => onPick(addDays(today, 1))}>Tomorrow</button>
        <button type="button" className={quick} onClick={() => onPick(nextMonday(today))}>Next week</button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" aria-label="Previous month" className="rounded-[var(--radius-chip)] p-1.5 hover:bg-[var(--fill-hover)]" onClick={() => month(-1)}><ChevronLeft size={16} /></button>
        <span className="text-[length:var(--text-card)] font-semibold">{MONTHS.format(d)}</span>
        <button type="button" aria-label="Next month" className="rounded-[var(--radius-chip)] p-1.5 hover:bg-[var(--fill-hover)]" onClick={() => month(1)}><ChevronRight size={16} /></button>
      </div>
      <div ref={grid} role="grid" onKeyDown={onKey} className="mt-2">
        <div className="grid grid-cols-7 text-center text-[length:var(--text-caption)] text-[var(--text-muted)]">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => <span key={w} className="py-1">{w}</span>)}
        </div>
        {monthGrid(d.getFullYear(), d.getMonth()).map((week, i) => (
          <div key={i} role="row" className="grid grid-cols-7">
            {week.map((day, j) => day ? (
              <button
                key={day}
                type="button"
                role="gridcell"
                data-day={day}
                tabIndex={day === focus ? 0 : -1}
                aria-selected={day === value}
                onClick={() => onPick(day)}
                className={`m-0.5 h-8 rounded-[var(--radius-ui)] text-[length:var(--text-sm)] ${
                  day === value ? 'bg-[var(--primary)] font-semibold text-white'
                  : day === today ? 'border-[1.5px] border-[var(--primary)] font-semibold text-[var(--primary)]'
                  : 'hover:bg-[var(--fill-hover)]'}`}
              >
                {parseDay(day).getDate()}
              </button>
            ) : <span key={j} />)}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-[length:var(--text-sm)]">
        <span className="text-[var(--text-muted)]">{value ? longDate(value) : 'No date'}</span>
        <button type="button" className="font-semibold text-[var(--danger)] hover:underline disabled:opacity-40" disabled={!value} onClick={onClear}>Clear date</button>
      </div>
    </div>
  )
}
