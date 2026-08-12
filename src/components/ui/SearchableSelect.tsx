import { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconSearch, IconCheck, IconX } from './icons'
import { Spinner } from './primitives'

// ── Single-select with type-to-filter + simulated load ─────────────────────
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  simulateLoad = false,
  loadingLabel = 'Loading…',
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  simulateLoad?: boolean
  loadingLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const openMenu = () => {
    setOpen(true)
    if (simulateLoad && !loaded) {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        setLoaded(true)
      }, 700)
    }
  }

  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className={`relative ${open ? 'z-40' : ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`flex w-full items-center justify-between rounded-input border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 ${
          value ? 'border-border text-ink' : 'border-border text-muted'
        }`}
      >
        <span>{value || placeholder}</span>
        <IconChevronDown className="text-muted" width={16} height={16} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-input border border-border bg-surface shadow-soft">
          <div className="relative border-b border-border">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to filter"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted">
                <Spinner /> {loadingLabel}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onChange(o)
                    setOpen(false)
                    setQ('')
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-cream"
                >
                  {o}
                  {value === o && <IconCheck className="text-brand" width={15} height={15} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Multi-select with search + selected chips ──────────────────────────────
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  groupBy,
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder: string
  groupBy?: (opt: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o])

  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
  const allSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o))
  const toggleAll = () =>
    allSelected
      ? onChange(selected.filter((s) => !filtered.includes(s)))
      : onChange([...new Set([...selected, ...filtered])])
  const groups = groupBy
    ? filtered.reduce<Record<string, string[]>>((acc, o) => {
        const g = groupBy(o)
        ;(acc[g] ??= []).push(o)
        return acc
      }, {})
    : { '': filtered }

  return (
    <div className={`space-y-2 ${open ? 'relative z-40' : ''}`}>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-input border border-border bg-surface px-3 py-2.5 text-sm text-muted outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
        >
          <span>{selected.length ? `${selected.length} selected` : placeholder}</span>
          <IconChevronDown className="text-muted" width={16} height={16} />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-input border border-border bg-surface shadow-soft">
            <div className="relative border-b border-border">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type to filter"
                className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none"
              />
            </div>
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs text-muted">{filtered.length} available</span>
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={toggleAll}
                className="text-xs font-medium text-brand hover:underline disabled:text-muted disabled:no-underline"
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted">No matches</div>
              ) : (
                Object.entries(groups).map(([g, items]) => (
                  <div key={g}>
                    {g && (
                      <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{g}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const allIn = items.every((o) => selected.includes(o))
                            if (allIn) onChange(selected.filter((s) => !items.includes(s)))
                            else onChange([...new Set([...selected, ...items])])
                          }}
                          className="text-[11px] font-medium text-brand hover:underline"
                        >
                          {items.every((o) => selected.includes(o)) ? 'Clear' : 'All'}
                        </button>
                      </div>
                    )}
                    {items.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => toggle(o)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-cream"
                      >
                        {o}
                        {selected.includes(o) && <IconCheck className="text-brand" width={15} height={15} />}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs text-ink">
              {s}
              <button onClick={() => toggle(s)} className="text-muted hover:text-danger">
                <IconX width={12} height={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
