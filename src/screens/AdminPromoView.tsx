import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { Button, Modal, inputCls } from '../components/ui/primitives'
import { StatusPill } from '../components/ui/StatusPill'
import { IconAlert, IconCheck, IconChevronDown, IconCopy } from '../components/ui/icons'
import { formatDate, formatINR } from '../lib/format'
import { detailForPromo } from '../lib/profitability'
import { DEACTIVATION_REASONS } from '../data/seed'

const TODAY = '2026-06-25'

function isWithinDates(expiry: string | null): boolean {
  if (!expiry) return true
  return expiry >= TODAY
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-ink">{children}</div>
    </div>
  )
}

function HistoryRow({ event, at, by, reason }: { event: string; at: string; by: string; reason?: string }) {
  const dot =
    event === 'Deactivated' ? 'bg-danger' :
    event === 'Reactivated' ? 'bg-success' :
    event === 'Approved' ? 'bg-success' :
    'bg-[#C7BFAE]'
  return (
    <div className="flex gap-3 text-sm">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div>
        <span className="font-medium text-ink">{event}</span>
        <span className="ml-2 text-muted">{formatDate(at)} · {by}</span>
        {reason && <p className="mt-0.5 italic text-[#6E4708]">"{reason}"</p>}
      </div>
    </div>
  )
}

