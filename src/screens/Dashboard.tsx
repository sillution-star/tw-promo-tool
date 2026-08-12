import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { StatusPill } from '../components/ui/StatusPill'
import { IconPlus, IconSearch, IconChevronDown, IconAlert, IconCopy } from '../components/ui/icons'
import { formatDate, daysUntil, isExpiring } from '../lib/format'
import { MANUFACTURERS, STATES_CITIES } from '../data/seed'
import type { Promo } from '../data/types'

const PAGE_SIZE = 25

type StatusChip = 'Pending' | 'Rejected' | 'Expiring' | 'Loss-making' | 'Live' | 'Draft'
const STATUS_CHIPS: StatusChip[] = ['Pending', 'Rejected', 'Expiring', 'Loss-making', 'Live', 'Draft']

const isLossMaking = (p: Promo) => p.margin !== null && p.margin < p.benchmark

// ── Summary cards ────────────────────────────────────────────────────────
function SummaryCards({
  promos,
  active,
  onPick,
}: {
  promos: Promo[]
  active: StatusChip | null
  onPick: (c: StatusChip | null) => void
}) {
  const cards: { label: string; chip: StatusChip; count: number }[] = [
    { label: 'Live', chip: 'Live', count: promos.filter((p) => p.status === 'Live').length },
    { label: 'Pending', chip: 'Pending', count: promos.filter((p) => p.status === 'Pending' || p.status === 'Resubmitted').length },
    { label: 'Approved', chip: 'Live', count: promos.filter((p) => p.status === 'Approved').length },
    { label: 'Rejected', chip: 'Rejected', count: promos.filter((p) => p.status === 'Rejected').length },
    { label: 'Expiring', chip: 'Expiring', count: promos.filter((p) => isExpiring(p.expiry)).length },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const isActive = active === c.chip && active !== null
        return (
          <button
            key={c.label}
            onClick={() => onPick(isActive ? null : c.chip)}
            className={`rounded-card border bg-surface px-5 py-4 text-left shadow-card transition-all ${
              isActive ? 'border-brand/40 ring-2 ring-brand/10' : 'border-border hover:border-[#D8D0BF]'
            }`}
          >
            <div className="font-serif text-3xl leading-none tabular text-ink">{c.count}</div>
            <div className="mt-2 text-sm text-muted">{c.label}</div>
          </button>
        )
      })}
    </div>
  )
}

// ── Attribute dropdown ───────────────────────────────────────────────────
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`peer appearance-none rounded-input border bg-surface py-2 pl-3 pr-9 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 ${
          value ? 'border-brand/30 text-ink' : 'border-border text-muted'
        }`}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <IconChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        width={15}
        height={15}
      />
    </div>
  )
}

