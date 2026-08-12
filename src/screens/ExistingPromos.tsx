import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { StatusPill } from '../components/ui/StatusPill'
import { IconSearch, IconChevronDown } from '../components/ui/icons'
import { formatDate } from '../lib/format'
import { MANUFACTURERS, SCHEMES, STATES_CITIES } from '../data/seed'
import { BulkUploadView } from './BulkUploadView'
import type { Promo } from '../data/types'

const PAGE_SIZE = 10

// ── Pagination (same as Inbox) ────────────────────────────────────────────────
function getPageRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  if (current > 3) pages.push('ellipsis')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('ellipsis')
  pages.push(total)
  return pages
}

function Pagination({ page, totalPages, total, onChange }: {
  page: number; totalPages: number; total: number; onChange: (p: number) => void
}) {
  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  const range = getPageRange(page, totalPages)
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <span className="text-xs text-muted">Showing {start}–{end} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 1} onClick={() => onChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm text-muted transition hover:border-brand/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >←</button>
        {range.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-muted">…</span>
          ) : (
            <button
              key={p} onClick={() => onChange(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition ${
                p === page ? 'bg-brand text-white' : 'border border-border text-ink hover:border-brand/40 hover:bg-cream'
              }`}
            >{p}</button>
          ),
        )}
        <button
          disabled={page === totalPages} onClick={() => onChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm text-muted transition hover:border-brand/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >→</button>
      </div>
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterSelect({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-input border border-border bg-surface py-2 pl-3 pr-8 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 ${value ? 'text-ink' : 'text-muted'}`}
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" width={14} height={14} />
    </div>
  )
}

// ── Promo row ─────────────────────────────────────────────────────────────────
function PromoRow({ promo, onClick }: { promo: Promo; onClick: () => void }) {
  const below = promo.margin != null && promo.margin < promo.benchmark
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-border transition last:border-0 hover:bg-cream/40"
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-muted">{promo.id}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${promo.status === 'Deactivated' ? 'text-muted' : 'text-ink'}`}>{promo.name}</span>
          {promo.status === 'Deactivated' && <StatusPill status="Deactivated" />}
          {promo.pendingEdit && promo.status !== 'Deactivated' && (
            <span className="inline-flex items-center rounded-full bg-[#FFF3E0] px-2 py-0.5 text-[10px] font-medium text-[#B94500]">
              Edit pending
            </span>
          )}
          {promo.editRejectedReason && !promo.pendingEdit && promo.status !== 'Deactivated' && (
            <span className="inline-flex items-center rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-medium text-danger">
              Edit rejected
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted">{promo.scheme}</div>
      </td>
      <td className="px-4 py-3 text-sm text-ink">{promo.manufacturer}</td>
      <td className="px-4 py-3 text-sm text-ink">{promo.state}</td>
      <td className="px-4 py-3">
        <span className={`font-mono text-sm tabular ${below ? 'text-danger' : 'text-ink'}`}>
          {promo.margin?.toFixed(1) ?? '—'}%
        </span>
        {below && (
          <span className="ml-1.5 rounded-full bg-danger-bg px-1.5 py-0.5 text-[10px] font-medium text-danger">↓</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted">{formatDate(promo.expiry)}</td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-medium text-brand hover:underline">
          View →
        </span>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ExistingPromos({ initialTab = 'Edit Promo' }: { initialTab?: string }) {
  const { promos, role, navigate } = useApp()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [search, setSearch] = useState('')
  const [filterScheme, setFilterScheme] = useState('')
  const [filterMfr, setFilterMfr] = useState('')
  const [filterState, setFilterState] = useState('')
  const [page, setPage] = useState(1)

  // Sync tab from prop (e.g. when navigating from Bulk Upload done)
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  const livePromos = useMemo(() => {
    const q = search.toLowerCase()
    return promos
      .filter((p) => p.status === 'Live' || (role === 'admin' && p.status === 'Deactivated'))
      .filter((p) => {
        if (q && !p.id.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return false
        if (filterScheme && p.scheme !== filterScheme) return false
        if (filterMfr && p.manufacturer !== filterMfr) return false
        if (filterState && p.state !== filterState) return false
        return true
      })
  }, [promos, search, filterScheme, filterMfr, filterState])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, filterScheme, filterMfr, filterState])

  const totalPages = Math.ceil(livePromos.length / PAGE_SIZE) || 1
  const slice = livePromos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const schemeNames = SCHEMES.map((s) => s.name)
  const stateNames = Object.keys(STATES_CITIES)

  const TABS = ['Edit Promo', 'Bulk Upload']

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl text-ink">Existing Promos</h1>

      {/* Tab bar */}
      <div className="flex gap-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative -mb-px border-b-2 pb-3 pt-1 text-sm font-medium transition ${
              activeTab === tab ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Edit Promo tab ── */}
      {activeTab === 'Edit Promo' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID or name…"
                className="rounded-input border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 w-64"
              />
            </div>
            <FilterSelect label="All Schemes" value={filterScheme} options={schemeNames} onChange={setFilterScheme} />
            <FilterSelect label="All Manufacturers" value={filterMfr} options={[...MANUFACTURERS]} onChange={setFilterMfr} />
            <FilterSelect label="All States" value={filterState} options={stateNames} onChange={setFilterState} />
            {(search || filterScheme || filterMfr || filterState) && (
              <button
                onClick={() => { setSearch(''); setFilterScheme(''); setFilterMfr(''); setFilterState('') }}
                className="text-sm text-muted hover:text-ink"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          {livePromos.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-surface/60 px-5 py-12 text-center text-sm text-muted">
              {search || filterScheme || filterMfr || filterState
                ? 'No live promos match your filters.'
                : 'No live promos yet.'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-cream/60 text-left text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name / Scheme</th>
                    <th className="px-4 py-3">Manufacturer</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Margin</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {slice.map((p) => (
                    <PromoRow
                      key={p.id}
                      promo={p}
                      onClick={() => navigate({ name: 'admin-promo', promoId: p.id })}
                    />
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="px-4 pb-4">
                  <Pagination page={page} totalPages={totalPages} total={livePromos.length} onChange={setPage} />
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted">
            {livePromos.length} promo{livePromos.length !== 1 ? 's' : ''} · click any row to view details and history
          </p>
        </div>
      )}

      {/* ── Bulk Upload tab ── */}
      {activeTab === 'Bulk Upload' && <BulkUploadView />}
    </div>
  )
}
