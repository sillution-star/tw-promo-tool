import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'
import { Button, Modal, Toast, inputCls } from '../components/ui/primitives'
import { IconAlert, IconCheck, IconChevronDown } from '../components/ui/icons'
import { StatusPill } from '../components/ui/StatusPill'
import { computeProfit, detailForPromo } from '../lib/profitability'
import { flatToIRR } from '../lib/profitability'
import { formatINR, formatDate } from '../lib/format'
import { SALES_POINTS } from '../data/seed'
import type { Promo, PresetAction } from '../data/types'

const REJECT_REASONS = [
  'Payout too high',
  'Below benchmark not justified',
  'Wrong geography',
  'Overlaps existing promo',
]

function IncomeExpenseRow({ label, value, kind }: { label: string; value: number; kind: 'in' | 'out' }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ink/80">{label}</span>
      <span className={`font-mono tabular ${kind === 'in' ? 'text-success' : 'text-danger'}`}>
        {kind === 'in' ? '+' : '−'} {formatINR(Math.round(value))}
      </span>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-ink">{children}</div>
    </div>
  )
}

// ── Edit-approval panel (shown when promo.pendingEdit is set) ─────────────────
function EditApprovalPanel({ promoId }: { promoId: string }) {
  const { getPromo, approveEdit, rejectEdit, navigate, role } = useApp()
  const promo = getPromo(promoId)!
  const edit = promo.pendingEdit!

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  // Build a detail object for the proposed edit (for profitability display)
  const existingDetail = detailForPromo(promo)
  const proposedDetail = {
    ...existingDetail,
    minAmount: parseFloat(edit.minAmount) || 0,
    maxAmount: parseFloat(edit.maxAmount) || 0,
    minTenure: edit.minTenure ?? 0,
    maxTenure: edit.maxTenure ?? 0,
    flatRate: parseFloat(edit.flatRate) || 0,
    pfPct: edit.pfPct, pfAmount: edit.pfAmount,
    pddPct: edit.pddPct, pddAmount: edit.pddAmount,
    pffAmount: edit.pffAmount ?? 0, lmfAmount: edit.lmfAmount ?? 0,
    dealerPayout: parseFloat(edit.dealerPayout) || 0,
    dmiOn: edit.dmiOn, dmiAmount: parseFloat(edit.dmiAmount) || 0,
  }
  const proposedResult = computeProfit(proposedDetail)
  const proposedBd = proposedResult.ok ? proposedResult.breakdown! : null
  const proposedBreached = proposedBd ? proposedBd.netPct < promo.benchmark : false

  if (done) {
    return (
      <div className="flex max-w-lg flex-col items-center gap-5 py-16 text-center animate-rise">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${done === 'approved' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
          {done === 'approved' ? <IconCheck width={32} height={32} /> : <IconAlert width={32} height={32} />}
        </div>
        <div>
          <h2 className="font-serif text-2xl text-ink">Edit {done === 'approved' ? 'Approved' : 'Rejected'}</h2>
          <p className="mt-2 text-sm text-muted">
            {done === 'approved'
              ? 'The promo now runs on the updated terms.'
              : 'The maker will be notified of your decision.'}
          </p>
        </div>
        <Button onClick={() => navigate({ name: 'inbox', tab: 'Pending Approval' })}>Back to Inbox</Button>
      </div>
    )
  }

  const doApprove = () => {
    approveEdit(promoId)
    setDone('approved')
  }
  const doReject = () => {
    if (!rejectNote.trim()) return
    rejectEdit(promoId, rejectNote.trim())
    setDone('rejected')
    setRejectOpen(false)
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12 animate-rise">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">{promo.name}</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{promo.id}</span> · {promo.scheme} · currently Live
          </p>
        </div>
        <StatusPill status={promo.status} />
      </div>

      {/* Edit-pending banner */}
      <div className="flex items-center gap-3 rounded-card border border-[#E7CFA6] bg-warning-bg px-4 py-3">
        <IconAlert width={18} height={18} className="shrink-0 text-warning" />
        <div className="text-sm text-[#6E4708]">
          <span className="font-medium">Edit awaiting your approval</span>
          {' '}· submitted by {edit.submittedBy} on {formatDate(edit.submittedAt)}
        </div>
      </div>

      {/* Side-by-side comparison — Mapping */}
      {(edit.manufacturer !== promo.manufacturer ||
        JSON.stringify(edit.states) !== JSON.stringify(existingDetail.states) ||
        JSON.stringify(edit.cities) !== JSON.stringify(existingDetail.cities) ||
        edit.salesPointIds.length !== existingDetail.salesPointIds.length ||
        edit.modelNames.length !== existingDetail.modelNames.length) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Current mapping</h3>
            <div className="space-y-2 text-sm">
              <CompareRow label="Manufacturer" val={promo.manufacturer} />
              <CompareRow label="States" val={existingDetail.states.join(', ') || '—'} />
              <CompareRow label="Cities" val={existingDetail.cities.length ? `${existingDetail.cities.length} cities` : 'All cities'} />
              <CompareRow label="Sales points" val={`${existingDetail.salesPointIds.length}`} />
              <CompareRow label="Models" val={`${existingDetail.modelNames.length}`} />
            </div>
          </div>
          <div className="rounded-card border border-border bg-surface p-5 shadow-card" style={{ borderLeft: '4px solid #B94500' }}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Proposed mapping</h3>
            <div className="space-y-2 text-sm">
              <CompareRow label="Manufacturer" val={edit.manufacturer} changed={edit.manufacturer !== promo.manufacturer} />
              <CompareRow
                label="States"
                val={edit.states.join(', ') || '—'}
                changed={JSON.stringify(edit.states) !== JSON.stringify(existingDetail.states)}
              />
              <CompareRow
                label="Cities"
                val={edit.cities.length ? `${edit.cities.length} cities` : 'All cities'}
                changed={JSON.stringify(edit.cities) !== JSON.stringify(existingDetail.cities)}
              />
              <CompareRow
                label="Sales points"
                val={`${edit.salesPointIds.length}`}
                changed={edit.salesPointIds.length !== existingDetail.salesPointIds.length}
              />
              <CompareRow
                label="Models"
                val={`${edit.modelNames.length}`}
                changed={edit.modelNames.length !== existingDetail.modelNames.length}
              />
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side comparison — Rates & Charges */}
      <div className="grid grid-cols-2 gap-4">
        {/* Current */}
        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Current rates</h3>
          <div className="space-y-2 text-sm">
            <CompareRow label="Loan range" val={`${formatINR(existingDetail.minAmount)} – ${formatINR(existingDetail.maxAmount)}`} />
            <CompareRow label="Tenure" val={`${existingDetail.minTenure} – ${existingDetail.maxTenure} mo`} />
            <CompareRow label="Flat rate" val={`${existingDetail.flatRate}%`} />
            <CompareRow label="Dealer payout" val={`${existingDetail.dealerPayout}%`} />
            <CompareRow label="Margin" val={`${promo.margin?.toFixed(1) ?? '—'}%`} />
          </div>
        </div>
        {/* Proposed */}
        <div
          className="rounded-card border border-border bg-surface p-5 shadow-card"
          style={{ borderLeft: `4px solid ${proposedBreached ? '#8E2418' : '#176038'}` }}
        >
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Proposed rates</h3>
          <div className="space-y-2 text-sm">
            <CompareRow
              label="Loan range"
              val={`${formatINR(proposedDetail.minAmount)} – ${formatINR(proposedDetail.maxAmount)}`}
              changed={proposedDetail.minAmount !== existingDetail.minAmount || proposedDetail.maxAmount !== existingDetail.maxAmount}
            />
            <CompareRow
              label="Tenure"
              val={`${proposedDetail.minTenure} – ${proposedDetail.maxTenure} mo`}
              changed={proposedDetail.minTenure !== existingDetail.minTenure || proposedDetail.maxTenure !== existingDetail.maxTenure}
            />
            <CompareRow
              label="Flat rate" val={`${proposedDetail.flatRate}%`}
              changed={proposedDetail.flatRate !== existingDetail.flatRate}
            />
            <CompareRow
              label="Dealer payout" val={`${proposedDetail.dealerPayout}%`}
              changed={proposedDetail.dealerPayout !== existingDetail.dealerPayout}
            />
            <CompareRow
              label="Margin"
              val={`${edit.newMargin?.toFixed(1) ?? '—'}%`}
              changed={edit.newMargin !== promo.margin}
              good={edit.newMargin != null && !proposedBreached}
              bad={proposedBreached}
            />
          </div>
          {proposedBreached && (
            <div className="mt-3 rounded-input bg-warning-bg px-3 py-2 text-xs text-[#6E4708]">
              Below benchmark ({promo.benchmark}%)
              {edit.breachReason && <span> · Maker's reason: "{edit.breachReason}"</span>}
            </div>
          )}
        </div>
      </div>

      {/* Decision buttons (checker only) */}
      {role === 'checker' && (
        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={doApprove} className="py-3">
              <IconCheck width={18} height={18} /> Approve Edit
            </Button>
            <Button variant="danger" onClick={() => setRejectOpen(true)} className="py-3">
              Reject Edit
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            Approving updates the live promo immediately. Rejecting notifies the maker.
          </p>
        </div>
      )}

      {/* Reject modal */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reason for rejecting this edit">
        <textarea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          rows={4}
          placeholder="Explain why the proposed changes can't be approved"
          className={`${inputCls} resize-none`}
        />
        <p className="mt-1 text-xs text-muted">The maker will see this reason.</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button variant="danger" disabled={!rejectNote.trim()} onClick={doReject}>
            Confirm Rejection
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function CompareRow({ label, val, changed, good, bad }: {
  label: string; val: string; changed?: boolean; good?: boolean; bad?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`font-medium ${bad ? 'text-danger' : good ? 'text-success' : changed ? 'text-[#B94500]' : 'text-ink'}`}>
        {val}
        {changed && !good && !bad && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-[#B94500]">changed</span>}
      </span>
    </div>
  )
}

export function ApproverDecision({ promoId, presetAction }: { promoId: string; presetAction?: PresetAction }) {
  const { getPromo, approve, reject, undoDecision, revoke, rework, navigate, startEditPromo, role } = useApp()
  const promo = getPromo(promoId)

  // Pre-open the relevant panel when arriving from the email
  const [rejectOpen, setRejectOpen] = useState(presetAction === 'reject')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [reworkOpen, setReworkOpen] = useState(presetAction === 'rework')
  const [reworkNote, setReworkNote] = useState('')
  // Approve from email: show a single-confirm panel instead of the 3-button grid
  const [confirmingApprove, setConfirmingApprove] = useState(presetAction === 'approve')
  const [reachOpen, setReachOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [undo, setUndo] = useState<{ label: string; snapshot: Promo } | null>(null)

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 6000)
    return () => clearTimeout(t)
  }, [undo])

  if (!promo) {
    return <div className="mt-20 text-center text-muted">Promo not found.</div>
  }

  // Pending edit on a Live promo → show separate edit-approval UI
  if (promo.pendingEdit) {
    return <EditApprovalPanel promoId={promoId} />
  }

  const detail = detailForPromo(promo)
  const result = computeProfit(detail)
  const bd = result.breakdown!
  const breached = bd.netPct < promo.benchmark
  const irr = flatToIRR(detail.flatRate, (detail.minTenure + detail.maxTenure) / 2)
  const decided = promo.status === 'Approved' || promo.status === 'Live' || promo.status === 'Rejected' || promo.status === 'Rework'
  const pending = promo.status === 'Pending' || promo.status === 'Resubmitted'
  const isResubmit = promo.history.some((h) => h.event === 'Resubmitted')

  const selectedSP = SALES_POINTS.filter((sp) => detail.salesPointIds.includes(sp.id))

  const doApprove = () => {
    setUndo({ label: 'Approved', snapshot: promo })
    approve(promo.id)
  }
  const doReject = () => {
    const full = `${rejectReason}${rejectNote ? ` — ${rejectNote}` : ''}`
    setUndo({ label: 'Rejected', snapshot: promo })
    reject(promo.id, full)
    setRejectOpen(false)
    setRejectReason('')
    setRejectNote('')
  }

  const doRework = () => {
    if (!reworkNote.trim()) return
    rework(promo.id, reworkNote.trim())
    setReworkOpen(false)
    setReworkNote('')
    navigate({ name: 'inbox', tab: 'Sent for Rework' })
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12 animate-rise">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">{promo.name}</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{promo.id}</span> · submitted by {promo.maker} ·{' '}
            {formatDate(promo.createdAt)} · {promo.group} Scheme
          </p>
        </div>
        <StatusPill status={promo.status} />
      </div>

      {/* Email-landing context banner */}
      {presetAction && !decided && (
        <div className="flex items-center justify-between rounded-card border border-[#C7BFAE] bg-cream px-4 py-3">
          <p className="text-sm text-muted">
            {presetAction === 'approve' && 'You tapped Approve in the email. Review and confirm below.'}
            {presetAction === 'reject' && 'You tapped Reject in the email. Add your reason below.'}
            {presetAction === 'rework' && 'You tapped Send for Rework in the email. Add your comments below.'}
          </p>
          <button
            onClick={() => navigate({ name: 'email-preview', promoId })}
            className="ml-4 shrink-0 text-xs font-medium text-brand hover:underline"
          >
            ← View email
          </button>
        </div>
      )}

      {decided && promo.status !== 'Rework' && (
        <div className="rounded-card border border-border bg-cream px-4 py-3 text-sm text-ink/80">
          This promo has already been decided.
        </div>
      )}
      {promo.status === 'Rework' && promo.reworkReason && (
        <div className="rounded-card border border-[#F5CAAD] bg-[#FFF3E0] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#B94500]">Sent back for rework</p>
          <p className="mt-1 text-sm text-[#8B3700]">"{promo.reworkReason}"</p>
        </div>
      )}

      {/* Verdict block (hero) */}
      <div
        className="rounded-card border border-border bg-surface p-6 shadow-card"
        style={{ borderLeft: `4px solid ${breached ? '#8E2418' : '#176038'}` }}
      >
        <div className="flex items-center justify-between gap-6">
          <div>
            <div className={`font-serif leading-none tabular ${breached ? 'text-danger' : 'text-ink'}`} style={{ fontSize: '64px' }}>
              {bd.netPct.toFixed(1)}%
            </div>
            <p className="mt-1 text-sm text-muted">Net margin</p>
          </div>
          <div className="text-right text-sm text-muted">
            Benchmark for {result.state}
            <div className="font-serif text-2xl text-ink">{promo.benchmark}%</div>
          </div>
        </div>
        {breached && (
          <div className="mt-4 rounded-input bg-warning-bg px-4 py-3 text-sm text-[#6E4708]">
            <p className="font-medium">Below benchmark — your approval required.</p>
            {promo.breachReason && <p className="mt-1 italic">Maker's reason: "{promo.breachReason}"</p>}
          </div>
        )}
      </div>

      {/* Breakdown block */}
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="font-medium text-ink">What drives the margin</h2>
        <p className="mt-0.5 text-xs text-muted">Per loan of {formatINR(Math.round(bd.loan))} over {Math.round(bd.tenure)} months.</p>
        <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-1 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-success">Income</div>
            <IncomeExpenseRow label="Interest" value={bd.interest} kind="in" />
            <IncomeExpenseRow label="PF" value={bd.pf} kind="in" />
            <IncomeExpenseRow label="PDD" value={bd.pdd} kind="in" />
            <IncomeExpenseRow label="PFF" value={bd.pff} kind="in" />
            <IncomeExpenseRow label="LMF" value={bd.lmf} kind="in" />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-danger">Expense</div>
            <IncomeExpenseRow label="Cost of funds" value={bd.cof} kind="out" />
            <IncomeExpenseRow label="Opex" value={bd.opex} kind="out" />
            <IncomeExpenseRow label="Net credit loss" value={bd.ncl} kind="out" />
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="inline-flex items-center gap-2 text-ink/80">
                Dealer payout
                {promo.highPayout && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">
                    {promo.dealerPayout}% — high
                  </span>
                )}
              </span>
              <span className="font-mono tabular text-danger">− {formatINR(Math.round(bd.payout))}</span>
            </div>
            {detail.dmiOn && <IncomeExpenseRow label="DMI" value={bd.dmi} kind="out" />}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="font-medium text-ink">Net per loan</span>
          <span className={`font-mono text-lg font-medium tabular ${breached ? 'text-danger' : 'text-success'}`}>
            {formatINR(Math.round(bd.netRs))}
          </span>
        </div>
      </div>

      {/* Facts block */}
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <Fact label="Scheme">{promo.scheme}</Fact>
          <Fact label="Validity">{formatDate(detail.validFrom)} → {formatDate(detail.validTo)}</Fact>
          <Fact label="Manufacturer · type">{promo.manufacturer} · {promo.dealerType}</Fact>
          <Fact label="Reach">
            <button onClick={() => setReachOpen((o) => !o)} className="inline-flex items-center gap-1 text-brand hover:underline">
              {promo.state} · {promo.salesPointCount} points
              <IconChevronDown width={12} height={12} className={reachOpen ? 'rotate-180' : ''} />
            </button>
          </Fact>
          <Fact label="Loan range">{formatINR(detail.minAmount)} – {formatINR(detail.maxAmount)}</Fact>
          <Fact label="Tenure range">{detail.minTenure} – {detail.maxTenure} mo</Fact>
          <Fact label="Flat rate">{detail.flatRate}% ({irr.toFixed(1)}% IRR)</Fact>
          <Fact label="Dealer payout">
            <span className="inline-flex items-center gap-2">
              {promo.dealerPayout}%
              {promo.highPayout && <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-warning">high</span>}
            </span>
          </Fact>
          <Fact label="Models">{detail.modelNames.length || promo.modelCount}</Fact>
        </div>
        {reachOpen && selectedSP.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 rounded-input bg-cream/60 p-3">
            {selectedSP.map((sp) => (
              <span key={sp.id} className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink">{sp.name}</span>
            ))}
          </div>
        )}
      </div>

      {/* History (if resubmitted) */}
      {isResubmit && (
        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <h2 className="font-medium text-ink">History</h2>
          <ol className="mt-4 space-y-4">
            {promo.history.map((h, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`h-2.5 w-2.5 rounded-full ${h.event === 'Rejected' ? 'bg-danger' : h.event === 'Approved' ? 'bg-success' : 'bg-[#C7BFAE]'}`} />
                  {i < promo.history.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="pb-1">
                  <div className="text-sm font-medium text-ink">{h.event}</div>
                  <div className="text-xs text-muted">{formatDate(h.at)} · {h.by}</div>
                  {h.reason && <div className="mt-1 text-sm italic text-[#6E4708]">"{h.reason}"</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Decision */}
      {!decided && role === 'checker' && (
        confirmingApprove ? (
          /* Pre-set from email: single Confirm Approval panel */
          <div className="rounded-card border-2 border-success bg-[#F3FBF7] p-6 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                <IconCheck width={22} height={22} />
              </div>
              <div>
                <p className="font-medium text-ink">Confirm your approval</p>
                <p className="text-xs text-muted">You tapped Approve in the email — one click to commit.</p>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button onClick={doApprove} className="flex-1 py-3">
                <IconCheck width={18} height={18} /> Confirm Approval
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmingApprove(false)}
                className="py-3"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface p-6 shadow-card">
            <div className="grid grid-cols-3 gap-3">
              <Button onClick={doApprove} className="py-3">
                <IconCheck width={18} height={18} /> Approve
              </Button>
              <Button variant="secondary" onClick={() => setReworkOpen(true)} className="py-3">
                Send for Rework
              </Button>
              <Button variant="danger" onClick={() => setRejectOpen(true)} className="py-3">
                Reject
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              "Send for Rework" returns the promo to the maker with your comments. Rejecting formally closes it.
            </p>
          </div>
        )
      )}

      {/* Maker — edit rejected notification */}
      {role === 'maker' && promo.editRejectedReason && (
        <div className="flex items-start gap-3 rounded-card border border-danger-bg bg-danger-bg px-4 py-3">
          <IconAlert width={18} height={18} className="mt-0.5 shrink-0 text-danger" />
          <div className="text-sm text-danger">
            <p className="font-medium">Your latest edit was rejected</p>
            <p className="mt-0.5 text-danger/80">"{promo.editRejectedReason}"</p>
            <button
              onClick={() => startEditPromo(promo.id)}
              className="mt-1 text-sm font-medium text-brand hover:underline"
            >
              Submit a revised edit →
            </button>
          </div>
        </div>
      )}

      {/* Maker — revoke while pending (read-only otherwise) */}
      {role === 'maker' && pending && (
        <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
          <p className="text-sm text-muted">
            Awaiting {promo.approver}. You can revoke this request while it's pending — it returns to your drafts.
          </p>
          <Button variant="secondary" onClick={() => setRevokeOpen(true)}>
            Revoke request
          </Button>
        </div>
      )}

      {/* Reject panel */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reason for rejection">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Common reason</label>
            <div className="relative">
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className={`${inputCls} appearance-none pr-9 ${rejectReason ? 'text-ink' : 'text-muted'}`}
              >
                <option value="">Select a reason</option>
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Details <span className="text-brand">*</span></label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Explain so the maker can fix and resubmit"
              className={`${inputCls} resize-none`}
            />
            <p className="mt-1 text-xs text-muted">The maker will see this reason.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!rejectReason && !rejectNote.trim()} onClick={doReject}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rework panel */}
      <Modal open={reworkOpen} onClose={() => setReworkOpen(false)} title="Send back for rework">
        <p className="text-sm text-ink/80">
          The maker will see your comments and can edit and resubmit. This is not a formal rejection.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-ink">
            What needs to change? <span className="text-brand">*</span>
          </label>
          <textarea
            value={reworkNote}
            onChange={(e) => setReworkNote(e.target.value)}
            rows={4}
            placeholder="e.g. Reduce dealer payout to below 4.5% and confirm there's no geography overlap with existing promos."
            className={`${inputCls} resize-none`}
          />
          <p className="text-xs text-muted">The maker will see this verbatim in their inbox and during editing.</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => { setReworkOpen(false); setReworkNote('') }}>Cancel</Button>
          <Button disabled={!reworkNote.trim()} onClick={doRework}>
            Send for Rework
          </Button>
        </div>
      </Modal>

      {/* Revoke confirm */}
      <Modal open={revokeOpen} onClose={() => setRevokeOpen(false)} title="Revoke this request?">
        <p className="text-sm text-ink/80">
          This pulls <span className="font-medium">{promo.name}</span> from {promo.approver}'s queue and
          returns it to your drafts. You can edit and resubmit it later.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRevokeOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              revoke(promo.id)
              setRevokeOpen(false)
              navigate({ name: 'dashboard' })
            }}
          >
            Revoke request
          </Button>
        </div>
      </Modal>

      {/* Undo toast */}
      {undo && (
        <Toast
          message={`${undo.label}. ${promo.name}`}
          action="Undo"
          onAction={() => {
            undoDecision(promo.id, undo.snapshot)
            setUndo(null)
            navigate({ name: 'inbox', tab: 'Pending Approval' })
          }}
        />
      )}
    </div>
  )
}
