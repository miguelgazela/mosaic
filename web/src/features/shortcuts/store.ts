import { create } from 'zustand'

export const useShortcutsSheet = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

export const openShortcuts = () => useShortcutsSheet.getState().setOpen(true)
