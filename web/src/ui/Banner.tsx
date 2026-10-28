import { WifiOff, Check } from 'lucide-react'
import { useEffect, useState } from 'react'

export type BannerState = 'hidden' | 'offline' | 'back'

/** Offline banner: sits under the top bar; turns green for 2 s on reconnect. */
export function OfflineBanner({ online }: { online: boolean }) {
  const [state, setState] = useState<BannerState>(online ? 'hidden' : 'offline')
  useEffect(() => {
    if (!online) { setState('offline'); return }
    setState((s) => (s === 'offline' ? 'back' : s))
    const t = setTimeout(() => setState('hidden'), 2000)
    return () => clearTimeout(t)
  }, [online])
  if (state === 'hidden') return null
  const offline = state === 'offline'
  return (
    <div
      role="status"
      className={`flex h-9 items-center justify-center gap-2 border-b text-[length:var(--text-sm)] ${
        offline
          ? 'border-[#f3d79b] bg-[var(--warning-soft)] text-[var(--warning-ink)]'
          : 'border-[#b9dfc9] bg-[var(--success-soft)] text-[var(--success)]'
      }`}
    >
      {offline ? <WifiOff size={14} /> : <Check size={14} />}
      <span><b className="font-semibold">{offline ? 'You’re offline.' : 'Back online.'}</b> {offline ? 'Changes will sync when you reconnect.' : 'All changes saved.'}</span>
    </div>
  )
}

export function useOnline(): boolean {
  const [on, setOn] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOn(true)
    const down = () => setOn(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return on
}
