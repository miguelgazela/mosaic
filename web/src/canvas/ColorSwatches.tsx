import { useState } from 'react'
import { Check } from 'lucide-react'
import { COLOR_NAMES, PICKER_ORDER, colorVar } from './colors'

/** Card colour picker (00-pickers): 5 × 2 grid, check on the current one, name of the hovered one below. */
export function ColorSwatches({ value, onPick }: { value: string | null | 'mixed'; onPick: (k: string | null) => void }) {
  const [hover, setHover] = useState<string | null | undefined>(undefined)
  const shown = hover !== undefined ? hover : value === 'mixed' ? undefined : value
  const name = shown === undefined ? 'Mixed' : shown === null ? 'No colour' : COLOR_NAMES[shown]
  return (
    <div className="p-2">
      <div role="group" aria-label="Card colour" className="grid grid-cols-5 gap-2">
        {PICKER_ORDER.map((k) => {
          const on = value === k
          return (
            <button
              key={k ?? 'none'}
              aria-label={k === null ? 'No colour' : `Colour ${COLOR_NAMES[k]}`}
              aria-pressed={on}
              data-color={k ?? 'none'}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[var(--radius-ui)] border border-[var(--border-strong)]"
              style={{
                background: colorVar(k) ?? '#fff',
                boxShadow: on ? '0 0 0 2px var(--card-bg), 0 0 0 4px var(--primary)' : undefined,
              }}
              onMouseEnter={() => setHover(k)}
              onMouseLeave={() => setHover(undefined)}
              onFocus={() => setHover(k)}
              onBlur={() => setHover(undefined)}
              onClick={() => onPick(k)}
            >
              {on && <Check size={14} className="text-[var(--text)]" aria-hidden />}
            </button>
          )
        })}
      </div>
      <div className="mt-2 text-[length:var(--text-caption)] text-[var(--text-muted)]">{name}</div>
    </div>
  )
}