export function AdminPromoView({ promoId }: { promoId: string }) {
  const { getPromo, navigate, startEditPromo, startClonePromo, deactivate, reactivate, role } = useApp()
  const isAdmin = role === 'admin'
  const promo = getPromo(promoId)

  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [reactivateOpen, setReactivateOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState<'deactivated' | 'reactivated' | null>(null)
  const [cloning, setCloning] = useState(false)

  if (!promo) {
    return <div className="mt-20 text-center text-muted">Promo not found.</div>
  }

  const detail = detailForPromo(promo)
  const canReactivate = promo.status === 'Deactivated' && isWithinDates(promo.expiry)
  const isEnded = promo.status === 'Deactivated' && !isWithinDates(promo.expiry)

  const doDeactivate = () => {
    deactivate(promoId, reason, note)
    setDeactivateOpen(false)
    setDone('deactivated')
    setReason('')
    setNote('')
  }

  const doReactivate = () => {
    reactivate(promoId)
    setReactivateOpen(false)
    setDone('reactivated')
  }

  // ── Post-action confirmation ──
  if (done) {
    return (
      <div className="mx-auto max-w-md py-16 text-center animate-rise">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${done === 'reactivated' ? 'bg-success-bg text-success' : 'bg-[#F3E8E8] text-danger'}`}>
          {done === 'reactivated' ? <IconCheck width={28} height={28} /> : <IconAlert width={28} height={28} />}
        </div>
        <h2 className="mt-5 font-serif text-3xl text-ink">
          {done === 'deactivated' ? 'Promo deactivated' : 'Promo reactivated'}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {done === 'deactivated'
            ? 'The promo is switched off for new business. You can reactivate it any time before the end date.'
            : 'The promo is live again and accepting new business.'}
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate({ name: 'existing-promos' })}>
            Back to Existing Promos
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12 animate-rise">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">{promo.name}</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{promo.id}</span> · {promo.scheme} · {promo.manufacturer} · {promo.state}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={promo.status} />

          {/* Clone — admin only */}
          {isAdmin && (
            <button
              onClick={() => {
                setCloning(true)
                setTimeout(() => {
                  startClonePromo(promoId)
                  setCloning(false)
                }, 700)
              }}
              disabled={cloning}
              className="inline-flex items-center gap-1.5 rounded-input border border-border px-3 py-2 text-sm font-medium text-muted transition hover:border-[#D8D0BF] hover:text-ink disabled:opacity-50"
            >
              <IconCopy width={14} height={14} />
              {cloning ? 'Cloning…' : 'Clone'}
            </button>
          )}

          {/* Promo Modification — admin only */}
          {isAdmin && promo.status === 'Live' && (
            <Button variant="secondary" onClick={() => startEditPromo(promoId)}>
              Promo Modification
            </Button>
          )}

          {/* Deactivate / Reactivate — admin only */}
          {isAdmin && promo.status === 'Live' && (
            <Button variant="danger" onClick={() => setDeactivateOpen(true)}>
              Deactivate
            </Button>
          )}
          {isAdmin && canReactivate && (
            <Button onClick={() => setReactivateOpen(true)}>
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Ended notice */}
      {isEnded && (
        <div className="flex items-center justify-between rounded-card border border-border bg-cream px-5 py-4 text-sm text-muted">
          <span>This promo has ended.</span>
          {isAdmin && (
            <button
              onClick={() => {
                setCloning(true)
                setTimeout(() => { startClonePromo(promoId); setCloning(false) }, 700)
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <IconCopy width={14} height={14} /> Clone to run again
            </button>
          )}
        </div>
      )}

      {/* Deactivated-within-dates info */}
      {canReactivate && (
        <div className="flex items-center gap-3 rounded-card border border-[#E3B7B0] bg-danger-bg px-4 py-3 text-sm text-danger">
          <IconAlert width={16} height={16} className="shrink-0" />
          Promo is deactivated — no new business is being accepted. It can be reactivated any time before {formatDate(promo.expiry)}.
        </div>
      )}

      {/* ── Facts ── */}
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <Fact label="Scheme">{promo.scheme} · {promo.group}</Fact>
          <Fact label="Manufacturer · Type">{promo.manufacturer} · {promo.dealerType}</Fact>
          <Fact label="Geography">{promo.state}{promo.city ? ` · ${promo.city}` : ''}</Fact>
          <Fact label="Validity">
            {detail.validFrom ? `${formatDate(detail.validFrom)} → ${formatDate(detail.validTo)}` : `Expires ${formatDate(promo.expiry)}`}
          </Fact>
          <Fact label="Loan range">
            {detail.minAmount ? `${formatINR(detail.minAmount)} – ${formatINR(detail.maxAmount)}` : '—'}
          </Fact>
          <Fact label="Tenure">
            {detail.minTenure ? `${detail.minTenure} – ${detail.maxTenure} months` : '—'}
          </Fact>
          <Fact label="Flat rate">{detail.flatRate ? `${detail.flatRate}%` : '—'}</Fact>
          <Fact label="Dealer payout">
            <span className="inline-flex items-center gap-2">
              {promo.dealerPayout}%
              {promo.highPayout && (
                <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-warning">high</span>
              )}
            </span>
          </Fact>
          <Fact label="Net margin">
            {promo.margin != null
              ? <span className={promo.margin < promo.benchmark ? 'text-danger' : 'text-success'}>{promo.margin.toFixed(1)}%</span>
              : '—'}
          </Fact>
          <Fact label="Sales points">{promo.salesPointCount}</Fact>
          <Fact label="Models">{promo.modelCount}</Fact>
          <Fact label="Approved by">{promo.approver ?? '—'}</Fact>
        </div>
      </div>

      {/* ── History ── */}
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-4 font-medium text-ink">History</h2>
        <div className="space-y-3">
          {promo.history.map((h, i) => (
            <HistoryRow key={i} event={h.event} at={h.at} by={h.by} reason={h.reason} />
          ))}
        </div>
      </div>

      {/* ── Deactivate modal ── */}
      <Modal open={deactivateOpen} onClose={() => { setDeactivateOpen(false); setReason(''); setNote('') }} title="Deactivate this promo">
        <p className="text-sm text-muted">
          This switches the promo off for new business.
          It can be reactivated any time before <span className="font-medium text-ink">{formatDate(promo.expiry)}</span>.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Reason <span className="text-brand">*</span>
            </label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`${inputCls} appearance-none pr-9 ${reason ? 'text-ink' : 'text-muted'}`}
              >
                <option value="">Select a reason</option>
                {DEACTIVATION_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Notes <span className="text-xs font-normal text-muted">(optional — logged in history)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Any additional context for the record…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => { setDeactivateOpen(false); setReason(''); setNote('') }}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!reason} onClick={doDeactivate}>
            Confirm Deactivation
          </Button>
        </div>
      </Modal>

      {/* ── Reactivate confirm ── */}
      <Modal open={reactivateOpen} onClose={() => setReactivateOpen(false)} title="Reactivate this promo?">
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{promo.name}</span> will go back to Live status
          and start accepting new business immediately. It runs until <span className="font-medium text-ink">{formatDate(promo.expiry)}</span>.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setReactivateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={doReactivate}>
            <IconCheck width={16} height={16} /> Confirm Reactivation
          </Button>
        </div>
      </Modal>
    </div>
  )
}
