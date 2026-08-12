import { useRef, useState } from 'react'
import { useApp, type BulkRow } from '../store/AppContext'
import { Button, Modal } from '../components/ui/primitives'
import { IconUpload, IconAlert, IconCheck } from '../components/ui/icons'
import { STATES_CITIES, MANUFACTURERS, MODELS, SALES_POINTS, DEACTIVATION_REASONS } from '../data/seed'
import { formatDate } from '../lib/format'

// ── Mode ─────────────────────────────────────────────────────────────────────

type BulkMode = 'map' | 'demap' | 'deactivate'

const MODES: { value: BulkMode; label: string }[] = [
  { value: 'map',        label: 'Map / Extend' },
  { value: 'demap',      label: 'Demap' },
  { value: 'deactivate', label: 'Deactivate' },
]

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
  return { headers, rows }
}

// ── Shared types ──────────────────────────────────────────────────────────────

interface ValidationError {
  row: number
  col: string
  value: string
  message: string
}

// ── Map / Extend ──────────────────────────────────────────────────────────────

const MAP_REQUIRED = ['promo_id']
const MAP_OPTIONAL = ['state', 'city', 'manufacturer', 'model', 'sales_point_id', 'new_end_date']
const MAP_ALL = [...MAP_REQUIRED, ...MAP_OPTIONAL]

interface MapRow {
  rowNum: number; promoId: string
  state?: string; city?: string; manufacturer?: string
  model?: string; salesPointId?: string; newEndDate?: string
  changes: string[]
}

function validateMapRows(
  rawRows: Record<string, string>[],
  promos: ReturnType<typeof useApp>['promos'],
): { errors: ValidationError[]; valid: MapRow[] } {
  const errors: ValidationError[] = []
  const valid: MapRow[] = []
  rawRows.forEach((raw, i) => {
    const rowNum = i + 2
    const promoId = raw['promo_id'] ?? ''
    if (!promoId) { errors.push({ row: rowNum, col: 'promo_id', value: '', message: 'Promo ID is required' }); return }
    const promo = promos.find((p) => p.id === promoId)
    if (!promo) { errors.push({ row: rowNum, col: 'promo_id', value: promoId, message: 'Promo not found' }); return }
    if (promo.status !== 'Live') { errors.push({ row: rowNum, col: 'promo_id', value: promoId, message: `Promo is ${promo.status}, not Live` }); return }

    const parsed: MapRow = { rowNum, promoId, changes: [] }

    const state = raw['state']
    if (state) {
      if (!STATES_CITIES[state]) { errors.push({ row: rowNum, col: 'state', value: state, message: 'Unknown state' }); return }
      parsed.state = state
      if (state !== promo.state) parsed.changes.push(`State → ${state}`)
    }
    const city = raw['city']
    if (city) {
      const stateToCheck = parsed.state ?? promo.state
      if (!(STATES_CITIES[stateToCheck] ?? []).includes(city)) { errors.push({ row: rowNum, col: 'city', value: city, message: `City not in ${stateToCheck}` }); return }
      parsed.city = city
      if (city !== promo.city) parsed.changes.push(`City → ${city}`)
    }
    const mfr = raw['manufacturer']
    if (mfr) {
      if (!(MANUFACTURERS as readonly string[]).includes(mfr)) { errors.push({ row: rowNum, col: 'manufacturer', value: mfr, message: 'Unknown manufacturer' }); return }
      parsed.manufacturer = mfr
      if (mfr !== promo.manufacturer) parsed.changes.push(`Manufacturer → ${mfr}`)
    }
    const model = raw['model']
    if (model) {
      const mfrToCheck = parsed.manufacturer ?? promo.manufacturer
      if (!(MODELS[mfrToCheck] ?? []).includes(model)) { errors.push({ row: rowNum, col: 'model', value: model, message: `Model not in ${mfrToCheck} catalogue` }); return }
      parsed.model = model
    }
    const spId = raw['sales_point_id']
    if (spId) {
      const sp = SALES_POINTS.find((x) => x.id === spId)
      if (!sp) { errors.push({ row: rowNum, col: 'sales_point_id', value: spId, message: 'Unknown sales point ID' }); return }
      const stateToCheck = parsed.state ?? promo.state
      if (sp.state !== stateToCheck) { errors.push({ row: rowNum, col: 'sales_point_id', value: spId, message: `Sales point is in ${sp.state}, not ${stateToCheck}` }); return }
      parsed.salesPointId = spId
    }
    const dateStr = raw['new_end_date']
    if (dateStr) {
      const dt = new Date(dateStr + 'T00:00:00')
      if (isNaN(dt.getTime())) { errors.push({ row: rowNum, col: 'new_end_date', value: dateStr, message: 'Invalid date (use YYYY-MM-DD)' }); return }
      if (promo.expiry && dateStr <= promo.expiry) { errors.push({ row: rowNum, col: 'new_end_date', value: dateStr, message: `Must be after current expiry ${formatDate(promo.expiry)}` }); return }
      parsed.newEndDate = dateStr
      parsed.changes.push(`End date → ${formatDate(dateStr)}`)
    }
    if (!parsed.state && !parsed.city && !parsed.manufacturer && !parsed.model && !parsed.salesPointId && !parsed.newEndDate) return
    valid.push(parsed)
  })
  return { errors, valid }
}

