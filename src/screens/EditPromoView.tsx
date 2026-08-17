import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { Button, Field, Modal, inputCls } from '../components/ui/primitives'
import { IconAlert, IconCheck, IconChevronDown } from '../components/ui/icons'
import { CHARGE_OPTIONS, TENURE_OPTIONS, APPROVAL_ROUTING } from '../data/seed'
import { computeProfit, flatToIRR } from '../lib/profitability'
import { ratesErrors } from './wizard/validators'
import { formatDate, formatINR } from '../lib/format'
import { StatusPill } from '../components/ui/StatusPill'
import type { WizardDraft } from '../data/types'

// ── Sub-components (same structure as StepRates) ──────────────────────────────

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

// ── Compact profitability widget ──────────────────────────────────────────────

function ProfitWidget({ form, benchmark }: { form: WizardDraft; benchmark: number }) {
  const detail = useMemo(() => ({
    minAmount: parseFloat(form.minAmount) || 0,
    maxAmount: parseFloat(form.maxAmount) || 0,
    minTenure: form.minTenure ?? 0,
    maxTenure: form.maxTenure ?? 0,
    flatRate: parseFloat(form.flatRate) || 0,
    pfPct: form.pfPct,
    pfAmount: form.pfAmount,
    pddPct: form.pddPct,
    pddAmount: form.pddAmount,
    pffAmount: form.pffAmount ?? 0,
    lmfAmount: form.lmfAmount ?? 0,
    dealerPayout: parseFloat(form.dealerPayout) || 0,
    dmiOn: form.dmiOn,
    dmiAmount: parseFloat(form.dmiAmount) || 0,
    advanceEmi: form.advanceEmi ?? 0,
    states: form.states,
    cities: form.cities,
    salesPointIds: form.salesPointIds,
    modelNames: form.modelNames,
    validFrom: form.validFrom,
    validTo: form.validTo,
  }), [form])

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
      {breached && (
        <div className="mt-3 rounded-input bg-warning-bg px-3 py-2 text-xs text-[#6E4708]">
          Below benchmark — {APPROVAL_ROUTING[result.state]?.breach ?? 'Zonal Head'} approval required.
        </div>
      )}
      {!breached && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-xs font-medium text-success">
          <IconCheck width={12} height={12} /> Clears benchmark
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function initForm(promo: NonNullable<ReturnType<typeof useApp>['promos'][0]>): WizardDraft {
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

export function EditPromoView({ promoId }: { promoId: string }) {
  const { getPromo, submitEdit, navigate, role } = useApp()
  const promo = getPromo(promoId)

  const [form, setForm] = useState<WizardDraft>(() => initForm(promo!))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!promo) {
    return <div className="mt-20 text-center text-muted">Promo not found.</div>
  }

  const errors = ratesErrors(form)
  const hasErrors = Object.keys(errors).length > 0
  const filled =
    !!form.minAmount && !!form.maxAmount &&
    form.minTenure != null && form.maxTenure != null &&
    !!form.flatRate && !!form.dealerPayout
  const canSubmit = !hasErrors && filled && !promo.pendingEdit && role === 'maker'

  const payout = parseFloat(form.dealerPayout)
  const avgTenure = form.minTenure != null && form.maxTenure != null
    ? (form.minTenure + form.maxTenure) / 2 : null
  const irr = form.flatRate && avgTenure ? flatToIRR(parseFloat(form.flatRate), avgTenure) : null

  // Compute profit to check for breach (for the submit modal text)
  const detailForModal = {
    minAmount: parseFloat(form.minAmount) || 0, maxAmount: parseFloat(form.maxAmount) || 0,
    minTenure: form.minTenure ?? 0, maxTenure: form.maxTenure ?? 0,
    flatRate: parseFloat(form.flatRate) || 0,
    pfPct: form.pfPct, pfAmount: form.pfAmount,
    pddPct: form.pddPct, pddAmount: form.pddAmount,
    pffAmount: form.pffAmount ?? 0, lmfAmount: form.lmfAmount ?? 0,
    dealerPayout: payout || 0, dmiOn: form.dmiOn, dmiAmount: parseFloat(form.dmiAmount) || 0,
    advanceEmi: form.advanceEmi ?? 0, states: form.states, cities: form.cities, salesPointIds: form.salesPointIds,
    modelNames: form.modelNames, validFrom: form.validFrom, validTo: form.validTo,
  }
  const profitResult = computeProfit(detailForModal)
  const breached = profitResult.ok && profitResult.breakdown!.netPct < promo.benchmark
  const modalApprover = breached
    ? (APPROVAL_ROUTING[promo.state]?.breach ?? 'Zonal Head')
    : (APPROVAL_ROUTING[promo.state]?.normal ?? 'Regional Head')

  const doSubmit = () => {
    submitEdit(promoId, form)
    setSubmitted(true)
    setConfirmOpen(false)
  }

  if (submitted) {
    return (
      <div className="flex max-w-lg flex-col items-center gap-5 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
          <IconCheck width={32} height={32} />
        </div>
        <div>
          <h2 className="font-serif text-2xl text-ink">Edit submitted</h2>
          <p className="mt-2 text-sm text-muted">
            The promo keeps running on its current terms. {modalApprover} will review the proposed changes.
          </p>
        </div>
        <Button onClick={() => navigate({ name: 'existing-promos' })}>Back to Existing Promos</Button>
      </div>
    )
  }

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
          <h1 className="font-serif text-2xl text-ink">Edit Rates &amp; Charges</h1>
          <p className="mt-0.5 text-sm text-muted">
            <span className="font-mono">{promo.id}</span> · {promo.name}
          </p>
        </div>
        <StatusPill status={promo.status} />
      </div>

      {/* Promo summary (read-only) */}
      <div className="rounded-card border border-border bg-cream/40 p-5 text-sm">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {[
            ['Scheme', promo.scheme],
            ['Manufacturer', `${promo.manufacturer} · ${promo.dealerType}`],
            ['Geography', promo.state + (promo.city ? `, ${promo.city}` : '')],
            ['Validity', `${formatDate(promo.detail?.validFrom ?? promo.createdAt)} → ${formatDate(promo.detail?.validTo ?? promo.expiry)}`],
            ['Current margin', `${promo.margin?.toFixed(1) ?? '—'}%`],
            ['Sales points', String(promo.salesPointCount)],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-xs text-muted">{label}</div>
              <div className="mt-0.5 font-medium text-ink">{val}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          Mapping (states, cities, sales points, models) cannot be changed here. Use Bulk Upload to re-map.
        </p>
      </div>

      {/* Pending edit blocked banner */}
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
            <p className="mt-1 text-danger/70">You can adjust the terms below and submit a revised edit.</p>
          </div>
        </div>
      )}

      {/* ── Loan & Rate section ── */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="font-medium text-ink">Loan &amp; Rate</h2>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Min Amount Financed" error={errors.minAmount}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
              <input
                inputMode="numeric" value={form.minAmount}
                onChange={(e) => setForm((d) => ({ ...d, minAmount: e.target.value.replace(/[^\d]/g, '') }))}
                className={`${inputCls} pl-7 font-mono ${errors.minAmount ? 'border-danger focus:ring-danger/10' : ''}`}
              />
            </div>
          </Field>
          <Field label="Max Amount Financed" error={errors.maxAmount}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
              <input
                inputMode="numeric" value={form.maxAmount}
                onChange={(e) => setForm((d) => ({ ...d, maxAmount: e.target.value.replace(/[^\d]/g, '') }))}
                className={`${inputCls} pl-7 font-mono ${errors.maxAmount ? 'border-danger focus:ring-danger/10' : ''}`}
              />
            </div>
          </Field>
          <Field label="Min Tenure">
            <TenureSelect value={form.minTenure} onChange={(v) => setForm((d) => ({ ...d, minTenure: v }))} />
          </Field>
          <Field label="Max Tenure" error={errors.maxTenure}>
            <TenureSelect value={form.maxTenure} onChange={(v) => setForm((d) => ({ ...d, maxTenure: v }))} />
          </Field>
        </div>
        <div className="mt-4 max-w-xs">
          <Field label="Flat Rate">
            <div className="relative">
              <input
                inputMode="decimal" value={form.flatRate}
                onChange={(e) => setForm((d) => ({ ...d, flatRate: e.target.value.replace(/[^\d.]/g, '') }))}
                className={`${inputCls} pr-8 font-mono`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
            </div>
          </Field>
          <p className="mt-2 text-sm text-muted">
            True rate (IRR): <span className="font-mono">{irr != null ? `${irr.toFixed(1)}%` : '—'}</span>
          </p>
        </div>
      </section>

      {/* ── Charges & Payouts section ── */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="font-medium text-ink">Charges &amp; Payouts</h2>
        <div className="mt-5 space-y-5">
          <Field label="Processing Fee (PF)" helper="Choose percentage or amount — not both.">
            <div className="grid grid-cols-2 gap-4">
              <ChargeSelect
                label="PF %" unit="%" options={CHARGE_OPTIONS.pfPct}
                value={form.pfPct} disabled={form.pfAmount !== null}
                onChange={(v) => setForm((d) => ({ ...d, pfPct: v, pfAmount: null }))}
              />
              <ChargeSelect
                label="PF Amount" unit="₹" options={CHARGE_OPTIONS.pfAmount}
                value={form.pfAmount} disabled={form.pfPct !== null}
                onChange={(v) => setForm((d) => ({ ...d, pfAmount: v, pfPct: null }))}
              />
            </div>
          </Field>
          <Field label="PDD" helper="Choose percentage or amount — not both.">
            <div className="grid grid-cols-2 gap-4">
              <ChargeSelect
                label="PDD %" unit="%" options={CHARGE_OPTIONS.pddPct}
                value={form.pddPct} disabled={form.pddAmount !== null}
                onChange={(v) => setForm((d) => ({ ...d, pddPct: v, pddAmount: null }))}
              />
              <ChargeSelect
                label="PDD Amount" unit="₹" options={CHARGE_OPTIONS.pddAmount}
                value={form.pddAmount} disabled={form.pddPct !== null}
                onChange={(v) => setForm((d) => ({ ...d, pddAmount: v, pddPct: null }))}
              />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="PFF Amount">
              <ChargeSelect label="PFF Amount" unit="₹" options={CHARGE_OPTIONS.pffAmount}
                value={form.pffAmount} onChange={(v) => setForm((d) => ({ ...d, pffAmount: v }))} />
            </Field>
            <Field label="LMF Amount">
              <ChargeSelect label="LMF Amount" unit="₹" options={CHARGE_OPTIONS.lmfAmount}
                value={form.lmfAmount} onChange={(v) => setForm((d) => ({ ...d, lmfAmount: v }))} />
            </Field>
          </div>
          <Field label="Dealer Payout" error={errors.dealerPayout}>
            <div className="relative max-w-xs">
              <input
                inputMode="decimal" value={form.dealerPayout}
                onChange={(e) => setForm((d) => ({ ...d, dealerPayout: e.target.value.replace(/[^\d.]/g, '') }))}
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
          {/* DMI toggle */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-ink">DM Referral Incentive (DMI)</div>
                <div className="text-xs text-muted">An extra incentive paid to the referring DM.</div>
              </div>
              <button
                onClick={() => setForm((d) => ({ ...d, dmiOn: !d.dmiOn }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${form.dmiOn ? 'bg-brand' : 'bg-[#D8D0BF]'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.dmiOn ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            {form.dmiOn && (
              <div className="mt-3 max-w-xs animate-rise">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                  <input
                    inputMode="numeric" value={form.dmiAmount}
                    onChange={(e) => setForm((d) => ({ ...d, dmiAmount: e.target.value.replace(/[^\d]/g, '') }))}
                    placeholder="DMI amount"
                    className={`${inputCls} pl-7 font-mono`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Live profitability */}
      {filled && <ProfitWidget form={form} benchmark={promo.benchmark} />}

      {/* Breach reason (if breached) */}
      {filled && breached && (
        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <label className="block text-sm font-medium text-ink">
            Reason for going below benchmark <span className="text-brand">*</span>
          </label>
          <textarea
            value={form.breachReason}
            onChange={(e) => setForm((d) => ({ ...d, breachReason: e.target.value }))}
            placeholder="Add your reason — it travels to the approver"
            rows={3}
            className={`${inputCls} mt-1.5 resize-none`}
          />
        </div>
      )}

      {/* Submit */}
      {!promo.pendingEdit && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted">
            The promo keeps running on current terms until the edit is approved.
          </p>
          <Button
            disabled={!canSubmit || (breached && !form.breachReason.trim())}
            onClick={() => setConfirmOpen(true)}
          >
            Send for Approval
          </Button>
        </div>
      )}

      {/* Confirm modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm edit submission">
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
          <Button onClick={doSubmit}>Send for Approval</Button>
        </div>
      </Modal>
    </div>
  )
}
