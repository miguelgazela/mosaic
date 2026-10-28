import { create } from 'zustand'

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error'

interface SyncState {
  status: SaveStatus
  online: boolean
  setStatus(s: SaveStatus): void
  setOnline(v: boolean): void
}

export const useSync = create<SyncState>()((set) => ({
  status: 'saved',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  setStatus: (status) => set({ status }),
  setOnline: (online) => set({ online }),
}))

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useSync.getState().setOnline(true))
  window.addEventListener('offline', () => useSync.getState().setOnline(false))
}
