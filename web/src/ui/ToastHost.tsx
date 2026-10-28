import { AlertCircle, Check, X } from 'lucide-react'
import { useToasts } from './toast'

export function ToastHost() {
  const t = useToasts((s) => s.current)
  const dismiss = useToasts((s) => s.dismiss)
  if (!t) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[4000000] flex justify-center">
      <div
        key={t.id}
        role="status"
        aria-live="polite"
        className="animate-toast-in pointer-events-auto flex items-center gap-3 rounded-[var(--radius-menu)] bg-[var(--text)] px-4 py-3 text-[length:var(--text-card)] font-medium text-white"
        style={{ boxShadow: 'var(--shadow-menu)' }}
      >
        {t.tone === 'success' && <Check size={16} className="text-[#6ee7a0]" />}
        {t.tone === 'error' && <AlertCircle size={16} className="text-[#fca5a5]" />}
        <span>{t.message}</span>
        {t.action && (
          <button
            className="rounded-[var(--radius-chip)] bg-white/15 px-3 py-1 font-semibold text-[#ddd6fe] hover:bg-white/25"
            onClick={() => { t.action!.run(); dismiss() }}
          >
            {t.action.label}
          </button>
        )}
        {t.dismissible && (
          <button aria-label="Dismiss" className="text-white/70 hover:text-white" onClick={dismiss}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
