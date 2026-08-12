import { useState, useMemo, useRef } from 'react'
import { useApp } from '../../store/AppContext'
import type { BaseMasterEntry, MasterAuditEntry, MasterKey } from '../../data/types'
import { IconX, IconSearch, IconClock, IconCheck, IconUpload, IconAlert } from '../../components/ui/icons'
import { STATES_CITIES, MANUFACTURERS } from '../../data/seed'

// ── Field definition ──────────────────────────────────────────────────────

type FieldType = 'text' | 'dropdown' | 'multi-select' | 'toggle' | 'date' | 'number' | 'email'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  required?: boolean
  readOnly?: boolean
  hint?: string
  condition?: (vals: Record<string, unknown>) => boolean
}

// ── Column definition ─────────────────────────────────────────────────────

interface ColDef {
  key: string
  label: string
  render?: (row: Record<string, unknown>) => React.ReactNode
}

// ── Master config ─────────────────────────────────────────────────────────

interface MasterConfig {
  name: string
  description: string
  entryLabel: (row: Record<string, unknown>) => string
  columns: ColDef[]
  fields: FieldDef[]
  csvHeaders?: string[]
}

const ALL_STATES = Object.keys(STATES_CITIES)
const ALL_CITIES = Object.values(STATES_CITIES).flat()
const ALL_MFRS = [...MANUFACTURERS]
const ZONES = ['West', 'South', 'North', 'East']
const APPROVER_ROLES = ['RH', 'ZH', 'NSM', 'PH', 'BH']
const PROF_COMPONENTS = ['CoF', 'Opex', 'NCL Delinquency', 'NCL Multiplier', 'Benchmark']

