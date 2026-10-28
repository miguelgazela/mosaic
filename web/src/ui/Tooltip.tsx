import type { ReactNode } from 'react'

/** CSS-only tooltip: shows on hover and keyboard focus of the wrapped control. */
export function Tooltip({
  label,
  shortcut,
  side = 'right',
  children,
}: {
  label: string
  shortcut?: string
  side?: 'right' | 'top' | 'bottom'
  children: ReactNode
}) {
  const pos =
    side === 'right' ? 'left-full top-1/2 ml-2 -translate-y-1/2'
    : side === 'top' ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
    : 'top-full left-1/2 mt-2 -translate-x-1/2'
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[3000000] flex items-center gap-2 whitespace-nowrap rounded-[var(--radius-ui)] bg-[var(--text)] px-2.5 py-1.5 text-[length:var(--text-sm)] font-medium text-white opacity-0 transition-opacity duration-[var(--dur-hover)] group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${pos}`}
      >
        {label}
        {shortcut && (
          <kbd className="rounded-[var(--radius-chip)] bg-white/20 px-1.5 text-[length:var(--text-caption)] font-semibold">{shortcut}</kbd>
        )}
      </span>
    </span>
  )
}