function downloadMapTemplate(promos: ReturnType<typeof useApp>['promos']) {
  const header = MAP_ALL.join(',')
  const examples = promos.filter((p) => p.status === 'Live').slice(0, 3).map((p) => {
    const det = p.detail
    return [p.id, det?.states[0] ?? p.state, det?.cities[0] ?? p.city ?? '', p.manufacturer, det?.modelNames[0] ?? '', det?.salesPointIds[0] ?? '', '2026-12-31'].join(',')
  })
  triggerDownload([header, ...examples].join('\n'), 'bulk_remap_template.csv')
}

// ── Deactivate ────────────────────────────────────────────────────────────────

interface DeactivateRow {
  rowNum: number; promoId: string; promoName: string; reason: string
}

function validateDeactivateRows(
  rawRows: Record<string, string>[],
  promos: ReturnType<typeof useApp>['promos'],
): { errors: ValidationError[]; valid: DeactivateRow[] } {
  const errors: ValidationError[] = []
  const valid: DeactivateRow[] = []
  const seen = new Set<string>()
  rawRows.forEach((raw, i) => {
    const rowNum = i + 2
    const promoId = raw['promo_id'] ?? ''
    if (!promoId) { errors.push({ row: rowNum, col: 'promo_id', value: '', message: 'Promo ID is required' }); return }
    if (seen.has(promoId)) { errors.push({ row: rowNum, col: 'promo_id', value: promoId, message: 'Duplicate promo ID in file' }); return }
    const promo = promos.find((p) => p.id === promoId)
    if (!promo) { errors.push({ row: rowNum, col: 'promo_id', value: promoId, message: 'Promo not found' }); return }
    if (promo.status !== 'Live') { errors.push({ row: rowNum, col: 'promo_id', value: promoId, message: `Promo is ${promo.status}, not Live` }); return }
    const reason = raw['reason'] ?? ''
    if (!reason) { errors.push({ row: rowNum, col: 'reason', value: '', message: 'Reason is required' }); return }
    seen.add(promoId)
    valid.push({ rowNum, promoId, promoName: promo.name, reason })
  })
  return { errors, valid }
}

function downloadDeactivateTemplate(promos: ReturnType<typeof useApp>['promos']) {
  const header = 'promo_id,reason'
  const examples = promos.filter((p) => p.status === 'Live').slice(0, 3)
    .map((p) => `${p.id},${DEACTIVATION_REASONS[0]}`)
  triggerDownload([header, ...examples].join('\n'), 'bulk_deactivate_template.csv')
}

// ── Demap ─────────────────────────────────────────────────────────────────────

interface DemapRawRow {
  rowNum: number; promoId: string
  salesPointId?: string; modelName?: string
}

