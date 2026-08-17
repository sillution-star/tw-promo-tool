import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { Button, Field, Modal, inputCls } from '../components/ui/primitives'
import { IconAlert, IconCheck, IconChevronDown, IconX } from '../components/ui/icons'
import { CHARGE_OPTIONS, TENURE_OPTIONS, APPROVAL_ROUTING, STATES_CITIES, SALES_POINTS, MODELS } from '../data/seed'
import { computeProfit, flatToIRR } from '../lib/profitability'
import { ratesErrors } from './wizard/validators'
import { formatDate, formatINR } from '../lib/format'
import { StatusPill } from '../components/ui/StatusPill'
import { MultiSelect } from '../components/ui/SearchableSelect'
import { TwoPanePicker, UploadPanel, PerStateCityPanel, Tabs, type PickItem } from './wizard/pickers'
import type { Promo, WizardDraft } from '../data/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReachForm {
  states: string[]
  cities: string[]
  salesPointIds: string[]
  modelNames: string[]
  validFrom: string
  validTo: string
}

function initReachForm(promo: Promo): ReachForm {
  return {
    states: promo.detail?.states ?? [promo.state],
    cities: promo.detail?.cities ?? (promo.city ? [promo.city] : []),
    salesPointIds: promo.detail?.salesPointIds ?? [],
    modelNames: promo.detail?.modelNames ?? [],
    validFrom: promo.detail?.validFrom ?? promo.createdAt,
    validTo: promo.detail?.validTo ?? promo.expiry ?? '',
  }
}

