import { create } from 'zustand'

export interface ToastAction { label: string; run: () => void }
export interface ToastItem {
  id: number
  message: string
  tone: 'default' | 'success' | 'error'
  action?: ToastAction
  dismissible: boolean
}

interface ToastState {
  current: ToastItem | null
  show(t: { message: string; tone?: ToastItem['tone']; action?: ToastAction }): void
  dismiss(): void
}

let nextId = 1
let timer: ReturnType<typeof setTimeout> | undefined

export const useToasts = create<ToastState>()((set) => ({
  current: null,
  show({ message, tone = 'default', action }) {
    clearTimeout(timer)
    const id = nextId++
    set({ current: { id, message, tone, action, dismissible: !!action } })
    // Toasts with an action stay until dismissed; others go after 5 s.
    if (!action) timer = setTimeout(() => set((s) => (s.current?.id === id ? { current: null } : s)), 5000)
  },
  dismiss() {
    clearTimeout(timer)
    set({ current: null })
  },
}))

export const toast = (message: string, opts: { tone?: ToastItem['tone']; action?: ToastAction } = {}): void =>
  useToasts.getState().show({ message, ...opts })
