import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext'
import { Field, SegmentedCards, Modal, Button, Toast, inputCls } from '../../components/ui/primitives'
import { SearchableSelect, MultiSelect } from '../../components/ui/SearchableSelect'
import { TwoPanePicker, UploadPanel, PerStateCityPanel, Tabs, type PickItem } from './pickers'
import { MANUFACTURERS, MODELS, STATES_CITIES, SALES_POINTS } from '../../data/seed'
import { IconCheck } from '../../components/ui/icons'
import type { DealerType } from '../../data/types'

function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return <div className="animate-rise">{children}</div>
}

export function StepMapping() {
  const { draft, setDraft, getPromo } = useApp()
  const editingPromo = draft.editingPromoId ? getPromo(draft.editingPromoId) : undefined
  const [spTab, setSpTab] = useState('Select from list')
  const [modelTab, setModelTab] = useState('Select from list')
  const [pendingDealerType, setPendingDealerType] = useState<DealerType | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [cityPanelOpen, setCityPanelOpen] = useState(false)
  const [cityPanelStartIdx, setCityPanelStartIdx] = useState(0)
  const prevStatesRef = useRef<string[]>(draft.states)

  const today = new Date().toISOString().slice(0, 10)
  const dateError =
    draft.validFrom && draft.validTo && draft.validTo <= draft.validFrom
      ? 'End date must be after start date.'
      : undefined
  const durationDays =
    draft.validFrom && draft.validTo && !dateError
      ? Math.ceil((new Date(draft.validTo).getTime() - new Date(draft.validFrom).getTime()) / 86400000)
      : null

  // Active manufacturers array (SBO = single, MBO = multi)
  const activeMfrs = draft.dealerType === 'MBO' ? draft.manufacturers : draft.manufacturer ? [draft.manufacturer] : []

  // Matching sales-point pool
  const spPool = useMemo<PickItem[]>(() => {
    return SALES_POINTS.filter(
      (sp) =>
        (!draft.dealerType || sp.dealerType === draft.dealerType) &&
        (activeMfrs.length === 0 || sp.manufacturers.some(m => activeMfrs.includes(m))) &&
        (draft.states.length === 0 || draft.states.includes(sp.state)) &&
        (draft.cities.length === 0 || draft.cities.includes(sp.city)),
    ).map((sp) => {
      const matchingBrands = activeMfrs.length > 1
        ? sp.manufacturers.filter(m => activeMfrs.includes(m))
        : []
      return {
        key: sp.id,
        label: sp.name,
        sub: matchingBrands.length > 0
          ? `${sp.city} · ${matchingBrands.join(', ')}`
          : `${sp.city} · ${sp.dealerType}`,
      }
    })
  }, [draft.dealerType, draft.manufacturer, draft.manufacturers, draft.states, draft.cities])

  const modelPool = useMemo<PickItem[]>(
    () => activeMfrs.flatMap(mfr => (MODELS[mfr] ?? []).map(m => ({ key: m, label: m, sub: activeMfrs.length > 1 ? mfr : undefined }))),
    [draft.manufacturer, draft.manufacturers],
  )

  // ── Handlers with edge-case behavior ──
  const changeDealerType = (v: DealerType) => {
    if (draft.salesPointIds.length > 0 && v !== draft.dealerType) {
      setPendingDealerType(v)
      return
    }
    setDraft((d) => ({ ...d, dealerType: v }))
  }
  const confirmDealerType = () => {
    setDraft((d) => ({ ...d, dealerType: pendingDealerType, salesPointIds: [] }))
    setPendingDealerType(null)
    setToast('Sales point selection cleared — different dealer pool.')
  }

  const changeManufacturer = (v: string) => {
    setDraft((d) => ({
      ...d,
      manufacturer: v,
      manufacturers: v ? [v] : [],
      salesPointIds: d.salesPointIds.filter((id) => SALES_POINTS.find((sp) => sp.id === id)?.manufacturers.includes(v)),
      modelNames: d.modelNames.filter((m) => (MODELS[v] ?? []).includes(m)),
    }))
  }

  const changeManufacturers = (vals: string[]) => {
    setDraft((d) => ({
      ...d,
      manufacturer: vals[0] ?? '',
      manufacturers: vals,
      salesPointIds: d.salesPointIds.filter((id) => {
        const sp = SALES_POINTS.find((x) => x.id === id)
        return sp && sp.manufacturers.some(m => vals.includes(m))
      }),
      modelNames: d.modelNames.filter((m) => vals.some(mfr => (MODELS[mfr] ?? []).includes(m))),
    }))
  }

  const changeStates = (next: string[]) => {
    const prev = draft.states
    const removed = prev.filter((s) => !next.includes(s))
    const added = next.filter((s) => !prev.includes(s))
    if (removed.length > 0) {
      const droppedSp = draft.salesPointIds.filter((id) => {
        const sp = SALES_POINTS.find((x) => x.id === id)
        return sp && removed.includes(sp.state)
      })
      setDraft((d) => ({
        ...d,
        states: next,
        cities: d.cities.filter((c) => next.some((s) => (STATES_CITIES[s] ?? []).includes(c))),
        salesPointIds: d.salesPointIds.filter((id) => !droppedSp.includes(id)),
      }))
      if (droppedSp.length > 0)
        setToast(`${droppedSp.length} sales points removed because ${removed[0]} was deselected.`)
    } else {
      setDraft((d) => ({ ...d, states: next }))
    }
    // Auto-open city panel for newly added states
    if (added.length > 0) {
      const firstNewIdx = next.indexOf(added[0])
      setCityPanelStartIdx(Math.max(0, firstNewIdx))
      setCityPanelOpen(true)
    }
    prevStatesRef.current = next
  }

  // Upload validation for sales points (whole-file semantics in UploadPanel)
  const validateSP = (token: string): { key: string } | { error: string } => {
    const sp = SALES_POINTS.find((x) => x.id.toLowerCase() === token.toLowerCase())
    if (!sp) return { error: 'Unknown sales point ID' }
    if (draft.dealerType && sp.dealerType !== draft.dealerType) return { error: `Wrong dealer type (${sp.dealerType})` }
    if (activeMfrs.length > 0 && !sp.manufacturers.some(m => activeMfrs.includes(m))) return { error: 'Different manufacturer' }
    if (draft.states.length && !draft.states.includes(sp.state)) return { error: `Outside selected states (${sp.state})` }
    if (draft.cities.length && !draft.cities.includes(sp.city)) return { error: `Outside selected cities (${sp.city})` }
    return { key: sp.id }
  }
  const validateModel = (token: string): { key: string } | { error: string } => {
    const allModels = activeMfrs.flatMap(mfr => MODELS[mfr] ?? [])
    const ok = allModels.find((m) => m.toLowerCase() === token.toLowerCase())
    return ok ? { key: ok } : { error: `Not a ${activeMfrs.join('/') || 'selected'} model` }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
      {/* Left — progressive form */}
      <div className="max-w-2xl space-y-7">
        {/* 1. Dealer Type */}
        <Field label="Dealer Type" required>
          <SegmentedCards<DealerType>
            value={draft.dealerType}
            onChange={changeDealerType}
            options={[
              { value: 'SBO', title: 'SBO', subtitle: 'Single brand outlet' },
              { value: 'MBO', title: 'MBO', subtitle: 'Multi-brand outlet' },
            ]}
          />
        </Field>

        {/* 2. Manufacturer — single for SBO, multi for MBO */}
        <Reveal show={!!draft.dealerType}>
          <Field
            label="Manufacturer"
            required
            helper={draft.dealerType === 'MBO' ? 'Select all OEMs this promo covers.' : undefined}
          >
            {draft.dealerType === 'SBO' ? (
              <SearchableSelect
                options={[...MANUFACTURERS]}
                value={draft.manufacturer}
                onChange={changeManufacturer}
                placeholder="Select a manufacturer"
              />
            ) : (
              <MultiSelect
                options={[...MANUFACTURERS]}
                selected={draft.manufacturers}
                onChange={changeManufacturers}
                placeholder="Select one or more manufacturers"
              />
            )}
          </Field>
        </Reveal>

        {/* 3. State */}
        <Reveal show={activeMfrs.length > 0}>
          <Field label="State" required>
            <MultiSelect
              options={Object.keys(STATES_CITIES)}
              selected={draft.states}
              onChange={changeStates}
              placeholder="Select states"
            />
            <div className="flex items-center gap-3 pt-1.5 text-xs">
              {draft.states.length < Object.keys(STATES_CITIES).length ? (
                <button
                  type="button"
                  onClick={() => changeStates(Object.keys(STATES_CITIES))}
                  className="font-medium text-brand hover:underline"
                >
                  Select all states
                </button>
              ) : (
                <span className="text-muted">All states selected</span>
              )}
              {draft.states.length > 0 && draft.states.length < Object.keys(STATES_CITIES).length && (
                <>
                  <span className="text-border">·</span>
                  <button
                    type="button"
                    onClick={() => changeStates([])}
                    className="text-muted hover:text-danger"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </Field>
        </Reveal>

        {/* 4. Cities — per-state summary with edit trigger */}
        <Reveal show={draft.states.length > 0}>
          <Field
            label="Cities"
            helper={
              draft.cities.length === 0
                ? `All cities in ${draft.states.length === 1 ? draft.states[0] : `${draft.states.length} states`} are included. Click a state to narrow down.`
                : undefined
            }
          >
            <div className="space-y-2">
              {draft.states.map((state, i) => {
                const stateCities = draft.cities.filter(c =>
                  (STATES_CITIES[state] ?? []).includes(c),
                )
                return (
                  <div
                    key={state}
                    className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-ink">{state}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {stateCities.length === 0 ? (
                          <span className="text-xs italic text-muted">All cities included</span>
                        ) : (
                          stateCities.map(c => (
                            <span
                              key={c}
                              className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-xs text-ink"
                            >
                              {c}
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft(d => ({ ...d, cities: d.cities.filter(x => x !== c) }))
                                }
                                className="text-muted hover:text-danger"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCityPanelStartIdx(i)
                        setCityPanelOpen(true)
                      }}
                      className="shrink-0 text-xs font-medium text-brand hover:underline"
                    >
                      {stateCities.length > 0 ? 'Edit' : 'Add cities'}
                    </button>
                  </div>
                )
              })}
            </div>
          </Field>
        </Reveal>

        {/* City panel overlay */}
        {cityPanelOpen && draft.states.length > 0 && (
          <PerStateCityPanel
            states={draft.states}
            startIdx={cityPanelStartIdx}
            existingCities={draft.cities}
            onApply={cities => {
              setDraft(d => ({ ...d, cities }))
              setCityPanelOpen(false)
            }}
            onClose={() => setCityPanelOpen(false)}
          />
        )}

        {/* 5. Sales Points */}
        <Reveal show={draft.states.length > 0}>
          <Field
            label="Sales Points"
            required={!editingPromo}
            helper={editingPromo && draft.salesPointIds.length === 0
              ? `Leaving blank keeps the existing ${editingPromo.salesPointCount} sales points.`
              : undefined}
          >
            <div className="space-y-3">
              <Tabs tabs={['Select from list', 'Upload Excel']} active={spTab} onChange={setSpTab} />
              {spTab === 'Select from list' ? (
                <TwoPanePicker
                  items={spPool}
                  selected={draft.salesPointIds}
                  onChange={(next) => setDraft((d) => ({ ...d, salesPointIds: next }))}
                  countNoun="sales points"
                  emptyText="No dealers match this selection."
                />
              ) : (
                <UploadPanel
                  templateName="sales_points_template.csv"
                  templateHeader="sales_point_id"
                  noun="sales point"
                  sampleTokens={[...spPool.slice(0, 3).map((s) => s.key), 'SP999', 'SP006']}
                  validate={validateSP}
                  onValidated={(keys) =>
                    setDraft((d) => ({ ...d, salesPointIds: [...new Set([...d.salesPointIds, ...keys])] }))
                  }
                />
              )}
            </div>
          </Field>
        </Reveal>

        {/* 6. Models */}
        <Reveal show={draft.salesPointIds.length > 0 || !!editingPromo}>
          <Field
            label="Models"
            required={!editingPromo}
            helper={editingPromo && draft.modelNames.length === 0
              ? `Leaving blank keeps the existing ${editingPromo.modelCount} models.`
              : undefined}
          >
            <div className="space-y-3">
              <Tabs tabs={['Select from list', 'Upload Excel']} active={modelTab} onChange={setModelTab} />
              {modelTab === 'Select from list' ? (
                <TwoPanePicker
                  items={modelPool}
                  selected={draft.modelNames}
                  onChange={(next) => setDraft((d) => ({ ...d, modelNames: next }))}
                  countNoun="models"
                />
              ) : (
                <UploadPanel
                  templateName="models_template.csv"
                  templateHeader="model_name"
                  noun="model"
                  sampleTokens={[...modelPool.slice(0, 2).map((m) => m.key), 'Phantom 999']}
                  validate={validateModel}
                  onValidated={(keys) =>
                    setDraft((d) => ({ ...d, modelNames: [...new Set([...d.modelNames, ...keys])] }))
                  }
                />
              )}
            </div>
          </Field>
        </Reveal>

        {/* 7. Validity Period — revealed once models are chosen */}
        <Reveal show={draft.modelNames.length > 0 || !!editingPromo}>
        <Field
          label="Validity Period"
          required
          error={dateError}
          helper={!draft.validFrom || !draft.validTo ? 'Set the start and end dates for this promo.' : undefined}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted">Start date</label>
              <input
                type="date"
                value={draft.validFrom}
                min={today}
                onChange={(e) => setDraft((d) => ({ ...d, validFrom: e.target.value }))}
                className={`${inputCls} ${!draft.validFrom ? 'border-[#E7CFA6] bg-warning-bg/30' : ''}`}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted">End date</label>
              <input
                type="date"
                value={draft.validTo}
                min={draft.validFrom || today}
                onChange={(e) => setDraft((d) => ({ ...d, validTo: e.target.value }))}
                className={`${inputCls} ${!draft.validTo ? 'border-[#E7CFA6] bg-warning-bg/30' : dateError ? 'border-danger' : ''}`}
              />
            </div>
          </div>
          {durationDays !== null && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
              <IconCheck width={12} height={12} />
              {durationDays} day{durationDays !== 1 ? 's' : ''}
            </p>
          )}
        </Field>
        </Reveal>
      </div>

      {/* Right — sticky live summary */}
      <div>
        <div className="sticky top-24 rounded-card border border-border bg-surface p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Live summary</h3>
          <div className="mt-3 space-y-2 text-sm">
            <SummaryRow label="Manufacturer" value={activeMfrs.length > 0 ? activeMfrs.join(', ') : '—'} />
            <SummaryRow label="Dealer type" value={draft.dealerType ?? '—'} />
            <SummaryRow
              label="Geography"
              value={
                draft.states.length
                  ? draft.states
                      .map(s => {
                        const cnt = draft.cities.filter(c =>
                          (STATES_CITIES[s] ?? []).includes(c),
                        ).length
                        return `${s}${cnt > 0 ? ` (${cnt} cit${cnt === 1 ? 'y' : 'ies'})` : ''}`
                      })
                      .join(', ')
                  : '—'
              }
            />
            <SummaryRow
              label="Sales points"
              value={
                draft.salesPointIds.length
                  ? `${draft.salesPointIds.length}`
                  : editingPromo
                    ? `${editingPromo.salesPointCount} (existing)`
                    : '—'
              }
            />
            <SummaryRow
              label="Models"
              value={
                draft.modelNames.length
                  ? `${draft.modelNames.length}`
                  : editingPromo
                    ? `${editingPromo.modelCount} (existing)`
                    : '—'
              }
            />
            <SummaryRow
              label="Validity"
              value={
                draft.validFrom && draft.validTo
                  ? `${draft.validFrom} → ${draft.validTo}`
                  : '—'
              }
            />
          </div>
          {activeMfrs.length > 0 && draft.states.length > 0 && (
            <p className="mt-4 border-t border-border pt-3 text-sm text-ink/80">
              {activeMfrs.join(', ')} · {draft.dealerType} ·{' '}
              {draft.states
                .map(s => {
                  const cityCnt = draft.cities.filter(c =>
                    (STATES_CITIES[s] ?? []).includes(c),
                  ).length
                  const spCnt = draft.salesPointIds.filter(id => {
                    const sp = SALES_POINTS.find(x => x.id === id)
                    return sp && sp.state === s
                  }).length
                  const parts = [
                    cityCnt > 0 ? `${cityCnt} cit${cityCnt === 1 ? 'y' : 'ies'}` : null,
                    spCnt > 0 ? `${spCnt} SP${spCnt !== 1 ? 's' : ''}` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')
                  return `${s}${parts ? ` (${parts})` : ''}`
                })
                .join(' · ')}{' '}
              · {draft.modelNames.length} models.
            </p>
          )}
        </div>
      </div>

      {/* Confirm dealer-type switch */}
      <Modal
        open={!!pendingDealerType}
        onClose={() => setPendingDealerType(null)}
        title="Switch dealer type?"
      >
        <p className="text-sm text-ink/80">
          SBO and MBO draw from different dealer pools. Switching to {pendingDealerType} will clear
          your {draft.salesPointIds.length} selected sales points.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPendingDealerType(null)}>
            Cancel
          </Button>
          <Button onClick={confirmDealerType}>Switch &amp; clear</Button>
        </div>
      </Modal>

      {toast && <DismissingToast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  )
}

function DismissingToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])
  return <Toast message={message} />
}
