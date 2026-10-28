import { useState } from 'react'
import { addCard } from '../../canvas/actions'
import { centerOfView } from '../../canvas/geometry'
import { useBoard } from '../../canvas/store'
import { Button } from '../../ui'

const KEY = 'milanote.homeHintDismissed'
const wasDismissed = (): boolean => {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

/** Home with nothing on it (03-home-empty): empty Recent strip and an onboarding card. */
export function HomeEmpty() {
  const empty = useBoard((s) => Object.keys(s.elements).length === 0)
  const [dismissed, setDismissed] = useState(wasDismissed)
  if (!empty) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10" style={{ left: 'var(--rail-w)' }}>
      <div
        data-testid="recent-strip"
        className="absolute left-4 top-4 flex items-center gap-3 rounded-[var(--radius-menu)] border border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-3.5 py-2.5 text-[length:var(--text-sm)]"
      >
        <span className="font-semibold">Recent</span>
        <span className="text-[var(--text-muted)]">Boards you open will show here.</span>
      </div>
      {!dismissed && (
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
