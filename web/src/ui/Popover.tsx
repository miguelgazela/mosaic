import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Anchored popover: closes on outside pointer-down and Escape, returns focus to the trigger. */
export function Popover({
  trigger,
  children,
  align = 'left',
  up,
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  up?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      ref.current?.querySelector<HTMLElement>('button')?.focus()
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={ref} className="relative inline-flex" onPointerDown={(e) => e.stopPropagation()}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={`absolute z-[3000000] ${up ? 'bottom-full mb-2' : 'top-full mt-2'} ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
