import { CARD_COLOR_KEYS, colorVar } from './colors'

/** Row of card-colour swatches + "no colour". Selected key gets a primary ring. */
export function ColorSwatches({ value, onPick }: { value: string | null | 'mixed'; onPick: (k: string | null) => void }) {
  const dot = 'h-6 w-6 rounded-full border border-[var(--border-strong)]'
  const ring = (on: boolean) => (on ? 'shadow-[0_0_0_2px_var(--card-bg),0_0_0_4px_var(--primary)]' : '')
  return (
    <div className="grid grid-cols-5 gap-2 p-2">
      {CARD_COLOR_KEYS.map((k) => (
        <button key={k} aria-label={`Colour ${k}`} className={`${dot} ${ring(value === k)}`} style={{ background: colorVar(k) }} onClick={() => onPick(k)} />
      ))}
      <button aria-label="No colour" className={`${dot} bg-white ${ring(value === null)}`} onClick={() => onPick(null)} />
    </div>
  )
}
