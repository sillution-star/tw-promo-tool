/**
 * EmailDecisionView — simulates the approval-request email that the checker
 * receives. Shows a branded, self-contained email card with a full promo
 * summary and three action buttons. Each button navigates to ApproverDecision
 * with the chosen action pre-set so the checker can confirm in one click.
 */

import { useApp } from '../store/AppContext'

import { IconCheck, IconAlert } from '../components/ui/icons'
import { computeProfit, detailForPromo } from '../lib/profitability'
import { flatToIRR } from '../lib/profitability'
import { formatINR, formatDate } from '../lib/format'
import type { PresetAction } from '../data/types'

function EmailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-[#ECE7DA] last:border-0">
      <td className="py-2.5 pr-6 text-xs font-medium uppercase tracking-wide text-[#8A7D6B]">{label}</td>
      <td className="py-2.5 text-sm font-medium text-[#1A1410]">{children}</td>
    </tr>
  )
}

export function EmailDecisionView({ promoId }: { promoId: string }) {
  const { getPromo, navigate } = useApp()
  const promo = getPromo(promoId)

  if (!promo) {
    return <div className="mt-20 text-center text-muted">Promo not found.</div>
  }

  const detail = detailForPromo(promo)
  const result = computeProfit(detail)
  const bd = result.breakdown!
  const breached = bd.netPct < promo.benchmark
  const irr = flatToIRR(detail.flatRate, (detail.minTenure + detail.maxTenure) / 2)

  const lastSubmit = [...promo.history].reverse().find((h) =>
    h.event === 'Submitted' || h.event === 'Resubmitted',
  )

  const land = (action: PresetAction) =>
    navigate({ name: 'approver', promoId, presetAction: action })

  return (
    /* Escape the AppShell padding, full-width grey browser-chrome feel */
    <div className="-mx-8 -my-7 bg-[#E8E4DC] pb-16 pt-8">

      {/* Browser-chrome hint */}
      <div className="mx-auto mb-3 flex max-w-2xl items-center gap-2 px-4">
        <div className="h-3 w-3 rounded-full bg-[#C7BFAE]" />
        <div className="h-3 w-3 rounded-full bg-[#C7BFAE]" />
        <div className="h-3 w-3 rounded-full bg-[#C7BFAE]" />
        <div className="ml-3 flex-1 rounded-md border border-[#C7BFAE] bg-white/70 px-3 py-1 text-xs text-[#8A7D6B]">
          mail.idfc.in/promo-approval/{promoId.toLowerCase()}
        </div>
      </div>

      {/* Email card */}
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)]">

        {/* Branded header */}
        <div className="bg-[#8B1A23] px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-widest text-white/70">IDFC First · TW Lending</div>
              <div className="mt-1 font-serif text-2xl text-white">Promo Approval Request</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <span className="font-serif text-lg font-bold text-white">F</span>
            </div>
          </div>
        </div>

        {/* Email body */}
        <div className="bg-white px-8 py-7">

          {/* Lede */}
          <p className="text-sm text-[#5A4F42]">
            <span className="font-medium text-[#1A1410]">{promo.maker}</span> submitted a new promo for your approval
            {lastSubmit ? ` on ${formatDate(lastSubmit.at)}` : ''}.
          </p>

          {/* Promo name + ref */}
          <div className="mt-5 border-l-4 border-[#8B1A23] pl-4">
            <div className="font-serif text-xl font-medium text-[#1A1410]">{promo.name}</div>
            <div className="mt-0.5 font-mono text-xs text-[#8A7D6B]">{promo.id}</div>
          </div>

          {/* Summary table */}
          <div className="mt-6">
            <table className="w-full">
              <tbody>
                <EmailRow label="Scheme">{promo.scheme}</EmailRow>
                <EmailRow label="Promo group">{promo.group} Scheme</EmailRow>
                <EmailRow label="Manufacturer · type">{promo.manufacturer} · {promo.dealerType}</EmailRow>
                <EmailRow label="Geography">
                  {promo.state}{promo.city ? ` · ${promo.city}` : ''}{' '}
                  · <span className="font-semibold">{promo.salesPointCount} sales points</span>
                  {promo.modelCount > 0 && ` · ${promo.modelCount} models`}
                </EmailRow>
                <EmailRow label="Validity">
                  {formatDate(detail.validFrom)} → {formatDate(detail.validTo)}
                </EmailRow>
                <EmailRow label="Loan range">
                  {formatINR(detail.minAmount)} – {formatINR(detail.maxAmount)}
                </EmailRow>
                <EmailRow label="Tenure">{detail.minTenure} – {detail.maxTenure} months</EmailRow>
                <EmailRow label="Flat rate">
                  {detail.flatRate}% ({irr.toFixed(1)}% IRR)
                </EmailRow>
                <EmailRow label="Dealer payout">
                  <span className={promo.highPayout ? 'text-[#B94500] font-semibold' : ''}>
                    {promo.dealerPayout}%
                    {promo.highPayout && ' — high payout flag'}
                  </span>
                </EmailRow>
              </tbody>
            </table>
          </div>

          {/* Profitability verdict */}
          <div className={`mt-5 rounded-xl border px-5 py-4 ${breached ? 'border-[#E3B7B0] bg-[#FDF4F3]' : 'border-[#B7D9C7] bg-[#F3FBF7]'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#8A7D6B]">Net margin</div>
                <div className={`mt-1 font-serif text-4xl leading-none ${breached ? 'text-[#8E2418]' : 'text-[#176038]'}`}>
                  {bd.netPct.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#8A7D6B]">Benchmark ({result.state})</div>
                <div className="mt-1 font-serif text-2xl text-[#1A1410]">{promo.benchmark}%</div>
              </div>
            </div>
            <div className={`mt-3 flex items-center gap-2 text-sm ${breached ? 'text-[#8E2418]' : 'text-[#176038]'}`}>
              {breached
                ? <><IconAlert width={15} height={15} className="shrink-0" /> Below benchmark — your approval is required.</>
                : <><IconCheck width={15} height={15} className="shrink-0" /> Clears the benchmark.</>
              }
            </div>
            {breached && promo.breachReason && (
              <div className="mt-2 rounded-lg bg-[#F5E8E7] px-3 py-2 text-sm italic text-[#6E2C24]">
                Maker's reason: "{promo.breachReason}"
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-7 border-t border-[#ECE7DA]" />

          {/* Action heading */}
          <p className="text-center text-sm font-medium text-[#5A4F42]">
            Choose your decision — you'll confirm on the portal.
          </p>

          {/* Three action buttons */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <button
              onClick={() => land('approve')}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-[#176038] bg-[#176038] px-4 py-3.5 text-white transition hover:bg-[#125230]"
            >
              <IconCheck width={20} height={20} />
              <span className="text-sm font-semibold">Approve</span>
            </button>
            <button
              onClick={() => land('reject')}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-[#8E2418] bg-white px-4 py-3.5 text-[#8E2418] transition hover:bg-[#FDF4F3]"
            >
              <IconAlert width={20} height={20} />
              <span className="text-sm font-semibold">Reject</span>
            </button>
            <button
              onClick={() => land('rework')}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-[#C7BFAE] bg-white px-4 py-3.5 text-[#5A4F42] transition hover:border-[#A89880] hover:bg-[#F8F5EE]"
            >
              <span className="text-lg leading-none">✏️</span>
              <span className="text-sm font-semibold">Send for Rework</span>
            </button>
          </div>

          {/* Footer note */}
          <p className="mt-5 text-center text-xs text-[#A89880]">
            You'll confirm on the portal — sign in if asked.
          </p>
        </div>

        {/* Email footer */}
        <div className="bg-[#F8F5EE] px-8 py-4 text-center">
          <p className="text-xs text-[#A89880]">
            IDFC First Bank · TW Lending · Promo Management System
          </p>
          <p className="mt-1 text-xs text-[#A89880]">
            Assigned approver: <span className="font-medium text-[#5A4F42]">{promo.approver ?? 'Regional Head'}</span>
          </p>
        </div>
      </div>

      {/* Back link */}
      <div className="mx-auto mt-6 max-w-2xl px-4">
        <button
          onClick={() => navigate({ name: 'inbox', tab: 'Pending Approval' })}
          className="text-sm font-medium text-[#6E5C4A] hover:underline"
        >
          ← Back to inbox
        </button>
      </div>
    </div>
  )
}
