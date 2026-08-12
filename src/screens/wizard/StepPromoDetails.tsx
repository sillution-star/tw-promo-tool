/**
 * StepPromoDetails — Step 1 of the Create wizard.
 *
 * Single scheme → normal Promo Name + Promo Group fields → "Next: Mapping".
 * Two or more schemes → inline data-entry grid (one row per scheme) with
 * per-row rates, a sliding picker panel for dealers/models, then a Review
 * stage before submitting.
 *
 * The wizard footer (Next button) is hidden during bulk mode via the
 * onBulkModeChange callback to the parent CreateWizard.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext'
import { Button, Field, inputCls } from '../../components/ui/primitives'
import { MultiSelect } from '../../components/ui/SearchableSelect'
import { IconX, IconSearch, IconCheck, IconAlert, IconUpload } from '../../components/ui/icons'
import { PerStateCityPanel } from './pickers'
import {
  SCHEMES,
  SALES_POINTS,
  MODELS,
  CHARGE_OPTIONS,
  MANUFACTURERS,
  STATES_CITIES,
} from '../../data/seed'
import { computeProfit } from '../../lib/profitability'
import type { PromoDetail, PromoGroup, DealerType, ProductType } from '../../data/types'
import { nameTaken } from './validators'

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHEME_NAMES = SCHEMES.map(s => s.name)
const TODAY = '2026-07-17'
const DEFAULT_EXPIRY = '2026-12-31'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BulkRow {
  id: string
  schemeName: string
  group: PromoGroup
  dealerType: DealerType | null
  manufacturers: string[]
  states: string[]
  cities: string[]
  salesPointIds: string[]
  modelNames: string[]
  minAmount: string
  maxAmount: string
  minTenure: number
  maxTenure: number
  flatRate: string
  pfPct: number | null
  pfAmount: number | null
  pddPct: number | null
  pddAmount: number | null
  pffAmount: number
  lmfAmount: number
  dealerPayout: string
  dmiOn: boolean
  dmiAmount: string
  advanceEmi: number
  validFrom: string
  validTo: string
}

type PickerField = 'dealers' | 'models' | 'manufacturers' | 'states'
type PickerTarget = { rowId: string; field: PickerField } | null

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(schemeName: string, group: PromoGroup): BulkRow {
  const scheme = SCHEMES.find(s => s.name === schemeName)
  const tenures = scheme?.tenures ?? [12, 36]
  return {
    id: `br-${Math.random().toString(36).slice(2, 9)}`,
    schemeName,
    group,
    dealerType: null,
    manufacturers: [],
    states: [],
    cities: [],
    salesPointIds: [],
    modelNames: [],
    minAmount: String(scheme?.minAmount ?? 30000),
    maxAmount: String(scheme?.maxAmount ?? 150000),
    minTenure: tenures[0],
    maxTenure: tenures[tenures.length - 1],
    flatRate: String(scheme?.roiMin ?? 12),
    pfPct: 2,
    pfAmount: null,
    pddPct: 1,
    pddAmount: null,
    pffAmount: 500,
    lmfAmount: 300,
    dealerPayout: '4',
    dmiOn: false,
    dmiAmount: '',
    advanceEmi: 0,
    validFrom: TODAY,
    validTo: DEFAULT_EXPIRY,
  }
}

function computeRowMargin(row: BulkRow): {
  margin: number | null
  benchmark: number
  breached: boolean
} {
  const state =
    SALES_POINTS.find(sp => row.salesPointIds.includes(sp.id))?.state ?? 'Maharashtra'
  const detail: PromoDetail = {
    minAmount: parseFloat(row.minAmount) || 0,
    maxAmount: parseFloat(row.maxAmount) || 0,
    minTenure: row.minTenure,
    maxTenure: row.maxTenure,
    flatRate: parseFloat(row.flatRate) || 0,
    pfPct: row.pfPct,
    pfAmount: row.pfAmount,
    pddPct: row.pddPct,
    pddAmount: row.pddAmount,
    pffAmount: row.pffAmount,
    lmfAmount: row.lmfAmount,
    dealerPayout: parseFloat(row.dealerPayout) || 0,
    dmiOn: row.dmiOn,
    dmiAmount: parseFloat(row.dmiAmount) || 0,
    advanceEmi: row.advanceEmi,
    states: [state],
    cities: [],
    salesPointIds: row.salesPointIds,
    modelNames: row.modelNames,
    validFrom: TODAY,
    validTo: DEFAULT_EXPIRY,
  }
  const result = computeProfit(detail)
  const bench = result.benchmark
  if (!result.ok || !result.breakdown) return { margin: null, benchmark: bench, breached: false }
  return { margin: result.breakdown.netPct, benchmark: bench, breached: result.breached ?? false }
}

function buildDetail(row: BulkRow): PromoDetail {
  const state =
    SALES_POINTS.find(sp => row.salesPointIds.includes(sp.id))?.state ?? 'Maharashtra'
  return {
    minAmount: parseFloat(row.minAmount) || 0,
    maxAmount: parseFloat(row.maxAmount) || 0,
    minTenure: row.minTenure,
    maxTenure: row.maxTenure,
    flatRate: parseFloat(row.flatRate) || 0,
    pfPct: row.pfPct,
    pfAmount: row.pfAmount,
    pddPct: row.pddPct,
    pddAmount: row.pddAmount,
    pffAmount: row.pffAmount,
    lmfAmount: row.lmfAmount,
    dealerPayout: parseFloat(row.dealerPayout) || 0,
    dmiOn: row.dmiOn,
    dmiAmount: parseFloat(row.dmiAmount) || 0,
    advanceEmi: row.advanceEmi,
    states: [state],
    cities: row.cities,
    salesPointIds: row.salesPointIds,
    modelNames: row.modelNames,
    validFrom: row.validFrom || TODAY,
    validTo: row.validTo || DEFAULT_EXPIRY,
  }
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── MarginBadge ───────────────────────────────────────────────────────────────

function MarginBadge({ row }: { row: BulkRow }) {
  const { margin, benchmark } = computeRowMargin(row)
  if (margin === null) return <span className="text-[10px] text-muted">—</span>
  const cls =
    margin >= benchmark
      ? 'text-success'
      : margin >= 0
        ? 'text-[#B45309]'
        : 'text-danger'
  return (
    <div className="text-right leading-tight">
      <div className={`text-[11px] font-semibold ${cls}`}>{margin.toFixed(1)}%</div>
      <div className="text-[9px] text-muted">b:{benchmark}%</div>
    </div>
  )
}

// ── PickerDropZone ────────────────────────────────────────────────────────────

function PickerDropZone({ onFile }: { onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault()
        setDrag(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
      onClick={() => ref.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition ${
        drag ? 'border-brand bg-brand/5' : 'border-border bg-surface/60 hover:border-[#D8D0BF]'
      }`}
    >
      <IconUpload width={22} height={22} className="text-muted" />
      <p className="text-sm font-medium text-ink">Drop file here or browse</p>
      <p className="text-xs text-muted">CSV with one ID per row</p>
      <input
        ref={ref}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── PickerPanel ───────────────────────────────────────────────────────────────

function PickerPanel({
  target,
  rows,
  onClose,
  onApply,
}: {
  target: PickerTarget
  rows: BulkRow[]
  onClose: () => void
  onApply: (rowId: string, field: PickerField, selection: string[]) => void
}) {
  const activeRow = rows.find(r => r.id === target?.rowId)
  const field = target?.field ?? 'dealers'

  const [tab, setTab] = useState<'list' | 'upload'>('list')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [uploadErrs, setUploadErrs] = useState<string[]>([])
  const [filterState, setFilterState] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterMfr, setFilterMfr] = useState('')

  // Initialise sel when the target changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!activeRow) return
    const selMap: Record<PickerField, string[]> = {
      dealers: activeRow.salesPointIds,
      models: activeRow.modelNames,
      manufacturers: activeRow.manufacturers,
      states: activeRow.states,
    }
    setSel(selMap[field])
    setQ('')
    setTab('list')
    setUploadErrs([])
    setFilterState('')
    setFilterCity('')
    setFilterMfr('')
  }, [target?.rowId, target?.field]) // intentionally narrow — we want to reset only when the target changes, not on every row edit

  // Cascading filter options for dealer picker — scoped by the row's pre-selected states/manufacturers
  const rowStates = activeRow?.states ?? []
  const rowMfrs = activeRow?.manufacturers ?? []
  const allStates = rowStates.length > 0
    ? rowStates
    : [...new Set(SALES_POINTS.map(sp => sp.state))].sort()
  const allCities = [...new Set(
    SALES_POINTS
      .filter(sp =>
        (rowStates.length === 0 || rowStates.includes(sp.state)) &&
        (!filterState || sp.state === filterState)
      )
      .map(sp => sp.city)
  )].sort()
  if (!target || !activeRow) return null

  // All unique manufacturers / states from seed data
  const allManufacturers = [...new Set(SALES_POINTS.flatMap(sp => sp.manufacturers))].sort()
  const allStatesGlobal = [...new Set(SALES_POINTS.map(sp => sp.state))].sort()

  // Build list items
  const allItems: Array<{ id: string; label: string; sub: string; brands?: string[] }> =
    field === 'dealers'
      ? SALES_POINTS
          .filter(sp =>
            (!activeRow.dealerType || sp.dealerType === activeRow.dealerType) &&
            (activeRow.manufacturers.length === 0 || sp.manufacturers.some(m => activeRow.manufacturers.includes(m))) &&
            (activeRow.states.length === 0 || activeRow.states.includes(sp.state)) &&
            (activeRow.cities.length === 0 || activeRow.cities.includes(sp.city))
          )
          .map(sp => ({
            id: sp.id,
            label: sp.name,
            sub: `${sp.city}, ${sp.state}`,
            brands: activeRow.manufacturers.length > 0
              ? sp.manufacturers.filter(m => activeRow.manufacturers.includes(m))
              : sp.manufacturers,
          }))
      : field === 'models'
      ? Object.entries(MODELS)
          .filter(([mfr]) =>
            (activeRow.manufacturers.length === 0 || activeRow.manufacturers.includes(mfr)) &&
            (!filterMfr || mfr === filterMfr)
          )
          .flatMap(([mfr, models]) => models.map(m => ({ id: m, label: m, sub: mfr })))
      : field === 'manufacturers'
      ? allManufacturers.map(m => ({ id: m, label: m, sub: '' }))
      : /* states */ allStatesGlobal.map(s => ({ id: s, label: s, sub: '' }))

  const filtered = allItems.filter(it => {
    if (field === 'dealers') {
      const sp = SALES_POINTS.find(s => s.id === it.id)
      if (sp) {
        if (filterState && sp.state !== filterState) return false
        if (filterCity && sp.city !== filterCity) return false
        if (filterMfr && !sp.manufacturers.includes(filterMfr)) return false
      }
    }
    if (q) {
      return it.label.toLowerCase().includes(q.toLowerCase()) ||
        it.sub.toLowerCase().includes(q.toLowerCase())
    }
    return true
  })

  const allSel = filtered.length > 0 && filtered.every(it => sel.includes(it.id))
  const toggle = (id: string) =>
    setSel(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  const toggleAll = () =>
    allSel
      ? setSel(prev => prev.filter(id => !filtered.map(it => it.id).includes(id)))
      : setSel(prev => [...new Set([...prev, ...filtered.map(it => it.id)])])

  const handleUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const lines = text.trim().split(/\r?\n/).filter(Boolean).slice(1) // skip header
      const ids: string[] = []
      const errs: string[] = []
      lines.forEach((line, i) => {
        const val = line.split(',')[0].trim()
        if (!val) {
          errs.push(`Row ${i + 2}: empty`)
          return
        }
        if (field === 'dealers') {
          if (!SALES_POINTS.find(sp => sp.id === val)) {
            errs.push(`Row ${i + 2}: "${val}" — sales point not found`)
          } else {
            ids.push(val)
          }
        } else {
          const allModels = Object.values(MODELS).flat()
          if (!allModels.includes(val)) {
            errs.push(`Row ${i + 2}: "${val}" — model not found`)
          } else {
            ids.push(val)
          }
        }
      })
      if (errs.length > 0) {
        setUploadErrs(errs)
      } else {
        setSel(ids)
        setUploadErrs([])
        setTab('list')
      }
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    if (field === 'dealers') {
      const rows = SALES_POINTS.slice(0, 3)
        .map(sp => sp.id)
        .join('\n')
      triggerDownload(`sales_point_id\n${rows}`, 'dealers_template.csv')
    } else {
      const rows = Object.values(MODELS)
        .flat()
        .slice(0, 3)
        .join('\n')
      triggerDownload(`model_name\n${rows}`, 'models_template.csv')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-ink/25 backdrop-blur-[1px]" onClick={onClose} />

      {/* Slide-in panel */}
      <div className="flex h-full w-[440px] flex-col border-l border-border bg-surface shadow-soft">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-medium text-ink">
            {field === 'dealers' ? 'Select Dealers'
              : field === 'models' ? 'Select Models'
              : field === 'manufacturers' ? 'Select Manufacturer'
              : field === 'states' ? 'Select States'
              : 'Select Cities'}
            <span className="ml-1.5 text-sm font-normal text-muted">
              — {activeRow.schemeName}
            </span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted hover:bg-cream hover:text-ink"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        {/* Tabs — upload only for dealers and models */}
        {(field === 'dealers' || field === 'models') && (
          <div className="flex border-b border-border">
            {(['list', 'upload'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 text-sm transition ${
                  tab === t
                    ? 'border-b-2 border-brand font-medium text-brand'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {t === 'list' ? 'Select from list' : 'Upload Excel'}
              </button>
            ))}
          </div>
        )}

        {/* ── List tab ── */}
        {tab === 'list' && (
          <>
            {/* Manufacturer filter for models — only when multiple OEMs selected on the row */}
            {field === 'models' && activeRow.manufacturers.length > 1 && (
              <div className="border-b border-border px-4 py-2">
                <select
                  value={filterMfr}
                  onChange={e => setFilterMfr(e.target.value)}
                  className="w-full rounded-input border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-brand/40"
                >
                  <option value="">All manufacturers</option>
                  {activeRow.manufacturers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* State / City / Manufacturer filters — dealers only */}
            {field === 'dealers' && (
              <div className="border-b border-border px-4 py-2.5 space-y-1.5">
                {rowStates.length > 0 && (
                  <p className="text-[10px] text-muted">
                    Showing dealers in {rowStates.join(', ')}
                    {rowMfrs.length > 0 ? ` · ${rowMfrs.join(', ')}` : ''}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterState}
                    onChange={e => { setFilterState(e.target.value); setFilterCity('') }}
                    className="rounded-input border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-brand/40"
                  >
                    <option value="">{rowStates.length > 0 ? 'All selected states' : 'All States'}</option>
                    {allStates.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    value={filterCity}
                    onChange={e => setFilterCity(e.target.value)}
                    className="rounded-input border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-brand/40"
                  >
                    <option value="">All Cities</option>
                    {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}
            {/* Search */}
            <div className="border-b border-border px-4 py-3">
              <div className="relative">
                <IconSearch
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  width={14}
                  height={14}
                />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={
                    field === 'dealers' ? 'Search dealers…'
                    : field === 'models' ? 'Search models…'
                    : field === 'manufacturers' ? 'Search brands…'
                    : field === 'states' ? 'Search states…'
                    : 'Search cities…'
                  }
                  className="w-full rounded-input border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  autoFocus
                />
              </div>
            </div>

            {/* Select-all bar */}
            <div className="flex items-center justify-between border-b border-border bg-cream/40 px-4 py-2">
              <span className="text-xs text-muted">
                {filtered.length}{' '}
                {field === 'dealers' ? 'dealer'
                  : field === 'models' ? 'model'
                  : field === 'manufacturers' ? 'brand'
                  : field === 'states' ? 'state'
                  : 'city'}
                {filtered.length !== 1 ? 's' : ''} · {sel.length} selected
              </span>
              <button
                onClick={toggleAll}
                disabled={filtered.length === 0}
                className="text-xs font-medium text-brand hover:underline disabled:text-muted disabled:no-underline"
              >
                {allSel ? 'Clear all' : 'Select all'}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">No matches</div>
              ) : (
                filtered.map(item => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-4 py-2.5 last:border-0 hover:bg-cream"
                  >
                    <input
                      type="checkbox"
                      checked={sel.includes(item.id)}
                      onChange={() => toggle(item.id)}
                      className="h-4 w-4 rounded accent-brand"
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-ink">{item.label}</div>
                      {item.sub && <div className="truncate text-xs text-muted">{item.sub}</div>}
                      {item.brands && item.brands.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {item.brands.map(b => (
                            <span key={b} className="rounded-full bg-brand/10 px-1.5 py-0 text-[8px] font-medium text-brand">{b}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Apply footer */}
            <div className="border-t border-border px-4 py-3">
              <button
                onClick={() => {
                  onApply(target.rowId, field, sel)
                  onClose()
                }}
                className="w-full rounded-input bg-brand py-2.5 text-sm font-medium text-white transition hover:bg-[#86162a]"
              >
                Apply{sel.length > 0 ? ` (${sel.length} selected)` : ''}
              </button>
            </div>
          </>
        )}

        {/* ── Upload tab — dealers and models only ── */}
        {tab === 'upload' && (field === 'dealers' || field === 'models') && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            {/* Template */}
            <div className="rounded-card border border-border bg-cream/40 p-4">
              <p className="text-sm font-medium text-ink">Download template</p>
              <p className="mt-0.5 text-xs text-muted">
                {field === 'dealers'
                  ? 'One row per sales point — use the sales_point_id column.'
                  : 'One row per model — use the model_name column.'}
              </p>
              <button
                onClick={downloadTemplate}
                className="mt-3 inline-flex items-center gap-1.5 rounded-input border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/5"
              >
                <IconUpload width={12} height={12} className="rotate-180" /> Download
                template.csv
              </button>
            </div>

            <PickerDropZone onFile={handleUpload} />

            {/* Upload errors */}
            {uploadErrs.length > 0 && (
              <div className="rounded-card border border-danger-bg bg-danger-bg p-4">
                <div className="mb-2 flex items-center gap-2">
                  <IconAlert width={14} height={14} className="text-danger" />
                  <p className="text-sm font-medium text-danger">
                    {uploadErrs.length} error{uploadErrs.length > 1 ? 's' : ''} — fix and
                    re-upload
                  </p>
                </div>
                <ul className="space-y-0.5">
                  {uploadErrs.map((err, i) => (
                    <li key={i} className="text-xs text-danger">
                      • {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── GridRow ───────────────────────────────────────────────────────────────────

function GridRow({
  row,
  onChange,
  onPickerOpen,
  onDealerTypeChange,
}: {
  row: BulkRow
  onChange: (id: string, patch: Partial<BulkRow>) => void
  onPickerOpen: (rowId: string, field: PickerField) => void
  onDealerTypeChange: (rowId: string, newType: DealerType | null) => void
}) {
  const payout = parseFloat(row.dealerPayout) || 0

  const ci = `rounded border px-1.5 py-1 text-xs outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 bg-surface`
  const sel = `rounded border border-border bg-surface px-1 py-0.5 text-xs outline-none focus:border-brand/40`

  return (
    <tr className="border-b border-border last:border-0 hover:bg-cream/20">
      {/* Scheme + group + live summary */}
      <td className="px-2 py-2 min-w-[140px]">
        <div className="flex flex-wrap items-center gap-0.5">
          <span className="inline-block whitespace-nowrap rounded-full bg-cream px-2 py-0.5 text-[10px] font-medium text-ink">
            {row.schemeName}
          </span>
          <span className={`inline-block whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
            row.group === 'Manufacturer' ? 'bg-brand/10 text-brand' : 'bg-[#E8F0FE] text-[#1967D2]'
          }`}>
            {row.group === 'Manufacturer' ? 'MFR' : 'COMP'}
          </span>
        </div>
        {(() => {
          const parts = [
            row.manufacturers.length > 0 ? row.manufacturers.join(', ') : null,
            row.dealerType,
            row.states.length > 0 ? row.states.join(', ') : null,
            row.cities.length > 0 ? `${row.cities.length} cit${row.cities.length === 1 ? 'y' : 'ies'}` : null,
            row.salesPointIds.length > 0 ? `${row.salesPointIds.length} SP${row.salesPointIds.length !== 1 ? 's' : ''}` : null,
            row.modelNames.length > 0 ? `${row.modelNames.length} model${row.modelNames.length !== 1 ? 's' : ''}` : null,
          ].filter(Boolean)
          return parts.length > 0 ? (
            <div className="mt-0.5 max-w-[130px] break-words text-[9px] leading-snug text-muted">
              {parts.join(' · ')}
            </div>
          ) : null
        })()}
      </td>

      {/* Dealer Type — SBO / MBO */}
      <td className="px-1 py-1 text-center">
        <div className="flex gap-0.5 justify-center">
          {(['SBO', 'MBO'] as DealerType[]).map(dt => (
            <button
              key={dt}
              type="button"
              onClick={() => onDealerTypeChange(row.id, row.dealerType === dt ? null : dt)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                row.dealerType === dt
                  ? 'bg-brand text-white'
                  : 'bg-[#ECE7DA] text-muted hover:bg-[#E0D8C8]'
              }`}
            >
              {dt}
            </button>
          ))}
        </div>
        {!row.dealerType && (
          <div className="mt-0.5 text-[9px] text-danger">Required</div>
        )}
      </td>

      {/* Manufacturer — SBO: single inline select · MBO: removable chips + add */}
      <td className="px-1 py-1 min-w-[130px]">
        {row.dealerType === null ? (
          <span className="text-[10px] text-muted/60 italic">← pick type</span>
        ) : row.dealerType === 'SBO' ? (
          <select
            value={row.manufacturers[0] ?? ''}
            onChange={e => onChange(row.id, {
              manufacturers: e.target.value ? [e.target.value] : [],
              cities: [],
              salesPointIds: [],
              modelNames: [],
            })}
            className="w-full rounded border border-border bg-surface px-1 py-0.5 text-xs outline-none focus:border-brand/40"
          >
            <option value="">Select OEM…</option>
            {[...MANUFACTURERS].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <div className="space-y-0.5">
            {row.manufacturers.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {row.manufacturers.map(m => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-0.5 rounded-full bg-cream px-1.5 py-0 text-[9px] text-ink"
                  >
                    {m}
                    <button
                      type="button"
                      onClick={() => onChange(row.id, {
                        manufacturers: row.manufacturers.filter(x => x !== m),
                        cities: [],
                        salesPointIds: [],
                        modelNames: [],
                      })}
                      className="ml-0.5 text-muted hover:text-danger leading-none"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => onPickerOpen(row.id, 'manufacturers')}
              className="inline-flex items-center gap-0.5 rounded border border-dashed border-brand/40 px-1.5 py-0.5 text-[10px] text-brand hover:bg-cream"
            >
              + Add OEM
            </button>
          </div>
        )}
      </td>

      {/* State */}
      <td className="px-1 py-1 text-center">
        <button
          type="button"
          onClick={() => onPickerOpen(row.id, 'states')}
          className="inline-flex items-center gap-0.5 whitespace-nowrap rounded border border-border bg-surface px-2 py-1 text-xs text-brand hover:bg-cream"
        >
          {row.states.length > 0 ? <>{row.states.length} ▸</> : <>+ Add</>}
        </button>
        {row.states.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-0.5 justify-center">
            {row.states.slice(0, 2).map(s => (
              <span key={s} className="rounded-full bg-cream px-1.5 py-0 text-[9px] text-muted">{s}</span>
            ))}
            {row.states.length > 2 && (
              <span className="text-[9px] text-muted">+{row.states.length - 2}</span>
            )}
          </div>
        )}
      </td>

      {/* Valid From */}
      <td className="px-1 py-1">
        <input
          type="date"
          value={row.validFrom}
          onChange={e => onChange(row.id, { validFrom: e.target.value })}
          className={`${ci} border-border`}
        />
      </td>

      {/* Valid To */}
      <td className="px-1 py-1">
        <input
          type="date"
          value={row.validTo}
          min={row.validFrom || undefined}
          onChange={e => onChange(row.id, { validTo: e.target.value })}
          className={`${ci} border-border`}
        />
      </td>

      {/* Dealers */}
      <td className="px-1 py-1 text-center">
        <button
          type="button"
          onClick={() => onPickerOpen(row.id, 'dealers')}
          className="inline-flex items-center gap-0.5 whitespace-nowrap rounded border border-border bg-surface px-2 py-1 text-xs text-brand hover:bg-cream"
        >
          {row.salesPointIds.length > 0 ? (
            <>{row.salesPointIds.length} ▸</>
          ) : (
            <>+ Add</>
          )}
        </button>
      </td>

      {/* Models */}
      <td className="px-1 py-1 text-center">
        <button
          type="button"
          onClick={() => onPickerOpen(row.id, 'models')}
          className="inline-flex items-center gap-0.5 whitespace-nowrap rounded border border-border bg-surface px-2 py-1 text-xs text-brand hover:bg-cream"
        >
          {row.modelNames.length > 0 ? (
            <>{row.modelNames.length} ▸</>
          ) : (
            <>+ Add</>
          )}
        </button>
      </td>

      {/* Loan Min */}
      <td className="px-1 py-1">
        <input
          type="number"
          value={row.minAmount}
          onChange={e => onChange(row.id, { minAmount: e.target.value })}
          className={`${ci} w-20 border-border`}
        />
      </td>

      {/* Loan Max */}
      <td className="px-1 py-1">
        <input
          type="number"
          value={row.maxAmount}
          onChange={e => onChange(row.id, { maxAmount: e.target.value })}
          className={`${ci} w-20 border-border`}
        />
      </td>

      {/* Tenure Min */}
      <td className="px-1 py-1">
        {(() => {
          const tenures = SCHEMES.find(s => s.name === row.schemeName)?.tenures ?? [12, 18, 24, 30, 36, 48]
          return (
            <select
              value={row.minTenure}
              onChange={e => {
                const v = parseInt(e.target.value)
                const patch: Partial<BulkRow> = { minTenure: v }
                if (v >= row.maxTenure) {
                  const nextMax = tenures.find(t => t > v)
                  if (nextMax) patch.maxTenure = nextMax
                }
                onChange(row.id, patch)
              }}
              className={sel}
            >
              {tenures.map(t => (
                <option key={t} value={t}>{t}m</option>
              ))}
            </select>
          )
        })()}
      </td>

      {/* Tenure Max */}
      <td className="px-1 py-1">
        {(() => {
          const tenures = SCHEMES.find(s => s.name === row.schemeName)?.tenures ?? [12, 18, 24, 30, 36, 48]
          return (
            <select
              value={row.maxTenure}
              onChange={e => {
                const v = parseInt(e.target.value)
                const patch: Partial<BulkRow> = { maxTenure: v }
                if (v <= row.minTenure) {
                  const prevMin = [...tenures].reverse().find(t => t < v)
                  if (prevMin) patch.minTenure = prevMin
                }
                onChange(row.id, patch)
              }}
              className={sel}
            >
              {tenures.map(t => (
                <option key={t} value={t}>{t}m</option>
              ))}
            </select>
          )
        })()}
      </td>

      {/* Flat Rate % — scheme ROI range shown as hint */}
      <td className="px-1 py-1">
        {(() => {
          const sch = SCHEMES.find(s => s.name === row.schemeName)
          return (
            <div className="flex flex-col items-center gap-0.5">
              <input
                type="number"
                step="0.1"
                value={row.flatRate}
                onChange={e => onChange(row.id, { flatRate: e.target.value })}
                className={`${ci} w-14 border-border`}
              />
              {sch && (
                <span className="text-[9px] text-muted">{sch.roiMin}–{sch.roiMax}%</span>
              )}
            </div>
          )
        })()}
      </td>

      {/* PF — mutually exclusive % / ₹ */}
      <td className="px-1 py-1">
        <div className="flex flex-col gap-0.5">
          <select
            value={row.pfPct ?? ''}
            title="PF %"
            onChange={e => {
              const v = e.target.value !== '' ? parseFloat(e.target.value) : null
              onChange(row.id, { pfPct: v, pfAmount: v !== null ? null : row.pfAmount })
            }}
            className={sel}
          >
            <option value="">—%</option>
            {CHARGE_OPTIONS.pfPct.map(v => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </select>
          <select
            value={row.pfAmount ?? ''}
            title="PF ₹"
            onChange={e => {
              const v = e.target.value !== '' ? parseFloat(e.target.value) : null
              onChange(row.id, { pfAmount: v, pfPct: v !== null ? null : row.pfPct })
            }}
            className={sel}
          >
            <option value="">—₹</option>
            {CHARGE_OPTIONS.pfAmount.map(v => (
              <option key={v} value={v}>
                ₹{v}
              </option>
            ))}
          </select>
        </div>
      </td>

      {/* PDD — mutually exclusive % / ₹ */}
      <td className="px-1 py-1">
        <div className="flex flex-col gap-0.5">
          <select
            value={row.pddPct ?? ''}
            title="PDD %"
            onChange={e => {
              const v = e.target.value !== '' ? parseFloat(e.target.value) : null
              onChange(row.id, { pddPct: v, pddAmount: v !== null ? null : row.pddAmount })
            }}
            className={sel}
          >
            <option value="">—%</option>
            {CHARGE_OPTIONS.pddPct.map(v => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </select>
          <select
            value={row.pddAmount ?? ''}
            title="PDD ₹"
            onChange={e => {
              const v = e.target.value !== '' ? parseFloat(e.target.value) : null
              onChange(row.id, { pddAmount: v, pddPct: v !== null ? null : row.pddPct })
            }}
            className={sel}
          >
            <option value="">—₹</option>
            {CHARGE_OPTIONS.pddAmount.map(v => (
              <option key={v} value={v}>
                ₹{v}
              </option>
            ))}
          </select>
        </div>
      </td>

      {/* PFF */}
      <td className="px-1 py-1">
        <select
          value={row.pffAmount}
          onChange={e => onChange(row.id, { pffAmount: parseFloat(e.target.value) })}
          className={sel}
        >
          {CHARGE_OPTIONS.pffAmount.map(v => (
            <option key={v} value={v}>
              ₹{v}
            </option>
          ))}
        </select>
      </td>

      {/* LMF */}
      <td className="px-1 py-1">
        <select
          value={row.lmfAmount}
          onChange={e => onChange(row.id, { lmfAmount: parseFloat(e.target.value) })}
          className={sel}
        >
          {CHARGE_OPTIONS.lmfAmount.map(v => (
            <option key={v} value={v}>
              ₹{v}
            </option>
          ))}
        </select>
      </td>

      {/* Dealer Payout — amber >5%, blocked >10% */}
      <td className="px-1 py-1">
        <div className="flex flex-col items-center gap-0.5">
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={row.dealerPayout}
            onChange={e => {
              if (parseFloat(e.target.value) > 10) return
              onChange(row.id, { dealerPayout: e.target.value })
            }}
            className={`${ci} w-14 text-center ${
              payout > 5 ? 'border-amber-400 bg-amber-50 text-[#B45309]' : 'border-border'
            }`}
          />
          {payout > 5 && payout <= 10 ? (
            <span className="text-[9px] font-semibold text-[#B45309]">High</span>
          ) : (
            <span className="text-[9px] text-muted">incl.GST</span>
          )}
        </div>
      </td>

      {/* DMI toggle + optional amount */}
      <td className="px-1 py-1">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(row.id, { dmiOn: !row.dmiOn })}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
              row.dmiOn
                ? 'bg-brand text-white'
                : 'bg-[#ECE7DA] text-muted hover:bg-[#E0D8C8]'
            }`}
          >
            {row.dmiOn ? 'On' : 'Off'}
          </button>
          {row.dmiOn && (
            <input
              type="number"
              value={row.dmiAmount}
              onChange={e => onChange(row.id, { dmiAmount: e.target.value })}
              placeholder="₹"
              className={`${ci} w-14 border-border text-center`}
            />
          )}
        </div>
      </td>

      {/* Advance EMI */}
      <td className="px-1 py-1">
        <select
          value={row.advanceEmi}
          onChange={e => onChange(row.id, { advanceEmi: Number(e.target.value) })}
          className={`${sel} w-12`}
        >
          {[0, 1, 2, 3, 4].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </td>

      {/* Margin — live, color-coded */}
      <td className="px-2 py-1">
        <MarginBadge row={row} />
      </td>
    </tr>
  )
}

// ── BulkSchemeFlow ────────────────────────────────────────────────────────────

function BulkSchemeFlow({
  selectedSchemes,
  selectedGroups,
  name,
  nameIsValid,
  product,
}: {
  selectedSchemes: string[]
  selectedGroups: PromoGroup[]
  name: string
  nameIsValid: boolean
  product: ProductType | null
}) {
  const { bulkCreatePromos, navigate } = useApp()

  const [rows, setRows] = useState<BulkRow[]>(() =>
    selectedSchemes.flatMap(s => selectedGroups.map(g => makeRow(s, g)))
  )
  const [activePicker, setActivePicker] = useState<PickerTarget>(null)
  const [cityPanelRowId, setCityPanelRowId] = useState<string | null>(null)
  const [stage, setStage] = useState<'grid' | 'review' | 'done'>('grid')
  const [breachReasons, setBreachReasons] = useState<Record<string, string>>({})
  const [createdCount, setCreatedCount] = useState(0)

  // When scheme/group selection changes, sync rows (preserve existing data) and reset to grid stage
  useEffect(() => {
    setRows(prev =>
      selectedSchemes.flatMap(s => selectedGroups.map(g => {
        const existing = prev.find(r => r.schemeName === s && r.group === g)
        return existing ?? makeRow(s, g)
      }))
    )
    setStage('grid')
  }, [selectedSchemes, selectedGroups])

  const [pendingSBOConfirm, setPendingSBOConfirm] = useState<{ rowId: string; currentMfrs: string[] } | null>(null)
  const [keepMfr, setKeepMfr] = useState('')

  const handleDealerTypeChange = useCallback((rowId: string, newType: DealerType | null) => {
    setRows(prev => {
      const row = prev.find(r => r.id === rowId)
      if (!row) return prev
      if (newType === 'SBO' && row.manufacturers.length > 1) {
        // Defer — show confirm dialog outside this callback
        setPendingSBOConfirm({ rowId, currentMfrs: row.manufacturers })
        setKeepMfr(row.manufacturers[0])
        return prev
      }
      return prev.map(r => r.id === rowId ? {
        ...r,
        dealerType: newType,
        manufacturers: newType === 'SBO' ? r.manufacturers.slice(0, 1) : r.manufacturers,
        cities: [],
        salesPointIds: [],
      } : r)
    })
  }, [])

  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const applyPicker = useCallback(
    (rowId: string, field: PickerField, selection: string[]) => {
      const fieldMap: Record<PickerField, keyof BulkRow> = {
        dealers: 'salesPointIds',
        models: 'modelNames',
        manufacturers: 'manufacturers',
        states: 'states',
      }
      setRows(prev =>
        prev.map(r => {
          if (r.id !== rowId) return r
          const base = { ...r, [fieldMap[field]]: selection }
          if (field === 'states') {
            return {
              ...base,
              cities: r.cities.filter(c =>
                selection.some(s => (STATES_CITIES[s] ?? []).includes(c)),
              ),
              salesPointIds: r.salesPointIds.filter(id => {
                const sp = SALES_POINTS.find(x => x.id === id)
                return sp && selection.includes(sp.state)
              }),
            }
          }
          return base
        }),
      )
      if (field === 'states' && selection.length > 0) {
        setCityPanelRowId(rowId)
      }
    },
    [],
  )

  // Grid ready to review: dealers + models + valid payout + valid dates (name is shared above)
  const rowReady = (row: BulkRow) => {
    const payout = parseFloat(row.dealerPayout) || 0
    const datesOk = !!row.validFrom && !!row.validTo && row.validTo > row.validFrom
    return !!row.dealerType && row.manufacturers.length > 0 && row.salesPointIds.length > 0 && row.modelNames.length > 0 && payout > 0 && payout <= 10 && datesOk
  }
  const gridValid = rows.every(rowReady) && nameIsValid
  const readyCount = rows.filter(rowReady).length

  // Compute review data once (used for both Review UI and final submit)
  const reviewData = useMemo(
    () =>
      rows.map(row => {
        const { margin, benchmark, breached } = computeRowMargin(row)
        return {
          ...row,
          margin,
          benchmark,
          breached,
          detail: buildDetail(row),
          highPayout: (parseFloat(row.dealerPayout) || 0) > 5,
        }
      }),
    [rows],
  )

  const breachCount = reviewData.filter(r => r.breached).length
  const allReasonsFilled = reviewData
    .filter(r => r.breached)
    .every(r => (breachReasons[r.id] ?? '').trim().length > 0)

  const handleCreate = () => {
    const batchId = `BATCH-${Date.now()}`
    bulkCreatePromos(
      reviewData.map(r => ({
        schemeName: r.schemeName,
        promoName: name,
        group: r.group,
        product,
        dealerType: r.dealerType ?? 'SBO',
        salesPointIds: r.salesPointIds,
        modelNames: r.modelNames,
        detail: r.detail,
        breachReason: r.breached ? (breachReasons[r.id] ?? '') : '',
        batchId,
      })),
    )
    setCreatedCount(rows.length)
    setStage('done')
  }

  // ── DONE ──────────────────────────────────────────────────────────────────

  if (stage === 'done') {
    return (
      <div className="rounded-card border border-[#D4EDDA] bg-[#F0FBF4] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <IconCheck width={26} height={26} className="text-success" />
        </div>
        <h3 className="mt-4 font-serif text-xl text-ink">
          {createdCount} promo{createdCount > 1 ? 's' : ''} created and sent for approval.
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Each promo is approved and tracked independently. They share a batch reference for
          traceability.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setStage('grid')
              setBreachReasons({})
            }}
          >
            Create another batch
          </Button>
          <Button onClick={() => navigate({ name: 'dashboard' })}>Go to Dashboard</Button>
        </div>
      </div>
    )
  }

  // ── REVIEW ────────────────────────────────────────────────────────────────

  if (stage === 'review') {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-ink">
              Review {rows.length} promo{rows.length > 1 ? 's' : ''}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Confirm each promo before creating.
              {breachCount > 0 && (
                <span className="ml-1 text-[#B45309]">
                  {breachCount} breach{breachCount > 1 ? 'es' : ''} — a reason is required for
                  each.
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setStage('grid')}
            className="shrink-0 text-sm font-medium text-brand hover:underline"
          >
            ← Edit grid
          </button>
        </div>

        <div className="space-y-3">
          {reviewData.map(r => (
            <div
              key={r.id}
              className={`rounded-card border p-4 ${
                r.breached ? 'border-[#E7CFA6] bg-warning-bg/40' : 'border-border bg-surface'
              }`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{name}</span>
                    <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-muted">
                      {r.schemeName}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.group === 'Manufacturer' ? 'bg-brand/10 text-brand' : 'bg-[#E8F0FE] text-[#1967D2]'
                    }`}>
                      {r.group}
                    </span>
                    {r.highPayout && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-[#8B5E00]">
                        <IconAlert width={10} height={10} /> High payout
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {r.dealerType ?? '—'} · {r.salesPointIds.length} dealer{r.salesPointIds.length !== 1 ? 's' : ''} ·{' '}
                    {r.modelNames.length} model{r.modelNames.length !== 1 ? 's' : ''} · Rate{' '}
                    {r.flatRate}%
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    Loan ₹{parseInt(r.minAmount).toLocaleString('en-IN')}–₹
                    {parseInt(r.maxAmount).toLocaleString('en-IN')} · Tenure {r.minTenure}–
                    {r.maxTenure}m · Payout {r.dealerPayout}%
                  </div>
                </div>

                {/* Margin */}
                <div className="shrink-0 text-right">
                  {r.margin !== null ? (
                    <>
                      <div
                        className={`text-base font-semibold ${r.breached ? 'text-danger' : 'text-success'}`}
                      >
                        {r.margin.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted">bench {r.benchmark}%</div>
                      <div
                        className={`mt-0.5 text-xs font-medium ${r.breached ? 'text-danger' : 'text-success'}`}
                      >
                        {r.breached ? '✗ breach' : '✓ clear'}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted">Can't calculate</span>
                  )}
                </div>
              </div>

              {/* Charges summary */}
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>
                  PF:{' '}
                  {r.pfPct !== null
                    ? `${r.pfPct}%`
                    : r.pfAmount !== null
                      ? `₹${r.pfAmount}`
                      : '—'}
                </span>
                <span>
                  PDD:{' '}
                  {r.pddPct !== null
                    ? `${r.pddPct}%`
                    : r.pddAmount !== null
                      ? `₹${r.pddAmount}`
                      : '—'}
                </span>
                <span>PFF: ₹{r.pffAmount}</span>
                <span>LMF: ₹{r.lmfAmount}</span>
                {r.dmiOn && <span>DMI: ₹{r.dmiAmount || '0'}</span>}
              </div>

              {/* Breach reason input */}
              {r.breached && (
                <div className="mt-3 space-y-1">
                  <label className="block text-xs font-medium text-danger">
                    Reason for breach <span aria-hidden>*</span>
                  </label>
                  <input
                    value={breachReasons[r.id] ?? ''}
                    onChange={e =>
                      setBreachReasons(prev => ({ ...prev, [r.id]: e.target.value }))
                    }
                    placeholder="e.g. Competitive market rate — approved by Zonal Head"
                    className={`${inputCls} border-[#E7CFA6] text-sm focus:border-danger/40`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Review footer */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <button
            onClick={() => setStage('grid')}
            className="text-sm text-muted hover:text-ink"
          >
            ← Back to grid
          </button>
          <div className="flex items-center gap-3">
            {!allReasonsFilled && breachCount > 0 && (
              <p className="text-xs text-muted">Fill all breach reasons to continue.</p>
            )}
            <Button disabled={!allReasonsFilled} onClick={handleCreate}>
              Create {rows.length} promo{rows.length > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── GRID ──────────────────────────────────────────────────────────────────

  const thCls =
    'border-b border-border bg-cream/60 px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted whitespace-nowrap'

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">
          Fill in rates for each scheme. Click dealer or model counts to open the picker.
        </p>
        <p className="mt-0.5 text-xs text-muted">Margin updates live as you type.</p>
      </div>

      {/* Horizontally-scrollable grid */}
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="min-w-max border-collapse text-xs">
          <thead>
            {/* Row 1 — group labels */}
            <tr>
              <th className={thCls} rowSpan={2}>Scheme</th>
              <th className={thCls} rowSpan={2}>Type</th>
              <th className={thCls} rowSpan={2}>Manufacturer</th>
              <th className={thCls} rowSpan={2}>State</th>
              <th className={thCls} rowSpan={2}>Valid From</th>
              <th className={thCls} rowSpan={2}>Valid To</th>
              <th className={thCls} rowSpan={2}>Dealers</th>
              <th className={thCls} rowSpan={2}>Models</th>
              <th className={`${thCls} text-center`} colSpan={2}>Loan Amount (₹)</th>
              <th className={`${thCls} text-center`} colSpan={2}>Tenure (mo.)</th>
              <th className={`${thCls} text-center`} colSpan={5}>Rates & Charges</th>
              <th className={thCls} rowSpan={2} title="Inclusive of GST">Payout%</th>
              <th className={thCls} rowSpan={2} title="Default margin insurance">DMI</th>
              <th className={thCls} rowSpan={2} title="Advance EMI value shown in SFDC — no charge impact">Adv.EMI</th>
              <th className={thCls} rowSpan={2}>Margin</th>
            </tr>
            {/* Row 2 — sub-column labels */}
            <tr>
              <th className={thCls}>Min</th>
              <th className={thCls}>Max</th>
              <th className={thCls}>Min</th>
              <th className={thCls}>Max</th>
              <th className={thCls}>ROI %</th>
              <th className={thCls} title="Processing fee (% or ₹)">PF</th>
              <th className={thCls} title="Post-disbursement default (% or ₹)">PDD</th>
              <th className={thCls} title="Pre-funding fee (₹)">PFF</th>
              <th className={thCls} title="Loan management fee (₹)">LMF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <GridRow
                key={row.id}
                row={row}
                onChange={updateRow}
                onDealerTypeChange={handleDealerTypeChange}
                onPickerOpen={(rowId, field) => setActivePicker({ rowId, field })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Grid footer */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {!gridValid && (
            <p className="text-xs text-muted">
              {!nameIsValid
                ? 'Enter a valid promo name to continue.'
                : `${readyCount}/${rows.length} rows complete — fill dealers & models to continue.`}
            </p>
          )}
        </div>
        <Button disabled={!gridValid} onClick={() => setStage('review')}>
          Next: Review →
        </Button>
      </div>

      {/* SBO confirm — switching from MBO with 2+ manufacturers */}
      {pendingSBOConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/30 backdrop-blur-[1px]">
          <div className="w-96 rounded-card border border-border bg-surface p-6 shadow-soft">
            <h3 className="font-medium text-ink">Switch to SBO?</h3>
            <p className="mt-1 text-sm text-muted">
              SBO allows only one manufacturer. Choose which OEM to keep — the others will be removed and dealers will be cleared.
            </p>
            <div className="mt-4 space-y-1">
              <label className="block text-xs font-medium text-ink">Keep manufacturer</label>
              <select
                value={keepMfr}
                onChange={e => setKeepMfr(e.target.value)}
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/40"
              >
                {pendingSBOConfirm.currentMfrs.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingSBOConfirm(null)}>Cancel</Button>
              <Button onClick={() => {
                setRows(prev => prev.map(r => r.id === pendingSBOConfirm.rowId ? {
                  ...r,
                  dealerType: 'SBO',
                  manufacturers: [keepMfr],
                  cities: [],
                  salesPointIds: [],
                  modelNames: [],
                } : r))
                setPendingSBOConfirm(null)
              }}>
                Switch to SBO
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* All pickers (states, manufacturers, models, dealers) */}
      <PickerPanel
        target={activePicker}
        rows={rows}
        onClose={() => setActivePicker(null)}
        onApply={applyPicker}
      />

      {/* City panel — opens after state selection (one state at a time) */}
      {cityPanelRowId && (() => {
        const row = rows.find(r => r.id === cityPanelRowId)
        if (!row || row.states.length === 0) return null
        return (
          <PerStateCityPanel
            states={row.states}
            existingCities={row.cities}
            onApply={cities => {
              setRows(prev => prev.map(r => r.id === cityPanelRowId ? { ...r, cities } : r))
              setCityPanelRowId(null)
            }}
            onClose={() => setCityPanelRowId(null)}
          />
        )
      })()}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function StepPromoDetails({
  onBulkModeChange,
}: {
  onBulkModeChange?: (active: boolean) => void
}) {
  const { draft, setDraft, promos, role } = useApp()
  const [checked, setChecked] = useState('')
  const [selectedSchemes, setSelectedSchemes] = useState<string[]>(
    draft.schemeName ? [draft.schemeName] : [],
  )
  const [selectedGroups, setSelectedGroups] = useState<PromoGroup[]>(
    draft.group ? [draft.group] : [],
  )

  const frozen = !!draft.editingPromoId
  const isBulkMode = !frozen && selectedSchemes.length * selectedGroups.length > 1

  // Sync single-scheme selection to draft
  useEffect(() => {
    if (frozen) return
    setDraft(d => ({
      ...d,
      schemeName: selectedSchemes.length === 1 ? selectedSchemes[0] : '',
    }))
  }, [selectedSchemes, frozen, setDraft])

  // Sync single-group selection to draft
  useEffect(() => {
    if (frozen) return
    setDraft(d => ({
      ...d,
      group: selectedGroups.length === 1 ? selectedGroups[0] : null,
    }))
  }, [selectedGroups, frozen, setDraft])

  // Tell CreateWizard to hide its footer when bulk grid is active
  useEffect(() => {
    onBulkModeChange?.(isBulkMode)
  }, [isBulkMode, onBulkModeChange])

  // Debounced name uniqueness check
  useEffect(() => {
    if (frozen) return
    const t = setTimeout(() => setChecked(draft.name), 400)
    return () => clearTimeout(t)
  }, [draft.name, frozen])

  const trimmed = draft.name.trim()
  const tooLong = trimmed.length > 100
  const taken = nameTaken(draft.name, promos, draft.id)
  const nameIsValid = !frozen && checked === draft.name && trimmed.length > 0 && !taken && !tooLong
  const nameError = frozen
    ? undefined
    : tooLong
      ? 'Promo name must be 100 characters or fewer.'
      : taken && checked === draft.name
        ? 'This name is already in use.'
        : undefined

  const isSalesTeam = role === 'maker'

  const toggleGroup = (g: PromoGroup) => {
    if (isSalesTeam && g === 'Manufacturer') return
    setSelectedGroups(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    )
  }

  return (
    <div className={`space-y-7 animate-rise ${isBulkMode ? '' : 'max-w-xl'}`}>
      {frozen && (
        <div className="flex items-center gap-2 rounded-card border border-border bg-cream px-4 py-3 text-sm text-muted">
          <IconCheck width={15} height={15} className="shrink-0 text-success" />
          Promo Details are locked for a Live promo. Proceed to Mapping to make changes.
        </div>
      )}

      {/* 1. Product — single-select segmented cards */}
      {!frozen && (
        <Field label="Product" required>
          <div className="flex gap-3">
            {(['New', 'Used', 'Refinance', 'Direct'] as ProductType[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setDraft(d => ({ ...d, product: p }))}
                className={`flex-1 rounded-card border-2 py-3 text-center text-sm font-medium transition ${
                  draft.product === p
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border bg-surface text-ink hover:border-brand/30 hover:bg-cream/40'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* 2. Promo Name — always visible; shared across batch */}
      <Field
        label="Promo Name"
        required={!frozen}
        error={nameError}
        helper={!frozen && !trimmed ? 'Promo name is required.' : undefined}
      >
        <div className="relative">
          <input
            value={draft.name}
            readOnly={frozen}
            onChange={frozen ? undefined : e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Honda Shine Festive – Pune"
            className={`${inputCls} ${
              frozen
                ? 'cursor-default bg-cream/60 text-muted'
                : nameError
                  ? 'border-danger focus:border-danger focus:ring-danger/10'
                  : ''
            }`}
          />
          {nameIsValid && (
            <IconCheck
              className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
              width={18}
              height={18}
            />
          )}
        </div>
        {isBulkMode && (
          <p className="mt-1 text-xs text-muted">
            All {selectedSchemes.length * selectedGroups.length} promos in this batch share this name.
          </p>
        )}
      </Field>

      {/* 3. Scheme — multi-select with chips */}
      <Field
        label="Scheme"
        required={!frozen}
        helper={
          frozen
            ? undefined
            : isBulkMode
              ? undefined
              : 'Fetched from Finnone. Select multiple schemes to create them all at once.'
        }
      >
        {frozen ? (
          <div className={`${inputCls} cursor-default bg-cream/60 text-muted`}>
            {draft.schemeName || '—'}
          </div>
        ) : (
          <MultiSelect
            options={SCHEME_NAMES}
            selected={selectedSchemes}
            onChange={setSelectedSchemes}
            placeholder="Select one or more schemes"
          />
        )}
      </Field>

      {/* 4. Promo Group — multi-select toggle cards */}
      {!frozen && (
        <Field label="Promo Group" required>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'Manufacturer' as PromoGroup, title: 'Manufacturer Scheme', subtitle: 'OEM-funded subvention', disabled: isSalesTeam, note: 'Only Product team can create Manufacturer schemes.' },
              { value: 'Competitive' as PromoGroup, title: 'Competitive Scheme', subtitle: 'Market-led, bank-funded', disabled: false, note: undefined },
            ]).map(opt => {
              const isSelected = selectedGroups.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => toggleGroup(opt.value)}
                  className={`relative rounded-card border-2 p-4 text-left transition ${
                    isSelected
                      ? 'border-brand bg-brand/5'
                      : opt.disabled
                        ? 'cursor-not-allowed border-border bg-cream/40 opacity-50'
                        : 'border-border bg-surface hover:border-brand/30 hover:bg-cream/30'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand">
                      <IconCheck width={11} height={11} className="text-white" />
                    </span>
                  )}
                  <div className="pr-6 font-medium text-ink">{opt.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{opt.subtitle}</div>
                  {opt.disabled && opt.note && (
                    <div className="mt-1.5 text-[10px] text-muted/70">{opt.note}</div>
                  )}
                </button>
              )
            })}
          </div>
        </Field>
      )}

      {/* Bulk grid — shown when scheme × group combinations > 1 */}
      {isBulkMode && (
        <BulkSchemeFlow
          key={`${selectedSchemes.join(',')}-${selectedGroups.join(',')}`}
          selectedSchemes={selectedSchemes}
          selectedGroups={selectedGroups}
          name={draft.name}
          nameIsValid={nameIsValid}
          product={draft.product}
        />
      )}
    </div>
  )
}
