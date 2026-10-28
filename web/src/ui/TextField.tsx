import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'

const input =
  'h-10 w-full rounded-[var(--radius-ui)] border bg-[var(--card-bg)] px-3 text-[length:var(--text-body)] text-[var(--text)] ' +
  'placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus-visible:shadow-[0_0_0_2px_var(--primary-soft)] ' +
  'disabled:bg-[var(--fill-hover)] disabled:text-[var(--text-disabled)]'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, className = '', id, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fid} className="text-[length:var(--text-sm)] font-semibold">{label}</label>
      <input
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : undefined}
        className={`${input} ${error ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]'} ${className}`}
        {...rest}
      />
      {error && (
        <p id={`${fid}-err`} role="alert" className="text-[length:var(--text-sm)] text-[var(--danger)]">{error}</p>
      )}
    </div>
  )
})

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onChange: (v: string) => void
}

export function SearchField({ value, onChange, className = '', ...rest }: SearchFieldProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} border-[var(--border-strong)] pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden`}
        {...rest}
      />
      {value && !rest.disabled && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-chip)] text-[var(--text-muted)] hover:bg-[var(--fill-hover)]"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
