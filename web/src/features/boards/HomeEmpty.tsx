import { useState } from 'react'
import { Link } from 'react-router-dom'
import { colorVar } from '../../canvas/colors'
import { addCard } from '../../canvas/actions'
import { centerOfView } from '../../canvas/geometry'
import { useBoard } from '../../canvas/store'
import { Button } from '../../ui'
import { useBoardInfo } from './boardRepo'
import { useBoardHref } from './nav'
import { readRecent } from './recent'

const KEY = 'milanote.homeHintDismissed'
const wasDismissed = (): boolean => {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

/** A recently opened board; renders nothing once the board is gone (trashed or deleted). */
function RecentChip({ id }: { id: string }) {
  const info = useBoardInfo(id)
  const href = useBoardHref()
  if (!info.data) return null
  return (
    <Link
      to={href(id)}
      data-testid="recent-board"
      className="flex h-8 items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--chrome-border)] bg-[var(--card-bg)] px-2.5 text-[length:var(--text-sm)] font-medium hover:bg-[var(--fill-hover)]"
    >
      <span className="h-4 w-4 shrink-0 rounded-[4px]" style={{ background: colorVar(info.data.color) ?? 'var(--card-color-9)' }} aria-hidden />
      <span className="max-w-[160px] truncate">{info.data.title}</span>
    </Link>
  )
}

/** Recent boards strip on Home (03-home-populated; 03-home-empty while nothing was opened yet). */
function RecentStrip() {
  const [ids] = useState(readRecent)
  return (
    <div
      data-testid="recent-strip"
      aria-label="Recent boards"
      className="pointer-events-auto absolute left-4 right-4 top-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-menu)] border border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-3.5 py-2 text-[length:var(--text-sm)]"
    >
      <span className="mr-1 font-semibold">Recent</span>
      {ids.length === 0 && <span className="text-[var(--text-muted)]">Boards you open will show here.</span>}
      {ids.map((id) => <RecentChip key={id} id={id} />)}
    </div>
  )
}

/** Home's overlay: the Recent strip, plus the onboarding card while the board has nothing on it. */
export function HomeEmpty() {
  const empty = useBoard((s) => Object.keys(s.elements).length === 0)
  const [dismissed, setDismissed] = useState(wasDismissed)
  return (
    <div className="pointer-events-none absolute inset-0 z-10" style={{ left: 'var(--rail-w)' }}>
      <RecentStrip />
      {empty && !dismissed && (
        <section
          data-testid="home-onboarding"
          aria-labelledby="home-onboarding-title"
          className="pointer-events-auto absolute left-1/2 top-1/2 w-[420px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-dialog)] bg-[var(--card-bg)] p-7"
          style={{ boxShadow: 'var(--shadow-card-hover)' }}
        >
          <h2 id="home-onboarding-title" className="text-[length:var(--text-h2)] font-semibold leading-[var(--leading-h2)]">This is your Home board</h2>
          <p className="mt-4 text-[length:var(--text-body)] leading-[var(--leading-body)] text-[var(--text-secondary)]">
            Everything starts here. Add a board for each project, then fill it with notes, images, links and to-dos.
          </p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[length:var(--text-card)] leading-[var(--leading-card)] text-[var(--text-secondary)]">
            <li>Drag <b className="text-[var(--text)]">Board</b> from the left onto the canvas.</li>
            <li>Name it, then click it to open.</li>
            <li>Double-click anywhere inside to add a note.</li>
          </ol>
          <div className="mt-6 flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const s = useBoard.getState()
                addCard('board', centerOfView(s.viewport, s.size))
              }}
            >
              Add a board
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                try { localStorage.setItem(KEY, '1') } catch { /* private mode: hide for this visit only */ }
                setDismissed(true)
              }}
            >
              Dismiss
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
