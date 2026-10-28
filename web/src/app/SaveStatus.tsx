import { Check, Loader2, WifiOff } from 'lucide-react'

export type SaveState = 'saved' | 'saving' | 'offline'

/** Presentational; P2 wires the real sync state into `state`. */
export function SaveStatus({ state }: { state: SaveState }) {
  const cfg = {
    saved: { icon: <Check size={14} />, text: 'Saved', cls: 'text-[var(--text-muted)]' },
    saving: { icon: <Loader2 size={14} className="animate-spin-slow" />, text: 'Saving…', cls: 'text-[var(--text-muted)]' },
    offline: { icon: <WifiOff size={14} />, text: 'Offline – changes will sync', cls: 'text-[var(--warning-ink)]' },
  }[state]
  return (
    <span role="status" data-testid="save-status" className={`flex items-center gap-1.5 text-[length:var(--text-sm)] ${cfg.cls}`}>
      {cfg.icon}
      {cfg.text}
    </span>
  )
}