const MASTER_CONFIGS: Record<MasterKey, MasterConfig> = {
  profComponents: {
    name: 'Profitability Component Master',
    description: 'Income and expense components used by the margin engine.',
    entryLabel: r => String(r.name),
    columns: [
      { key: 'name', label: 'Component Name' },
      { key: 'type', label: 'Type' },
      { key: 'source', label: 'Source' },
      { key: 'includeInEngine', label: 'In Engine', render: r => r.includeInEngine ? <span className="text-success font-medium">Yes</span> : <span className="text-muted">No</span> },
    ],
    fields: [
      { key: 'name', label: 'Component Name', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'dropdown', options: ['Income', 'Expense'], required: true },
      { key: 'includeInEngine', label: 'Include in Engine', type: 'toggle' },
      { key: 'source', label: 'Source', type: 'dropdown', options: ['Calculated', 'User Input', 'Master'], required: true },
    ],
  },
  profValues: {
    name: 'Profitability Value Master',
    description: 'Numeric values used by the margin engine — CoF, Opex, NCL, Benchmark.',
    entryLabel: r => `${r.component}${r.state ? ' · ' + r.state : ' · PAN-India'}`,
    columns: [
      { key: 'component', label: 'Component' },
      { key: 'scope', label: 'Scope' },
      { key: 'state', label: 'State', render: r => String(r.state || '—') },
      { key: 'value', label: 'Value', render: r => `${r.value}%` },
      { key: 'effectiveFrom', label: 'Effective From' },
    ],
    fields: [
      { key: 'component', label: 'Component', type: 'dropdown', options: PROF_COMPONENTS, required: true },
      { key: 'scope', label: 'Scope', type: 'dropdown', options: ['PAN-India', 'State-wise'], required: true },
      { key: 'state', label: 'State', type: 'dropdown', options: ALL_STATES, condition: v => v.scope === 'State-wise', required: true },
      { key: 'value', label: 'Value (%)', type: 'number', required: true },
      { key: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
    ],
  },
  states: {
    name: 'State Master',
    description: 'States with zone mapping.',
    entryLabel: r => String(r.name),
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'State Name' },
      { key: 'zone', label: 'Zone' },
    ],
    fields: [
      { key: 'code', label: 'State Code', type: 'text', required: true },
      { key: 'name', label: 'State Name', type: 'text', required: true },
      { key: 'zone', label: 'Zone', type: 'dropdown', options: ZONES },
    ],
    csvHeaders: ['code', 'name', 'zone'],
  },
  cities: {
    name: 'City Master',
    description: 'Cities linked to states.',
    entryLabel: r => String(r.name),
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'City Name' },
      { key: 'state', label: 'State' },
    ],
    fields: [
      { key: 'code', label: 'City Code', type: 'text', required: true },
      { key: 'name', label: 'City Name', type: 'text', required: true },
      { key: 'state', label: 'State', type: 'dropdown', options: ALL_STATES, required: true },
    ],
    csvHeaders: ['code', 'name', 'state'],
  },
  manufacturers: {
    name: 'Manufacturer Master',
    description: 'OEM brands supported by the tool.',
    entryLabel: r => String(r.name),
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Manufacturer Name' },
    ],
    fields: [
      { key: 'code', label: 'Manufacturer Code', type: 'text', required: true },
      { key: 'name', label: 'Manufacturer Name', type: 'text', required: true },
    ],
    csvHeaders: ['code', 'name'],
  },
  makes: {
    name: 'Make Master',
    description: 'Make lines linked to manufacturers.',
    entryLabel: r => String(r.name),
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Make Name' },
      { key: 'manufacturer', label: 'Manufacturer' },
    ],
    fields: [
      { key: 'code', label: 'Make Code', type: 'text', required: true },
      { key: 'name', label: 'Make Name', type: 'text', required: true },
      { key: 'manufacturer', label: 'Manufacturer', type: 'dropdown', options: ALL_MFRS, required: true },
    ],
    csvHeaders: ['code', 'name', 'manufacturer'],
  },
  models: {
    name: 'Model Master',
    description: 'Models linked to makes and manufacturers.',
    entryLabel: r => String(r.name),
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Model Name' },
      { key: 'make', label: 'Make' },
      { key: 'manufacturer', label: 'Manufacturer' },
    ],
    fields: [
      { key: 'code', label: 'Model Code', type: 'text', required: true },
      { key: 'name', label: 'Model Name', type: 'text', required: true },
      { key: 'manufacturer', label: 'Manufacturer', type: 'dropdown', options: ALL_MFRS, required: true },
      { key: 'make', label: 'Make', type: 'text', required: true },
    ],
    csvHeaders: ['code', 'name', 'manufacturer', 'make'],
  },
  salesPoints: {
    name: 'Sales Point Master',
    description: 'Dealer outlets — city, manufacturers, and dealer type.',
    entryLabel: r => String(r.name),
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Sales Point Name' },
      { key: 'city', label: 'City' },
      { key: 'manufacturers', label: 'Manufacturers', render: r => (r.manufacturers as string[]).join(', ') },
      { key: 'dealerType', label: 'Type', render: r => <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.dealerType === 'MBO' ? 'bg-brand/10 text-brand' : 'bg-cream text-muted'}`}>{String(r.dealerType)}</span> },
    ],
    fields: [
      { key: 'code', label: 'Sales Point Code', type: 'text', required: true },
      { key: 'name', label: 'Sales Point Name', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'dropdown', options: ALL_CITIES, required: true },
      { key: 'manufacturers', label: 'Manufacturers', type: 'multi-select', options: ALL_MFRS, required: true },
      { key: 'dealerType', label: 'Dealer Type', type: 'text', readOnly: true, hint: 'Auto: SBO if 1 manufacturer, MBO if 2+' },
    ],
  },
  approvalMatrix: {
    name: 'Approval Matrix Master',
    description: 'State-wise normal and breach approver routing.',
    entryLabel: r => `${r.state} · ${r.promoGroup}`,
    columns: [
      { key: 'state', label: 'State' },
      { key: 'promoGroup', label: 'Group' },
      { key: 'normalApproverName', label: 'Normal Approver' },
      { key: 'normalApproverRole', label: 'Role' },
      { key: 'breachApproverName', label: 'Breach Approver' },
      { key: 'slaHours', label: 'SLA (h)' },
    ],
    fields: [
      { key: 'state', label: 'State', type: 'dropdown', options: ALL_STATES, required: true },
      { key: 'promoGroup', label: 'Promo Group', type: 'dropdown', options: ['Manufacturer', 'Competitive'], required: true },
      { key: 'normalApproverName', label: 'Normal Approver Name', type: 'text', required: true },
      { key: 'normalApproverEmail', label: 'Normal Approver Email', type: 'email', required: true },
      { key: 'normalApproverRole', label: 'Normal Approver Role', type: 'dropdown', options: APPROVER_ROLES, required: true },
      { key: 'breachApproverName', label: 'Breach Approver Name', type: 'text', required: true },
      { key: 'breachApproverEmail', label: 'Breach Approver Email', type: 'email', required: true },
      { key: 'breachApproverRole', label: 'Breach Approver Role', type: 'dropdown', options: APPROVER_ROLES, required: true },
      { key: 'backupApproverEmail', label: 'Backup Approver Email', type: 'email' },
      { key: 'slaHours', label: 'SLA (hours)', type: 'number', required: true },
    ],
  },
  users: {
    name: 'User / Role Master',
    description: 'All users, their roles, and geographic access scope.',
    entryLabel: r => String(r.name),
    columns: [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'accessScope', label: 'Scope' },
      { key: 'zone', label: 'Zone', render: r => String(r.zone || '—') },
    ],
    fields: [
      { key: 'employeeId', label: 'Employee ID', type: 'text', required: true },
      { key: 'name', label: 'Full Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'role', label: 'Role', type: 'dropdown', options: ['Maker', 'Checker', 'Admin', 'Viewer'], required: true },
      { key: 'accessScope', label: 'Access Scope', type: 'dropdown', options: ['PAN-India', 'Zone', 'State'], required: true },
      { key: 'zone', label: 'Zone', type: 'dropdown', options: ZONES, condition: v => v.accessScope === 'Zone', required: true },
      { key: 'states', label: 'States', type: 'multi-select', options: ALL_STATES, condition: v => v.accessScope === 'State', required: true },
    ],
  },
  reasonCodes: {
    name: 'Reason Code Master',
    description: 'Pre-defined reasons for Reject, Rework, Deactivate, and Demap.',
    entryLabel: r => String(r.code),
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'code', label: 'Code' },
      { key: 'text', label: 'Reason Text' },
    ],
    fields: [
      { key: 'category', label: 'Category', type: 'dropdown', options: ['Reject', 'Rework', 'Deactivate', 'Demap'], required: true },
      { key: 'code', label: 'Reason Code', type: 'text', required: true },
      { key: 'text', label: 'Reason Text', type: 'text', required: true },
    ],
    csvHeaders: ['category', 'code', 'text'],
  },
  chargeSchedules: {
    name: 'Schedule of Charges',
    description: 'Permitted charge types and value bands — validated against Finnone.',
    entryLabel: r => `${r.chargeCode} · ${r.chargeName}`,
    columns: [
      { key: 'chargeCode', label: 'Code' },
      { key: 'chargeName', label: 'Charge Name' },
      { key: 'allowedType', label: 'Allowed Type' },
      { key: 'permittedValues', label: 'Permitted Values' },
    ],
    fields: [
      { key: 'chargeCode', label: 'Charge Code', type: 'text', required: true },
      { key: 'chargeName', label: 'Charge Name', type: 'text', required: true },
      { key: 'allowedType', label: 'Allowed Type', type: 'dropdown', options: ['%', 'Amount', 'Both'], required: true },
      { key: 'minValue', label: 'Min Value', type: 'number', required: true },
      { key: 'maxValue', label: 'Max Value', type: 'number', required: true },
      { key: 'permittedValues', label: 'Permitted Values Description', type: 'text', required: true, hint: 'e.g. 0–5% or ₹0–5000' },
    ],
    csvHeaders: ['chargeCode', 'chargeName', 'allowedType', 'minValue', 'maxValue', 'permittedValues'],
  },
}

// ── Status pill ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
      status === 'Active' ? 'bg-[#EAF6EE] text-[#1A7A3E]' : 'bg-[#F5F5F5] text-[#888]'
    }`}>
      {status}
    </span>
  )
}

