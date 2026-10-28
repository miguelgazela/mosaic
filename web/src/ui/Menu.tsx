import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/** Shared menu surface: 10 px radius, 6 px inset, 34 px rows, shortcut right-aligned. */
export function MenuPanel({
  children,
  className = '',
  style,
  onClose,
  label,
  ...rest
}: {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  onClose?: () => void
  label?: string
} & Pick<React.HTMLAttributes<HTMLDivElement>, 'onPointerDown' | 'onContextMenu'>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true })
  }, [])
  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus()
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus()
    else if (e.key === 'Escape') onClose?.()
    else return
    e.preventDefault()
    e.stopPropagation()
  }
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      {...rest}
      className={`animate-menu-in rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)] p-1.5 ${className}`}
      style={{ boxShadow: 'var(--shadow-menu)', ...style }}
    >
      {children}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  shortcut,
  destructive,
  submenu,
  checked,
  onClick,
  disabled,
}: {
  icon?: ReactNode
  children: ReactNode
  shortcut?: string
  destructive?: boolean
  submenu?: boolean
  checked?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[34px] w-full items-center gap-3 rounded-[var(--radius-ui)] px-2.5 text-left text-[length:var(--text-card)] focus-visible:bg-[var(--fill-hover)] focus-visible:shadow-none hover:bg-[var(--fill-hover)] disabled:text-[var(--text-disabled)] ${
        destructive ? 'text-[var(--danger)]' : 'text-[var(--text)]'
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--text-secondary)]">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {checked && <span aria-hidden className="text-[var(--primary)]">✓</span>}
      {shortcut && <span className="text-[length:var(--text-caption)] text-[var(--text-muted)]">{shortcut}</span>}
      {submenu && <ChevronRight size={14} className="text-[var(--text-muted)]" />}
    </button>
  )
}

export const MenuDivider = () => <div role="separator" className="my-1.5 h-px bg-[var(--divider)]" />
