import type { PromoStatus } from '../../data/types'

const STYLES: Record<PromoStatus, string> = {
  Live: 'bg-success-bg text-success',
  Approved: 'bg-success-bg text-success',
  Pending: 'bg-warning-bg text-warning',
  Resubmitted: 'bg-warning-bg text-warning',
  Rejected: 'bg-danger-bg text-danger',
  Rework: 'bg-[#FFF3E0] text-[#B94500]',
  Draft: 'bg-[#ECE7DA] text-muted',
  Expired: 'bg-[#ECE7DA] text-muted',
  Deactivated: 'bg-[#ECE7DA] text-muted',
}

export function StatusPill({ status }: { status: PromoStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
      >
        {status}
      </span>
      {status === 'Resubmitted' && (
        <span className="rounded-full bg-[#ECE7DA] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          2nd look
        </span>
      )}
      {status === 'Rework' && (
        <span className="rounded-full bg-[#FFF3E0] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#B94500]">
          action needed
        </span>
      )}
    </span>
  )
}
