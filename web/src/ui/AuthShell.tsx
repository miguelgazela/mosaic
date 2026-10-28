import type { ReactNode } from 'react'
import { Wordmark } from './Logo'

/** Full-page dotted backdrop with the wordmark above a white card (sign in, not a member). */
export function AuthShell({ children, footer, width = 380 }: { children: ReactNode; footer?: ReactNode; width?: number }) {
  return (
    <main className="dotted flex min-h-full flex-col items-center justify-center gap-6 px-4 py-12">
      <Wordmark />
      <div
        className="w-full rounded-[var(--radius-dialog)] border border-[var(--border)] bg-[var(--card-bg)] p-7"
        style={{ maxWidth: width, boxShadow: 'var(--shadow-card)' }}
      >
        {children}
      </div>
      {footer && <p className="max-w-[360px] text-center text-[length:var(--text-sm)] text-[var(--text-secondary)]">{footer}</p>}
    </main>
  )
}