// ── History panel ─────────────────────────────────────────────────────────

function HistoryPanel({ entry, onClose }: { entry: BaseMasterEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-ink/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="flex h-full w-[400px] flex-col border-l border-border bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-medium text-ink">Version History</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:bg-cream hover:text-ink">
            <IconX width={18} height={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {entry.history.length === 0 ? (
            <p className="text-sm text-muted">No history recorded.</p>
          ) : (
            <ol className="relative border-l border-border/60 ml-2 space-y-6">
              {[...entry.history].reverse().map((h: MasterAuditEntry, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-surface bg-border" />
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      h.action === 'Created' ? 'bg-[#EAF6EE] text-[#1A7A3E]'
                      : h.action === 'Deactivated' ? 'bg-[#FEF3F2] text-danger'
                      : h.action === 'Reactivated' ? 'bg-[#EAF6EE] text-[#1A7A3E]'
                      : 'bg-cream text-muted'
                    }`}>{h.action}</span>
                    <span className="text-xs text-muted">by {h.by}</span>
                  </div>
                  <time className="mt-1 block text-xs text-muted">
                    {new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </time>
                  {h.before && (
                    <div className="mt-2 rounded border border-border bg-cream/40 p-2 text-xs text-muted">
                      {Object.entries(h.after ?? {})
                        .filter(([k]) => !['id','status','createdAt','updatedAt','history'].includes(k))
                        .map(([k, v]) => {
                          const before = (h.before as Record<string, unknown>)[k]
                          if (JSON.stringify(before) === JSON.stringify(v)) return null
                          return (
                            <div key={k}><span className="font-medium text-ink">{k}</span>: {JSON.stringify(before)} → {JSON.stringify(v)}</div>
                          )
                        })
                        .filter(Boolean)}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add / Edit drawer ─────────────────────────────────────────────────────

function EntryDrawer({
  config,
  initial,
  onSave,
  onClose,
}: {
  config: MasterConfig
  initial: Record<string, unknown> | null
  onSave: (values: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial ?? {})

  const set = (key: string, val: unknown) => setValues(prev => ({ ...prev, [key]: val }))

  const allRequiredFilled = config.fields
    .filter(f => f.required && (!f.condition || f.condition(values)))
    .every(f => {
      const v = values[f.key]
      if (Array.isArray(v)) return v.length > 0
      return v !== undefined && v !== '' && v !== null
    })

  const handleSave = () => {
    // Auto-calculate dealerType for salesPoints
    if ('manufacturers' in values) {
      const mfrs = values.manufacturers as string[]
      set('dealerType', mfrs.length > 1 ? 'MBO' : 'SBO')
    }
    onSave(values)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-ink/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="flex h-full w-[480px] flex-col border-l border-border bg-surface shadow-soft">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-medium text-ink">{initial ? 'Edit Entry' : 'Add Entry'}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:bg-cream hover:text-ink">
            <IconX width={18} height={18} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {config.fields.map(field => {
            if (field.condition && !field.condition(values)) return null
            const val = values[field.key]

            return (
              <div key={field.key}>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  {field.label}
                  {field.required && <span className="ml-0.5 text-danger">*</span>}
                </label>

                {field.type === 'toggle' ? (
                  <button
                    type="button"
                    onClick={() => set(field.key, !val)}
                    className={`flex h-6 w-11 items-center rounded-full transition-colors ${val ? 'bg-brand' : 'bg-border'}`}
                  >
                    <span className={`ml-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                ) : field.type === 'dropdown' ? (
                  <select
                    value={String(val ?? '')}
                    onChange={e => set(field.key, e.target.value)}
                    className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                    disabled={field.readOnly}
                  >
                    <option value="">Select…</option>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.type === 'multi-select' ? (
                  <div className="rounded-input border border-border bg-surface">
                    <div className="max-h-40 overflow-y-auto divide-y divide-border/50">
                      {field.options?.map(o => {
                        const selected = Array.isArray(val) && (val as string[]).includes(o)
                        return (
                          <label key={o} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-cream">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                const arr = Array.isArray(val) ? (val as string[]) : []
                                set(field.key, selected ? arr.filter(x => x !== o) : [...arr, o])
                              }}
                              className="h-3.5 w-3.5 rounded accent-brand"
                            />
                            <span className="text-sm text-ink">{o}</span>
                          </label>
                        )
                      })}
                    </div>
                    {Array.isArray(val) && (val as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1 border-t border-border/50 px-3 py-2">
                        {(val as string[]).map(v => (
                          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                            {v}
                            <button onClick={() => set(field.key, (val as string[]).filter(x => x !== v))} className="hover:text-danger">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : field.readOnly ? (
                  <div className="rounded-input border border-border bg-cream/60 px-3 py-2 text-sm text-muted">
                    {String(val ?? (field.hint ?? '—'))}
                    {field.hint && <span className="ml-1 text-xs text-muted">({field.hint})</span>}
                  </div>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                    value={String(val ?? '')}
                    onChange={e => set(field.key, field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
                    className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                    placeholder={field.label}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-input border border-border py-2.5 text-sm text-muted hover:bg-cream"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!allRequiredFilled}
              className="flex-1 rounded-input bg-brand py-2.5 text-sm font-medium text-white transition hover:bg-[#86162a] disabled:opacity-40"
            >
              {initial ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Deactivate confirm dialog ─────────────────────────────────────────────

function DeactivateDialog({
  label,
  onConfirm,
  onCancel,
}: {
  label: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]">
      <div className="w-[420px] rounded-card border border-border bg-surface p-6 shadow-soft">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-danger/10">
          <IconAlert width={20} height={20} className="text-danger" />
        </div>
        <h3 className="mt-4 font-medium text-ink">Deactivate "{label}"?</h3>
        <p className="mt-1.5 text-sm text-muted">
          The entry will be hidden from active lists but its history will be preserved. It can be reactivated at any time.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-input border border-border py-2.5 text-sm hover:bg-cream">Cancel</button>
          <button onClick={onConfirm} className="flex-1 rounded-input bg-danger py-2.5 text-sm font-medium text-white hover:opacity-90">
            Deactivate
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CSV Upload panel ──────────────────────────────────────────────────────

function CsvUpload({
  config,
  onImport,
  onClose,
}: {
  config: MasterConfig
  onImport: (rows: Record<string, unknown>[]) => void
  onClose: () => void
}) {
  const [stage, setStage] = useState<'idle' | 'error' | 'preview'>('idle')
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const headers = config.csvHeaders ?? config.fields.filter(f => !f.readOnly).map(f => f.key)

  const validate = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = (e.target?.result as string) ?? ''
      const lines = text.trim().split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) { setErrors(['File must have a header row and at least one data row.']); setStage('error'); return }
      const fileHeaders = lines[0].split(',').map(h => h.trim().toLowerCase())
      const errs: string[] = []
      const rows: Record<string, unknown>[] = []
      lines.slice(1).forEach((line, i) => {
        const cols = line.split(',').map(c => c.trim())
        if (cols.length !== fileHeaders.length) { errs.push(`Row ${i + 2}: wrong column count`); return }
        const row: Record<string, unknown> = {}
        headers.forEach(h => {
          const idx = fileHeaders.indexOf(h.toLowerCase())
          row[h] = idx >= 0 ? cols[idx] : ''
        })
        // required field check
        const requiredFields = config.fields.filter(f => f.required && !f.condition)
        requiredFields.forEach(f => {
          if (!row[f.key]) errs.push(`Row ${i + 2}: "${f.key}" is required`)
        })
        if (errs.length === 0) rows.push(row)
      })
      if (errs.length > 0) { setErrors(errs); setStage('error') }
      else { setPreview(rows); setStage('preview') }
    }
    reader.readAsText(file)
  }

  const triggerDownload = () => {
    const csv = [headers.join(','), headers.map(() => 'example').join(',')].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `${config.name.toLowerCase().replace(/\s+/g, '_')}_template.csv`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]">
      <div className="w-[520px] rounded-card border border-border bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-medium text-ink">Bulk Upload — {config.name}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:bg-cream"><IconX width={16} height={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Template */}
          <div className="flex items-center justify-between rounded-card border border-border bg-cream/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">Download template</p>
              <p className="text-xs text-muted">Columns: {headers.join(', ')}</p>
            </div>
            <button onClick={triggerDownload} className="flex items-center gap-1.5 rounded-input border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/5">
              <IconUpload width={12} height={12} className="rotate-180" /> Download
            </button>
          </div>

          {/* Drop zone */}
          {stage === 'idle' && (
            <div
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-surface/60 p-10 hover:border-brand/40"
            >
              <IconUpload width={22} height={22} className="text-muted" />
              <p className="text-sm font-medium text-ink">Drop CSV here or click to browse</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) validate(f); e.target.value = '' }} />
            </div>
          )}

          {/* Errors */}
          {stage === 'error' && (
            <div className="rounded-card border border-danger-bg bg-danger-bg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <IconAlert width={14} height={14} className="text-danger" />
                <p className="text-sm font-medium text-danger">{errors.length} error{errors.length > 1 ? 's' : ''} — fix and re-upload</p>
              </div>
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {errors.map((e, i) => <li key={i} className="text-xs text-danger">• {e}</li>)}
              </ul>
              <button onClick={() => { setStage('idle'); setErrors([]) }} className="text-xs font-medium text-brand hover:underline">Try again</button>
            </div>
          )}

          {/* Preview */}
          {stage === 'preview' && (
            <div className="rounded-card border border-border bg-cream/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-success">
                <IconCheck width={16} height={16} />
                <p className="text-sm font-medium">{preview.length} row{preview.length > 1 ? 's' : ''} validated and ready to import</p>
              </div>
              <div className="max-h-32 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr>{headers.map(h => <th key={h} className="py-1 pr-3 text-left font-medium text-muted uppercase tracking-wide">{h}</th>)}</tr></thead>
                  <tbody>{preview.slice(0, 5).map((row, i) => <tr key={i}>{headers.map(h => <td key={h} className="py-1 pr-3 text-ink">{String(row[h] ?? '')}</td>)}</tr>)}</tbody>
                </table>
                {preview.length > 5 && <p className="mt-1 text-xs text-muted">… and {preview.length - 5} more</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-border px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-input border border-border py-2.5 text-sm hover:bg-cream">Cancel</button>
          <button
            onClick={() => { onImport(preview); onClose() }}
            disabled={stage !== 'preview'}
            className="flex-1 rounded-input bg-brand py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#86162a]"
          >
            Import {stage === 'preview' ? preview.length : ''} row{preview.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main MasterDetail component ───────────────────────────────────────────

export function MasterDetail({ masterKey }: { masterKey: MasterKey }) {
  const { masters, navigate, addMasterEntry, editMasterEntry, deactivateMasterEntry, reactivateMasterEntry } = useApp()
  const config = MASTER_CONFIGS[masterKey]
  const entries = masters[masterKey] as BaseMasterEntry[]

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [drawerEntry, setDrawerEntry] = useState<Record<string, unknown> | null | undefined>(undefined) // undefined=closed, null=new, obj=edit
  const [historyEntry, setHistoryEntry] = useState<BaseMasterEntry | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<BaseMasterEntry | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (statusFilter !== 'All' && e.status !== statusFilter) return false
      if (!q) return true
      return config.columns.some(col => {
        const val = (e as Record<string, unknown>)[col.key]
        return String(val ?? '').toLowerCase().includes(q.toLowerCase())
      })
    })
  }, [entries, q, statusFilter, config.columns])

  const handleSave = (vals: Record<string, unknown>) => {
    if (drawerEntry) {
      editMasterEntry(masterKey, String(drawerEntry.id), vals)
    } else {
      addMasterEntry(masterKey, vals)
    }
    setDrawerEntry(undefined)
  }

  const handleImport = (rows: Record<string, unknown>[]) => {
    rows.forEach(row => addMasterEntry(masterKey, row))
  }

  const thCls = 'border-b border-border bg-cream/60 px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted whitespace-nowrap'
  const tdCls = 'px-3 py-2.5 text-sm text-ink align-middle'

  return (
    <div className="space-y-5 py-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate({ name: 'masters' })}
            className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink"
          >
            ← Back to Masters
          </button>
          <h1 className="font-serif text-2xl text-ink">{config.name}</h1>
          <p className="mt-0.5 text-sm text-muted">{config.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-input border border-border px-3 py-2 text-sm text-muted hover:bg-cream"
          >
            <IconUpload width={14} height={14} /> Upload CSV
          </button>
          <button
            onClick={() => setDrawerEntry(null)}
            className="rounded-input bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-[#86162a]"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={14} height={14} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-input border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/40"
        >
          <option>All</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <span className="text-xs text-muted">{filtered.length} entries</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {config.columns.map(col => <th key={col.key} className={thCls}>{col.label}</th>)}
              <th className={thCls}>Status</th>
              <th className={thCls}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length + 2} className="px-4 py-10 text-center text-sm text-muted">
                  No entries found.
                </td>
              </tr>
            ) : (
              filtered.map(entry => {
                const row = entry as Record<string, unknown>
                return (
                  <tr key={entry.id} className={`border-b border-border/50 last:border-0 ${entry.status === 'Inactive' ? 'bg-[#FAFAF9] opacity-70' : 'hover:bg-cream/30'}`}>
                    {config.columns.map(col => (
                      <td key={col.key} className={tdCls}>
                        {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                      </td>
                    ))}
                    <td className={tdCls}><StatusPill status={entry.status} /></td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        {/* History */}
                        <button
                          title="Version history"
                          onClick={() => setHistoryEntry(entry)}
                          className="rounded p-1 text-muted hover:bg-cream hover:text-ink"
                        >
                          <IconClock width={14} height={14} />
                        </button>
                        {/* Edit */}
                        {entry.status === 'Active' && (
                          <button
                            onClick={() => setDrawerEntry(row)}
                            className="rounded px-2 py-1 text-xs font-medium text-brand hover:bg-brand/5"
                          >
                            Edit
                          </button>
                        )}
                        {/* Deactivate / Reactivate */}
                        {entry.status === 'Active' ? (
                          <button
                            onClick={() => setDeactivateTarget(entry)}
                            className="rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger/5"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivateMasterEntry(masterKey, entry.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-success hover:bg-success/5"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {drawerEntry !== undefined && (
        <EntryDrawer
          config={config}
          initial={drawerEntry}
          onSave={handleSave}
          onClose={() => setDrawerEntry(undefined)}
        />
      )}

      {/* History panel */}
      {historyEntry && (
        <HistoryPanel entry={historyEntry} onClose={() => setHistoryEntry(null)} />
      )}

      {/* Deactivate dialog */}
      {deactivateTarget && (
        <DeactivateDialog
          label={config.entryLabel(deactivateTarget as Record<string, unknown>)}
          onConfirm={() => {
            deactivateMasterEntry(masterKey, deactivateTarget.id)
            setDeactivateTarget(null)
          }}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}

      {/* CSV Upload */}
      {showUpload && (
        <CsvUpload config={config} onImport={handleImport} onClose={() => setShowUpload(false)} />
      )}
    </div>
  )
}
