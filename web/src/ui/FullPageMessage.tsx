import type { ReactNode } from 'react'

export const FullPageMessage = ({ children }: { children: ReactNode }) => (
  <div className="dotted flex min-h-full items-center justify-center p-6 text-[length:var(--text-body)] text-[var(--text-secondary)]">{children}</div>
)