interface DemapImpact {
  promoId: string; promoName: string
  salesPointsToRemove: string[]
  modelsToRemove: string[]
}

function validateDemapRows(
  rawRows: Record<string, string>[],
  promos: ReturnType<typeof useApp>['promos'],
): { errors: ValidationError[]; valid: DemapImpact[] } {
  const errors: ValidationError[] = []
  const rawParsed: DemapRawRow[] = []

  rawRows.forEach((raw, i) => {
    const rowNum = i + 2
    const promoId = raw['promo_id'] ?? ''
    if (!promoId) { errors.push({ row: rowNum, col: 'promo_id', value: '', message: 'Promo ID is required' }); return }
    const promo = promos.find((p) => p.id === promoId)
    if (!promo) { errors.push({ row: rowNum, col: 'promo_id', value: promoId, message: 'Promo not found' }); return }
    if (promo.status !== 'Live') { errors.push({ row: rowNum, col: 'promo_id', value: promoId, message: `Promo is ${promo.status}, not Live` }); return }

    const spId = raw['sales_point_id'] ?? ''
    const modelName = raw['model'] ?? ''

    if (!spId && !modelName) { errors.push({ row: rowNum, col: 'sales_point_id / model', value: '', message: 'At least one of sales_point_id or model must be provided' }); return }

    const currentSPs = promo.detail?.salesPointIds ?? []
    const currentModels = promo.detail?.modelNames ?? []

    if (spId && !currentSPs.includes(spId)) {
      errors.push({ row: rowNum, col: 'sales_point_id', value: spId, message: 'Not currently mapped to this promo' }); return
    }
    if (modelName && !currentModels.includes(modelName)) {
      errors.push({ row: rowNum, col: 'model', value: modelName, message: 'Not currently mapped to this promo' }); return
    }

    rawParsed.push({ rowNum, promoId, salesPointId: spId || undefined, modelName: modelName || undefined })
  })

  if (errors.length > 0) return { errors, valid: [] }

  // Group by promo and check coverage
  const grouped = new Map<string, DemapImpact>()
  for (const r of rawParsed) {
    if (!grouped.has(r.promoId)) {
      const promo = promos.find((p) => p.id === r.promoId)!
      grouped.set(r.promoId, { promoId: r.promoId, promoName: promo.name, salesPointsToRemove: [], modelsToRemove: [] })
    }
    const g = grouped.get(r.promoId)!
    if (r.salesPointId && !g.salesPointsToRemove.includes(r.salesPointId)) g.salesPointsToRemove.push(r.salesPointId)
    if (r.modelName && !g.modelsToRemove.includes(r.modelName)) g.modelsToRemove.push(r.modelName)
  }

  // Coverage check
  const coverageErrors: ValidationError[] = []
  grouped.forEach((impact) => {
    const promo = promos.find((p) => p.id === impact.promoId)!
    const remainSPs = (promo.detail?.salesPointIds ?? []).filter((id) => !impact.salesPointsToRemove.includes(id))
    const remainModels = (promo.detail?.modelNames ?? []).filter((m) => !impact.modelsToRemove.includes(m))
    if (remainSPs.length === 0 || remainModels.length === 0) {
      coverageErrors.push({
        row: 0,
        col: 'promo_id',
        value: impact.promoId,
        message: `${impact.promoId} (${impact.promoName}): would leave promo with no coverage — deactivate instead`,
      })
    }
  })

  if (coverageErrors.length > 0) return { errors: coverageErrors, valid: [] }

  return { errors: [], valid: Array.from(grouped.values()) }
}

