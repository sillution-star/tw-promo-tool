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
import { IconX, IconSearch, IconCheck, IconAlert, IconUpload, IconChevronDown } from '../../components/ui/icons'
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
  dealerSubventionPct: number | null
  dealerSubventionAmt: number | null
  mfgSubventionPct: number | null
  mfgSubventionAmt: number | null
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
    dealerSubventionPct: null,
    dealerSubventionAmt: null,
    mfgSubventionPct: null,
    mfgSubventionAmt: null,
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
    dealerSubventionPct: row.dealerSubventionPct,
    dealerSubventionAmt: row.dealerSubventionAmt,
    mfgSubventionPct: row.mfgSubventionPct,
    mfgSubventionAmt: row.mfgSubventionAmt,
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

// ── PromoForm ─────────────────────────────────────────────────────────────────

const selCls = 'w-full appearance-none rounded-input border border-border bg-surface py-2.5 pl-3 pr-9 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10'

function PromoForm({
  row,
  index,
  total,
  onChange,
  onPickerOpen,
  onDealerTypeChange,
}: {
  row: BulkRow
  index: number
  total: number
  onChange: (id: string, patch: Partial<BulkRow>) => void
  onPickerOpen: (rowId: string, field: PickerField) => void
  onDealerTypeChange: (rowId: string, newType: DealerType | null) => void
}) {
  const payout = parseFloat(row.dealerPayout) || 0
  const sch = SCHEMES.find(s => s.name === row.schemeName)
  const tenures = sch?.tenures ?? [12, 18, 24, 30, 36, 48]

  return (
    <div className="space-y-5">
      {/* Scheme header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink">
          {row.schemeName}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          row.group === 'Manufacturer' ? 'bg-brand/10 text-brand' : 'bg-[#E8F0FE] text-[#1967D2]'
        }`}>
          {row.group}
        </span>
        <span className="ml-auto text-xs text-muted">Promo {index + 1} of {total}</span>
      </div>

      {/* ── Dealer Mapping ── */}
      <section className="rounded-card border border-border bg-surface p-5 space-y-5">
        <h3 className="text-sm font-medium text-ink">Dealer Mapping</h3>

        <Field label="Dealer Type" required>
          <div className="flex gap-3">
            {(['SBO', 'MBO'] as DealerType[]).map(dt => (
              <button
                key={dt}
                type="button"
                onClick={() => onDealerTypeChange(row.id, row.dealerType === dt ? null : dt)}
                className={`flex-1 rounded-card border-2 py-3 text-center text-sm font-semibold transition ${
                  row.dealerType === dt
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border bg-surface text-muted hover:border-brand/30 hover:bg-cream/30'
                }`}
              >
                {dt}
              </button>
            ))}
          </div>
          {!row.dealerType && <p className="mt-1 text-xs text-danger">Required</p>}
        </Field>

        {row.dealerType && (
          <Field label="Manufacturer" required>
            {row.dealerType === 'SBO' ? (
              <div className="relative">
                <select
                  value={row.manufacturers[0] ?? ''}
                  onChange={e => onChange(row.id, {
                    manufacturers: e.target.value ? [e.target.value] : [],
                    cities: [],
                    salesPointIds: [],
                    modelNames: [],
                  })}
                  className={`${selCls} ${!row.manufacturers[0] ? 'text-muted' : 'text-ink'}`}
                >
                  <option value="">Select OEM…</option>
                  {[...MANUFACTURERS].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
              </div>
            ) : (
              <div className="space-y-2">
                {row.manufacturers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {row.manufacturers.map(m => (
                      <span key={m} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-sm text-ink">
                        {m}
                        <button
                          type="button"
                          onClick={() => onChange(row.id, {
                            manufacturers: row.manufacturers.filter(x => x !== m),
                            cities: [],
                            salesPointIds: [],
                            modelNames: [],
                          })}
                          className="leading-none text-muted hover:text-danger"
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
                  className="inline-flex items-center gap-1.5 rounded-input border border-dashed border-brand/50 px-3 py-1.5 text-sm text-brand hover:bg-cream"
                >
                  + Add OEM
                </button>
              </div>
            )}
            {row.manufacturers.length === 0 && (
              <p className="mt-1 text-xs text-danger">Required</p>
            )}
          </Field>
        )}

        {row.manufacturers.length > 0 && (
          <Field label="State">
            <button
              type="button"
              onClick={() => onPickerOpen(row.id, 'states')}
              className={`${inputCls} flex items-center justify-between text-left ${row.states.length > 0 ? 'text-ink' : 'text-muted'}`}
            >
              <span>{row.states.length > 0 ? row.states.join(', ') : 'Select states…'}</span>
              <IconChevronDown width={16} height={16} className="shrink-0 text-muted" />
            </button>
          </Field>
        )}

        {row.manufacturers.length > 0 && (
          <Field label="Dealers" required>
            <button
              type="button"
              onClick={() => onPickerOpen(row.id, 'dealers')}
              className={`${inputCls} flex items-center justify-between text-left ${row.salesPointIds.length > 0 ? 'text-ink' : 'text-muted'}`}
            >
              <span>
                {row.salesPointIds.length > 0
                  ? `${row.salesPointIds.length} dealer${row.salesPointIds.length !== 1 ? 's' : ''} selected`
                  : 'Select dealers…'}
              </span>
              <IconChevronDown width={16} height={16} className="shrink-0 text-muted" />
            </button>
            {row.salesPointIds.length === 0 && <p className="mt-1 text-xs text-danger">Required</p>}
          </Field>
        )}

        {row.manufacturers.length > 0 && (
          <Field label="Models" required>
            <button
              type="button"
              onClick={() => onPickerOpen(row.id, 'models')}
              className={`${inputCls} flex items-center justify-between text-left ${row.modelNames.length > 0 ? 'text-ink' : 'text-muted'}`}
            >
              <span>
                {row.modelNames.length > 0
                  ? `${row.modelNames.length} model${row.modelNames.length !== 1 ? 's' : ''} selected`
                  : 'Select models…'}
              </span>
              <IconChevronDown width={16} height={16} className="shrink-0 text-muted" />
            </button>
            {row.modelNames.length === 0 && <p className="mt-1 text-xs text-danger">Required</p>}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid From">
            <input
              type="date"
              value={row.validFrom}
              onChange={e => onChange(row.id, { validFrom: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Valid To">
            <input
              type="date"
              value={row.validTo}
              min={row.validFrom || undefined}
              onChange={e => onChange(row.id, { validTo: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* ── Loan & Rate ── */}
      <section className="rounded-card border border-border bg-surface p-5 space-y-5">
        <h3 className="text-sm font-medium text-ink">Loan &amp; Rate</h3>
        {sch && (
          <p className="text-xs text-muted">
            {sch.name}: ₹{sch.minAmount.toLocaleString('en-IN')} – ₹{sch.maxAmount.toLocaleString('en-IN')} · ROI {sch.roiMin}–{sch.roiMax}%
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Min Amount Financed">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
              <input
                type="number"
                value={row.minAmount}
                onChange={e => onChange(row.id, { minAmount: e.target.value })}
                className={`${inputCls} pl-7 font-mono`}
              />
            </div>
          </Field>
          <Field label="Max Amount Financed">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
              <input
                type="number"
                value={row.maxAmount}
                onChange={e => onChange(row.id, { maxAmount: e.target.value })}
                className={`${inputCls} pl-7 font-mono`}
              />
            </div>
          </Field>
          <Field label="Min Tenure" helper={sch ? `Allowed: ${sch.tenures.join(', ')} mo.` : undefined}>
            <div className="relative">
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
                className={`${selCls} text-ink`}
              >
                {tenures.map(t => <option key={t} value={t}>{t} months</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </Field>
          <Field label="Max Tenure" helper={sch ? `Allowed: ${sch.tenures.join(', ')} mo.` : undefined}>
            <div className="relative">
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
                className={`${selCls} text-ink`}
              >
                {tenures.map(t => <option key={t} value={t}>{t} months</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </Field>
        </div>
        <Field label="Flat Rate %" helper={sch ? `Scheme range: ${sch.roiMin}–${sch.roiMax}%` : undefined}>
          <div className="relative max-w-xs">
            <input
              type="number"
              step="0.1"
              value={row.flatRate}
              onChange={e => onChange(row.id, { flatRate: e.target.value })}
              className={`${inputCls} pr-8 font-mono`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
          </div>
        </Field>
      </section>

      {/* ── Charges & Payouts ── */}
      <section className="rounded-card border border-border bg-surface p-5 space-y-5">
        <h3 className="text-sm font-medium text-ink">Charges &amp; Payouts</h3>

        <Field label="Processing Fee (PF)" helper="Choose percentage or amount — not both.">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <select
                value={row.pfPct ?? ''}
                disabled={row.pfAmount !== null}
                onChange={e => {
                  const v = e.target.value !== '' ? parseFloat(e.target.value) : null
                  onChange(row.id, { pfPct: v, pfAmount: v !== null ? null : row.pfAmount })
                }}
                className={`${selCls} ${row.pfAmount !== null ? 'cursor-not-allowed bg-cream/60 text-muted' : row.pfPct === null ? 'text-muted' : 'text-ink'}`}
              >
                <option value="">PF %</option>
                {CHARGE_OPTIONS.pfPct.map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
            <div className="relative">
              <select
                value={row.pfAmount ?? ''}
                disabled={row.pfPct !== null}
                onChange={e => {
                  const v = e.target.value !== '' ? parseFloat(e.target.value) : null
                  onChange(row.id, { pfAmount: v, pfPct: v !== null ? null : row.pfPct })
                }}
                className={`${selCls} ${row.pfPct !== null ? 'cursor-not-allowed bg-cream/60 text-muted' : row.pfAmount === null ? 'text-muted' : 'text-ink'}`}
              >
                <option value="">PF ₹</option>
                {CHARGE_OPTIONS.pfAmount.map(v => <option key={v} value={v}>₹{v}</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </div>
        </Field>

        <Field label="PDD" helper="Choose percentage or amount — not both.">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <select
                value={row.pddPct ?? ''}
                disabled={row.pddAmount !== null}
                onChange={e => {
                  const v = e.target.value !== '' ? parseFloat(e.target.value) : null
                  onChange(row.id, { pddPct: v, pddAmount: v !== null ? null : row.pddAmount })
                }}
                className={`${selCls} ${row.pddAmount !== null ? 'cursor-not-allowed bg-cream/60 text-muted' : row.pddPct === null ? 'text-muted' : 'text-ink'}`}
              >
                <option value="">PDD %</option>
                {CHARGE_OPTIONS.pddPct.map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
            <div className="relative">
              <select
                value={row.pddAmount ?? ''}
                disabled={row.pddPct !== null}
                onChange={e => {
                  const v = e.target.value !== '' ? parseFloat(e.target.value) : null
                  onChange(row.id, { pddAmount: v, pddPct: v !== null ? null : row.pddPct })
                }}
                className={`${selCls} ${row.pddPct !== null ? 'cursor-not-allowed bg-cream/60 text-muted' : row.pddAmount === null ? 'text-muted' : 'text-ink'}`}
              >
                <option value="">PDD ₹</option>
                {CHARGE_OPTIONS.pddAmount.map(v => <option key={v} value={v}>₹{v}</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="PFF Amount">
            <div className="relative">
              <select
                value={row.pffAmount}
                onChange={e => onChange(row.id, { pffAmount: parseFloat(e.target.value) })}
                className={`${selCls} text-ink`}
              >
                {CHARGE_OPTIONS.pffAmount.map(v => <option key={v} value={v}>₹{v}</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </Field>
          <Field label="LMF Amount">
            <div className="relative">
              <select
                value={row.lmfAmount}
                onChange={e => onChange(row.id, { lmfAmount: parseFloat(e.target.value) })}
                className={`${selCls} text-ink`}
              >
                {CHARGE_OPTIONS.lmfAmount.map(v => <option key={v} value={v}>₹{v}</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </Field>
        </div>

        <Field label="Dealer Subvention" helper="Choose percentage or loan amount — not both.">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <select
                value={row.dealerSubventionPct ?? ''}
                disabled={row.dealerSubventionAmt !== null}
                onChange={e => {
                  const v = e.target.value !== '' ? parseFloat(e.target.value) : null
                  onChange(row.id, { dealerSubventionPct: v, dealerSubventionAmt: v !== null ? null : row.dealerSubventionAmt })
                }}
                className={`${selCls} ${row.dealerSubventionAmt !== null ? 'cursor-not-allowed bg-cream/60 text-muted' : row.dealerSubventionPct === null ? 'text-muted' : 'text-ink'}`}
              >
                <option value="">Dealer Sub %</option>
                {CHARGE_OPTIONS.subventionPct.map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
            <div className="relative">
              <select
                value={row.dealerSubventionAmt ?? ''}
                disabled={row.dealerSubventionPct !== null}
                onChange={e => {
                  const v = e.target.value !== '' ? parseFloat(e.target.value) : null
                  onChange(row.id, { dealerSubventionAmt: v, dealerSubventionPct: v !== null ? null : row.dealerSubventionPct })
                }}
                className={`${selCls} ${row.dealerSubventionPct !== null ? 'cursor-not-allowed bg-cream/60 text-muted' : row.dealerSubventionAmt === null ? 'text-muted' : 'text-ink'}`}
              >
                <option value="">Dealer Sub ₹</option>
                {CHARGE_OPTIONS.subventionAmt.map(v => <option key={v} value={v}>₹{v}</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </div>
        </Field>

        <Field label="Manufacturer Subvention" helper="Choose percentage or loan amount — not both.">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <select
                value={row.mfgSubventionPct ?? ''}
                disabled={row.mfgSubventionAmt !== null}
                onChange={e => {
                  const v = e.target.value !== '' ? parseFloat(e.target.value) : null
                  onChange(row.id, { mfgSubventionPct: v, mfgSubventionAmt: v !== null ? null : row.mfgSubventionAmt })
                }}
                className={`${selCls} ${row.mfgSubventionAmt !== null ? 'cursor-not-allowed bg-cream/60 text-muted' : row.mfgSubventionPct === null ? 'text-muted' : 'text-ink'}`}
              >
                <option value="">Mfg Sub %</option>
                {CHARGE_OPTIONS.subventionPct.map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
            <div className="relative">
              <select
                value={row.mfgSubventionAmt ?? ''}
                disabled={row.mfgSubventionPct !== null}
                onChange={e => {
                  const v = e.target.value !== '' ? parseFloat(e.target.value) : null
                  onChange(row.id, { mfgSubventionAmt: v, mfgSubventionPct: v !== null ? null : row.mfgSubventionPct })
                }}
                className={`${selCls} ${row.mfgSubventionPct !== null ? 'cursor-not-allowed bg-cream/60 text-muted' : row.mfgSubventionAmt === null ? 'text-muted' : 'text-ink'}`}
              >
                <option value="">Mfg Sub ₹</option>
                {CHARGE_OPTIONS.subventionAmt.map(v => <option key={v} value={v}>₹{v}</option>)}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </div>
        </Field>

        <Field label="Dealer Payout %" helper="Inclusive of GST">
          <div className="relative max-w-xs">
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
              className={`${inputCls} pr-8 font-mono ${payout > 5 ? 'border-amber-400 bg-amber-50 text-[#B45309]' : ''}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
          </div>
          {payout > 5 && payout <= 10 && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#B45309]">
              <IconAlert width={12} height={12} /> High payout — please recheck.
            </p>
          )}
        </Field>

        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink">DM Referral Incentive (DMI)</div>
              <div className="text-xs text-muted">An extra incentive paid to the referring DM.</div>
            </div>
            <button
              type="button"
              onClick={() => onChange(row.id, { dmiOn: !row.dmiOn })}
              className={`relative h-6 w-11 rounded-full transition-colors ${row.dmiOn ? 'bg-brand' : 'bg-[#D8D0BF]'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${row.dmiOn ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {row.dmiOn && (
            <div className="mt-3 max-w-xs">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                <input
                  type="number"
                  value={row.dmiAmount}
                  onChange={e => onChange(row.id, { dmiAmount: e.target.value })}
                  placeholder="DMI amount"
                  className={`${inputCls} pl-7 font-mono`}
                />
              </div>
            </div>
          )}
        </div>

        <Field label="Advance EMI" helper="Value shown in SFDC. No charge impact.">
          <div className="relative max-w-xs">
            <select
              value={row.advanceEmi}
              onChange={e => onChange(row.id, { advanceEmi: Number(e.target.value) })}
              className={`${selCls} text-ink`}
            >
              {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
          </div>
        </Field>

        <div className="flex items-center gap-3 rounded-input bg-cream/60 px-4 py-3">
          <span className="text-sm text-muted">Live margin:</span>
          <MarginBadge row={row} />
        </div>
      </section>
    </div>
  )
}

// ── ReadOnlyGridRow ───────────────────────────────────────────────────────────

type ReviewRow = BulkRow & { margin: number | null; benchmark: number; breached: boolean; highPayout: boolean; detail: PromoDetail }

function ReadOnlyGridRow({ row, onEdit }: { row: ReviewRow; onEdit: () => void }) {
  const payout = parseFloat(row.dealerPayout) || 0
  const thCls = 'px-2 py-2.5 text-xs text-ink'
  return (
    <tr className={`border-b border-border last:border-0 ${row.breached ? 'bg-warning-bg/20' : 'hover:bg-cream/20'}`}>
      <td className="px-2 py-2 min-w-[150px]">
        <div className="flex flex-wrap gap-0.5 mb-0.5">
          <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-medium text-ink">{row.schemeName}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${row.group === 'Manufacturer' ? 'bg-brand/10 text-brand' : 'bg-[#E8F0FE] text-[#1967D2]'}`}>
            {row.group === 'Manufacturer' ? 'MFR' : 'COMP'}
          </span>
        </div>
        <button type="button" onClick={onEdit} className="text-[10px] font-medium text-brand hover:underline">Edit ↗</button>
      </td>
      <td className={`${thCls} text-center`}>{row.dealerType ?? <span className="text-[10px] text-danger">—</span>}</td>
      <td className={`${thCls} min-w-[90px]`}>{row.manufacturers.join(', ') || '—'}</td>
      <td className={`${thCls} text-muted`}>{row.states.length > 0 ? row.states.join(', ') : '—'}</td>
      <td className={`${thCls} whitespace-nowrap`}>{row.validFrom || '—'}</td>
      <td className={`${thCls} whitespace-nowrap`}>{row.validTo || '—'}</td>
      <td className={`${thCls} text-center`}>{row.salesPointIds.length || <span className="text-[10px] text-danger">0</span>}</td>
      <td className={`${thCls} text-center`}>{row.modelNames.length || <span className="text-[10px] text-danger">0</span>}</td>
      <td className={`${thCls} font-mono whitespace-nowrap`}>₹{parseInt(row.minAmount).toLocaleString('en-IN')}</td>
      <td className={`${thCls} font-mono whitespace-nowrap`}>₹{parseInt(row.maxAmount).toLocaleString('en-IN')}</td>
      <td className={`${thCls} text-center`}>{row.minTenure}m</td>
      <td className={`${thCls} text-center`}>{row.maxTenure}m</td>
      <td className={`${thCls} font-mono text-center`}>{row.flatRate}%</td>
      <td className={`${thCls} text-center`}>{row.pfPct !== null ? `${row.pfPct}%` : row.pfAmount !== null ? `₹${row.pfAmount}` : '—'}</td>
      <td className={`${thCls} text-center`}>{row.pddPct !== null ? `${row.pddPct}%` : row.pddAmount !== null ? `₹${row.pddAmount}` : '—'}</td>
      <td className={`${thCls} text-center`}>₹{row.pffAmount}</td>
      <td className={`${thCls} text-center`}>₹{row.lmfAmount}</td>
      <td className={`${thCls} text-center`}>
        {row.dealerSubventionPct !== null && row.dealerSubventionPct !== undefined ? `${row.dealerSubventionPct}%` : row.dealerSubventionAmt !== null && row.dealerSubventionAmt !== undefined ? `₹${row.dealerSubventionAmt}` : <span className="text-muted">—</span>}
      </td>
      <td className={`${thCls} text-center`}>
        {row.mfgSubventionPct !== null && row.mfgSubventionPct !== undefined ? `${row.mfgSubventionPct}%` : row.mfgSubventionAmt !== null && row.mfgSubventionAmt !== undefined ? `₹${row.mfgSubventionAmt}` : <span className="text-muted">—</span>}
      </td>
      <td className={`${thCls} text-center`}>
        <span className={`font-mono ${payout > 5 ? 'font-semibold text-[#B45309]' : ''}`}>{row.dealerPayout}%</span>
        {row.highPayout && <div className="text-[9px] text-[#B45309]">High</div>}
      </td>
      <td className={`${thCls} text-center`}>{row.dmiOn ? `₹${row.dmiAmount || '—'}` : <span className="text-muted">Off</span>}</td>
      <td className={`${thCls} text-center`}>{row.advanceEmi}</td>
      <td className="px-2 py-2">
        {row.margin !== null ? (
          <div className="text-right leading-tight">
            <div className={`text-[11px] font-semibold ${row.breached ? 'text-danger' : 'text-success'}`}>{row.margin.toFixed(1)}%</div>
            <div className="text-[9px] text-muted">b:{row.benchmark}%</div>
            {row.breached && <div className="text-[9px] font-semibold text-danger">breach</div>}
          </div>
        ) : <span className="text-[10px] text-muted">—</span>}
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
  const [stage, setStage] = useState<'form' | 'review' | 'done'>('form')
  const [formIndex, setFormIndex] = useState(0)
  const [breachReasons, setBreachReasons] = useState<Record<string, string>>({})
  const [createdCount, setCreatedCount] = useState(0)

  // When scheme/group selection changes, sync rows (preserve existing data) and reset to form stage
  useEffect(() => {
    setRows(prev =>
      selectedSchemes.flatMap(s => selectedGroups.map(g => {
        const existing = prev.find(r => r.schemeName === s && r.group === g)
        return existing ?? makeRow(s, g)
      }))
    )
    setStage('form')
    setFormIndex(0)
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
              setStage('form')
              setFormIndex(0)
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
    const thCls = 'border-b border-border bg-cream/60 px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted whitespace-nowrap'
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-serif text-xl text-ink">
            Review {rows.length} promo{rows.length > 1 ? 's' : ''}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Check all details before creating. Click <strong>Edit ↗</strong> on any row to go back and change it.
            {breachCount > 0 && (
              <span className="ml-1 text-[#B45309]">
                {breachCount} breach{breachCount > 1 ? 'es' : ''} — fill a reason for each below.
              </span>
            )}
          </p>
        </div>

        {/* Read-only grid */}
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="min-w-max border-collapse text-xs">
            <thead>
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
                <th className={`${thCls} text-center`} colSpan={2}>Tenure</th>
                <th className={`${thCls} text-center`} colSpan={7}>Rates &amp; Charges</th>
                <th className={thCls} rowSpan={2}>Payout%</th>
                <th className={thCls} rowSpan={2}>DMI</th>
                <th className={thCls} rowSpan={2}>Adv.EMI</th>
                <th className={thCls} rowSpan={2}>Margin</th>
              </tr>
              <tr>
                <th className={thCls}>Min</th>
                <th className={thCls}>Max</th>
                <th className={thCls}>Min</th>
                <th className={thCls}>Max</th>
                <th className={thCls}>ROI %</th>
                <th className={thCls}>PF</th>
                <th className={thCls}>PDD</th>
                <th className={thCls}>PFF</th>
                <th className={thCls}>LMF</th>
                <th className={thCls}>D.Sub</th>
                <th className={thCls}>M.Sub</th>
              </tr>
            </thead>
            <tbody>
              {reviewData.map((r, i) => (
                <ReadOnlyGridRow
                  key={r.id}
                  row={r}
                  onEdit={() => {
                    setFormIndex(i)
                    setStage('form')
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Breach reasons */}
        {breachCount > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#B45309]">
              {breachCount} promo{breachCount > 1 ? 's' : ''} with margin breach — reason required
            </p>
            {reviewData.filter(r => r.breached).map(r => (
              <div key={r.id} className="rounded-card border border-[#E7CFA6] bg-warning-bg/40 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-ink">{name}</span>
                  <span className="rounded-full bg-cream px-2 py-0.5 text-xs text-muted">{r.schemeName}</span>
                  <span className="text-xs text-danger font-semibold">Margin {r.margin?.toFixed(1)}% vs bench {r.benchmark}%</span>
                </div>
                <label className="block text-xs font-medium text-danger mb-1">
                  Reason for breach <span aria-hidden>*</span>
                </label>
                <input
                  value={breachReasons[r.id] ?? ''}
                  onChange={e => setBreachReasons(prev => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="e.g. Competitive market rate — approved by Zonal Head"
                  className={`${inputCls} border-[#E7CFA6] text-sm focus:border-danger/40`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Review footer */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <button
            onClick={() => setStage('form')}
            className="text-sm text-muted hover:text-ink"
          >
            ← Edit promos
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

  // ── FORM ──────────────────────────────────────────────────────────────────

  const currentRow = rows[formIndex] ?? rows[0]

  return (
    <div className="max-w-2xl space-y-6">
      {/* Progress bar — click a segment to jump to that promo */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          {rows.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setFormIndex(i)}
              title={`${r.schemeName} · ${r.group}`}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i === formIndex ? 'bg-brand' : rowReady(r) ? 'bg-success/50' : 'bg-border'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted">
          {rows.filter(rowReady).length} of {rows.length} promos complete · click a segment to jump
        </p>
      </div>

      <PromoForm
        row={currentRow}
        index={formIndex}
        total={rows.length}
        onChange={updateRow}
        onPickerOpen={(rowId, field) => setActivePicker({ rowId, field })}
        onDealerTypeChange={handleDealerTypeChange}
      />

      {/* Navigation footer */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          onClick={() => setFormIndex(f => Math.max(0, f - 1))}
          disabled={formIndex === 0}
          className="text-sm text-muted hover:text-ink disabled:cursor-default disabled:opacity-40"
        >
          ← Previous
        </button>
        <div className="flex items-center gap-3">
          {!nameIsValid && (
            <p className="text-xs text-muted">Enter a valid promo name to continue.</p>
          )}
          {formIndex < rows.length - 1 ? (
            <Button onClick={() => setFormIndex(f => f + 1)}>
              Next →
            </Button>
          ) : (
            <Button disabled={!gridValid} onClick={() => setStage('review')}>
              Review {rows.length} promo{rows.length > 1 ? 's' : ''} →
            </Button>
          )}
        </div>
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

      {/* Pickers */}
      <PickerPanel
        target={activePicker}
        rows={rows}
        onClose={() => setActivePicker(null)}
        onApply={applyPicker}
      />

      {/* City panel */}
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
