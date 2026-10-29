import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

export function Dialog({
  title,
  onClose,
  children,
  footer,
  width = 440,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    // Something inside may have asked for focus already (autoFocus on Cancel, a search field).
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); prev?.focus() }
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-[3500000] flex items-center justify-center bg-[var(--overlay-dim)] p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-menu-in max-h-full w-full overflow-auto rounded-[var(--radius-dialog)] bg-[var(--card-bg)] p-6"
        style={{ maxWidth: width, boxShadow: 'var(--shadow-dialog)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[length:var(--text-h3)] font-semibold">{title}</h2>
          <IconButton aria-label="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>
        {children}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
