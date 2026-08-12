import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../../store/AppContext'
import { getReportConfig, EMPTY_FILTERS, AUDIT_ENTITY_OPTIONS, AUDIT_ACTION_OPTIONS, OPERATION_TYPES, OUTCOME_OPTIONS, type ReportFilters, type ColDef, type ReportRow } from './reportConfigs'
import { MANUFACTURERS, SCHEMES, STATES_CITIES } from '../../data/seed'
import { formatDate, formatINR } from '../../lib/format'
import { IconSearch, IconChevronDown, IconX } from '../../components/ui/icons'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25
const WARN_ROWS  = 1000

const STATUS_VALUES = ['Draft', 'Pending', 'Resubmitted', 'Approved', 'Rejected', 'Rework', 'Live', 'Expired', 'Deactivated']

const STATUS_CHIP: Record<string, string> = {
  Live:        'bg-[#EAF6EE] text-[#1A7A3E]',
  Approved:    'bg-[#EAF6EE] text-[#1A7A3E]',
  Pending:     'bg-[#EEF1F8] text-[#1C2B5E]',
  Resubmitted: 'bg-[#EEF1F8] text-[#1C2B5E]',
  Rejected:    'bg-[#FDF2F3] text-[#BE2134]',
  Rework:      'bg-[#FEF9EC] text-[#8B5E00]',
  Draft:       'bg-cream text-muted',
  Expired:     'bg-[#F5F5F5] text-[#888]',
  Deactivated: 'bg-[#F5F5F5] text-[#888]',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayValue(val: string | number | null, type?: ColDef['type']): string {
  if (val === null || val === undefined) return '—'
  switch (type) {
    case 'currency': return typeof val === 'number' ? formatINR(val) : String(val)
    case 'pct':      return typeof val === 'number' ? `${val.toFixed(1)}%` : String(val)
    case 'count':    return typeof val === 'number' ? val.toLocaleString('en-IN') : String(val)
    case 'date':     return typeof val === 'string' ? formatDate(val) : String(val)
    default:         return String(val)
  }
}

function sortValue(val: string | number | null, type?: ColDef['type']): string | number {
  if (val === null || val === undefined) return ''
  if (type === 'currency' || type === 'pct' || type === 'count' || type === 'number') {
    return typeof val === 'number' ? val : 0
  }
  return String(val).toLowerCase()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

function downloadCsv(rows: ReportRow[], cols: ColDef[], name: string) {
  const headers = cols.map(c => `"${c.label}"`).join(',')
  const body = rows.map(r =>
    cols.map(c => {
      const v = displayValue(r[c.key], c.type)
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  ).join('\n')
  downloadBlob(new Blob([`${headers}\n${body}`], { type: 'text/csv' }), `${name}-${new Date().toISOString().slice(0,10)}.csv`)
}

function downloadExcel(rows: ReportRow[], cols: ColDef[], name: string) {
  const ths = cols.map(c => `<th>${c.label}</th>`).join('')
  const trs = rows.map(r =>
    `<tr>${cols.map(c => `<td>${displayValue(r[c.key], c.type)}</td>`).join('')}</tr>`
  ).join('')
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`
  downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }), `${name}-${new Date().toISOString().slice(0,10)}.xls`)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none rounded-input border border-border bg-surface py-2 pl-3 pr-8 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 ${value ? 'text-ink' : 'text-muted'}`}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" width={14} height={14} />
    </div>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 inline-block text-[10px] ${active ? 'text-brand' : 'text-muted/40'}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  )
}

function ColumnToggle({ cols, hidden, onToggle, onSelectAll, onDeselectAll, onReset }: {
  cols: ColDef[]
  hidden: Set<string>
  onToggle: (key: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = search.toLowerCase()
  const filtered = q ? cols.filter(c => c.label.toLowerCase().includes(q)) : cols

  // Build ordered groups from the filtered list
  const groupOrder: string[] = []
  const byGroup: Record<string, ColDef[]> = {}
  for (const c of filtered) {
    const g = c.group ?? 'Other'
    if (!groupOrder.includes(g)) groupOrder.push(g)
    ;(byGroup[g] ??= []).push(c)
  }

  const visibleCount = cols.filter(c => !hidden.has(c.key)).length

  function toggleGroup(keys: string[]) {
    const allVisible = keys.every(k => !hidden.has(k))
    keys.forEach(k => {
      if (allVisible !== !hidden.has(k)) onToggle(k)
    })
    if (allVisible) keys.forEach(k => !hidden.has(k) && onToggle(k))
    else keys.forEach(k => hidden.has(k) && onToggle(k))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-card border border-border bg-surface px-3 py-2 text-sm font-medium text-muted hover:text-ink"
      >
        Columns <span className="text-[11px] text-brand">{visibleCount}</span>
        <IconChevronDown width={12} height={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-card border border-border bg-surface shadow-soft">
          {/* Search */}
          <div className="border-b border-border p-2">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" width={12} height={12} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search columns…"
                className="w-full rounded-input border border-border bg-bg py-1.5 pl-7 pr-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
              />
            </div>
          </div>
          {/* Quick actions */}
          <div className="flex items-center gap-0 border-b border-border px-2 py-1.5">
            <button onClick={onSelectAll}   className="rounded px-2 py-1 text-[11px] font-medium text-muted hover:bg-cream hover:text-ink">All</button>
            <button onClick={onDeselectAll} className="rounded px-2 py-1 text-[11px] font-medium text-muted hover:bg-cream hover:text-ink">None</button>
            <button onClick={onReset}       className="rounded px-2 py-1 text-[11px] font-medium text-brand hover:bg-cream">Default</button>
            <span className="ml-auto text-[10px] text-muted/60">{visibleCount} / {cols.length} shown</span>
          </div>
          {/* Grouped list */}
          <div className="max-h-80 overflow-y-auto py-1">
            {groupOrder.length === 0 && (
              <div className="px-4 py-3 text-xs text-muted">No columns match.</div>
            )}
            {groupOrder.map(group => {
              const groupCols = byGroup[group]
              const allGroupOn = groupCols.every(c => !hidden.has(c.key))
              const someGroupOn = groupCols.some(c => !hidden.has(c.key))
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 bg-bg/60 px-3 py-1">
                    <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-muted">{group}</span>
                    <button
                      onClick={() => {
                        if (allGroupOn) groupCols.forEach(c => !hidden.has(c.key) && onToggle(c.key))
                        else groupCols.forEach(c => hidden.has(c.key) && onToggle(c.key))
                      }}
                      className="text-[10px] text-muted hover:text-brand"
                    >
                      {allGroupOn ? 'hide' : someGroupOn ? 'all' : 'show'}
                    </button>
                  </div>
                  {groupCols.map(c => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2 px-4 py-1 text-sm text-ink hover:bg-cream/50">
                      <input
                        type="checkbox"
                        checked={!hidden.has(c.key)}
                        onChange={() => onToggle(c.key)}
                        className="accent-brand"
                      />
                      <span className="text-sm">{c.label}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function GroupByToggle({ options, value, onChange }: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Group by</span>
      <div className="flex rounded-card border border-border bg-surface">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value === value ? '' : opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition first:rounded-l-card last:rounded-r-card ${
              value === opt.value
                ? 'bg-ink text-surface'
                : 'text-muted hover:bg-cream hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {value && (
          <button
            onClick={() => onChange('')}
            className="border-l border-border px-2 py-1.5 text-[11px] text-muted hover:text-danger"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, total, onChange }: {
  page: number; totalPages: number; total: number; onChange: (p: number) => void
}) {
  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <span className="text-xs text-muted">Showing {start}–{end} of {total}</span>
      <div className="flex items-center gap-1">
        <button disabled={page === 1} onClick={() => onChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm text-muted transition hover:border-brand/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >←</button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let p = i + 1
          if (totalPages > 7) {
            if (page <= 4) p = i + 1
            else if (page >= totalPages - 3) p = totalPages - 6 + i
            else p = page - 3 + i
          }
          return (
            <button key={p} onClick={() => onChange(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition ${p === page ? 'bg-brand text-white' : 'border border-border text-ink hover:border-brand/40 hover:bg-cream'}`}
            >{p}</button>
          )
        })}
        <button disabled={page === totalPages} onClick={() => onChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm text-muted transition hover:border-brand/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >→</button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReportView({ reportId }: { reportId: string }) {
  const { promos, masters, navigate } = useApp()
  const config = getReportConfig(reportId)

  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS)
  const [sortKey, setSortKey]   = useState<string>('')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc')
  const [hidden, setHidden]     = useState<Set<string>>(() =>
    new Set(config?.columns.filter(c => c.defaultHidden).map(c => c.key) ?? [])
  )
  const [groupBy, setGroupBy] = useState<string>(config?.defaultGroupBy ?? '')
  const [page, setPage] = useState(1)

  // init sort from config
  const effectiveSortKey = sortKey || config?.defaultSortKey || ''
  const effectiveSortDir = sortKey ? sortDir : (config?.defaultSortDir ?? 'asc')

  const stateNames    = Object.keys(STATES_CITIES)
  const schemeNames   = SCHEMES.map(s => s.name)

  const allRows = useMemo<ReportRow[]>(() => {
    if (!config) return []
    return config.getData({ promos, masters }, filters)
  }, [config, promos, masters, filters])

  const sortedRows = useMemo(() => {
    if (!effectiveSortKey && !groupBy) return allRows
    const col = config?.columns.find(c => c.key === effectiveSortKey)
    return [...allRows].sort((a, b) => {
      // Primary: group key (always ascending so group members cluster)
      if (groupBy) {
        const ga = String(a[groupBy] ?? '')
        const gb = String(b[groupBy] ?? '')
        const gcmp = ga.localeCompare(gb)
        if (gcmp !== 0) return gcmp
      }
      // Secondary: user-chosen sort
      if (!effectiveSortKey) return 0
      const av = sortValue(a[effectiveSortKey], col?.type)
      const bv = sortValue(b[effectiveSortKey], col?.type)
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return effectiveSortDir === 'asc' ? cmp : -cmp
    })
  }, [allRows, effectiveSortKey, effectiveSortDir, config, groupBy])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const pageRows   = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const visibleCols = config?.columns.filter(c => !hidden.has(c.key)) ?? []

  function toggleSort(key: string) {
    if (effectiveSortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  function toggleHidden(key: string) {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function selectAllCols()   { setHidden(new Set()) }
  function deselectAllCols() { setHidden(new Set(config?.columns.map(c => c.key) ?? [])) }
  function resetCols()       { setHidden(new Set(config?.columns.filter(c => c.defaultHidden).map(c => c.key) ?? [])) }

  function setFilter<K extends keyof ReportFilters>(key: K, val: string) {
    setFilters(f => ({ ...f, [key]: val }))
    setPage(1)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const hasFilters = Object.values(filters).some(Boolean)
  const filterKeys = config?.filterKeys ?? []

  if (!config) {
    return <div className="mt-20 text-center text-sm text-muted">Report not found.</div>
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 py-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate({ name: 'reports' })}
            className="mb-1 text-xs text-muted hover:text-brand"
          >
            ← All Reports
          </button>
          <h1 className="font-serif text-2xl text-ink">{config.name}</h1>
          <p className="mt-0.5 text-sm text-muted">{config.question}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => downloadCsv(sortedRows, visibleCols, config.name)}
            className="flex items-center gap-1.5 rounded-card border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-cream"
          >
            ↓ CSV
          </button>
          <button
            onClick={() => downloadExcel(sortedRows, visibleCols, config.name)}
            className="flex items-center gap-1.5 rounded-card border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-cream"
          >
            ↓ Excel
          </button>
        </div>
      </div>

      {/* ── Info note (e.g. Performance synthetic data disclaimer) ── */}
      {config.infoNote && (
        <div className="flex items-center gap-2 rounded-card border border-[#B0C8E8] bg-[#EEF4FB] px-4 py-3 text-sm text-[#1C4B7A]">
          <span className="font-semibold">ℹ</span>
          {config.infoNote}
        </div>
      )}

      {/* ── Large-data warning ── */}
      {allRows.length > WARN_ROWS && (
        <div className="flex items-center gap-2 rounded-card border border-[#E8C96A] bg-[#FEF9EC] px-4 py-3 text-sm text-[#8B5E00]">
          <span className="font-semibold">⚠</span>
          {allRows.length.toLocaleString()} rows — consider narrowing the date range before exporting.
        </div>
      )}

      {/* ── Group-by toggle (only when config defines options) ── */}
      {config.groupByOptions && (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-2.5">
          <GroupByToggle
            options={config.groupByOptions}
            value={groupBy}
            onChange={v => { setGroupBy(v); setPage(1) }}
          />
          {groupBy && (
            <span className="text-[11px] text-muted/70">
              · Rows within each group sorted by the column you click
            </span>
          )}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        {filterKeys.includes('batchId') && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">Batch ID</label>
            <input
              value={filters.batchId}
              onChange={e => setFilter('batchId', e.target.value)}
              placeholder="e.g. BLK-0005"
              className="w-36 rounded-card border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </div>
        )}
        {filterKeys.includes('dateFrom') && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">From</label>
            <input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)}
              className="rounded-card border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
          </div>
        )}
        {filterKeys.includes('dateTo') && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">To</label>
            <input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)}
              className="rounded-card border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
          </div>
        )}
        {filterKeys.includes('state') && (
          <FilterSelect label="All States" value={filters.state} options={stateNames} onChange={v => setFilter('state', v)} />
        )}
        {filterKeys.includes('scheme') && (
          <FilterSelect label="All Schemes" value={filters.scheme} options={schemeNames} onChange={v => setFilter('scheme', v)} />
        )}
        {filterKeys.includes('manufacturer') && (
          <FilterSelect label="All Manufacturers" value={filters.manufacturer} options={[...MANUFACTURERS]} onChange={v => setFilter('manufacturer', v)} />
        )}
        {filterKeys.includes('promoGroup') && (
          <FilterSelect label="All Groups" value={filters.promoGroup} options={['Manufacturer', 'Competitive']} onChange={v => setFilter('promoGroup', v)} />
        )}
        {filterKeys.includes('status') && (
          <FilterSelect label="All Statuses" value={filters.status} options={STATUS_VALUES} onChange={v => setFilter('status', v)} />
        )}
        {filterKeys.includes('operationType') && (
          <FilterSelect label="All Operations" value={filters.operationType} options={OPERATION_TYPES} onChange={v => setFilter('operationType', v)} />
        )}
        {filterKeys.includes('outcome') && (
          <FilterSelect label="All Outcomes" value={filters.outcome} options={OUTCOME_OPTIONS} onChange={v => setFilter('outcome', v)} />
        )}
        {filterKeys.includes('entityFilter') && (
          <FilterSelect label="All Entities" value={filters.entityFilter} options={AUDIT_ENTITY_OPTIONS} onChange={v => setFilter('entityFilter', v)} />
        )}
        {filterKeys.includes('actionFilter') && (
          <FilterSelect label="All Actions" value={filters.actionFilter} options={AUDIT_ACTION_OPTIONS} onChange={v => setFilter('actionFilter', v)} />
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 rounded-card border border-border px-3 py-2 text-sm text-muted hover:text-danger">
            <IconX width={12} height={12} /> Clear
          </button>
        )}
        <div className="ml-auto">
          <ColumnToggle
            cols={config.columns}
            hidden={hidden}
            onToggle={toggleHidden}
            onSelectAll={selectAllCols}
            onDeselectAll={deselectAllCols}
            onReset={resetCols}
          />
        </div>
      </div>

      {/* ── Row count ── */}
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {allRows.length === sortedRows.length
            ? `${allRows.length} row${allRows.length !== 1 ? 's' : ''}`
            : `${allRows.length} of ${promos.length} promos match`}
          <span className="ml-2 text-[11px] text-muted/60">· Export mirrors this filtered view</span>
        </span>
        <span className="text-[11px] text-muted">
          {visibleCols.length} of {config.columns.length} columns shown
        </span>
      </div>

      {/* ── Table ── */}
      {allRows.length === 0 ? (
        <div className="rounded-card border border-border bg-surface py-16 text-center">
          <div className="text-sm font-medium text-ink">No results</div>
          <div className="mt-1 text-sm text-muted">
            {hasFilters ? 'Try widening or clearing the filters.' : 'No data available for this report.'}
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-3 text-sm font-medium text-brand hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
          <table className="w-full border-collapse text-sm" style={{ minWidth: `${visibleCols.length * 120}px` }}>
            <thead>
              <tr className="border-b border-border bg-bg">
                {visibleCols.map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-ink"
                  >
                    {col.label}
                    <SortIcon active={effectiveSortKey === col.key} dir={effectiveSortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const prevRow = i > 0 ? pageRows[i - 1] : null
                const isNewGroup = !!groupBy && !!prevRow && prevRow[groupBy] !== row[groupBy]
                return (<tr key={i} className={`border-b border-border last:border-0 hover:bg-cream/30 ${isNewGroup ? 'border-t-2 border-t-brand/20' : ''}`}>
                  {visibleCols.map(col => {
                    const val = row[col.key]
                    const display = displayValue(val, col.type)
                    if (col.type === 'status') {
                      const cls = STATUS_CHIP[String(val)] ?? 'bg-cream text-muted'
                      return (
                        <td key={col.key} className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                            {display}
                          </span>
                        </td>
                      )
                    }
                    if (col.type === 'sla') {
                      const sla = String(val ?? '—')
                      const cls = sla === 'Within SLA'
                        ? 'bg-[#EAF6EE] text-[#1A7A3E]'
                        : sla === 'Breached'
                        ? 'bg-[#FDF2F3] text-[#BE2134]'
                        : 'bg-cream text-muted'
                      return (
                        <td key={col.key} className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                            {sla}
                          </span>
                        </td>
                      )
                    }
                    if (col.type === 'pct') {
                      const num = typeof val === 'number' ? val : null
                      const isNeg = num !== null && num < 0
                      return (
                        <td key={col.key} className={`px-4 py-3 tabular-nums ${isNeg ? 'text-danger' : 'text-ink'}`}>
                          {display}
                        </td>
                      )
                    }
                    const isNumeric = col.type === 'currency' || col.type === 'count' || col.type === 'number'
                    return (
                      <td key={col.key} className={`px-4 py-3 ${isNumeric ? 'tabular-nums text-ink' : 'text-ink'}`}>
                        {display}
                      </td>
                    )
                  })}
                </tr>)
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="px-4 pb-4 pt-2">
              <Pagination page={page} totalPages={totalPages} total={sortedRows.length} onChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
