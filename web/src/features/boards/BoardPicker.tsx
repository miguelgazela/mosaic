import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { colorVar } from '../../canvas/colors'
import { BOARD_EMOJI, BOARD_ICONS } from './icons'
import { boardInfoKey, getBoardRepo, useBoardInfo } from './boardRepo'
import { useQueryClient } from '@tanstack/react-query'

/** Colours offered for a board (keys of the card palette; null = neutral). */
const BOARD_COLORS: (string | null)[] = [null, '2', '1', '6', '5', '4', '3', '7']

/** Board icon and colour picker (00-pickers). Arrow keys move through the grids via native button focus. */
export function BoardPicker({ boardId }: { boardId: string }) {
  const info = useBoardInfo(boardId).data
  const qc = useQueryClient()
  const [tab, setTab] = useState<'icons' | 'emoji'>('icons')
  const [q, setQ] = useState('')
  const save = (patch: { icon?: string | null; color?: string | null }) => {
    qc.setQueryData(boardInfoKey(boardId), (d: typeof info) => (d ? { ...d, ...patch } : d))
    void getBoardRepo().update(boardId, patch).catch(() => void qc.invalidateQueries({ queryKey: boardInfoKey(boardId) }))
  }
  const needle = q.trim().toLowerCase()
  const icons = BOARD_ICONS.filter((i) => !needle || i.label.toLowerCase().includes(needle) || i.key.includes(needle))
  const emoji = BOARD_EMOJI.filter((e) => !needle || e.label.includes(needle))
  const current = info?.icon ?? 'layout'
  const cell = 'flex h-9 w-9 items-center justify-center rounded-[var(--radius-ui)] text-[var(--text)] hover:bg-[var(--fill-hover)]'
  return (
    <div className="w-[296px] p-3" data-testid="board-picker">
      <div role="tablist" className="mb-2 grid grid-cols-2 rounded-[var(--radius-ui)] bg-[var(--fill-hover)] p-0.5 text-[length:var(--text-sm)] font-semibold">
        {(['icons', 'emoji'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-[6px] py-1 ${tab === t ? 'bg-[var(--card-bg)] shadow-[var(--shadow-card)]' : 'text-[var(--text-secondary)]'}`}
          >
            {t === 'icons' ? 'Icons' : 'Emoji'}
          </button>
        ))}
      </div>
      <label className="mb-2 flex h-9 items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border-strong)] px-2.5 text-[var(--text-muted)] focus-within:border-[var(--primary)]">
        <Search size={14} aria-hidden />
        <input
          aria-label={tab === 'icons' ? 'Search icons' : 'Search emoji'}
          placeholder={tab === 'icons' ? 'Search icons' : 'Search emoji'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[length:var(--text-card)] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </label>
      <div className="grid grid-cols-6 gap-1">
        {tab === 'icons'
          ? icons.map(({ key, label, Icon }) => (
              <button
                key={key}
                aria-label={label}
                aria-pressed={current === key}
                className={`${cell} ${current === key ? '!bg-[var(--primary-soft)] text-[var(--primary-ink)] ring-1 ring-[var(--primary)]' : ''}`}
                onClick={() => save({ icon: key })}
              >
                <Icon size={18} strokeWidth={1.75} />
              </button>
            ))
          : emoji.map((e) => (
              <button
                key={e.char}
                aria-label={e.label}
                aria-pressed={current === e.char}
                className={`${cell} text-[18px] ${current === e.char ? '!bg-[var(--primary-soft)] ring-1 ring-[var(--primary)]' : ''}`}
                onClick={() => save({ icon: e.char })}
              >
                {e.char}
              </button>
            ))}
      </div>
      <div className="mt-3 flex gap-2 border-t border-[var(--divider)] pt-3" role="group" aria-label="Board colour">
        {BOARD_COLORS.map((k) => {
          const on = (info?.color ?? null) === k
          return (
            <button
              key={k ?? 'none'}
              aria-label={k ? `Colour ${k}` : 'No colour'}
              aria-pressed={on}
              onClick={() => save({ color: k })}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-strong)]"
              style={{
                background: colorVar(k) ?? 'var(--card-color-9)',
                boxShadow: on ? '0 0 0 2px var(--card-bg), 0 0 0 4px var(--primary)' : undefined,
              }}
            >
              {on && <Check size={12} aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
