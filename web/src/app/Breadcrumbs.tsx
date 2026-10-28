import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { MenuItem, MenuPanel, IconButton } from '../ui'
import { Popover } from '../ui/Popover'

export interface Crumb { id: string; title: string; to: string }

const Sep = () => <ChevronRight size={14} className="shrink-0 text-[var(--icon-subtle)]" aria-hidden />
const link = 'rounded-[var(--radius-ui)] px-2 py-1 text-[length:var(--text-card)] text-[var(--text-secondary)] hover:bg-[var(--fill-hover)] hover:text-[var(--text)]'

/** Ancestors (links), then the current board title (click to rename inline: Enter saves, Esc cancels). */
export function Breadcrumbs({
  ancestors,
  title,
  onRename,
  readOnly,
}: {
  ancestors: Crumb[]
  title: string
  onRename: (title: string) => void
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) input.current?.select() }, [editing])

  const commit = () => {
    setEditing(false)
    const t = draft.trim()
    if (t && t !== title) onRename(t)
  }

  const collapse = ancestors.length > 2
  const shown = collapse ? [ancestors[0], ancestors[ancestors.length - 1]] : ancestors
  const hidden = collapse ? ancestors.slice(1, -1) : []

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0.5">
      {shown.map((c, i) => (
        <span key={c.id} className="flex items-center gap-0.5">
          <Link to={c.to} className={link}>{c.title}</Link>
          <Sep />
          {i === 0 && collapse && (
            <>
              <Popover
                trigger={({ toggle }) => (
                  <IconButton aria-label="Show hidden levels" className="!h-6 !w-7 bg-[var(--fill-hover)]" onClick={toggle}>
                    <MoreHorizontal size={14} />
                  </IconButton>
                )}
              >
                {(close) => (
                  <MenuPanel className="min-w-[250px]" onClose={close}>
                    {hidden.map((h) => (
                      <Link key={h.id} to={h.to} onClick={close} tabIndex={-1}>
                        <MenuItem>{h.title}</MenuItem>
                      </Link>
                    ))}
                  </MenuPanel>
                )}
              </Popover>
              <Sep />
            </>
          )}
        </span>
      ))}
      {editing ? (
        <input
          ref={input}
          aria-label="Board title"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') { setDraft(title); setEditing(false) }
          }}
          className="h-8 w-56 rounded-[var(--radius-ui)] border border-[var(--primary)] bg-[var(--card-bg)] px-2 text-[length:var(--text-card)] font-semibold shadow-[0_0_0_2px_var(--primary-soft)]"
        />
      ) : (
        <button
          disabled={readOnly}
          onClick={() => { setDraft(title); setEditing(true) }}
          className="truncate rounded-[var(--radius-ui)] px-2 py-1 text-[length:var(--text-card)] font-semibold hover:bg-[var(--fill-hover)]"
          title={readOnly ? undefined : 'Rename board'}
        >
          {title}
        </button>
      )}
    </nav>
  )
}
