import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'

const base =
  'inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-ui)] px-4 text-[length:var(--text-card)] font-semibold ' +
  'transition-colors duration-[var(--dur-hover)] disabled:cursor-not-allowed disabled:bg-[var(--fill-pressed)] disabled:text-[var(--text-disabled)] disabled:border-transparent'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)]',
  secondary:
    'border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] hover:bg-[var(--fill-hover)] active:bg-[var(--fill-pressed)] disabled:bg-transparent',
  ghost: 'text-[var(--text)] hover:bg-[var(--fill-hover)] active:bg-[var(--fill-pressed)] disabled:bg-transparent',
  destructive: 'bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)] active:bg-[var(--danger-pressed)]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', block, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
})

/** 36 px square icon button. Pass `aria-label`. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function IconButton(
  { className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-ui)] text-[var(--text)] transition-colors duration-[var(--dur-hover)] hover:bg-[var(--fill-hover)] active:bg-[var(--fill-pressed)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[var(--icon-subtle)] ${className}`}
      {...rest}
    />
  )
})
