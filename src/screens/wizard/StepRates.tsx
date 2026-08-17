import { useEffect } from 'react'
import { useApp } from '../../store/AppContext'
import { Field, inputCls } from '../../components/ui/primitives'
import { IconChevronDown, IconAlert } from '../../components/ui/icons'
import { CHARGE_OPTIONS } from '../../data/seed'
import { flatToIRR } from '../../lib/profitability'
import { ratesErrors, schemeFor } from './validators'

function ChargeSelect({
  label,
  unit,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string
  unit: '%' | '₹'
  options: number[]
  value: number | null
  disabled?: boolean
  onChange: (v: number | null) => void
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

function ChargeSelectTenure({
  value,
  options,
  onChange,
}: {
  value: number | null
  options: number[]
  onChange: (v: number | null) => void
}) {
  return (
    <div className="relative">
      <select
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={`w-full appearance-none rounded-input border border-border bg-surface py-2.5 pl-3 pr-9 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 ${value === null ? 'text-muted' : 'text-ink'}`}
      >
        <option value="">Months</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {m} months
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
    </div>
  )
}

export function StepRates() {
  const { draft, setDraft } = useApp()
  const errors = ratesErrors(draft)
  const scheme = schemeFor(draft.schemeName)
  const payout = parseFloat(draft.dealerPayout)

  const tenureOptions = scheme?.tenures ?? [12, 18, 24, 30, 36, 48]

  // Auto-populate min/max tenure from scheme when scheme changes
  useEffect(() => {
    if (!scheme) return
    const tenures = scheme.tenures
    setDraft((d) => ({
      ...d,
      minTenure: d.minTenure != null && tenures.includes(d.minTenure) ? d.minTenure : tenures[0],
      maxTenure: d.maxTenure != null && tenures.includes(d.maxTenure) ? d.maxTenure : tenures[tenures.length - 1],
    }))
  }, [draft.schemeName]) // eslint-disable-line react-hooks/exhaustive-deps

  const avgTenure =
    draft.minTenure != null && draft.maxTenure != null ? (draft.minTenure + draft.maxTenure) / 2 : null
  const irr = draft.flatRate && avgTenure ? flatToIRR(parseFloat(draft.flatRate), avgTenure) : null

  return (
    <div className="max-w-2xl space-y-8 animate-rise">
      {/* Group A — Loan & Rate */}
      <section className="rounded-card border border-border bg-surface p-6">
        <h2 className="font-medium text-ink">Loan &amp; Rate</h2>
        {scheme && (
          <p className="mt-1 text-xs text-muted">
            {scheme.name}: ₹{scheme.minAmount.toLocaleString('en-IN')} – ₹{scheme.maxAmount.toLocaleString('en-IN')}
          </p>
        )}

        {/* Min / Max ROI — read-only, auto-populated from Finnone */}
        {scheme && (
          <div className="mt-4 flex items-center gap-6 rounded-input border border-border bg-cream/60 px-4 py-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">Min ROI (Finnone)</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-ink">{scheme.roiMin}%</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">Max ROI (Finnone)</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-ink">{scheme.roiMax}%</div>
            </div>
            <div className="ml-auto text-xs italic text-muted">Auto-populated · Read-only</div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Min Amount Financed" error={errors.minAmount}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
              <input
                inputMode="numeric"
                value={draft.minAmount}
                onChange={(e) => setDraft((d) => ({ ...d, minAmount: e.target.value.replace(/[^\d]/g, '') }))}
                className={`${inputCls} pl-7 font-mono ${errors.minAmount ? 'border-danger focus:ring-danger/10' : ''}`}
              />
            </div>
          </Field>
          <Field label="Max Amount Financed" error={errors.maxAmount}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
              <input
                inputMode="numeric"
                value={draft.maxAmount}
                onChange={(e) => setDraft((d) => ({ ...d, maxAmount: e.target.value.replace(/[^\d]/g, '') }))}
                className={`${inputCls} pl-7 font-mono ${errors.maxAmount ? 'border-danger focus:ring-danger/10' : ''}`}
              />
            </div>
          </Field>
          <Field label="Min Tenure" helper={scheme ? `Allowed: ${scheme.tenures.join(', ')} mo.` : undefined}>
            <ChargeSelectTenure
              value={draft.minTenure}
              options={tenureOptions}
              onChange={(v) => setDraft((d) => ({ ...d, minTenure: v }))}
            />
          </Field>
          <Field label="Max Tenure" error={errors.maxTenure} helper={scheme ? `Allowed: ${scheme.tenures.join(', ')} mo.` : undefined}>
            <ChargeSelectTenure
              value={draft.maxTenure}
              options={tenureOptions}
              onChange={(v) => setDraft((d) => ({ ...d, maxTenure: v }))}
            />
          </Field>
        </div>

        <div className="mt-4 max-w-xs">
          <Field label="Flat Rate">
            <div className="relative">
              <input
                inputMode="decimal"
                value={draft.flatRate}
                onChange={(e) => setDraft((d) => ({ ...d, flatRate: e.target.value.replace(/[^\d.]/g, '') }))}
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

      {/* Group B — Charges & Payouts */}
      <section className="rounded-card border border-border bg-surface p-6">
        <h2 className="font-medium text-ink">Charges &amp; Payouts</h2>
        <p className="mt-1 text-xs text-muted">From Finnone. Select 0 explicitly where a charge doesn't apply.</p>

        <div className="mt-5 space-y-5">
          {/* PF */}
          <Field label="Processing Fee (PF)" helper="Choose percentage or amount — not both.">
            <div className="grid grid-cols-2 gap-4">
              <ChargeSelect
                label="PF %"
                unit="%"
                options={CHARGE_OPTIONS.pfPct}
                value={draft.pfPct}
                disabled={draft.pfAmount !== null}
                onChange={(v) => setDraft((d) => ({ ...d, pfPct: v, pfAmount: null }))}
              />
              <ChargeSelect
                label="PF Amount"
                unit="₹"
                options={CHARGE_OPTIONS.pfAmount}
                value={draft.pfAmount}
                disabled={draft.pfPct !== null}
                onChange={(v) => setDraft((d) => ({ ...d, pfAmount: v, pfPct: null }))}
              />
            </div>
          </Field>

          {/* PDD */}
          <Field label="PDD" helper="Choose percentage or amount — not both.">
            <div className="grid grid-cols-2 gap-4">
              <ChargeSelect
                label="PDD %"
                unit="%"
                options={CHARGE_OPTIONS.pddPct}
                value={draft.pddPct}
                disabled={draft.pddAmount !== null}
                onChange={(v) => setDraft((d) => ({ ...d, pddPct: v, pddAmount: null }))}
              />
              <ChargeSelect
                label="PDD Amount"
                unit="₹"
                options={CHARGE_OPTIONS.pddAmount}
                value={draft.pddAmount}
                disabled={draft.pddPct !== null}
                onChange={(v) => setDraft((d) => ({ ...d, pddAmount: v, pddPct: null }))}
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="PFF Amount">
              <ChargeSelect
                label="PFF Amount"
                unit="₹"
                options={CHARGE_OPTIONS.pffAmount}
                value={draft.pffAmount}
                onChange={(v) => setDraft((d) => ({ ...d, pffAmount: v }))}
              />
            </Field>
            <Field label="LMF Amount">
              <ChargeSelect
                label="LMF Amount"
                unit="₹"
                options={CHARGE_OPTIONS.lmfAmount}
                value={draft.lmfAmount}
                onChange={(v) => setDraft((d) => ({ ...d, lmfAmount: v }))}
              />
            </Field>
          </div>

          {/* Dealer Subvention */}
          <Field label="Dealer Subvention" helper="Choose percentage or loan amount — not both.">
            <div className="grid grid-cols-2 gap-4">
              <ChargeSelect
                label="Dealer Sub %"
                unit="%"
                options={CHARGE_OPTIONS.subventionPct}
                value={draft.dealerSubventionPct}
                disabled={draft.dealerSubventionAmt !== null}
                onChange={(v) => setDraft((d) => ({ ...d, dealerSubventionPct: v, dealerSubventionAmt: null }))}
              />
              <ChargeSelect
                label="Dealer Sub Amt"
                unit="₹"
                options={CHARGE_OPTIONS.subventionAmt}
                value={draft.dealerSubventionAmt}
                disabled={draft.dealerSubventionPct !== null}
                onChange={(v) => setDraft((d) => ({ ...d, dealerSubventionAmt: v, dealerSubventionPct: null }))}
              />
            </div>
          </Field>

          {/* Manufacturer Subvention */}
          <Field label="Manufacturer Subvention" helper="Choose percentage or loan amount — not both.">
            <div className="grid grid-cols-2 gap-4">
              <ChargeSelect
                label="Mfg Sub %"
                unit="%"
                options={CHARGE_OPTIONS.subventionPct}
                value={draft.mfgSubventionPct}
                disabled={draft.mfgSubventionAmt !== null}
                onChange={(v) => setDraft((d) => ({ ...d, mfgSubventionPct: v, mfgSubventionAmt: null }))}
              />
              <ChargeSelect
                label="Mfg Sub Amt"
                unit="₹"
                options={CHARGE_OPTIONS.subventionAmt}
                value={draft.mfgSubventionAmt}
                disabled={draft.mfgSubventionPct !== null}
                onChange={(v) => setDraft((d) => ({ ...d, mfgSubventionAmt: v, mfgSubventionPct: null }))}
              />
            </div>
          </Field>

          {/* Dealer Payout */}
          <Field label="Dealer Payout %" helper="Inclusive of GST" error={errors.dealerPayout}>
            <div className="relative max-w-xs">
              <input
                inputMode="decimal"
                value={draft.dealerPayout}
                onChange={(e) => setDraft((d) => ({ ...d, dealerPayout: e.target.value.replace(/[^\d.]/g, '') }))}
                className={`${inputCls} pr-8 font-mono ${errors.dealerPayout ? 'border-danger focus:ring-danger/10' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
            </div>
          </Field>
          {!errors.dealerPayout && payout > 5 && (
            <div className="-mt-3 flex items-center gap-2 rounded-input bg-warning-bg px-3 py-2 text-sm text-warning">
              <IconAlert width={16} height={16} />
              Payout above 5% — please recheck.
            </div>
          )}

          {/* Advance EMI */}
          <Field label="Advance EMI" helper="Value shown in SFDC against this promo. No charge impact.">
            <div className="relative max-w-xs">
              <select
                value={draft.advanceEmi}
                onChange={(e) => setDraft((d) => ({ ...d, advanceEmi: Number(e.target.value) }))}
                className="w-full appearance-none rounded-input border border-border bg-surface py-2.5 pl-3 pr-9 text-sm text-ink outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
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
                onClick={() => setDraft((d) => ({ ...d, dmiOn: !d.dmiOn }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${draft.dmiOn ? 'bg-brand' : 'bg-[#D8D0BF]'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${draft.dmiOn ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
            </div>
            {draft.dmiOn && (
              <div className="mt-3 max-w-xs animate-rise">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                  <input
                    inputMode="numeric"
                    value={draft.dmiAmount}
                    onChange={(e) => setDraft((d) => ({ ...d, dmiAmount: e.target.value.replace(/[^\d]/g, '') }))}
                    placeholder="DMI amount"
                    className={`${inputCls} pl-7 font-mono`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
