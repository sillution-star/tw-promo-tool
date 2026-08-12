import { useApp } from '../../store/AppContext'
import { IconCheck, IconAlert } from '../../components/ui/icons'
import { computeProfit } from '../../lib/profitability'
import { APPROVAL_ROUTING } from '../../data/seed'
import { inputCls } from '../../components/ui/primitives'

export function StepProfitability() {
  const { draft, setDraft } = useApp()

  const detail = {
    minAmount: parseFloat(draft.minAmount) || 0,
    maxAmount: parseFloat(draft.maxAmount) || 0,
    minTenure: draft.minTenure ?? 0,
    maxTenure: draft.maxTenure ?? 0,
    flatRate: parseFloat(draft.flatRate) || 0,
    pfPct: draft.pfPct,
    pfAmount: draft.pfAmount,
    pddPct: draft.pddPct,
    pddAmount: draft.pddAmount,
    pffAmount: draft.pffAmount ?? 0,
    lmfAmount: draft.lmfAmount ?? 0,
    dealerPayout: parseFloat(draft.dealerPayout) || 0,
    dmiOn: draft.dmiOn,
    dmiAmount: parseFloat(draft.dmiAmount) || 0,
    advanceEmi: draft.advanceEmi ?? 0,
    states: draft.states,
    cities: draft.cities,
    salesPointIds: draft.salesPointIds,
    modelNames: draft.modelNames,
    validFrom: draft.validFrom,
    validTo: draft.validTo,
  }

  const result = computeProfit(detail)
  const state = result.state

  // Missing master — can't calculate
  if (!result.ok) {
    return (
      <div className="mx-auto mt-10 max-w-md text-center animate-rise">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-bg text-warning">
          <IconAlert width={24} height={24} />
        </div>
        <h2 className="mt-4 font-serif text-2xl text-ink">Profitability can't be calculated</h2>
        <p className="mt-2 text-muted">
          {result.missingMaster} is not set for {state}. Contact admin to configure it.
        </p>
      </div>
    )
  }

  const { netPct } = result.breakdown!
  const breached = result.breached!
  const breachApprover = APPROVAL_ROUTING[state]?.breach ?? 'Zonal Head'

  return (
    <div className="mx-auto max-w-xl py-10 text-center animate-rise">
      {/* The number — the hero */}
      <div
        className={`font-serif leading-none tabular ${breached ? 'text-danger' : 'text-ink'}`}
        style={{ fontSize: '110px' }}
      >
        {netPct.toFixed(1)}%
      </div>
      <p className="mt-2 text-sm uppercase tracking-[0.18em] text-muted">Net margin</p>

      <p className="mt-6 text-base text-muted">Benchmark for {state} is {result.benchmark}%.</p>

      {breached ? (
        <div className="mt-8 text-left">
          <div className="flex items-start gap-3 rounded-card border border-[#E7CFA6] bg-warning-bg px-4 py-3">
            <IconAlert width={20} height={20} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-sm text-[#6E4708]">
              The promo is not meeting the benchmark. <span className="font-medium">{breachApprover}</span> approval is required.
            </p>
          </div>
          <div className="mt-5">
            <label className="block text-sm font-medium text-ink">
              Reason for going below benchmark <span className="text-brand">*</span>
            </label>
            <textarea
              value={draft.breachReason}
              onChange={(e) => setDraft((d) => ({ ...d, breachReason: e.target.value }))}
              placeholder="Add your reason"
              rows={3}
              className={`${inputCls} mt-1.5 resize-none`}
            />
            <p className="mt-1 text-xs text-muted">This reason travels to the approver with your promo.</p>
          </div>
        </div>
      ) : (
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-success-bg px-4 py-2 text-sm font-medium text-success">
          <IconCheck width={16} height={16} />
          Clears the benchmark
        </div>
      )}
    </div>
  )
}
