import { Check } from 'lucide-react'
import { useId } from 'react'

interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
  error?: string
}

export function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <label className={`inline-flex items-center gap-3 text-[length:var(--text-body)] ${disabled ? 'text-[var(--text-disabled)]' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors duration-[var(--dur-hover)] disabled:cursor-not-allowed ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'} ${disabled ? 'opacity-50' : ''}`}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] duration-[var(--dur-hover)]"
          style={{ left: checked ? 18 : 2 }}
        />
      </button>
      {label}
    </label>
  )
}

export function Checkbox({ checked, onChange, label, disabled, error }: Props) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={`inline-flex items-center gap-2 text-[length:var(--text-body)] ${disabled ? 'text-[var(--text-disabled)]' : ''}`}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[var(--radius-chip)] border-[1.5px] peer-focus-visible:shadow-[var(--ring-focus)] ${
            checked ? 'border-[var(--success)] bg-[var(--success)] text-white' : error ? 'border-[var(--danger)]' : 'border-[var(--border-strong)] bg-[var(--card-bg)]'
          } ${disabled ? 'opacity-50' : ''}`}
        >
          {checked && <Check size={13} strokeWidth={3} />}
        </span>
        {label}
      </label>
      {error && <p className="mt-1 text-[length:var(--text-sm)] text-[var(--danger)]">{error}</p>}
    </div>
  )
}
