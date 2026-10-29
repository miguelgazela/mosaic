import { useSyncExternalStore } from 'react'

const PHONE = '(max-width: 767px)'

/** FR-54: below 768 px the app is view only. */
export const usePhone = (): boolean => useSyncExternalStore(
  (cb) => { const m = window.matchMedia(PHONE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
  () => window.matchMedia(PHONE).matches,
)