// ── Table ────────────────────────────────────────────────────────────────
function MarginCell({ promo }: { promo: Promo }) {
  if (promo.margin === null) return <span className="text-muted">—</span>
  const loss = isLossMaking(promo)
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-sm tabular ${
        loss ? 'bg-danger-bg text-danger' : 'text-ink'
      }`}
    >
      {promo.margin.toFixed(1)}%
    </span>
  )
}

function ExpiryCell({ promo }: { promo: Promo }) {
  if (!promo.expiry) return <span className="text-muted">—</span>
  const expiring = isExpiring(promo.expiry)
  const left = daysUntil(promo.expiry)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-ink/80">{formatDate(promo.expiry)}</span>
      {expiring && (
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">
          {left} {left === 1 ? 'day' : 'days'} left
        </span>
      )}
    </span>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-t border-border">
          {Array.from({ length: 5 }).map((__, j) => (
            <td key={j} className="px-5 py-4">
              <div className={`skeleton h-3.5 rounded ${j === 0 ? 'w-48' : 'w-24'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────
export function Dashboard({ onCreate, onOpen }: { onCreate?: () => void; onOpen?: (p: Promo) => void }) {
  const { promos, startClonePromo } = useApp()
  const [loading, setLoading] = useState(true)
  const [cloningId, setCloningId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusChip, setStatusChip] = useState<StatusChip | null>(null)
  const [filters, setFilters] = useState({ state: '', city: '', zone: '', manufacturer: '', group: '' })
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650)
    return () => clearTimeout(t)
  }, [])

  const draftCount = promos.filter((p) => p.status === 'Draft').length

  const cityOptions = useMemo(() => {
    if (filters.state) return STATES_CITIES[filters.state] ?? []
    return Object.values(STATES_CITIES).flat()
  }, [filters.state])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return promos
      .filter((p) => {
        if (q && !`${p.name} ${p.id} ${p.scheme}`.toLowerCase().includes(q)) return false
        if (statusChip === 'Pending' && !(p.status === 'Pending' || p.status === 'Resubmitted')) return false
        if (statusChip === 'Rejected' && p.status !== 'Rejected') return false
        if (statusChip === 'Live' && p.status !== 'Live') return false
        if (statusChip === 'Draft' && p.status !== 'Draft') return false
        if (statusChip === 'Expiring' && !isExpiring(p.expiry)) return false
        if (statusChip === 'Loss-making' && !isLossMaking(p)) return false
        if (filters.state && p.state !== filters.state) return false
        if (filters.city && p.city !== filters.city) return false
        if (filters.zone && p.zone !== filters.zone) return false
        if (filters.manufacturer && p.manufacturer !== filters.manufacturer) return false
        if (filters.group && p.group !== filters.group) return false
        return true
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) // newest first
  }, [promos, query, statusChip, filters])

  const hasFilters =
    !!query || !!statusChip || Object.values(filters).some(Boolean)

  const clearAll = () => {
    setQuery('')
    setStatusChip(null)
    setFilters({ state: '', city: '', zone: '', manufacturer: '', group: '' })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  // True empty state — no promos at all
  if (!loading && promos.length === 0) {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <h2 className="font-serif text-2xl text-ink">No promos yet</h2>
        <p className="mt-2 text-muted">Create your first promo to get started.</p>
        <button
          onClick={onCreate}
          className="mt-6 inline-flex items-center gap-2 rounded-input bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-[#86162a]"
        >
          <IconPlus width={18} height={18} /> Create New Promo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Greeting + primary action */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Good morning, Rajesh</p>
          <h1 className="mt-0.5 font-serif text-3xl leading-tight text-ink">Dashboard</h1>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex shrink-0 items-center gap-2 rounded-input bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-[#86162a]"
        >
          <IconPlus width={18} height={18} /> Create New Promo
        </button>
      </div>

      {/* Drafts banner */}
      {draftCount > 0 && (
        <div className="flex items-center justify-between rounded-card border border-border bg-warning-bg/50 px-4 py-3 text-sm">
          <span className="text-ink/80">
            You have {draftCount} {draftCount === 1 ? 'draft' : 'drafts'} in progress.
          </span>
          <button
            onClick={() => setStatusChip('Draft')}
            className="font-medium text-brand hover:underline"
          >
            Continue
          </button>
        </div>
      )}

      {/* Summary cards */}
      <SummaryCards promos={promos} active={statusChip} onPick={(c) => { setStatusChip(c); setPage(1) }} />

      {/* Search */}
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width={18} height={18} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          placeholder="Search by name, ID, or scheme"
          className="w-full rounded-input border border-border bg-surface py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
        />
      </div>

      {/* Filter set 1 — Status chips */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map((chip) => {
          const on = statusChip === chip
          return (
            <button
              key={chip}
              onClick={() => { setStatusChip(on ? null : chip); setPage(1) }}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                on
                  ? 'border-brand bg-brand text-white'
                  : 'border-border bg-surface text-ink/70 hover:border-[#D8D0BF]'
              }`}
            >
              {chip}
            </button>
          )
        })}
      </div>

      {/* Filter set 2 — Attribute dropdowns */}
      <div className="flex flex-wrap items-center gap-3">
        <Select label="State" value={filters.state} options={Object.keys(STATES_CITIES)} onChange={(v) => { setFilters((f) => ({ ...f, state: v, city: '' })); setPage(1) }} />
        <Select label="City" value={filters.city} options={cityOptions} onChange={(v) => { setFilters((f) => ({ ...f, city: v })); setPage(1) }} />
        <Select label="Zone" value={filters.zone} options={['West', 'South']} onChange={(v) => { setFilters((f) => ({ ...f, zone: v })); setPage(1) }} />
        <Select label="Manufacturer" value={filters.manufacturer} options={[...MANUFACTURERS]} onChange={(v) => { setFilters((f) => ({ ...f, manufacturer: v })); setPage(1) }} />
        <Select label="Promo Group" value={filters.group} options={['Manufacturer', 'Competitive']} onChange={(v) => { setFilters((f) => ({ ...f, group: v })); setPage(1) }} />
        {hasFilters && (
          <button onClick={clearAll} className="text-sm font-medium text-muted hover:text-ink">
            Clear filters
          </button>
        )}
      </div>

      {/* Promo list */}
      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-5 py-3 font-medium">Promo Name</th>
              <th className="px-5 py-3 font-medium">Scheme</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Margin</th>
              <th className="px-5 py-3 font-medium">Expiry</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <IconAlert className="text-muted" width={22} height={22} />
                    <p className="mt-3 text-ink/80">No promos match these filters.</p>
                    <button onClick={clearAll} className="mt-2 text-sm font-medium text-brand hover:underline">
                      Clear filters?
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onOpen?.(p)}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-cream/60"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted">{p.id}</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-ink/80">{p.scheme}</td>
                  <td className="px-5 py-4"><StatusPill status={p.status} /></td>
                  <td className="px-5 py-4"><MarginCell promo={p} /></td>
                  <td className="px-5 py-4"><ExpiryCell promo={p} /></td>
                  <td className="px-5 py-4 text-right">
                    {cloningId === p.id ? (
                      <span className="text-xs text-muted animate-pulse">Cloning…</span>
                    ) : (
                      <button
                        title="Clone this promo"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCloningId(p.id)
                          setTimeout(() => {
                            startClonePromo(p.id)
                            setCloningId(null)
                          }, 700)
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:bg-cream hover:text-ink"
                      >
                        <IconCopy width={13} height={13} /> Clone
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted">
            <span>
              {filtered.length} {filtered.length === 1 ? 'promo' : 'promos'}
              {hasFilters && ' (filtered)'}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
                className="rounded-md px-3 py-1 disabled:opacity-40 enabled:hover:bg-cream"
              >
                Prev
              </button>
              <span className="px-2 text-ink/70">
                Page {current} of {totalPages}
              </span>
              <button
                disabled={current >= totalPages}
                onClick={() => setPage(current + 1)}
                className="rounded-md px-3 py-1 disabled:opacity-40 enabled:hover:bg-cream"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
