import { useState, useMemo, Fragment } from 'react'
import { useApp } from '../../store/AppContext'
import { IconSearch, IconX } from '../../components/ui/icons'

// ── Types ─────────────────────────────────────────────────────────────────

interface AuditRow {
  at: string
  entity: string        // e.g. "Promo" or master name
  entityId: string
  entityName: string
  action: string
  by: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  reason?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

const ACTION_COLOURS: Record<string, string> = {
  Created:     'bg-[#EAF6EE] text-[#1A7A3E]',
  Edited:      'bg-[#EEF1F8] text-[#1C2B5E]',
  Submitted:   'bg-[#EEF1F8] text-[#1C2B5E]',
  Approved:    'bg-[#EAF6EE] text-[#1A7A3E]',
  Rejected:    'bg-[#FDF2F3] text-[#BE2134]',
  Deactivated: 'bg-[#F5F5F5] text-[#888]',
  Reactivated: 'bg-[#EAF6EE] text-[#1A7A3E]',
  'Sent for rework': 'bg-[#FEF9EC] text-[#8B5E00]',
  Resubmitted: 'bg-[#EEF1F8] text-[#1C2B5E]',
  Cloned:      'bg-[#F5F0FF] text-[#6B3FA0]',
  'Auto-expired': 'bg-[#F5F5F5] text-[#888]',
}

function ActionChip({ action }: { action: string }) {
  const cls = ACTION_COLOURS[action] ?? 'bg-cream text-muted'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {action}
    </span>
  )
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function downloadCsv(rows: AuditRow[]) {
  const headers = ['Timestamp', 'Entity', 'Entity ID', 'Name', 'Action', 'By', 'Reason']
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      `"${r.at}"`,
      `"${r.entity}"`,
      `"${r.entityId}"`,
      `"${r.entityName}"`,
      `"${r.action}"`,
      `"${r.by}"`,
      `"${r.reason ?? ''}"`,
    ].join(','))
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const MASTER_LABELS: Record<string, string> = {
  profComponents: 'Profitability Component',
  profValues: 'Profitability Value',
  states: 'State',
  cities: 'City',
  manufacturers: 'Manufacturer',
  makes: 'Make',
  models: 'Model',
  salesPoints: 'Sales Point',
  approvalMatrix: 'Approval Matrix',
  users: 'User / Role',
  reasonCodes: 'Reason Code',
  chargeSchedules: 'Schedule of Charges',
}

// ── Main component ─────────────────────────────────────────────────────────