function initCommercialForm(promo: Promo): WizardDraft {
  const det = promo.detail
  return {
    id: promo.id,
    name: promo.name,
    schemeName: promo.scheme,
    group: promo.group,
    product: promo.product ?? null,
    dealerType: promo.dealerType,
    manufacturer: promo.manufacturer,
    manufacturers: promo.manufacturer ? [promo.manufacturer] : [],
    states: det?.states ?? [promo.state],
    cities: det?.cities ?? (promo.city ? [promo.city] : []),
    salesPointIds: det?.salesPointIds ?? [],
    modelNames: det?.modelNames ?? [],
    minAmount: det ? String(det.minAmount) : '',
    maxAmount: det ? String(det.maxAmount) : '',
    minTenure: det?.minTenure ?? null,
    maxTenure: det?.maxTenure ?? null,
    flatRate: det ? String(det.flatRate) : '',
    pfPct: det?.pfPct ?? null,
    pfAmount: det?.pfAmount ?? null,
    pddPct: det?.pddPct ?? null,
    pddAmount: det?.pddAmount ?? null,
    pffAmount: det?.pffAmount ?? null,
    lmfAmount: det?.lmfAmount ?? null,
    dealerSubventionPct: det?.dealerSubventionPct ?? null,
    dealerSubventionAmt: det?.dealerSubventionAmt ?? null,
    mfgSubventionPct: det?.mfgSubventionPct ?? null,
    mfgSubventionAmt: det?.mfgSubventionAmt ?? null,
    dealerPayout: String(promo.dealerPayout),
    dmiOn: det?.dmiOn ?? false,
    dmiAmount: det ? String(det.dmiAmount) : '',
    advanceEmi: det?.advanceEmi ?? 0,
    breachReason: promo.breachReason ?? '',
    validFrom: det?.validFrom ?? promo.createdAt,
    validTo: det?.validTo ?? promo.expiry ?? '',
    history: promo.history,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChargeSelect({
  label, unit, options, value, disabled, onChange,
}: {
  label: string; unit: '%' | '₹'; options: number[]
  value: number | null; disabled?: boolean; onChange: (v: number | null) => void
}) {
  return (
    <div className="relative">
      <select
        disabled={disabled}
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={`peer w-full appearance-none rounded-input border border-border bg-surface py-2.5 pl-3 pr-9 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 ${
          disabled ? 'cursor-not-allowed bg-cream/60 text-muted' : value === null ? 'text-muted' : 'text-ink'
        }`}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {unit === '%' ? `${o}%` : `₹${o.toLocaleString('en-IN')}`}
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
    </div>
  )
}

function TenureSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="relative">
      <select
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={`w-full appearance-none rounded-input border border-border bg-surface py-2.5 pl-3 pr-9 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 ${value === null ? 'text-muted' : 'text-ink'}`}
      >
        <option value="">Months</option>
        {TENURE_OPTIONS.map((m) => (
          <option key={m} value={m}>{m} months</option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
    </div>
  )
}

function ProfitWidget({ form, benchmark, promo }: { form: WizardDraft; benchmark: number; promo: Promo }) {
  const detail = useMemo(() => ({
    minAmount: parseFloat(form.minAmount) || 0,
    maxAmount: parseFloat(form.maxAmount) || 0,
    minTenure: form.minTenure ?? 0,
    maxTenure: form.maxTenure ?? 0,
    flatRate: parseFloat(form.flatRate) || 0,
    pfPct: form.pfPct, pfAmount: form.pfAmount,
    pddPct: form.pddPct, pddAmount: form.pddAmount,
    pffAmount: form.pffAmount ?? 0, lmfAmount: form.lmfAmount ?? 0,
    dealerPayout: parseFloat(form.dealerPayout) || 0,
    dmiOn: form.dmiOn, dmiAmount: parseFloat(form.dmiAmount) || 0,
    advanceEmi: form.advanceEmi ?? 0,
    states: promo.detail?.states ?? [promo.state],
    cities: promo.detail?.cities ?? [],
    salesPointIds: promo.detail?.salesPointIds ?? [],
    modelNames: promo.detail?.modelNames ?? [],
    validFrom: form.validFrom, validTo: form.validTo,
  }), [form, promo])

  const result = computeProfit(detail)
  if (!result.ok) {
    return (
      <div className="rounded-card border border-border bg-surface p-5 text-sm text-muted">
        Profitability can't be calculated for this state.
      </div>
    )
  }
  const bd = result.breakdown!
  const breached = bd.netPct < benchmark
  return (
    <div
      className="rounded-card border border-border bg-surface p-5 shadow-card"
      style={{ borderLeft: `4px solid ${breached ? '#8E2418' : '#176038'}` }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className={`font-serif text-4xl tabular ${breached ? 'text-danger' : 'text-ink'}`}>
            {bd.netPct.toFixed(1)}%
          </span>
          <p className="mt-0.5 text-xs text-muted">Net margin · {formatINR(Math.round(bd.netRs))} per loan</p>
        </div>
        <div className="text-right text-xs text-muted">
          Benchmark
          <div className="font-serif text-2xl text-ink">{benchmark}%</div>
        </div>
      </div>
      {breached ? (
        <div className="mt-3 rounded-input bg-warning-bg px-3 py-2 text-xs text-[#6E4708]">
          Below benchmark — {APPROVAL_ROUTING[result.state]?.breach ?? 'Zonal Head'} approval required.
        </div>
      ) : (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-xs font-medium text-success">
          <IconCheck width={12} height={12} /> Clears benchmark
        </div>
      )}
    </div>
  )
}

function DismissingToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-rise">
      <div className="flex items-center gap-2.5 rounded-card border border-border bg-surface px-4 py-3 shadow-soft text-sm text-ink">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-bg text-success">
          <IconCheck width={13} height={13} />
        </span>
        {message}
      </div>
    </div>
  )
}

function SectionBadge({ label, tone }: { label: string; tone: 'green' | 'amber' }) {
  const cls = tone === 'green'
    ? 'bg-success-bg text-success'
    : 'bg-warning-bg text-[#6E4708]'
  return (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function EditPromoView({ promoId }: { promoId: string }) {
  const { getPromo, applyImmediateEdit, submitEdit, navigate, role } = useApp()
  const promo = getPromo(promoId)
  const isAdmin = role === 'admin'
  const today = new Date().toISOString().slice(0, 10)

  // ── Reach & Validity state ──
  const [reach, setReach] = useState<ReachForm>(() => initReachForm(promo!))
  const [cityPanelOpen, setCityPanelOpen] = useState(false)
  const [cityPanelStartIdx, setCityPanelStartIdx] = useState(0)
  const [spTab, setSpTab] = useState('Select from list')
  const [modelTab, setModelTab] = useState('Select from list')
  const [reachToast, setReachToast] = useState<string | null>(null)

  // ── Commercial Terms state ──
  const [commercial, setCommercial] = useState<WizardDraft>(() => initCommercialForm(promo!))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [commercialSubmitted, setCommercialSubmitted] = useState(false)

  if (!promo) {
    return <div className="mt-20 text-center text-muted">Promo not found.</div>
  }

  // ── Reach: pools ──
  const spPool = useMemo<PickItem[]>(() => {
    return SALES_POINTS.filter(
      (sp) =>
        sp.dealerType === promo.dealerType &&
        sp.manufacturers.includes(promo.manufacturer) &&
        (reach.states.length === 0 || reach.states.includes(sp.state)) &&
        (reach.cities.length === 0 || reach.cities.includes(sp.city)),
    ).map((sp) => ({ key: sp.id, label: sp.name, sub: `${sp.city} · ${sp.dealerType}` }))
  }, [promo.dealerType, promo.manufacturer, reach.states, reach.cities])

  const modelPool = useMemo<PickItem[]>(
    () => (MODELS[promo.manufacturer] ?? []).map((m) => ({ key: m, label: m })),
    [promo.manufacturer],
  )

  // ── Reach: validation ──
  const spError = reach.salesPointIds.length === 0
    ? 'At least one sales point is required — deactivate the promo instead of removing all.'
    : null
  const dateOrderError =
    reach.validFrom && reach.validTo && reach.validTo <= reach.validFrom
      ? 'End date must be after start date.'
      : null
  const datePastError =
    reach.validTo && reach.validTo <= today
      ? 'End date must be after today.'
      : null
  const reachValid = !spError && !dateOrderError && !datePastError && !!reach.validFrom && !!reach.validTo

  // ── Reach: handlers ──
  const changeStates = (next: string[]) => {
    const removed = reach.states.filter((s) => !next.includes(s))
    const added = next.filter((s) => !reach.states.includes(s))
    const droppedSps = removed.length > 0
      ? reach.salesPointIds.filter((id) => {
          const sp = SALES_POINTS.find((x) => x.id === id)
          return sp && removed.includes(sp.state)
        })
      : []
    setReach((r) => ({
      ...r,
      states: next,
      cities: r.cities.filter((c) => next.some((s) => (STATES_CITIES[s] ?? []).includes(c))),
      salesPointIds: r.salesPointIds.filter((id) => !droppedSps.includes(id)),
    }))
    if (added.length > 0) {
      const firstNewIdx = next.indexOf(added[0])
      setCityPanelStartIdx(Math.max(0, firstNewIdx))
      setCityPanelOpen(true)
    }
  }

  const validateSP = (token: string): { key: string } | { error: string } => {
    const sp = SALES_POINTS.find((x) => x.id.toLowerCase() === token.toLowerCase())
    if (!sp) return { error: 'Unknown sales point ID' }
    if (sp.dealerType !== promo.dealerType) return { error: `Wrong dealer type (${sp.dealerType})` }
    if (!sp.manufacturers.includes(promo.manufacturer)) return { error: 'Different manufacturer' }
    if (reach.states.length && !reach.states.includes(sp.state)) return { error: `Outside selected states (${sp.state})` }
    return { key: sp.id }
  }

  const validateModel = (token: string): { key: string } | { error: string } => {
    const ok = (MODELS[promo.manufacturer] ?? []).find((m) => m.toLowerCase() === token.toLowerCase())
    return ok ? { key: ok } : { error: `Not a ${promo.manufacturer} model` }
  }

  const saveReach = () => {
    applyImmediateEdit(promoId, reach)
    setReachToast('Reach & validity saved — changes are live.')
  }

  // ── Commercial: derived ──
  const errors = ratesErrors(commercial)
  const hasErrors = Object.keys(errors).length > 0
  const filled =
    !!commercial.minAmount && !!commercial.maxAmount &&
    commercial.minTenure != null && commercial.maxTenure != null &&
    !!commercial.flatRate && !!commercial.dealerPayout
  const canSubmitCommercial = !hasErrors && filled && !promo.pendingEdit && isAdmin

  const payout = parseFloat(commercial.dealerPayout)
  const avgTenure =
    commercial.minTenure != null && commercial.maxTenure != null
      ? (commercial.minTenure + commercial.maxTenure) / 2
      : null
  const irr = commercial.flatRate && avgTenure ? flatToIRR(parseFloat(commercial.flatRate), avgTenure) : null

  const detailForProfit = {
    minAmount: parseFloat(commercial.minAmount) || 0,
    maxAmount: parseFloat(commercial.maxAmount) || 0,
    minTenure: commercial.minTenure ?? 0,
    maxTenure: commercial.maxTenure ?? 0,
    flatRate: parseFloat(commercial.flatRate) || 0,
    pfPct: commercial.pfPct, pfAmount: commercial.pfAmount,
    pddPct: commercial.pddPct, pddAmount: commercial.pddAmount,
    pffAmount: commercial.pffAmount ?? 0, lmfAmount: commercial.lmfAmount ?? 0,
    dealerPayout: payout || 0, dmiOn: commercial.dmiOn,
    dmiAmount: parseFloat(commercial.dmiAmount) || 0,
    advanceEmi: commercial.advanceEmi ?? 0,
    states: promo.detail?.states ?? [promo.state],
    cities: promo.detail?.cities ?? [],
    salesPointIds: promo.detail?.salesPointIds ?? [],
    modelNames: promo.detail?.modelNames ?? [],
    validFrom: commercial.validFrom, validTo: commercial.validTo,
  }
  const profitResult = computeProfit(detailForProfit)
  const breached = profitResult.ok && profitResult.breakdown!.netPct < promo.benchmark
  const modalApprover = breached
    ? (APPROVAL_ROUTING[promo.state]?.breach ?? 'Zonal Head')
    : (APPROVAL_ROUTING[promo.state]?.normal ?? 'Regional Head')

  const doSubmitCommercial = () => {
    submitEdit(promoId, commercial)
    setCommercialSubmitted(true)
    setConfirmOpen(false)
  }

  // ── Success screen (commercial submitted) ──
  if (commercialSubmitted) {
    return (
      <div className="flex max-w-lg flex-col items-center gap-5 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
          <IconCheck width={32} height={32} />
        </div>
        <div>
          <h2 className="font-serif text-2xl text-ink">Commercial edit submitted</h2>
          <p className="mt-2 text-sm text-muted">
            The promo keeps running on its current terms. {modalApprover} will review the proposed changes.
          </p>
        </div>
        <Button onClick={() => navigate({ name: 'existing-promos' })}>Back to Existing Promos</Button>
      </div>
    )
  }

  // ── Main render ──
  return (
    <div className="max-w-2xl space-y-6 pb-12 animate-rise">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate({ name: 'existing-promos' })}
            className="mb-2 text-xs font-medium text-brand hover:underline"
          >
            ← Existing Promos
          </button>
          <h1 className="font-serif text-2xl text-ink">Promo Modification</h1>
          <p className="mt-0.5 text-sm text-muted">
            <span className="font-mono">{promo.id}</span> · {promo.name}
          </p>
        </div>
        <StatusPill status={promo.status} />
      </div>

      {/* Frozen info */}
      <div className="rounded-card border border-border bg-cream/40 p-4 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            ['Scheme', promo.scheme],
            ['Group', promo.group],
            ['Manufacturer', promo.manufacturer],
            ['Dealer type', promo.dealerType],
            ['Current margin', `${promo.margin?.toFixed(1) ?? '—'}%`],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-xs text-muted">{label}</div>
              <div className="mt-0.5 font-medium text-ink">{val}</div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 border-t border-border pt-2.5 text-xs text-muted">
          Scheme, group, manufacturer, and dealer type are frozen after a promo goes live.
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-card border border-[#E7CFA6] bg-warning-bg px-4 py-3 text-sm text-[#6E4708]">
          <IconAlert width={16} height={16} className="shrink-0" />
          Switch to Admin role to save changes.
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — REACH & VALIDITY (immediate)
      ════════════════════════════════════════════════════════════════ */}
      <section className="rounded-card border border-border bg-surface shadow-card">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <h2 className="font-medium text-ink">Reach &amp; Validity</h2>
          <SectionBadge label="Applies immediately" tone="green" />
        </div>
        <div className="space-y-6 p-6">

          {/* States */}
          <Field label="States">
            <MultiSelect
              options={Object.keys(STATES_CITIES)}
              selected={reach.states}
              onChange={changeStates}
              placeholder="Select states"
            />
            <div className="pt-1 text-xs text-muted">
              Removing a state will also remove its cities and sales points.
            </div>
          </Field>

          {/* Cities per state */}
          {reach.states.length > 0 && (
            <Field label="Cities">
              <div className="space-y-2">
                {reach.states.map((state, i) => {
                  const stateCities = reach.cities.filter((c) =>
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
                            stateCities.map((c) => (
                              <span
                                key={c}
                                className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-xs text-ink"
                              >
                                {c}
                                <button
                                  onClick={() => setReach((r) => ({ ...r, cities: r.cities.filter((x) => x !== c) }))}
                                  className="text-muted hover:text-danger"
                                >
                                  <IconX width={11} height={11} />
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setCityPanelStartIdx(i); setCityPanelOpen(true) }}
                        className="shrink-0 text-xs font-medium text-brand hover:underline"
                      >
                        {stateCities.length > 0 ? 'Edit' : 'Add cities'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </Field>
          )}

          {/* City panel overlay */}
          {cityPanelOpen && reach.states.length > 0 && (
            <PerStateCityPanel
              states={reach.states}
              startIdx={cityPanelStartIdx}
              existingCities={reach.cities}
              onApply={(cities) => { setReach((r) => ({ ...r, cities })); setCityPanelOpen(false) }}
              onClose={() => setCityPanelOpen(false)}
            />
          )}

          {/* Sales Points */}
          <Field
            label="Sales Points"
            error={spError ?? undefined}
          >
            <div className="space-y-3">
              <Tabs tabs={['Select from list', 'Upload Excel']} active={spTab} onChange={setSpTab} />
              {spTab === 'Select from list' ? (
                <TwoPanePicker
                  items={spPool}
                  selected={reach.salesPointIds}
                  onChange={(next) => setReach((r) => ({ ...r, salesPointIds: next }))}
                  countNoun="sales points"
                  emptyText="No dealers match this selection. Select states first."
                />
              ) : (
                <UploadPanel
                  templateName="sales_points_template.csv"
                  templateHeader="sales_point_id"
                  noun="sales point"
                  sampleTokens={[...spPool.slice(0, 3).map((s) => s.key), 'SP999']}
                  validate={validateSP}
                  onValidated={(keys) =>
                    setReach((r) => ({ ...r, salesPointIds: [...new Set([...r.salesPointIds, ...keys])] }))
                  }
                />
              )}
            </div>
          </Field>

          {/* Models */}
          <Field label="Models">
            <div className="space-y-3">
              <Tabs tabs={['Select from list', 'Upload Excel']} active={modelTab} onChange={setModelTab} />
              {modelTab === 'Select from list' ? (
                <TwoPanePicker
                  items={modelPool}
                  selected={reach.modelNames}
                  onChange={(next) => setReach((r) => ({ ...r, modelNames: next }))}
                  countNoun="models"
                />
              ) : (
                <UploadPanel
                  templateName="models_template.csv"
                  templateHeader="model_name"
                  noun="model"
                  sampleTokens={[...modelPool.slice(0, 2).map((m) => m.key), 'Unknown Model']}
                  validate={validateModel}
                  onValidated={(keys) =>
                    setReach((r) => ({ ...r, modelNames: [...new Set([...r.modelNames, ...keys])] }))
                  }
                />
              )}
            </div>
          </Field>

          {/* Validity dates */}
          <Field
            label="Validity Period"
            error={dateOrderError ?? datePastError ?? undefined}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted">Start date</label>
                <input
                  type="date"
                  value={reach.validFrom}
                  onChange={(e) => setReach((r) => ({ ...r, validFrom: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted">End date</label>
                <input
                  type="date"
                  value={reach.validTo}
                  min={today}
                  onChange={(e) => setReach((r) => ({ ...r, validTo: e.target.value }))}
                  className={`${inputCls} ${datePastError || dateOrderError ? 'border-danger' : ''}`}
                />
              </div>
            </div>
            {!dateOrderError && !datePastError && reach.validFrom && reach.validTo && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                <IconCheck width={12} height={12} />
                {Math.ceil(
                  (new Date(reach.validTo).getTime() - new Date(reach.validFrom).getTime()) / 86400000,
                )}{' '}
                days
              </p>
            )}
          </Field>

          {/* Save reach button */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted">Changes apply immediately — no approval required.</p>
            <Button
              disabled={!reachValid || !isAdmin}
              onClick={saveReach}
            >
              Save reach &amp; validity
            </Button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — COMMERCIAL TERMS (approval-routed)
      ════════════════════════════════════════════════════════════════ */}
      <section className="rounded-card border border-border bg-surface shadow-card">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <h2 className="font-medium text-ink">Commercial Terms</h2>
          <SectionBadge label="Routes to approval" tone="amber" />
        </div>
        <div className="space-y-6 p-6">

          {/* Pending edit banner */}
          {promo.pendingEdit && (
            <div className="flex items-start gap-3 rounded-card border border-[#E7CFA6] bg-warning-bg px-4 py-3">
              <IconAlert width={18} height={18} className="mt-0.5 shrink-0 text-warning" />
              <div className="text-sm text-[#6E4708]">
                <p className="font-medium">An edit is already pending approval</p>
                <p className="mt-0.5">
                  Submitted {formatDate(promo.pendingEdit.submittedAt)} · awaiting {promo.pendingEdit.approver}.
                  You cannot submit another edit until this one is decided.
                </p>
              </div>
            </div>
          )}

          {/* Edit rejected banner */}
          {promo.editRejectedReason && !promo.pendingEdit && (
            <div className="flex items-start gap-3 rounded-card border border-danger-bg bg-danger-bg px-4 py-3">
              <IconAlert width={18} height={18} className="mt-0.5 shrink-0 text-danger" />
              <div className="text-sm text-danger">
                <p className="font-medium">Previous edit was rejected</p>
                <p className="mt-0.5 text-danger/80">"{promo.editRejectedReason}"</p>
                <p className="mt-1 text-danger/70">Adjust the terms below and resubmit.</p>
              </div>
            </div>
          )}

          {/* Loan & Rate */}
          <div>
            <h3 className="mb-4 text-sm font-medium text-ink">Loan &amp; Rate</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Min Amount Financed" error={errors.minAmount}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                  <input
                    inputMode="numeric"
                    value={commercial.minAmount}
                    onChange={(e) => setCommercial((d) => ({ ...d, minAmount: e.target.value.replace(/[^\d]/g, '') }))}
                    className={`${inputCls} pl-7 font-mono ${errors.minAmount ? 'border-danger focus:ring-danger/10' : ''}`}
                  />
                </div>
              </Field>
              <Field label="Max Amount Financed" error={errors.maxAmount}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                  <input
                    inputMode="numeric"
                    value={commercial.maxAmount}
                    onChange={(e) => setCommercial((d) => ({ ...d, maxAmount: e.target.value.replace(/[^\d]/g, '') }))}
                    className={`${inputCls} pl-7 font-mono ${errors.maxAmount ? 'border-danger focus:ring-danger/10' : ''}`}
                  />
                </div>
              </Field>
              <Field label="Min Tenure">
                <TenureSelect value={commercial.minTenure} onChange={(v) => setCommercial((d) => ({ ...d, minTenure: v }))} />
              </Field>
              <Field label="Max Tenure" error={errors.maxTenure}>
                <TenureSelect value={commercial.maxTenure} onChange={(v) => setCommercial((d) => ({ ...d, maxTenure: v }))} />
              </Field>
            </div>
            <div className="mt-4 max-w-xs">
              <Field label="ROI (%)">
                <div className="relative">
                  <input
                    inputMode="decimal"
                    value={commercial.flatRate}
                    onChange={(e) => setCommercial((d) => ({ ...d, flatRate: e.target.value.replace(/[^\d.]/g, '') }))}
                    className={`${inputCls} pr-8 font-mono`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
                </div>
              </Field>
              <p className="mt-2 text-sm text-muted">
                True rate (IRR): <span className="font-mono">{irr != null ? `${irr.toFixed(1)}%` : '—'}</span>
              </p>
            </div>
          </div>

          {/* Charges & Payouts */}
          <div>
            <h3 className="mb-4 text-sm font-medium text-ink">Charges &amp; Payouts</h3>
            <div className="space-y-5">
              <Field label="Processing Fee (PF)" helper="Choose percentage or amount — not both.">
                <div className="grid grid-cols-2 gap-4">
                  <ChargeSelect label="PF %" unit="%" options={CHARGE_OPTIONS.pfPct}
                    value={commercial.pfPct} disabled={commercial.pfAmount !== null}
                    onChange={(v) => setCommercial((d) => ({ ...d, pfPct: v, pfAmount: null }))} />
                  <ChargeSelect label="PF Amount" unit="₹" options={CHARGE_OPTIONS.pfAmount}
                    value={commercial.pfAmount} disabled={commercial.pfPct !== null}
                    onChange={(v) => setCommercial((d) => ({ ...d, pfAmount: v, pfPct: null }))} />
                </div>
              </Field>
              <Field label="PDD" helper="Choose percentage or amount — not both.">
                <div className="grid grid-cols-2 gap-4">
                  <ChargeSelect label="PDD %" unit="%" options={CHARGE_OPTIONS.pddPct}
                    value={commercial.pddPct} disabled={commercial.pddAmount !== null}
                    onChange={(v) => setCommercial((d) => ({ ...d, pddPct: v, pddAmount: null }))} />
                  <ChargeSelect label="PDD Amount" unit="₹" options={CHARGE_OPTIONS.pddAmount}
                    value={commercial.pddAmount} disabled={commercial.pddPct !== null}
                    onChange={(v) => setCommercial((d) => ({ ...d, pddAmount: v, pddPct: null }))} />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="PFF Amount">
                  <ChargeSelect label="PFF Amount" unit="₹" options={CHARGE_OPTIONS.pffAmount}
                    value={commercial.pffAmount}
                    onChange={(v) => setCommercial((d) => ({ ...d, pffAmount: v }))} />
                </Field>
                <Field label="LMF Amount">
                  <ChargeSelect label="LMF Amount" unit="₹" options={CHARGE_OPTIONS.lmfAmount}
                    value={commercial.lmfAmount}
                    onChange={(v) => setCommercial((d) => ({ ...d, lmfAmount: v }))} />
                </Field>
              </div>
              <Field label="Dealer Subvention" helper="Choose percentage or loan amount — not both.">
                <div className="grid grid-cols-2 gap-4">
                  <ChargeSelect label="Dealer Sub %" unit="%" options={CHARGE_OPTIONS.subventionPct}
                    value={commercial.dealerSubventionPct} disabled={commercial.dealerSubventionAmt !== null}
                    onChange={(v) => setCommercial((d) => ({ ...d, dealerSubventionPct: v, dealerSubventionAmt: null }))} />
                  <ChargeSelect label="Dealer Sub Amt" unit="₹" options={CHARGE_OPTIONS.subventionAmt}
                    value={commercial.dealerSubventionAmt} disabled={commercial.dealerSubventionPct !== null}
                    onChange={(v) => setCommercial((d) => ({ ...d, dealerSubventionAmt: v, dealerSubventionPct: null }))} />
                </div>
              </Field>
              <Field label="Manufacturer Subvention" helper="Choose percentage or loan amount — not both.">
                <div className="grid grid-cols-2 gap-4">
                  <ChargeSelect label="Mfg Sub %" unit="%" options={CHARGE_OPTIONS.subventionPct}
                    value={commercial.mfgSubventionPct} disabled={commercial.mfgSubventionAmt !== null}
                    onChange={(v) => setCommercial((d) => ({ ...d, mfgSubventionPct: v, mfgSubventionAmt: null }))} />
                  <ChargeSelect label="Mfg Sub Amt" unit="₹" options={CHARGE_OPTIONS.subventionAmt}
                    value={commercial.mfgSubventionAmt} disabled={commercial.mfgSubventionPct !== null}
                    onChange={(v) => setCommercial((d) => ({ ...d, mfgSubventionAmt: v, mfgSubventionPct: null }))} />
                </div>
              </Field>
              <Field label="Dealer Payout" error={errors.dealerPayout}>
                <div className="relative max-w-xs">
                  <input
                    inputMode="decimal"
                    value={commercial.dealerPayout}
                    onChange={(e) => setCommercial((d) => ({ ...d, dealerPayout: e.target.value.replace(/[^\d.]/g, '') }))}
                    className={`${inputCls} pr-8 font-mono ${errors.dealerPayout ? 'border-danger focus:ring-danger/10' : ''}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
                </div>
              </Field>
              {!errors.dealerPayout && payout > 5 && (
                <div className="-mt-3 flex items-center gap-2 rounded-input bg-warning-bg px-3 py-2 text-sm text-warning">
                  <IconAlert width={16} height={16} /> Payout above 5% — please recheck.
                </div>
              )}
              {/* Advance EMI */}
              <Field label="Advance EMI" helper="Value shown in SFDC. No charge impact.">
                <div className="relative max-w-xs">
                  <select
                    value={commercial.advanceEmi}
                    onChange={(e) => setCommercial((d) => ({ ...d, advanceEmi: Number(e.target.value) }))}
                    className="w-full appearance-none rounded-input border border-border bg-surface py-2.5 pl-3 pr-9 text-sm text-ink outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  >
                    {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
                </div>
              </Field>
              {/* DMI */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-ink">DM Referral Incentive (DMI)</div>
                    <div className="text-xs text-muted">An extra incentive paid to the referring DM.</div>
                  </div>
                  <button
                    onClick={() => setCommercial((d) => ({ ...d, dmiOn: !d.dmiOn }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${commercial.dmiOn ? 'bg-brand' : 'bg-[#D8D0BF]'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${commercial.dmiOn ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
                {commercial.dmiOn && (
                  <div className="mt-3 max-w-xs animate-rise">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                      <input
                        inputMode="numeric"
                        value={commercial.dmiAmount}
                        onChange={(e) => setCommercial((d) => ({ ...d, dmiAmount: e.target.value.replace(/[^\d]/g, '') }))}
                        placeholder="DMI amount"
                        className={`${inputCls} pl-7 font-mono`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live profitability */}
          {filled && <ProfitWidget form={commercial} benchmark={promo.benchmark} promo={promo} />}

          {/* Breach reason */}
          {filled && breached && (
            <Field label="Reason for going below benchmark" required>
              <textarea
                value={commercial.breachReason}
                onChange={(e) => setCommercial((d) => ({ ...d, breachReason: e.target.value }))}
                placeholder="Add your reason — it travels to the approver"
                rows={3}
                className={`${inputCls} mt-1.5 resize-none`}
              />
            </Field>
          )}

          {/* Submit commercial button */}
          {!promo.pendingEdit && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted">
                The promo keeps running on current terms until the edit is approved.
              </p>
              <Button
                disabled={!canSubmitCommercial || (breached && !commercial.breachReason.trim())}
                onClick={() => setConfirmOpen(true)}
              >
                Submit for approval
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Confirm modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm commercial edit">
        <p className="text-sm text-ink/80">
          This promo will keep running on its <strong>current terms</strong> until the change is approved.
          The edit will be reviewed by <strong>{modalApprover}</strong>.
        </p>
        {breached && (
          <div className="mt-3 flex items-center gap-2 rounded-input bg-warning-bg px-3 py-2 text-sm text-[#6E4708]">
            <IconAlert width={15} height={15} /> Below benchmark — {modalApprover} approval required.
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={doSubmitCommercial}>Submit for approval</Button>
        </div>
      </Modal>

      {/* Reach saved toast */}
      {reachToast && <DismissingToast message={reachToast} onDone={() => setReachToast(null)} />}
    </div>
  )
}
