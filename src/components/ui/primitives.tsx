import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { IconCheck } from './icons'

// ── Button ────────────────────────────────────────────────────────────────
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}
export function Button({ variant = 'primary', className = '', children, ...rest }: BtnProps) {
  const styles: Record<string, string> = {
    primary: 'bg-brand text-white shadow-soft hover:bg-[#86162a] disabled:bg-[#C9A8AE] disabled:shadow-none',
    secondary: 'border border-border bg-surface text-ink hover:border-[#D8D0BF] disabled:opacity-50',
    ghost: 'text-muted hover:text-ink',
    danger: 'bg-danger text-white hover:bg-[#7a1e14] disabled:opacity-50',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-input px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

// ── Field wrapper ───────────────────────────────────────────────────────────
export function Field({
  label,
  helper,
  error,
  required,
  children,
}: {
  label: string
  helper?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-brand"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : helper ? (
        <p className="text-xs text-muted">{helper}</p>
      ) : null}
    </div>
  )
}

export const inputCls =
  'w-full rounded-input border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10'

// ── Segmented cards (two big choices) ───────────────────────────────────────
export function SegmentedCards<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; title: string; subtitle?: string; disabled?: boolean; note?: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative rounded-card border p-4 text-left transition ${
              o.disabled
                ? 'cursor-not-allowed border-border bg-cream/50 opacity-60'
                : active
                  ? 'border-brand bg-brand/[0.03] ring-2 ring-brand/15'
                  : 'border-border bg-surface hover:border-[#D8D0BF]'
            }`}
          >
            {active && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                <IconCheck width={13} height={13} />
              </span>
            )}
            <div className="font-medium text-ink">{o.title}</div>
            {o.subtitle && <div className="mt-0.5 text-xs text-muted">{o.subtitle}</div>}
            {o.disabled && o.note && <div className="mt-2 text-[11px] text-muted">{o.note}</div>}
          </button>
        )
      })}
    </div>
  )
}

// ── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

// ── Modal ───────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`animate-rise relative w-full ${width} rounded-card border border-border bg-surface p-6 shadow-soft`}>
        <h3 className="font-serif text-xl text-ink">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

// ── Toast ───────────────────────────────────────────────────────────────────
export function Toast({
  message,
  action,
  onAction,
}: {
  message: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="animate-rise fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-input bg-ink px-4 py-3 text-sm text-white shadow-soft">
      <span>{message}</span>
      {action && (
        <button onClick={onAction} className="font-medium text-[#E9B8c0] hover:underline">
          {action}
        </button>
      )}
    </div>
  )
}