export function AuditLog() {
  const { promos, masters } = useApp()

  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState('All')
  const [filterAction, setFilterAction] = useState('All')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // ── Build combined rows ─────────────────────────────────────────────────

  const allRows = useMemo<AuditRow[]>(() => {
    const rows: AuditRow[] = []

    // Promo history
    for (const promo of promos) {
      for (const h of promo.history) {
        rows.push({
          at: h.at,
          entity: 'Promo',
          entityId: promo.id,
          entityName: promo.name,
          action: h.event,
          by: h.by,
          reason: h.reason,
        })
      }
    }

    // Master history
    for (const [key, entries] of Object.entries(masters)) {
      const label = MASTER_LABELS[key] ?? key
      for (const entry of entries as Array<{ id: string; history: Array<{ at: string; by: string; action: string; before?: Record<string, unknown>; after?: Record<string, unknown> }> } & Record<string, unknown>>) {
        const entryName = String(entry.name ?? entry.code ?? entry.chargeCode ?? entry.employeeId ?? entry.id)
        for (const h of entry.history) {
          rows.push({
            at: h.at,
            entity: label,
            entityId: entry.id,
            entityName: entryName,
            action: h.action,
            by: h.by,
            before: h.before,
            after: h.after,
          })
        }
      }
    }

    // Sort newest first
    return rows.sort((a, b) => b.at.localeCompare(a.at))
  }, [promos, masters])

  // ── Unique filter options ───────────────────────────────────────────────

  const entityOptions = useMemo(() => {
    const s = new Set(allRows.map(r => r.entity))
    return ['All', ...Array.from(s).sort()]
  }, [allRows])

  const actionOptions = useMemo(() => {
    const s = new Set(allRows.map(r => r.action))
    return ['All', ...Array.from(s).sort()]
  }, [allRows])

  // ── Filter ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allRows.filter(r => {
      if (q && !r.entityName.toLowerCase().includes(q) && !r.entityId.toLowerCase().includes(q) && !r.by.toLowerCase().includes(q)) return false
      if (filterEntity !== 'All' && r.entity !== filterEntity) return false
      if (filterAction !== 'All' && r.action !== filterAction) return false
      if (filterFrom && r.at < filterFrom) return false
      if (filterTo && r.at > filterTo + 'T23:59:59') return false
      return true
    })
  }, [allRows, search, filterEntity, filterAction, filterFrom, filterTo])

  const clearFilters = () => {
    setSearch(''); setFilterEntity('All'); setFilterAction('All')
    setFilterFrom(''); setFilterTo('')
  }
  const hasFilters = search || filterEntity !== 'All' || filterAction !== 'All' || filterFrom || filterTo

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">Audit Log</h1>
          <p className="mt-1 text-sm text-muted">
            Every action on promos and master data — append-only, never editable.
          </p>
        </div>
        <button
          onClick={() => downloadCsv(filtered)}
          className="flex shrink-0 items-center gap-2 rounded-card border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-cream"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={14} height={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, ID, or actor…"
            className="w-full rounded-card border border-border bg-bg py-2 pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
          />
        </div>

        {/* Entity */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">Entity</label>
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="rounded-card border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {entityOptions.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>

        {/* Action */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">Action</label>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="rounded-card border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {actionOptions.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">From</label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="rounded-card border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">To</label>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="rounded-card border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 rounded-card border border-border px-3 py-2 text-sm text-muted hover:text-danger">
            <IconX width={12} height={12} /> Clear
          </button>
        )}
      </div>

      {/* Count */}
      <div className="text-sm text-muted">
        {filtered.length === allRows.length
          ? `${allRows.length} total entries`
          : `${filtered.length} of ${allRows.length} entries`}
        <span className="ml-2 text-[11px] text-muted/60">· Append-only · Read-only</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-card border border-border bg-surface py-16 text-center text-sm text-muted">
          No entries match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-bg">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">Timestamp</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">Entity</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">Name / ID</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">Action</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">By</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const key = `${row.at}-${row.entityId}-${row.action}-${i}`
                const isExpanded = expanded === key
                const hasDetail = row.reason || row.before || row.after
                return (
                  <Fragment key={key}>
                    <tr
                      className={`border-b border-border transition-colors ${hasDetail ? 'cursor-pointer hover:bg-cream/40' : ''} ${isExpanded ? 'bg-cream/30' : ''}`}
                      onClick={() => hasDetail && setExpanded(isExpanded ? null : key)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted font-variant-numeric tabular-nums">
                        {fmtDate(row.at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded border border-border bg-bg px-2 py-0.5 text-[11px] font-medium text-muted">
                          {row.entity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{row.entityName}</div>
                        <div className="text-[11px] text-muted">{row.entityId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ActionChip action={row.action} />
                      </td>
                      <td className="px-4 py-3 text-sm text-ink">{row.by}</td>
                      <td className="px-4 py-3 text-right">
                        {hasDetail && (
                          <span className="text-[11px] text-muted hover:text-brand">
                            {isExpanded ? '▲ less' : '▼ more'}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasDetail && (
                      <tr className="border-b border-border bg-cream/20">
                        <td colSpan={6} className="px-4 pb-3 pt-0">
                          <div className="space-y-2 pl-2 text-sm">
                            {row.reason && (
                              <div className="flex items-start gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted w-16 shrink-0 pt-0.5">Reason</span>
                                <span className="text-ink">{row.reason}</span>
                              </div>
                            )}
                            {row.before && (
                              <div className="flex items-start gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted w-16 shrink-0 pt-0.5">Before</span>
                                <span className="font-mono text-[11px] text-muted break-all">{JSON.stringify(row.before)}</span>
                              </div>
                            )}
                            {row.after && (
                              <div className="flex items-start gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted w-16 shrink-0 pt-0.5">After</span>
                                <span className="font-mono text-[11px] text-ink break-all">{JSON.stringify(row.after)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
