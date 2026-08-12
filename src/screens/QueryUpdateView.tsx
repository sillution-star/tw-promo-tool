/**
 * QueryUpdateView — Story 19
 * Three steps: Find → Update → Preview & Apply
 *
 * • FILTER: all promo fields includng every charge/rate field
 * • UPDATE: multiple change rows applied in one batch
 * • Multi-select for State (+ mandatory cascaded City), City, Manufacturer
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import { Button, inputCls } from '../components/ui/primitives'
import { IconCheck, IconAlert, IconX, IconPlus } from '../components/ui/icons'
import { MANUFACTURERS, STATES_CITIES, SCHEMES } from '../data/seed'
import { detailForPromo, computeProfit } from '../lib/profitability'
import type { Promo } from '../data/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHEME_NAMES = SCHEMES.map(s => s.name)
const STATE_NAMES  = Object.keys(STATES_CITIES)
const ALL_CITIES   = Object.values(STATES_CITIES).flat()

// ── Condition field config ────────────────────────────────────────────────────

type FieldType = 'enum' | 'number' | 'date' | 'text'

interface CondFieldCfg {
  key: string
  label: string
  group: string
  type: FieldType
  options?: string[]
  unit?: string
  defaultOp: string
  defaultValue: string
}

const COND_FIELDS: CondFieldCfg[] = [
  // Promo info
  { key:'scheme',       label:'Scheme',        group:'Promo',    type:'enum',   options:SCHEME_NAMES, defaultOp:'is',  defaultValue:SCHEME_NAMES[0] },
  { key:'group',        label:'Promo Group',   group:'Promo',    type:'enum',   options:['Manufacturer','Competitive'], defaultOp:'is', defaultValue:'Competitive' },
  { key:'status',       label:'Status',        group:'Promo',    type:'enum',   options:['Live','Pending','Approved','Rejected','Rework','Expired','Draft','Deactivated'], defaultOp:'is', defaultValue:'Live' },
  { key:'manufacturer', label:'Manufacturer',  group:'Promo',    type:'enum',   options:[...MANUFACTURERS], defaultOp:'is', defaultValue:MANUFACTURERS[0] },
  { key:'state',        label:'State',         group:'Promo',    type:'enum',   options:STATE_NAMES, defaultOp:'is', defaultValue:'Maharashtra' },
  // Mapping — free-text
  { key:'salesPoint',   label:'Sales Point',   group:'Mapping',  type:'text',   defaultOp:'contains', defaultValue:'SP-' },
  { key:'model',        label:'Model',         group:'Mapping',  type:'text',   defaultOp:'contains', defaultValue:'' },
  // Rates & charges
  { key:'flatRate',     label:'Flat Rate',     group:'Rates',    type:'number', unit:'%',  defaultOp:'=',   defaultValue:'9' },
  { key:'dealerPayout', label:'Dealer Payout', group:'Rates',    type:'number', unit:'%',  defaultOp:'<=',  defaultValue:'5' },
  { key:'pfPct',        label:'PF (%)',         group:'Rates',    type:'number', unit:'%',  defaultOp:'=',   defaultValue:'2' },
  { key:'pddPct',       label:'PDD (%)',        group:'Rates',    type:'number', unit:'%',  defaultOp:'=',   defaultValue:'1' },
  { key:'pffAmount',    label:'PFF (₹)',        group:'Rates',    type:'number', unit:'₹',  defaultOp:'>=',  defaultValue:'500' },
  { key:'lmfAmount',    label:'LMF (₹)',        group:'Rates',    type:'number', unit:'₹',  defaultOp:'>=',  defaultValue:'100' },
  // Tenure
  { key:'minTenure',    label:'Min Tenure',    group:'Tenure',   type:'number', unit:'mo', defaultOp:'=',   defaultValue:'12' },
  { key:'maxTenure',    label:'Max Tenure',    group:'Tenure',   type:'number', unit:'mo', defaultOp:'=',   defaultValue:'36' },
  // Loan amount
  { key:'minAmount',    label:'Min Amount (₹)', group:'Amount',  type:'number', unit:'₹',  defaultOp:'>=',  defaultValue:'50000' },
  { key:'maxAmount',    label:'Max Amount (₹)', group:'Amount',  type:'number', unit:'₹',  defaultOp:'<=',  defaultValue:'500000' },
  // Profitability
  { key:'margin',       label:'Net Margin',    group:'Profit',   type:'number', unit:'%',  defaultOp:'>=',  defaultValue:'3' },
  // Date
  { key:'validTo',      label:'End Date',      group:'Date',     type:'date',               defaultOp:'before', defaultValue:'2026-12-31' },
]

const COND_GROUPS = ['Promo', 'Mapping', 'Rates', 'Tenure', 'Amount', 'Profit', 'Date']

const OPS_FOR_TYPE: Record<FieldType, Array<{ key: string; label: string }>> = {
  enum:   [{ key:'is', label:'is' }, { key:'is not', label:'is not' }],
  text:   [{ key:'contains', label:'contains' }, { key:'does not contain', label:'does not contain' }],
  number: [{ key:'=', label:'=' }, { key:'>=', label:'≥' }, { key:'<=', label:'≤' }, { key:'>', label:'>' }, { key:'<', label:'<' }],
  date:   [{ key:'before', label:'before' }, { key:'after', label:'after' }, { key:'is', label:'is' }],
}

// ── Change field config ────────────────────────────────────────────────────────

type ChangeFieldCategory = 'mapping' | 'financial' | 'date'
type ValueInputType = 'number' | 'date' | 'text' | 'multiselect'

interface ChangeFieldCfg {
  key: string
  label: string
  category: ChangeFieldCategory
  inputType: ValueInputType
  unit?: string
  options?: string[]
  placeholder?: string
  hows: Array<{ key: string; label: string }>
}

const MAP_HOWS = [{ key:'add', label:'add' }, { key:'remove', label:'remove' }]
const NUM_HOWS = [
  { key:'increase by', label:'increase by' },
  { key:'decrease by', label:'decrease by' },
  { key:'set to',      label:'set to' },
]

const CHANGE_FIELDS: ChangeFieldCfg[] = [
  // Mapping — multi-select
  { key:'state',        label:'State',         category:'mapping',   inputType:'multiselect', options:STATE_NAMES,       hows:MAP_HOWS },
  { key:'city',         label:'City',          category:'mapping',   inputType:'multiselect',                            hows:MAP_HOWS },
  { key:'manufacturer', label:'Manufacturer',  category:'mapping',   inputType:'multiselect', options:[...MANUFACTURERS], hows:[...MAP_HOWS, { key:'set to', label:'set to' }] },
  // Mapping — single text
  { key:'model',        label:'Model',         category:'mapping',   inputType:'text',   placeholder:'e.g. Honda Shine', hows:MAP_HOWS },
  { key:'salesPoint',   label:'Sales Point',   category:'mapping',   inputType:'text',   placeholder:'SP-001',           hows:MAP_HOWS },
  // Financial
  { key:'flatRate',     label:'Flat Rate',     category:'financial', inputType:'number', unit:'%',  hows:NUM_HOWS },
  { key:'dealerPayout', label:'Dealer Payout', category:'financial', inputType:'number', unit:'%',  hows:NUM_HOWS },
  { key:'pfPct',        label:'PF (%)',         category:'financial', inputType:'number', unit:'%',  hows:NUM_HOWS },
  { key:'pddPct',       label:'PDD (%)',        category:'financial', inputType:'number', unit:'%',  hows:NUM_HOWS },
  { key:'pffAmount',    label:'PFF (₹)',        category:'financial', inputType:'number', unit:'₹',  hows:NUM_HOWS },
  { key:'lmfAmount',    label:'LMF (₹)',        category:'financial', inputType:'number', unit:'₹',  hows:NUM_HOWS },
  { key:'minTenure',    label:'Min Tenure',    category:'financial', inputType:'number', unit:'mo', hows:NUM_HOWS },
  { key:'maxTenure',    label:'Max Tenure',    category:'financial', inputType:'number', unit:'mo', hows:NUM_HOWS },
  { key:'minAmount',    label:'Min Amount',    category:'financial', inputType:'number', unit:'₹',  hows:NUM_HOWS },
  { key:'maxAmount',    label:'Max Amount',    category:'financial', inputType:'number', unit:'₹',  hows:NUM_HOWS },
  // Date
  { key:'validTo',      label:'End Date',      category:'date',      inputType:'date',
    hows:[{ key:'extend to', label:'extend to' }, { key:'set to', label:'set to' }] },
]

// ── MultiSelectDropdown ────────────────────────────────────────────────────────

function MultiSelectDropdown({
  options, selected, onChange, placeholder = 'Select…', disabled = false,
}: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void
  placeholder?: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = (o: string) => onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o])
  const lbl = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`${inputCls} flex w-full items-center justify-between text-left
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          ${selected.length === 0 ? 'text-[#9A9082]' : 'text-ink'}`}>
        <span className="truncate">{lbl}</span>
        <svg className="ml-2 shrink-0 text-muted" width="11" height="7" viewBox="0 0 11 7" fill="none">
          <path d="M1 1l4.5 4.5L10 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 z-50 mt-1 max-h-56 w-full min-w-[200px] overflow-y-auto rounded-xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => onChange(options)}>All</button>
            <button type="button" className="text-xs font-medium text-muted hover:text-ink" onClick={() => onChange([])}>Clear</button>
          </div>
          {options.length === 0
            ? <div className="px-3 py-3 text-sm text-muted">No options</div>
            : options.map(opt => (
              <label key={opt} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#F8F5EE]">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="h-3.5 w-3.5 accent-brand"/>
                <span className={selected.includes(opt) ? 'font-medium text-ink' : 'text-[#6E5C4A]'}>{opt}</span>
              </label>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Condition matching ─────────────────────────────────────────────────────────

interface Condition { id: string; field: string; op: string; value: string; connector?: 'AND' | 'OR' }

function matchPromo(promo: Promo, c: Condition): boolean {
  if (!c.field || !c.op) return false
  const det = detailForPromo(promo)
  const num = (actual: number) => {
    const v = parseFloat(c.value); if (isNaN(v)) return false
    switch (c.op) {
      case '=':  return Math.abs(actual - v) < 0.001
      case '>':  return actual > v
      case '<':  return actual < v
      case '>=': return actual >= v
      case '<=': return actual <= v
    }
    return false
  }
  const str = (actual: string) => {
    const a = actual.toLowerCase(), b = c.value.toLowerCase()
    return c.op === 'is' ? a === b : a !== b
  }
  const txt = (items: string[]) => {
    if (!c.value) return false
    const b = c.value.toLowerCase()
    const hit = items.some(s => s.toLowerCase().includes(b))
    return c.op === 'contains' ? hit : !hit
  }
  const date = (actual: string) => {
    if (!actual) return false
    return c.op === 'before' ? actual < c.value : c.op === 'after' ? actual > c.value : actual === c.value
  }
  switch (c.field) {
    case 'scheme':       return str(promo.scheme)
    case 'group':        return str(promo.group)
    case 'status':       return str(promo.status)
    case 'manufacturer': return str(promo.manufacturer)
    case 'state':        return str(promo.state)
    case 'salesPoint':   return txt(promo.salesPointIds ?? [])
    case 'model':        return txt(promo.modelNames ?? [])
    case 'flatRate':     return num(det.flatRate)
    case 'dealerPayout': return num(promo.dealerPayout)
    case 'pfPct':        return num(det.pfPct ?? 2)
    case 'pddPct':       return num(det.pddPct ?? 1)
    case 'pffAmount':    return num(det.pffAmount)
    case 'lmfAmount':    return num(det.lmfAmount)
    case 'minTenure':    return num(det.minTenure)
    case 'maxTenure':    return num(det.maxTenure)
    case 'minAmount':    return num(det.minAmount)
    case 'maxAmount':    return num(det.maxAmount)
    case 'margin':       return num(promo.margin ?? 0)
    case 'validTo':      return date(promo.expiry ?? '')
    default:             return false
  }
}

// ── Change type ────────────────────────────────────────────────────────────────

interface Change {
  id: string
  field: string
  how: string
  value: string
  values: string[]
  cityValues: string[]
}

type ChangeCategory = 'increase' | 'decrease' | 'reach'

function changeCategory(ch: Change): ChangeCategory {
  if (['state','city','manufacturer','model','salesPoint'].includes(ch.field)) return 'reach'
  if (ch.field === 'validTo') return 'reach'
  if (ch.field === 'dealerPayout') return ch.how === 'decrease by' ? 'increase' : 'decrease'
  return ch.how === 'increase by' ? 'increase' : 'decrease'
}

function overallCategory(changes: Change[]): ChangeCategory {
  const cats = changes.map(changeCategory)
  if (cats.includes('decrease')) return 'decrease'
  if (cats.includes('increase')) return 'increase'
  return 'reach'
}

function isChangeComplete(c: Change): boolean {
  if (!c.field || !c.how) return false
  const cfg = CHANGE_FIELDS.find(f => f.key === c.field)
  if (cfg?.inputType === 'multiselect') {
    if (c.values.length === 0) return false
    if (c.field === 'state' && c.cityValues.length === 0) return false
    return true
  }
  return !!c.value
}

// ── Impact computation (chains all changes per promo) ─────────────────────────

interface FieldChangeResult { cfg: ChangeFieldCfg; oldVal: number | string | null; newVal: number | string | null }
interface PromoImpact {
  promo: Promo
  fieldChanges: FieldChangeResult[]
  oldMargin: number | null
  newMargin: number | null
  belowBenchmark: boolean
}

function computeMultiImpacts(matched: Promo[], changes: Change[]): PromoImpact[] {
  const valid = changes.filter(isChangeComplete)
  if (valid.length === 0 || matched.length === 0) return []

  return matched.map(promo => {
    let det = { ...detailForPromo(promo) }
    const fieldChanges: FieldChangeResult[] = []

    for (const ch of valid) {
      const cfg = CHANGE_FIELDS.find(f => f.key === ch.field)!
      const isMS = cfg.inputType === 'multiselect'

      // Mapping / date — no margin change, just record the intent
      if (isMS || ch.field === 'model' || ch.field === 'salesPoint' || ch.field === 'validTo') {
        const display = isMS
          ? (ch.field === 'state' && ch.cityValues.length > 0
              ? `${ch.values.join(', ')} + ${ch.cityValues.length} city(ies)`
              : ch.values.join(', '))
          : ch.value
        fieldChanges.push({ cfg, oldVal: ch.field === 'validTo' ? promo.expiry ?? null : null, newVal: display })
        // apply to det for state/city so the chain is consistent
        if (ch.field === 'state') {
          if (ch.how === 'add') det = { ...det, states: [...new Set([...det.states, ...ch.values])], cities: ch.cityValues.length ? [...new Set([...det.cities, ...ch.cityValues])] : det.cities }
          else det = { ...det, states: det.states.filter(s => !ch.values.includes(s)) }
        } else if (ch.field === 'city') {
          if (ch.how === 'add') det = { ...det, cities: [...new Set([...det.cities, ...ch.values])] }
          else det = { ...det, cities: det.cities.filter(c => !ch.values.includes(c)) }
        } else if (ch.field === 'validTo') {
          det = { ...det, validTo: ch.value }
        }
        continue
      }

      // Financial
      const v = parseFloat(ch.value)
      if (isNaN(v)) continue
      const apply = (cur: number) => ch.how === 'increase by' ? cur + v : ch.how === 'decrease by' ? Math.max(0, cur - v) : v
      let oldVal = 0, newVal = 0

      switch (ch.field) {
        case 'flatRate':     oldVal = det.flatRate;        newVal = apply(oldVal); det = { ...det, flatRate: newVal }; break
        case 'dealerPayout': oldVal = det.dealerPayout;   newVal = apply(oldVal); det = { ...det, dealerPayout: newVal }; break
        case 'pfPct':        oldVal = det.pfPct ?? 2;      newVal = apply(oldVal); det = { ...det, pfPct: newVal, pfAmount: null }; break
        case 'pddPct':       oldVal = det.pddPct ?? 1;     newVal = apply(oldVal); det = { ...det, pddPct: newVal, pddAmount: null }; break
        case 'pffAmount':    oldVal = det.pffAmount;       newVal = apply(oldVal); det = { ...det, pffAmount: newVal }; break
        case 'lmfAmount':    oldVal = det.lmfAmount;       newVal = apply(oldVal); det = { ...det, lmfAmount: newVal }; break
        case 'minTenure':    oldVal = det.minTenure;       newVal = Math.max(1, apply(oldVal)); det = { ...det, minTenure: newVal }; break
        case 'maxTenure':    oldVal = det.maxTenure;       newVal = Math.max(2, apply(oldVal)); det = { ...det, maxTenure: newVal }; break
        case 'minAmount':    oldVal = det.minAmount;       newVal = apply(oldVal); det = { ...det, minAmount: newVal }; break
        case 'maxAmount':    oldVal = det.maxAmount;       newVal = apply(oldVal); det = { ...det, maxAmount: newVal }; break
        default: continue
      }
      fieldChanges.push({ cfg, oldVal, newVal })
    }

    const result = computeProfit(det)
    const newMargin = result.ok ? result.breakdown!.netPct : promo.margin
    return { promo, fieldChanges, oldMargin: promo.margin, newMargin: newMargin ?? null, belowBenchmark: (newMargin ?? 0) < promo.benchmark }
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let _cid = 0, _chid = 0
const newCondId   = () => String(++_cid)
const newChangeId = () => String(++_chid)

function defaultCondition(fieldKey = 'scheme'): Condition {
  const cfg = COND_FIELDS.find(f => f.key === fieldKey) ?? COND_FIELDS[0]
  return { id: newCondId(), field: cfg.key, op: cfg.defaultOp, value: cfg.defaultValue }
}
function emptyChange(fieldKey = 'flatRate'): Change {
  const cfg = CHANGE_FIELDS.find(f => f.key === fieldKey) ?? CHANGE_FIELDS[5]
  return { id: newChangeId(), field: cfg.key, how: cfg.hows[0].key, value: '', values: [], cityValues: [] }
}

function fmtVal(v: number | string | null, cfg: ChangeFieldCfg): string {
  if (v === null) return '—'
  if (typeof v === 'string') return v
  return `${v.toFixed(cfg.unit === '₹' ? 0 : 1)}${cfg.unit ?? ''}`
}

const STAGES = ['Find', 'Update', 'Preview & Apply']

// ── Stage bar ──────────────────────────────────────────────────────────────────

function StageBar({ stage }: { stage: number }) {
  return (
    <div className="flex items-center gap-2">
      {STAGES.map((label, i) => {
        const done = i < stage, active = i === stage
        return (
          <span key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium
              ${done ? 'bg-success text-white' : active ? 'bg-brand text-white' : 'bg-[#ECE7DA] text-muted'}`}>
              {done ? <IconCheck width={13} height={13}/> : i + 1}
            </span>
            <span className={`text-sm ${active ? 'font-medium text-ink' : 'text-muted'}`}>{label}</span>
            {i < STAGES.length - 1 && <span className="mx-2 h-px w-8 bg-border"/>}
          </span>
        )
      })}
    </div>
  )
}

// ── Condition row ─────────────────────────────────────────────────────────────

function ConditionRow({ cond, onField, onOp, onValue, onRemove }: {
  cond: Condition; onField: (f: string) => void; onOp: (op: string) => void
  onValue: (v: string) => void; onRemove?: () => void
}) {
  const cfg = COND_FIELDS.find(f => f.key === cond.field)!
  const ops = OPS_FOR_TYPE[cfg?.type ?? 'enum']
  const sel = 'rounded-lg border border-border bg-[#F8F5EE] px-2.5 py-1.5 text-sm font-medium text-ink focus:outline-none focus:ring-1 focus:ring-brand/30'

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3">
      {/* Field — grouped optgroup dropdown */}
      <select value={cond.field} onChange={e => onField(e.target.value)} className={sel}>
        {COND_GROUPS.map(g => {
          const fields = COND_FIELDS.filter(f => f.group === g)
          return fields.length === 0 ? null : (
            <optgroup key={g} label={g}>
              {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </optgroup>
          )
        })}
      </select>

      {/* Op */}
      <select value={cond.op} onChange={e => onOp(e.target.value)}
        className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm text-muted focus:outline-none">
        {ops.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>

      {/* Value */}
      {cfg?.type === 'enum' ? (
        <select value={cond.value} onChange={e => onValue(e.target.value)} className={sel}>
          {cfg.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : cfg?.type === 'text' ? (
        <input type="text" value={cond.value} onChange={e => onValue(e.target.value)}
          placeholder="Type to filter…" className={`w-40 ${sel}`}/>
      ) : cfg?.type === 'date' ? (
        <input type="date" value={cond.value} onChange={e => onValue(e.target.value)} className={sel}/>
      ) : (
        <div className="flex items-center gap-1">
          <input type="number" step="any" value={cond.value} onChange={e => onValue(e.target.value)}
            className={`w-24 ${sel}`}/>
          {cfg?.unit && <span className="text-sm text-muted">{cfg.unit}</span>}
        </div>
      )}

      <button onClick={onRemove} disabled={!onRemove}
        className={`ml-auto p-1 ${onRemove ? 'text-[#C7BFAE] hover:text-danger' : 'invisible'}`}>
        <IconX width={14} height={14}/>
      </button>
    </div>
  )
}

// ── Change row ────────────────────────────────────────────────────────────────

function ChangeRow({ ch, onChange, onRemove, cascadeCities }: {
  ch: Change
  onChange: (patch: Partial<Change>) => void
  onRemove?: () => void
  cascadeCities: string[]
}) {
  const cfg = CHANGE_FIELDS.find(f => f.key === ch.field)!
  const isMS = cfg?.inputType === 'multiselect'

  const primaryOptions = useMemo<string[]>(() => {
    if (ch.field === 'city') return ALL_CITIES
    return cfg?.options ?? []
  }, [ch.field, cfg])

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-2.5">
      {/* Row 1 — Field (full width) + remove */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-muted mb-1">Field</label>
          <select value={ch.field}
            onChange={e => {
              const newCfg = CHANGE_FIELDS.find(f => f.key === e.target.value) ?? CHANGE_FIELDS[0]
              onChange({ field: e.target.value, how: newCfg.hows[0].key, value: '', values: [], cityValues: [] })
            }}
            className={inputCls}>
            <optgroup label="Mapping">
              {CHANGE_FIELDS.filter(f => f.category === 'mapping').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </optgroup>
            <optgroup label="Rates &amp; Charges">
              {CHANGE_FIELDS.filter(f => f.category === 'financial').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </optgroup>
            <optgroup label="Date">
              {CHANGE_FIELDS.filter(f => f.category === 'date').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </optgroup>
          </select>
        </div>
        <button onClick={onRemove} disabled={!onRemove}
          className={`mt-5 shrink-0 p-1.5 ${onRemove ? 'text-[#C7BFAE] hover:text-danger' : 'invisible'}`}>
          <IconX width={14} height={14}/>
        </button>
      </div>

      {/* Row 2 — How + Value side by side */}
      <div className="grid grid-cols-2 gap-2">
        {/* How */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-muted mb-1">How</label>
          <select value={ch.how}
            onChange={e => onChange({ how: e.target.value, value: '', values: [], cityValues: [] })}
            className={inputCls}>
            {cfg?.hows.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
          </select>
        </div>

        {/* Value */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-muted mb-1">
            {isMS ? cfg.label : `Value${cfg?.unit ? ` (${cfg.unit})` : ''}`}
          </label>
          {isMS ? (
            <MultiSelectDropdown
              options={primaryOptions}
              selected={ch.values}
              onChange={v => onChange({ values: v, cityValues: [] })}
              placeholder={`Select…`}
            />
          ) : cfg?.inputType === 'date' ? (
            <input type="date" value={ch.value} onChange={e => onChange({ value: e.target.value })} className={inputCls}/>
          ) : cfg?.inputType === 'text' ? (
            <input type="text" value={ch.value} onChange={e => onChange({ value: e.target.value })}
              placeholder={cfg.placeholder ?? 'Value…'} className={inputCls}/>
          ) : (
            <div className="flex items-center gap-1.5">
              <input type="number" step="any" min="0" value={ch.value}
                onChange={e => onChange({ value: e.target.value })}
                placeholder="0" className={`flex-1 ${inputCls}`}/>
              {cfg?.unit && <span className="shrink-0 text-sm text-muted">{cfg.unit}</span>}
            </div>
          )}
        </div>
      </div>

      {/* State → City cascade */}
      {ch.field === 'state' && (
        <div className="rounded-lg border border-border bg-[#F8F5EE] px-3 py-3 space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold text-ink">Cities</span>
            <span className="text-xs font-medium text-danger">* required</span>
            {ch.values.length === 0
              ? <span className="text-xs text-muted">— select states first</span>
              : ch.cityValues.length === 0
              ? <span className="text-xs text-muted">— pick cities within {ch.values.join(', ')}</span>
              : null}
          </div>
          <MultiSelectDropdown
            options={cascadeCities}
            selected={ch.cityValues}
            onChange={v => onChange({ cityValues: v })}
            placeholder={ch.values.length === 0 ? 'Select states first…' : 'Select cities…'}
            disabled={ch.values.length === 0}
          />
        </div>
      )}
    </div>
  )
}

// ── Impact row ────────────────────────────────────────────────────────────────

function ImpactRow({ impact }: { impact: PromoImpact }) {
  const hasFinancial = impact.fieldChanges.some(fc => fc.cfg.category === 'financial')
  return (
    <div className="py-3 text-sm border-b border-inherit last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div>
            <span className="font-medium text-ink">{impact.promo.name}</span>
            <span className="ml-2 font-mono text-xs text-muted">{impact.promo.id}</span>
          </div>
          <div className="mt-1.5 space-y-0.5">
            {impact.fieldChanges.map((fc, i) => (
              <div key={i} className="text-xs text-muted">
                <span className="font-medium text-ink/70">{fc.cfg.label}:</span>{' '}
                {fc.oldVal !== null && typeof fc.oldVal === 'number'
                  ? <>{fmtVal(fc.oldVal, fc.cfg)} → <span className="font-semibold text-ink">{fmtVal(fc.newVal, fc.cfg)}</span></>
                  : <span className="text-ink">{fc.newVal}</span>}
              </div>
            ))}
          </div>
        </div>
        {hasFinancial && impact.oldMargin !== null && impact.newMargin !== null && (
          <div className="shrink-0 text-right text-xs">
            <div className="text-muted">Margin</div>
            <div className="mt-0.5">
              <span className="text-muted">{impact.oldMargin.toFixed(1)}%</span>
              {' → '}
              <span className={impact.belowBenchmark ? 'font-semibold text-danger' : 'font-semibold text-success'}>
                {impact.newMargin.toFixed(1)}%
              </span>
            </div>
            <div className="text-muted">bench {impact.promo.benchmark}%</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function QueryUpdateView() {
  const { promos, navigate, queryUpdate } = useApp()

  const [stage, setStage]           = useState(0)
  const [conditions, setConditions] = useState<Condition[]>([defaultCondition('scheme')])
  const [changes, setChanges]       = useState<Change[]>([emptyChange('flatRate')])
  const [showList, setShowList]     = useState(false)
  const [done, setDone]             = useState(false)

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filledConds = conditions.filter(c => c.field && c.op && c.value)
  const matched = useMemo(() => {
    if (filledConds.length === 0) return []
    return promos.filter(p => {
      let result = matchPromo(p, filledConds[0])
      for (let i = 1; i < filledConds.length; i++) {
        const connector = filledConds[i].connector ?? 'AND'
        if (connector === 'AND') result = result && matchPromo(p, filledConds[i])
        else result = result || matchPromo(p, filledConds[i])
      }
      return result
    })
  }, [promos, filledConds])

  // ── Valid changes + impacts ────────────────────────────────────────────────

  const validChanges = changes.filter(isChangeComplete)
  const impacts      = useMemo(() => computeMultiImpacts(matched, validChanges), [matched, validChanges]) // eslint-disable-line
  const category     = overallCategory(validChanges)
  const belowCount   = impacts.filter(i => i.belowBenchmark).length
  const stage2Ok     = validChanges.length > 0 && validChanges.length === changes.length

  // Cascade cities per change row
  const cascadeCitiesFor = (ch: Change) =>
    ch.field === 'state' && ch.values.length > 0
      ? [...new Set(ch.values.flatMap(s => STATES_CITIES[s] ?? []))]
      : []

  // ── Restatement list ───────────────────────────────────────────────────────

  const restatements = useMemo<string[]>(() => {
    const n = matched.length
    const cs = `${n} promo${n !== 1 ? 's' : ''}`
    return validChanges.map(ch => {
      const cfg = CHANGE_FIELDS.find(f => f.key === ch.field)!
      if (!cfg) return ''
      if (cfg.inputType === 'multiselect') {
        if (ch.values.length === 0) return ''
        const valStr = ch.values.length === 1 ? ch.values[0] : `${ch.values.length} ${cfg.label.toLowerCase()}s`
        const city   = ch.field === 'state' && ch.cityValues.length > 0 ? ` + ${ch.cityValues.length} city(ies)` : ''
        const verb   = ch.how === 'add' ? 'added to' : ch.how === 'remove' ? 'removed from' : 'set on'
        return `${cfg.label} "${valStr}"${city} ${verb} ${cs}`
      }
      if (ch.field === 'validTo') return `End date on ${cs} ${ch.how} ${ch.value}`
      return `${cfg.label} on ${cs} ${ch.how} ${ch.value}${cfg.unit ?? ''}`
    }).filter(Boolean)
  }, [validChanges, matched.length])

  // ── Condition helpers ──────────────────────────────────────────────────────

  const updateCond  = (id: string, p: Partial<Condition>) => setConditions(prev => prev.map(c => c.id === id ? { ...c, ...p } : c))
  const switchField = (id: string, field: string) => {
    const cfg = COND_FIELDS.find(f => f.key === field) ?? COND_FIELDS[0]
    updateCond(id, { field, op: cfg.defaultOp, value: cfg.defaultValue })
  }
  const addCond    = () => setConditions(prev => [...prev, { ...defaultCondition('flatRate'), connector: 'AND' }])
  const removeCond = (id: string) => setConditions(prev => prev.filter(c => c.id !== id))

  // ── Change helpers ─────────────────────────────────────────────────────────

  const updateChange = (id: string, patch: Partial<Change>) => setChanges(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  const addChange    = () => setChanges(prev => [...prev, emptyChange('flatRate')])
  const removeChange = (id: string) => setChanges(prev => prev.filter(c => c.id !== id))

  // ── Apply ──────────────────────────────────────────────────────────────────

  const handleApply = () => {
    const allIds     = impacts.map(i => i.promo.id)
    const instantIds = category !== 'decrease' ? allIds : []
    const checkerIds = category === 'decrease' ? allIds : []
    queryUpdate({ instantIds, checkerIds, changes: validChanges })
    setDone(true)
  }

  // ── Done screen ────────────────────────────────────────────────────────────

  if (done) {
    const n = impacts.length
    return (
      <div className="mx-auto max-w-sm py-24 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <IconCheck width={30} height={30} className="text-success"/>
        </div>
        <h2 className="mt-5 font-serif text-2xl text-ink">Done</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {category !== 'decrease'
            ? <><span className="font-medium text-ink">{n} promo{n !== 1 ? 's' : ''}</span> updated instantly.</>
            : <><span className="font-medium text-ink">{n} promo{n !== 1 ? 's' : ''}</span> sent for approval as one batch.</>}
        </p>
        <div className="mt-8">
          <Button onClick={() => navigate({ name: 'existing-promos' })}>View Existing Promos</Button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-24">
      <div className="space-y-4">
        <h1 className="font-serif text-3xl text-ink">Query Update</h1>
        <StageBar stage={stage}/>
      </div>

      {/* ── Stage 0 — Find ───────────────────────────────────────────────────── */}
      {stage === 0 && (
        <div className="max-w-2xl space-y-5 animate-rise">
          <div>
            <h2 className="text-base font-semibold text-ink">Which promos?</h2>
            <p className="mt-0.5 text-sm text-muted">Filter by any combination of promo fields, rates, charges, tenure, or dates.</p>
          </div>

          <div className="space-y-2">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="flex items-center gap-3">
                <div className="w-10 shrink-0 text-center">
                  {idx === 0 ? (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">If</span>
                  ) : (
                    <button
                      onClick={() => updateCond(cond.id, { connector: cond.connector === 'OR' ? 'AND' : 'OR' })}
                      className="rounded-md border border-border bg-white px-2 py-0.5 text-xs font-semibold text-brand hover:border-brand hover:bg-brand/5 transition-colors"
                      title="Click to toggle AND / OR">
                      {cond.connector ?? 'AND'}
                    </button>
                  )}
                </div>
                <div className="flex-1">
                  <ConditionRow
                    cond={cond}
                    onField={f => switchField(cond.id, f)}
                    onOp={op => updateCond(cond.id, { op })}
                    onValue={v => updateCond(cond.id, { value: v })}
                    onRemove={idx > 0 ? () => removeCond(cond.id) : undefined}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pl-12">
            <button onClick={addCond} className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              <IconPlus width={14} height={14}/> Add condition
            </button>
          </div>

          {/* Live match count */}
          <div className={`ml-12 rounded-xl border px-5 py-4 transition-colors
            ${matched.length === 0 ? 'border-[#E3B7B0] bg-danger-bg' : 'border-[#B7D9C7] bg-[#F3FBF7]'}`}>
            {matched.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-danger">
                <IconAlert width={14} height={14} className="shrink-0"/>
                No promos match these conditions.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink">
                    <span className="font-serif text-3xl font-medium text-[#176038]">{matched.length}</span>
                    {' '}<span className="text-muted">promo{matched.length !== 1 ? 's' : ''} match.</span>
                  </p>
                  <button onClick={() => setShowList(l => !l)} className="text-sm font-medium text-brand hover:underline">
                    {showList ? 'Hide' : 'View list'}
                  </button>
                </div>
                {showList && (
                  <div className="mt-3 max-h-52 overflow-y-auto divide-y divide-[#D0EDDD] border-t border-[#D0EDDD] pt-2">
                    {matched.map(p => {
                      const det = detailForPromo(p)
                      return (
                        <div key={p.id} className="py-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-ink">{p.name}</span>
                            <span className="text-muted">{p.id} · {p.status}</span>
                          </div>
                          <div className="mt-0.5 text-muted">
                            {p.manufacturer} · Flat Rate {det.flatRate}% · PF {det.pfPct ?? 2}% · Dealer {det.dealerPayout}% · Margin {p.margin?.toFixed(1) ?? '—'}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button disabled={matched.length === 0} onClick={() => setStage(1)}>
              Next: Set update →
            </Button>
          </div>
        </div>
      )}

      {/* ── Stage 1 — Update ─────────────────────────────────────────────────── */}
      {stage === 1 && (
        <div className="max-w-2xl space-y-5 animate-rise">
          <div>
            <h2 className="text-base font-semibold text-ink">What should change?</h2>
            <p className="mt-0.5 text-sm text-muted">
              Add one or more changes — all applied to {matched.length} promo{matched.length !== 1 ? 's' : ''} in one batch.
            </p>
          </div>

          {/* Active filter pills */}
          <div className="flex flex-wrap gap-2">
            {filledConds.map((c, idx) => {
              const cfg = COND_FIELDS.find(f => f.key === c.field)
              return (
                <span key={c.id} className="flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted">
                  {idx > 0 && <span className="text-[10px] font-semibold uppercase text-brand">{c.connector ?? 'AND'}</span>}
                  <span className="font-medium text-ink">{cfg?.label ?? c.field}</span>
                  {' '}{c.op}{' '}
                  <span className="font-medium text-ink">{c.value}{cfg?.unit}</span>
                </span>
              )
            })}
          </div>

          {/* Change rows */}
          <div className="space-y-3">
            {changes.map((ch, idx) => (
              <div key={ch.id} className="flex items-start gap-2">
                <div className="w-10 shrink-0 pt-3.5 text-center">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {idx === 0 ? 'Set' : 'And'}
                  </span>
                </div>
                <div className="flex-1">
                  <ChangeRow
                    ch={ch}
                    onChange={patch => updateChange(ch.id, patch)}
                    onRemove={changes.length > 1 ? () => removeChange(ch.id) : undefined}
                    cascadeCities={cascadeCitiesFor(ch)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pl-12">
            <button onClick={addChange} className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              <IconPlus width={14} height={14}/> Add another change
            </button>
          </div>

          {/* Restatement */}
          {restatements.length > 0 && (
            <div className="rounded-lg border border-[#B7D9C7] bg-[#F3FBF7] px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-[#176038]">You're about to:</p>
              {restatements.map((r, i) => (
                <p key={i} className="text-sm text-[#176038] italic">• {r}</p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button variant="secondary" onClick={() => setStage(0)}>← Back</Button>
            <Button disabled={!stage2Ok} onClick={() => setStage(2)}>Next: Preview impact →</Button>
          </div>
        </div>
      )}

      {/* ── Stage 2 — Preview & Apply ─────────────────────────────────────────── */}
      {stage === 2 && (
        <div className="max-w-2xl space-y-5 animate-rise">
          <div>
            <h2 className="text-base font-semibold text-ink">Preview & Apply</h2>
            {restatements.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {restatements.map((r, i) => (
                  <p key={i} className="text-sm italic text-muted">• {r}</p>
                ))}
              </div>
            )}
          </div>

          {/* Increase — green */}
          {category === 'increase' && (
            <div className="overflow-hidden rounded-xl border border-[#B7D9C7]">
              <div className="bg-[#E8F5EE] px-5 py-4">
                <div className="flex items-center gap-2">
                  <IconCheck width={16} height={16} className="shrink-0 text-success"/>
                  <span className="font-semibold text-[#176038]">{impacts.length} promo{impacts.length !== 1 ? 's' : ''} will update instantly.</span>
                </div>
                <p className="mt-1 text-sm text-[#176038]/80">All changes raise profit or expand reach — no approval needed.</p>
              </div>
              <div className="bg-[#F3FBF7] px-5">
                {impacts.map(imp => <ImpactRow key={imp.promo.id} impact={imp}/>)}
              </div>
            </div>
          )}

          {/* Reach — neutral */}
          {category === 'reach' && (
            <div className="overflow-hidden rounded-xl border border-[#C7BFAE]">
              <div className="bg-[#F8F5EE] px-5 py-4">
                <div className="flex items-center gap-2">
                  <IconCheck width={16} height={16} className="shrink-0 text-[#6E5C4A]"/>
                  <span className="font-semibold text-[#3D3024]">{impacts.length} promo{impacts.length !== 1 ? 's' : ''} will update instantly.</span>
                </div>
                <p className="mt-1 text-sm text-muted">No money terms change — no approval needed.</p>
              </div>
              <div className="bg-white px-5">
                {impacts.map(imp => <ImpactRow key={imp.promo.id} impact={imp}/>)}
              </div>
            </div>
          )}

          {/* Decrease — amber */}
          {category === 'decrease' && (
            <div className="overflow-hidden rounded-xl border border-[#F5CAAD]">
              <div className="bg-[#FEF0E0] px-5 py-4">
                <div className="flex items-center gap-2">
                  <IconAlert width={16} height={16} className="shrink-0 text-[#B94500]"/>
                  <span className="font-semibold text-[#B94500]">{impacts.length} promo{impacts.length !== 1 ? 's' : ''} — sent to checker as one batch.</span>
                </div>
                <p className="mt-1 text-sm text-[#B94500]/80">
                  One or more changes lower profit, so a checker reviews them.
                  {belowCount > 0 && <> <span className="font-semibold">{belowCount} will fall below benchmark.</span></>}
                </p>
              </div>
              <div className="bg-[#FFF8F0] px-5">
                {impacts.map(imp => <ImpactRow key={imp.promo.id} impact={imp}/>)}
              </div>
            </div>
          )}

          {impacts.length === 0 && (
            <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
              No impact to show — verify the change values are valid.
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="secondary" onClick={() => setStage(1)}>← Back</Button>
            <Button disabled={impacts.length === 0} onClick={handleApply}>
              {category === 'decrease'
                ? `Send ${impacts.length} to checker`
                : `Apply to ${impacts.length} promo${impacts.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
