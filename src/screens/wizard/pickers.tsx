import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { IconSearch, IconX, IconCheck, IconAlert } from '../../components/ui/icons'
import { Button, Modal } from '../../components/ui/primitives'
import { STATES_CITIES } from '../../data/seed'

export interface PickItem {
  key: string
  label: string
  sub?: string
}

// ── Two-pane picker: left = available (search + Select All), right = chips ──
export function TwoPanePicker({
  items,
  selected,
  onChange,
  countNoun,
  emptyText = 'No matches for this selection.',
}: {
  items: PickItem[]
  selected: string[]
  onChange: (next: string[]) => void
  countNoun: string
  emptyText?: string
}) {
  const [q, setQ] = useState('')
  const filtered = items.filter(
    (it) => it.label.toLowerCase().includes(q.toLowerCase()) || it.sub?.toLowerCase().includes(q.toLowerCase()),
  )
  const allSelected = filtered.length > 0 && filtered.every((it) => selected.includes(it.key))
  const selectedItems = items.filter((it) => selected.includes(it.key))

  const toggle = (k: string) =>
    onChange(selected.includes(k) ? selected.filter((s) => s !== k) : [...selected, k])
  const toggleAll = () => {
    if (allSelected) onChange(selected.filter((s) => !filtered.some((it) => it.key === s)))
    else onChange([...new Set([...selected, ...filtered.map((it) => it.key)])])
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Left — available */}
      <div className="rounded-card border border-border bg-surface">
        <div className="relative border-b border-border">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none"
          />
        </div>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs text-muted">{filtered.length} available</span>
          <button
            disabled={filtered.length === 0}
            onClick={toggleAll}
            className="text-xs font-medium text-brand hover:underline disabled:text-muted disabled:no-underline"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted">{emptyText}</div>
          ) : (
            filtered.map((it) => {
              const on = selected.includes(it.key)
              return (
                <button
                  key={it.key}
                  onClick={() => toggle(it.key)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-cream"
                >
                  <span>
                    <span className="block text-sm text-ink">{it.label}</span>
                    {it.sub && <span className="block text-xs text-muted">{it.sub}</span>}
                  </span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      on ? 'border-brand bg-brand text-white' : 'border-border'
                    }`}
                  >
                    {on && <IconCheck width={11} height={11} />}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right — selected */}
      <div className="rounded-card border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-medium text-ink">
            {selected.length} {countNoun} selected
          </span>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="text-xs text-muted hover:text-danger">
              Remove all
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-3">
          {selectedItems.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted">Nothing selected yet.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedItems.map((it) => (
                <span key={it.key} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs text-ink">
                  {it.label}
                  <button onClick={() => toggle(it.key)} className="text-muted hover:text-danger">
                    <IconX width={12} height={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Excel upload panel (simulated parse + whole-file validation) ────────────
export function UploadPanel({
  templateName,
  templateHeader,
  sampleTokens,
  validate,
  onValidated,
  noun,
}: {
  templateName: string
  templateHeader: string
  sampleTokens: string[] // a demo file with a mix of valid + invalid rows
  validate: (token: string) => { key: string } | { error: string }
  onValidated: (keys: string[]) => void
  noun: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [report, setReport] = useState<{ token: string; error: string }[] | null>(null)
  const [reportValid, setReportValid] = useState(0) // how many valid rows were accepted alongside errors
  const [busy, setBusy] = useState(false)

  const downloadTemplate = () => {
    const blob = new Blob([templateHeader + '\n'], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = templateName
    a.click()
    URL.revokeObjectURL(url)
  }

  const process = (tokens: string[]) => {
    setBusy(true)
    setTimeout(() => {
      const errors: { token: string; error: string }[] = []
      const valid: string[] = []
      tokens
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => {
          const r = validate(t)
          if ('error' in r) errors.push({ token: t, error: r.error })
          else valid.push(r.key)
        })
      setBusy(false)
      // Accept valid rows regardless — always call onValidated if anything passed
      if (valid.length > 0) onValidated(valid)
      // Show skipped rows as a warning (not a full rejection)
      if (errors.length > 0) {
        setReport(errors)
        setReportValid(valid.length)
      }
    }, 600)
  }

  const onFile = (f: File) => {
    setBusy(true) // show spinner immediately while the file is being read
    const reader = new FileReader()
    reader.onload = () => {
      try {
        // SheetJS handles both binary .xlsx (zip) and .csv via ArrayBuffer
        const workbook = XLSX.read(reader.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        // Read only the first column — safer than sheet_to_csv for multi-column files
        const ref = sheet['!ref']
        const tokens: string[] = []
        if (ref) {
          const range = XLSX.utils.decode_range(ref)
          for (let row = range.s.r; row <= range.e.r; row++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })]
            if (cell && cell.v != null) {
              const val = String(cell.v).trim()
              if (val && !/sales.?point|model|id/i.test(val)) tokens.push(val)
            }
          }
        }
        process(tokens)
      } catch {
        // Unreadable / corrupt file — show error modal directly
        setBusy(false)
        setReport([{ token: '(uploaded file)', error: 'Could not read file. Upload a valid .xlsx or .csv file.' }])
        setReportValid(0)
      }
    }
    reader.readAsArrayBuffer(f) // works for both .xlsx (binary) and .csv
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
        onClick={() => fileRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-border bg-cream/40 px-6 py-10 text-center transition hover:border-brand/40"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {busy ? (
          <span className="text-sm text-muted">Validating file…</span>
        ) : (
          <>
            <span className="text-sm font-medium text-ink">Drag &amp; drop your Excel here</span>
            <span className="mt-1 text-xs text-muted">or click to browse · .xlsx / .csv</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <button onClick={downloadTemplate} className="font-medium text-brand hover:underline">
          Download template
        </button>
        <button onClick={() => process(sampleTokens)} className="text-muted hover:text-ink">
          Try a sample file
        </button>
      </div>

      <Modal
        open={!!report}
        onClose={() => { setReport(null); setReportValid(0) }}
        title={reportValid > 0 ? 'Some rows were skipped' : 'File could not be imported'}
        width="max-w-lg"
      >
        {reportValid > 0 ? (
          <div className="flex items-start gap-3 rounded-input bg-warning-bg px-3 py-2.5 text-sm text-warning">
            <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
            <p>
              {reportValid} {noun}{reportValid === 1 ? '' : 's'} imported successfully.{' '}
              {report?.length} {report && report.length === 1 ? 'row was' : 'rows were'} skipped — fix and re-upload to include them.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-input bg-danger-bg px-3 py-2.5 text-sm text-danger">
            <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
            <p>
              All {report?.length} {noun} {report && report.length === 1 ? 'row' : 'rows'} failed validation.
              Fix these and re-upload.
            </p>
          </div>
        )}
        <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
          {report?.map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-3 rounded-input border border-border px-3 py-2 text-sm">
              <span className="font-mono text-xs text-ink">{r.token}</span>
              <span className="text-right text-xs text-danger">{r.error}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={() => { setReport(null); setReportValid(0) }}>
            {reportValid > 0 ? 'Got it' : 'Close'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Per-state city panel (slide-out, sequential per state) ──────────────────
export function PerStateCityPanel({
  states,
  startIdx = 0,
  existingCities,
  onApply,
  onClose,
}: {
  states: string[]
  startIdx?: number
  existingCities: string[]
  onApply: (cities: string[]) => void
  onClose: () => void
}) {
  const initPerState = () => {
    const map: Record<string, string[]> = {}
    for (const s of states) {
      map[s] = existingCities.filter(c => (STATES_CITIES[s] ?? []).includes(c))
    }
    return map
  }

  const [currentIdx, setCurrentIdx] = useState(startIdx)
  const [perState, setPerState] = useState<Record<string, string[]>>(initPerState)
  const [tab, setTab] = useState<'list' | 'upload'>('list')

  const currentState = states[currentIdx]
  const cityItems: PickItem[] = (STATES_CITIES[currentState] ?? []).map(c => ({ key: c, label: c }))
  const currentSel = perState[currentState] ?? []

  const setSel = (next: string[]) =>
    setPerState(prev => ({ ...prev, [currentState]: next }))

  const validateCity = (token: string): { key: string } | { error: string } => {
    const cities = STATES_CITIES[currentState] ?? []
    const match = cities.find(c => c.toLowerCase() === token.toLowerCase())
    if (match) return { key: match }
    const inOtherState = Object.entries(STATES_CITIES).some(
      ([s, cs]) => s !== currentState && cs.some(c => c.toLowerCase() === token.toLowerCase()),
    )
    return inOtherState
      ? { error: `City not in ${currentState}` }
      : { error: 'Unknown city' }
  }

  const isLast = currentIdx === states.length - 1

  const handleNext = () => {
    if (!isLast) {
      setCurrentIdx(i => i + 1)
      setTab('list')
    } else {
      // onApply is responsible for closing the panel (or transitioning to another phase)
      onApply(states.flatMap(s => perState[s] ?? []))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-ink/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="flex h-full w-[500px] flex-col border-l border-border bg-surface shadow-soft">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-medium text-ink">
              {currentState}
              <span className="ml-1.5 text-sm font-normal text-muted">— select cities</span>
            </h3>
            {states.length > 1 && (
              <p className="mt-0.5 text-xs text-muted">
                State {currentIdx + 1} of {states.length}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted hover:bg-cream hover:text-ink"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        {/* Progress bar for multiple states */}
        {states.length > 1 && (
          <div className="flex gap-1 border-b border-border px-5 py-2.5">
            {states.map((s, i) => (
              <button
                key={s}
                onClick={() => setCurrentIdx(i)}
                title={s}
                className={`h-1.5 flex-1 rounded-full transition ${
                  i === currentIdx ? 'bg-brand' : i < currentIdx ? 'bg-brand/40' : 'bg-border'
                }`}
              />
            ))}
          </div>
        )}

        {/* Tabs */}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'list' ? (
            <TwoPanePicker
              items={cityItems}
              selected={currentSel}
              onChange={setSel}
              countNoun="cities"
              emptyText="No cities available for this state."
            />
          ) : (
            <UploadPanel
              templateName={`cities_template.csv`}
              templateHeader="city_name"
              noun="city"
              sampleTokens={[
                ...(STATES_CITIES[currentState] ?? []).slice(0, 3),
                'Hyderabad',
                'Atlantis',
              ]}
              validate={validateCity}
              onValidated={keys => setSel([...new Set([...currentSel, ...keys])])}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          {currentIdx > 0 ? (
            <button
              onClick={() => setCurrentIdx(i => i - 1)}
              className="text-sm text-muted hover:text-ink"
            >
              ← {states[currentIdx - 1]}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              {currentSel.length > 0
                ? `${currentSel.length} cit${currentSel.length === 1 ? 'y' : 'ies'} selected`
                : 'All cities included'}
            </span>
            <button
              onClick={handleNext}
              className="rounded-input bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-[#86162a]"
            >
              {isLast ? 'Done' : `Next: ${states[currentIdx + 1]} →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[]
  active: string
  onChange: (t: string) => void
}) {
  return (
    <div className="flex gap-1 rounded-input border border-border bg-cream/60 p-1">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            active === t ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
