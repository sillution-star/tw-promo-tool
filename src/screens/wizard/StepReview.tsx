import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppContext'
import { Button } from '../../components/ui/primitives'
import { IconCheck, IconAlert, IconChevronDown, IconCopy } from '../../components/ui/icons'
import { computeProfit } from '../../lib/profitability'
import { flatToIRR } from '../../lib/profitability'
import { APPROVAL_ROUTING, SALES_POINTS } from '../../data/seed'
import { formatINR } from '../../lib/format'
import type { Promo } from '../../data/types'

function Section({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="font-medium text-ink">{title}</h3>
        {onEdit && (
          <button onClick={onEdit} className="text-sm font-medium text-brand hover:underline">
            Edit
          </button>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{children}</span>
    </div>
  )
}

// Highlighted input used for "must fill" fields in clone mode
function AttentionInput({
  label,
  required,
  empty,
  hint,
  children,
}: {
  label: string
  required?: boolean
  empty: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-input border px-3 py-2.5 transition ${empty ? 'border-[#E7CFA6] bg-warning-bg/30' : 'border-border bg-cream/40'}`}>
      <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted">
        {label}
        {required && <span className="text-brand">*</span>}
        {empty && <span className="ml-auto text-[#B87A20]">{hint ?? 'Required'}</span>}
      </div>
      {children}
    </div>
  )
}

export function StepReview({ onEdit }: { onEdit: (step: number) => void }) {
  const { draft, setDraft, promos, navigate, submitPromo, submitEdit } = useApp()
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<Promo | null>(null)
  const [editDone, setEditDone] = useState(false)
  const [reachOpen, setReachOpen] = useState(false)
  const [proceedAnyway, setProceedAnyway] = useState(false)

  const isEditMode = !!draft.editingPromoId
  const isCloneMode = !!draft.clonedFromId

  const payout = parseFloat(draft.dealerPayout) || 0
  const avgTenure = ((draft.minTenure ?? 0) + (draft.maxTenure ?? 0)) / 2
  const irr = draft.flatRate ? flatToIRR(parseFloat(draft.flatRate), avgTenure) : 0

  const detail = useMemo(
    () => ({
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
      dealerPayout: payout,
      dmiOn: draft.dmiOn,
      dmiAmount: parseFloat(draft.dmiAmount) || 0,
      advanceEmi: draft.advanceEmi ?? 0,
      states: draft.states,
      cities: draft.cities,
      salesPointIds: draft.salesPointIds,
      modelNames: draft.modelNames,
      validFrom: draft.validFrom,
      validTo: draft.validTo,
    }),
    [draft, payout],
  )

  const profit = computeProfit(detail)
  const breached = profit.breached
  const state = profit.state
  const route = APPROVAL_ROUTING[state]
  const approver = breached ? route?.breach : route?.normal

  // Duplicate check — skip in clone mode (a clone is inherently similar)
  const duplicate = useMemo(
    () =>
      !isCloneMode
        ? promos.find(
            (p) =>
              p.id !== draft.id &&
              p.status !== 'Draft' &&
              p.scheme === draft.schemeName &&
              p.manufacturer === draft.manufacturer &&
              draft.states.includes(p.state) &&
              Math.abs(p.dealerPayout - payout) <= 1,
          )
        : undefined,
    [promos, draft, payout, isCloneMode],
  )

  const selectedSP = SALES_POINTS.filter((sp) => draft.salesPointIds.includes(sp.id))

  // Clone submit validation
  const cloneName = draft.name.trim()
  const cloneReady = !isCloneMode || (cloneName.length > 0 && !!draft.validFrom && !!draft.validTo)
  const cloneBreachReady = !isCloneMode || !breached || !!draft.breachReason.trim()

  const submit = () => {
    setSubmitting(true)
    setTimeout(() => {
      if (isEditMode) {
        submitEdit(draft.editingPromoId!, draft)
        setSubmitting(false)
        setEditDone(true)
      } else {
        const promo = submitPromo()
        setSubmitting(false)
        setDone(promo)
      }
    }, 900)
  }

  // ── Edit-mode success ──
  if (editDone) {
    return (
      <div className="mx-auto max-w-md py-12 text-center animate-rise">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
          <IconCheck width={28} height={28} />
        </div>
        <h2 className="mt-5 font-serif text-3xl text-ink">Edit submitted</h2>
        <p className="mt-2 text-muted">
          Your changes to <span className="font-mono text-ink">{draft.editingPromoId}</span> are pending approval.
          The promo continues on its current terms until the checker approves.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate({ name: 'existing-promos' })}>
            Back to Existing Promos
          </Button>
          <Button onClick={() => navigate({ name: 'inbox', tab: 'Pending' })}>Go to Inbox</Button>
        </div>
      </div>
    )
  }

  // ── Create / clone / resubmit success ──
  if (done) {
    return (
      <div className="mx-auto max-w-md py-12 text-center animate-rise">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
          <IconCheck width={28} height={28} />
        </div>
        <h2 className="mt-5 font-serif text-3xl text-ink">Submitted for approval</h2>
        <p className="mt-2 text-muted">
          <span className="font-mono text-ink">{done.id}</span> — {done.name}
        </p>
        {draft.clonedFromId && (
          <p className="mt-1 text-xs text-muted">Cloned from {draft.clonedFromName}</p>
        )}
        <div className="mx-auto mt-6 max-w-xs space-y-2 rounded-card border border-border bg-surface p-4 text-sm">
          <Row label="Status">
            <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-medium text-warning">
              Pending Approval
            </span>
          </Row>
          <Row label="Gone to">{done.approver}</Row>
        </div>
        <div className="mt-7 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate({ name: 'dashboard' })}>
            Back to Dashboard
          </Button>
          <Button onClick={() => navigate({ name: 'inbox', tab: 'Pending' })}>Go to Inbox</Button>
        </div>
      </div>
    )
  }

  const dmiText = draft.dmiOn ? formatINR(parseFloat(draft.dmiAmount) || 0) : 'Off'

  return (
    <div className="max-w-2xl space-y-5 pb-24 animate-rise">

      {/* Clone provenance banner */}
      {isCloneMode && (
        <div className="flex items-center gap-3 rounded-card border border-[#C7BFAE] bg-cream px-4 py-3">
          <IconCopy width={16} height={16} className="shrink-0 text-muted" />
          <p className="text-sm text-muted">
            Cloned from <span className="font-medium text-ink">{draft.clonedFromName}</span>.
            {' '}Review and adjust before submitting.
          </p>
        </div>
      )}

      {/* Duplicate notice (not shown in clone mode) */}
      {!isCloneMode && duplicate && (
        <div className="rounded-card border border-[#E7CFA6] bg-warning-bg px-4 py-3">
          <div className="flex items-start gap-3">
            <IconAlert width={20} height={20} className="mt-0.5 shrink-0 text-warning" />
            <div className="text-sm text-[#6E4708]">
              <p className="font-medium">A similar promo may already exist.</p>
              <p className="mt-0.5">
                {duplicate.name} ({duplicate.id}) — same scheme &amp; manufacturer in {duplicate.state}, payout {duplicate.dealerPayout}%.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={() => navigate({ name: 'approver', promoId: duplicate.id })}
                  className="font-medium text-brand hover:underline"
                >
                  Review match
                </button>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={proceedAnyway} onChange={(e) => setProceedAnyway(e.target.checked)} />
                  Proceed anyway
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promo Details */}
      <Section title="Promo Details" onEdit={!isEditMode ? () => onEdit(1) : undefined}>
        {isCloneMode ? (
          <div className="space-y-3">
            {/* Name — must fill, highlighted */}
            <AttentionInput label="Name" required empty={!draft.name.trim()} hint="Enter a unique name">
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Honda Shine Festive – Pune 2027"
                className="w-full bg-transparent text-sm font-medium text-ink placeholder:font-normal placeholder:text-muted/60 outline-none"
              />
            </AttentionInput>

            <Row label="Scheme">{draft.schemeName}</Row>
            <Row label="Promo group">{draft.group} Scheme</Row>

            {/* Dates — must fill, highlighted */}
            <AttentionInput
              label="Validity dates"
              required
              empty={!draft.validFrom || !draft.validTo}
              hint="Both dates required"
            >
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={draft.validFrom}
                  onChange={(e) => setDraft((d) => ({ ...d, validFrom: e.target.value }))}
                  className={`rounded-sm border px-2.5 py-1.5 text-sm outline-none transition ${
                    !draft.validFrom ? 'border-[#E7CFA6] bg-warning-bg/40 text-muted' : 'border-border text-ink'
                  }`}
                />
                <span className="text-muted">→</span>
                <input
                  type="date"
                  value={draft.validTo}
                  onChange={(e) => setDraft((d) => ({ ...d, validTo: e.target.value }))}
                  className={`rounded-sm border px-2.5 py-1.5 text-sm outline-none transition ${
                    !draft.validTo ? 'border-[#E7CFA6] bg-warning-bg/40 text-muted' : 'border-border text-ink'
                  }`}
                />
              </div>
            </AttentionInput>
          </div>
        ) : (
          <>
            <Row label="Name">{draft.name}</Row>
            <Row label="Scheme">{draft.schemeName}</Row>
            <Row label="Promo group">{draft.group} Scheme</Row>
          </>
        )}
      </Section>

      {/* Mapping */}
      <Section title="Mapping" onEdit={() => onEdit(2)}>
        <Row label="Manufacturer · dealer type">{draft.manufacturer} · {draft.dealerType}</Row>
        <Row label="Geography">{draft.states.join(', ')}{draft.cities.length ? ` (${draft.cities.length} cities)` : ''}</Row>
        <Row label="Reach">
          <button onClick={() => setReachOpen((o) => !o)} className="inline-flex items-center gap-1 text-brand hover:underline">
            {draft.salesPointIds.length} sales points · view
            <IconChevronDown width={13} height={13} className={reachOpen ? 'rotate-180' : ''} />
          </button>
        </Row>
        {reachOpen && (
          <div className="mt-2 flex flex-wrap gap-1.5 rounded-input bg-cream/60 p-3">
            {selectedSP.map((sp) => (
              <span key={sp.id} className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink">
                {sp.name}
              </span>
            ))}
          </div>
        )}
        <Row label="Models">{draft.modelNames.join(', ') || '—'}</Row>
      </Section>

      {/* Rates & Charges */}
      <Section title="Rates & Charges" onEdit={() => onEdit(3)}>
        <Row label="Amount financed">{formatINR(detail.minAmount)} – {formatINR(detail.maxAmount)}</Row>
        <Row label="Tenure">{detail.minTenure} – {detail.maxTenure} months</Row>
        <Row label="Flat rate (IRR)">{detail.flatRate}% ({irr.toFixed(1)}% IRR)</Row>
        <Row label="PF">{draft.pfPct != null ? `${draft.pfPct}%` : formatINR(draft.pfAmount ?? 0)}</Row>
        <Row label="PDD">{draft.pddPct != null ? `${draft.pddPct}%` : formatINR(draft.pddAmount ?? 0)}</Row>
        <Row label="PFF / LMF">{formatINR(draft.pffAmount ?? 0)} / {formatINR(draft.lmfAmount ?? 0)}</Row>
        <Row label="Dealer payout">
          <span className="inline-flex items-center gap-2">
            {payout}%
            {payout > 5 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">
                <IconAlert width={11} height={11} /> high
              </span>
            )}
          </span>
        </Row>
        <Row label="DMI">{dmiText}</Row>
      </Section>

      {/* Profitability */}
      <Section title="Profitability" onEdit={() => onEdit(4)}>
        <Row label="Net margin">
          <span className={breached ? 'text-danger' : 'text-ink'}>{profit.breakdown!.netPct.toFixed(1)}%</span>
        </Row>
        <Row label="Benchmark">{profit.benchmark}% ({state})</Row>
        {breached ? (
          <div className="mt-2 space-y-2 rounded-input bg-warning-bg px-3 py-2.5 text-sm text-[#6E4708]">
            <p className="font-medium">Below benchmark — will go to {approver}.</p>
            {isCloneMode ? (
              /* In clone mode, breach reason must be filled inline */
              <div>
                <label className="block text-xs font-medium text-[#8B5E00] mb-1">
                  Reason for breach <span className="text-brand">*</span>
                </label>
                <textarea
                  value={draft.breachReason}
                  onChange={(e) => setDraft((d) => ({ ...d, breachReason: e.target.value }))}
                  rows={2}
                  placeholder="Briefly justify why this payout is below benchmark…"
                  className={`w-full resize-none rounded-sm border px-2.5 py-2 text-sm outline-none transition ${
                    !draft.breachReason.trim()
                      ? 'border-[#E7CFA6] bg-warning-bg/40 placeholder:text-[#B87A20]'
                      : 'border-border bg-surface/80 text-ink'
                  }`}
                />
              </div>
            ) : (
              <p className="italic">"{draft.breachReason}"</p>
            )}
          </div>
        ) : (
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-success">
            <IconCheck width={15} height={15} /> Clears the benchmark — routes to {approver}.
          </div>
        )}
      </Section>

      {/* Footer */}
      <div className="fixed bottom-0 left-[248px] right-0 z-10 flex items-center justify-between border-t border-border bg-cream/90 px-8 py-4 backdrop-blur">
        <div>
          {!isCloneMode && (
            <Button variant="secondary" onClick={() => onEdit(4)}>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Clone mode — show what's still missing */}
          {isCloneMode && (!cloneReady || !cloneBreachReady) && (
            <p className="text-xs text-muted">
              {!cloneName ? 'Enter a promo name' : !draft.validFrom || !draft.validTo ? 'Set validity dates' : 'Add a breach reason'}
              {' '}to enable submit
            </p>
          )}
          <Button
            disabled={
              submitting
              || (!isEditMode && !isCloneMode && !!duplicate && !proceedAnyway)
              || !cloneReady
              || !cloneBreachReady
            }
            onClick={submit}
          >
            {submitting
              ? 'Submitting…'
              : isCloneMode
                ? 'Submit Clone for Approval'
                : isEditMode
                  ? 'Submit Edit for Approval'
                  : 'Submit for Approval'}
          </Button>
        </div>
      </div>
    </div>
  )
}