function downloadDemapTemplate(promos: ReturnType<typeof useApp>['promos']) {
  const header = 'promo_id,sales_point_id,model'
  const examples = promos.filter((p) => p.status === 'Live' && p.detail).slice(0, 3).map((p) => {
    const sp = p.detail!.salesPointIds[0] ?? ''
    const model = p.detail!.modelNames[0] ?? ''
    return `${p.id},${sp},${model}`
  })
  triggerDownload([header, ...examples].join('\n'), 'bulk_demap_template.csv')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function triggerDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Stage bar ─────────────────────────────────────────────────────────────────

function StageBar({ stage }: { stage: 0 | 1 | 2 }) {
  const stages = ['Prepare', 'Validate & Preview', 'Done']
  return (
    <div className="flex items-center gap-0">
      {stages.map((label, i) => {
        const done = i < stage
        const active = i === stage
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-success text-white' : active ? 'bg-brand text-white' : 'bg-[#ECE7DA] text-muted'}`}>
                {done ? <IconCheck width={12} height={12} /> : i + 1}
              </span>
              <span className={`text-sm ${active ? 'font-medium text-ink' : done ? 'text-success' : 'text-muted'}`}>{label}</span>
            </div>
            {i < stages.length - 1 && <div className={`mx-4 h-px w-12 ${i < stage ? 'bg-success' : 'bg-border'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Error table ───────────────────────────────────────────────────────────────

function ErrorTable({ errors }: { errors: ValidationError[] }) {
  const rowErrors = errors.filter((e) => e.row > 0)
  const topError = errors.find((e) => e.row === 0)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-card border border-danger-bg bg-danger-bg px-4 py-3">
        <IconAlert width={16} height={16} className="shrink-0 text-danger" />
        <p className="text-sm font-medium text-danger">
          {topError ? topError.message : `${errors.length} error${errors.length > 1 ? 's' : ''} found — fix the file and re-upload`}
        </p>
      </div>
      {rowErrors.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-cream/60 text-left text-xs text-muted">
                <th className="px-4 py-2.5">Row</th>
                <th className="px-4 py-2.5">Column</th>
                <th className="px-4 py-2.5">Value</th>
                <th className="px-4 py-2.5">Error</th>
              </tr>
            </thead>
            <tbody>
              {rowErrors.map((err, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-muted">{err.row}</td>
                  <td className="px-4 py-2.5 font-mono text-ink">{err.col}</td>
                  <td className="px-4 py-2.5 font-mono text-ink">{err.value || '(empty)'}</td>
                  <td className="px-4 py-2.5 text-danger">{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
      onClick={() => fileRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-12 text-center transition ${dragOver ? 'border-brand bg-brand/5' : 'border-border bg-surface/60 hover:border-[#D8D0BF]'}`}
    >
      <IconUpload width={32} height={32} className="text-muted" />
      <div>
        <p className="font-medium text-ink">Drop your filled file here</p>
        <p className="mt-1 text-sm text-muted">or browse</p>
      </div>
      <p className="text-xs text-muted">CSV files only — save .xlsx as CSV first</p>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BulkUploadView() {
  const { promos, applyBulkRemaps, bulkDeactivate, bulkDemap, navigate } = useApp()

  const [mode, setMode] = useState<BulkMode>('map')
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [mapRows, setMapRows] = useState<MapRow[]>([])
  const [deactivateRows, setDeactivateRows] = useState<DeactivateRow[]>([])
  const [demapImpacts, setDemapImpacts] = useState<DemapImpact[]>([])
  const [fileName, setFileName] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applied, setApplied] = useState(0)
  const [appliedMode, setAppliedMode] = useState<BulkMode>('map')

  const changeMode = (m: BulkMode) => {
    setMode(m); setStage(0); setErrors([]); setMapRows([]); setDeactivateRows([]); setDemapImpacts([]); setFileName('')
  }

  const reset = () => {
    setStage(0); setErrors([]); setMapRows([]); setDeactivateRows([]); setDemapImpacts([]); setFileName('')
  }

  const processFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text.startsWith('PK')) {
        setErrors([{ row: 0, col: 'file', value: file.name, message: 'This is an Excel (.xlsx) file. Please save it as CSV (File → Save As → CSV) and re-upload.' }])
        setStage(1); return
      }
      const { headers, rows } = parseCsv(text)

      if (mode === 'map') {
        const missing = ['promo_id'].filter((h) => !headers.includes(h))
        if (missing.length) { setErrors([{ row: 0, col: 'headers', value: headers.join(', '), message: `Missing required columns: ${missing.join(', ')}` }]); setStage(1); return }
        const { errors: errs, valid } = validateMapRows(rows, promos)
        setErrors(errs); setMapRows(valid); setStage(1)
      } else if (mode === 'deactivate') {
        const missing = ['promo_id', 'reason'].filter((h) => !headers.includes(h))
        if (missing.length) { setErrors([{ row: 0, col: 'headers', value: headers.join(', '), message: `Missing required columns: ${missing.join(', ')}` }]); setStage(1); return }
        const { errors: errs, valid } = validateDeactivateRows(rows, promos)
        setErrors(errs); setDeactivateRows(valid); setStage(1)
      } else {
        const missing = ['promo_id'].filter((h) => !headers.includes(h))
        if (missing.length) { setErrors([{ row: 0, col: 'headers', value: headers.join(', '), message: `Missing required columns: ${missing.join(', ')}` }]); setStage(1); return }
        const { errors: errs, valid } = validateDemapRows(rows, promos)
        setErrors(errs); setDemapImpacts(valid); setStage(1)
      }
    }
    reader.readAsText(file)
  }

  const doApply = () => {
    if (mode === 'map') {
      const bulk: BulkRow[] = mapRows.map((r) => ({ promoId: r.promoId, state: r.state, city: r.city, manufacturer: r.manufacturer, model: r.model, salesPointId: r.salesPointId, newEndDate: r.newEndDate }))
      applyBulkRemaps(bulk)
      setApplied(bulk.length)
    } else if (mode === 'deactivate') {
      bulkDeactivate(deactivateRows.map((r) => ({ promoId: r.promoId, reason: r.reason })))
      setApplied(deactivateRows.length)
    } else {
      bulkDemap(demapImpacts.map((d) => ({ promoId: d.promoId, salesPointsToRemove: d.salesPointsToRemove, modelsToRemove: d.modelsToRemove })))
      setApplied(demapImpacts.length)
    }
    setAppliedMode(mode)
    setConfirmOpen(false)
    setStage(2)
  }

  // Summary counts for demap
  const totalSPs = demapImpacts.reduce((s, d) => s + d.salesPointsToRemove.length, 0)
  const totalModels = demapImpacts.reduce((s, d) => s + d.modelsToRemove.length, 0)

  const isRemovalMode = mode === 'demap' || mode === 'deactivate'
  const hasCleanRows = errors.length === 0 && (mapRows.length > 0 || deactivateRows.length > 0 || demapImpacts.length > 0)
  const cleanCount = mode === 'map' ? mapRows.length : mode === 'deactivate' ? deactivateRows.length : demapImpacts.length

  return (
    <div className="space-y-6">

      {/* Mode selector */}
      <div className="flex items-center gap-1 rounded-input border border-border bg-cream p-0.5 w-fit">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => changeMode(m.value)}
            className={`rounded-[6px] px-4 py-2 text-sm font-medium transition ${
              mode === m.value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <StageBar stage={stage} />

      {/* ── Stage 0 — Prepare ── */}
      {stage === 0 && (
        <div className="space-y-6">
          {/* Template card */}
          <div className="rounded-card border border-border bg-surface p-6 shadow-card">
            {mode === 'map' && (
              <>
                <h2 className="font-medium text-ink">Download the template</h2>
                <p className="mt-1 text-sm text-muted">
                  Fill it with live promo IDs and the mapping changes you want to apply.
                  Rates &amp; Charges stay fixed — you can re-map geography or extend end dates in bulk.
                </p>
                <div className="mt-4 font-mono text-xs text-muted">Columns: promo_id, state, city, manufacturer, model, sales_point_id, new_end_date</div>
                <button onClick={() => downloadMapTemplate(promos)} className="mt-4 inline-flex items-center gap-2 rounded-input border border-brand px-4 py-2.5 text-sm font-medium text-brand transition hover:bg-brand/5">
                  <IconUpload width={16} height={16} className="rotate-180" /> Download template.csv
                </button>
              </>
            )}
            {mode === 'deactivate' && (
              <>
                <h2 className="font-medium text-ink">Download the template</h2>
                <p className="mt-1 text-sm text-muted">
                  Fill it with the promo IDs you want to deactivate and a reason for each.
                  Deactivation switches the promo off for new business immediately — no money or mapping changes.
                </p>
                <div className="mt-4 font-mono text-xs text-muted">Columns: promo_id, reason</div>
                <button onClick={() => downloadDeactivateTemplate(promos)} className="mt-4 inline-flex items-center gap-2 rounded-input border border-brand px-4 py-2.5 text-sm font-medium text-brand transition hover:bg-brand/5">
                  <IconUpload width={16} height={16} className="rotate-180" /> Download template.csv
                </button>
              </>
            )}
            {mode === 'demap' && (
              <>
                <h2 className="font-medium text-ink">Download the template</h2>
                <p className="mt-1 text-sm text-muted">
                  Fill it with the sales points or models to remove from each promo.
                  One removal per row — no money or rate changes, geography only.
                </p>
                <div className="mt-4 font-mono text-xs text-muted">Columns: promo_id, sales_point_id, model</div>
                <button onClick={() => downloadDemapTemplate(promos)} className="mt-4 inline-flex items-center gap-2 rounded-input border border-brand px-4 py-2.5 text-sm font-medium text-brand transition hover:bg-brand/5">
                  <IconUpload width={16} height={16} className="rotate-180" /> Download template.csv
                </button>
              </>
            )}
          </div>

          <DropZone onFile={processFile} />
        </div>
      )}

      {/* ── Stage 1 — Validate & Preview ── */}
      {stage === 1 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">File: <span className="font-medium text-ink">{fileName}</span></p>
            <button onClick={reset} className="text-sm font-medium text-brand hover:underline">Re-upload</button>
          </div>

          {errors.length > 0 && <ErrorTable errors={errors} />}

          {errors.length === 0 && cleanCount === 0 && (
            <div className="rounded-card border border-border bg-surface/60 px-5 py-12 text-center text-sm text-muted">No valid rows found in the file.</div>
          )}

          {hasCleanRows && (
            <div className="space-y-4">
              {/* Summary banner */}
              {isRemovalMode ? (
                <div className="flex items-center gap-2 rounded-card border border-[#E7CFA6] bg-warning-bg px-4 py-3">
                  <IconAlert width={16} height={16} className="shrink-0 text-warning" />
                  <p className="text-sm font-medium text-[#6E4708]">
                    {mode === 'deactivate'
                      ? `${cleanCount} promo${cleanCount > 1 ? 's' : ''} will be deactivated`
                      : `${cleanCount} promo${cleanCount > 1 ? 's' : ''} will be demapped from ${totalSPs} sales point${totalSPs > 1 ? 's' : ''}${totalModels > 0 ? ` and ${totalModels} model${totalModels > 1 ? 's' : ''}` : ''}`}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-card border border-[#D4EDDA] bg-[#F0FBF4] px-4 py-3">
                  <IconCheck width={16} height={16} className="text-success" />
                  <p className="text-sm font-medium text-success">{cleanCount} promo{cleanCount > 1 ? 's' : ''} will be updated</p>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-hidden rounded-card border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b border-border text-left text-xs text-muted ${isRemovalMode ? 'bg-[#FFF9EE]' : 'bg-cream/60'}`}>
                      <th className="px-4 py-2.5">Promo ID</th>
                      <th className="px-4 py-2.5">{mode === 'deactivate' ? 'Reason' : mode === 'demap' ? 'Removed from' : 'Changes'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mode === 'map' && mapRows.map((r) => (
                      <tr key={r.promoId} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-muted">{r.promoId}</div>
                          <div className="mt-0.5 font-medium text-ink">{promos.find((p) => p.id === r.promoId)?.name}</div>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {r.changes.length > 0 ? <ul className="space-y-0.5">{r.changes.map((c, i) => <li key={i}>{c}</li>)}</ul> : <span className="italic">Geography re-mapped</span>}
                        </td>
                      </tr>
                    ))}
                    {mode === 'deactivate' && deactivateRows.map((r) => (
                      <tr key={r.promoId} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-muted">{r.promoId}</div>
                          <div className="mt-0.5 font-medium text-ink">{r.promoName}</div>
                        </td>
                        <td className="px-4 py-3 text-[#6E4708]">{r.reason}</td>
                      </tr>
                    ))}
                    {mode === 'demap' && demapImpacts.map((d) => (
                      <tr key={d.promoId} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-muted">{d.promoId}</div>
                          <div className="mt-0.5 font-medium text-ink">{d.promoName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <ul className="space-y-0.5 text-[#6E4708]">
                            {d.salesPointsToRemove.map((sp) => <li key={sp}>Remove SP: <span className="font-mono">{sp}</span></li>)}
                            {d.modelsToRemove.map((m) => <li key={m}>Remove model: {m}</li>)}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Warning */}
              <div className={`flex items-center gap-3 rounded-card border px-4 py-3 text-sm ${isRemovalMode ? 'border-[#E7CFA6] bg-warning-bg text-[#6E4708]' : 'border-[#E7CFA6] bg-warning-bg text-[#6E4708]'}`}>
                <IconAlert width={16} height={16} className="shrink-0 text-warning" />
                {mode === 'deactivate'
                  ? 'Deactivation takes effect immediately and does not require approval.'
                  : mode === 'demap'
                  ? 'Demap takes effect immediately. Removed sales points and models will stop receiving this promo.'
                  : 'Changes take effect immediately and do not go through approval.'}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={reset}>Cancel</Button>
                {mode === 'map'
                  ? <Button onClick={doApply}>Apply {cleanCount} Changes</Button>
                  : mode === 'deactivate'
                  ? <Button variant="danger" onClick={() => setConfirmOpen(true)}>Apply Deactivation</Button>
                  : <Button variant="danger" onClick={() => setConfirmOpen(true)}>Apply Demap</Button>
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Stage 2 — Done ── */}
      {stage === 2 && (
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${appliedMode === 'map' ? 'bg-success-bg text-success' : 'bg-[#FFF3E0] text-warning'}`}>
            <IconCheck width={32} height={32} />
          </div>
          <div>
            <h2 className="font-serif text-2xl text-ink">
              {appliedMode === 'deactivate' ? `${applied} promo${applied !== 1 ? 's' : ''} deactivated` :
               appliedMode === 'demap' ? `${applied} promo${applied !== 1 ? 's' : ''} de-mapped` :
               `${applied} promo${applied !== 1 ? 's' : ''} updated`}
            </h2>
            <p className="mt-2 text-sm text-muted">Changes are live. History has been logged on each promo.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { reset(); setApplied(0) }}>Upload another file</Button>
            <Button onClick={() => navigate({ name: 'existing-promos' })}>View Existing Promos</Button>
          </div>
        </div>
      )}

      {/* ── Confirm modal (Demap + Deactivate) ── */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={mode === 'deactivate' ? 'Confirm bulk deactivation' : 'Confirm bulk demap'}
      >
        <p className="text-sm text-muted">
          {mode === 'deactivate'
            ? `This will switch off ${deactivateRows.length} promo${deactivateRows.length > 1 ? 's' : ''} for new business. Existing loans are unaffected.`
            : `This will remove ${totalSPs} sales point${totalSPs !== 1 ? 's' : ''}${totalModels > 0 ? ` and ${totalModels} model${totalModels !== 1 ? 's' : ''}` : ''} from ${demapImpacts.length} promo${demapImpacts.length !== 1 ? 's' : ''}. Removed coverage stops receiving this promo immediately.`}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={doApply}>
            {mode === 'deactivate' ? `Deactivate ${deactivateRows.length} promo${deactivateRows.length !== 1 ? 's' : ''}` : `Demap ${demapImpacts.length} promo${demapImpacts.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
