import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../store/AppContext'
import { StatusPill } from '../components/ui/StatusPill'
import { Button } from '../components/ui/primitives'
import { IconAlert, IconCheck } from '../components/ui/icons'
import { formatDate } from '../lib/format'
import type { Promo, Role } from '../data/types'

// ── Tab bar ──────────────────────────────────────────────────────────────────
function Tabs({ tabs, active, onChange, counts }: {
  tabs: string[]
  active: string
  onChange: (t: string) => void
  counts: Record<string, number>
}) {
  return (
    <div className="flex gap-6 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`relative -mb-px flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition ${
            active === t ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {t}
          {counts[t] > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${active === t ? 'bg-brand text-white' : 'bg-[#ECE7DA] text-muted'}`}>
              {counts[t]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface/60 px-5 py-12 text-center text-sm text-muted">
      {text}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10

/** Returns the sequence of page numbers (and 'ellipsis' gaps) to render. */
function getPageRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  if (current > 3) pages.push('ellipsis')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('ellipsis')
  pages.push(total)
  return pages
}

function Pagination({ page, totalPages, total, onChange }: {
  page: number
  totalPages: number
  total: number
  onChange: (p: number) => void
}) {
  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  const range = getPageRange(page, totalPages)

  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <span className="text-xs text-muted">Showing {start}–{end} of {total}</span>
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm text-muted transition hover:border-brand/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          ←
        </button>

        {/* Page numbers */}
        {range.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-muted">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition ${
                p === page
                  ? 'bg-brand text-white'
                  : 'border border-border text-ink hover:border-brand/40 hover:bg-cream'
              }`}
            >
              {p}
            </button>
          ),
        )}

        {/* Next */}
        <button
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm text-muted transition hover:border-brand/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  )
}

/**
 * Wraps a list of promos with automatic pagination.
 * Because it's rendered inside a conditional (tab === '...'), it unmounts on
 * tab change — so the page resets to 1 naturally without any extra useEffect.
 */
function TabContent({
  items,
  emptyText,
  renderItem,
}: {
  items: Promo[]
  emptyText: string
  renderItem: (item: Promo) => ReactNode
}) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(items.length / PAGE_SIZE) || 1
  const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (items.length === 0) return <EmptyRow text={emptyText} />

  return (
    <div className="space-y-2.5">
      {slice.map(renderItem)}
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={items.length} onChange={setPage} />
      )}
    </div>
  )
}

// ── Maker Inbox ───────────────────────────────────────────────────────────────
function MakerInbox({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const { promos, editDraft, navigate, user } = useApp()
  const openDetail = (id: string) => navigate({ name: 'approver', promoId: id })

  const mine     = promos.filter((p) => p.maker === user.name)
  const pending  = mine.filter((p) => p.status === 'Pending' || p.status === 'Resubmitted')
  const approved = mine.filter((p) => p.status === 'Approved' || p.status === 'Live')
  const rejected = mine.filter((p) => p.status === 'Rejected')
  const rework   = mine.filter((p) => p.status === 'Rework')

  const counts = {
    Pending: pending.length,
    Approved: approved.length,
    Rejected: rejected.length,
    Rework: rework.length,
  }

  return (
    <div className="space-y-5">
      <Tabs
        tabs={['Pending', 'Approved', 'Rejected', 'Rework']}
        active={tab}
        onChange={onTab}
        counts={counts}
      />

      {tab === 'Pending' && (
        <TabContent
          items={pending}
          emptyText="Nothing awaiting a decision right now."
          renderItem={(p) => (
            <button
              key={p.id}
              onClick={() => openDetail(p.id)}
              className="flex w-full items-center justify-between rounded-card border border-border bg-surface px-5 py-4 text-left shadow-card transition hover:border-[#D8D0BF]"
            >
              <div>
                <div className="font-medium text-ink">{p.name}</div>
                <div className="mt-0.5 text-xs text-muted">{p.scheme} · submitted {formatDate(p.createdAt)}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={p.status} />
                <span className="text-xs text-muted">Awaiting {p.approver}</span>
              </div>
            </button>
          )}
        />
      )}

      {tab === 'Approved' && (
        <TabContent
          items={approved}
          emptyText="No approved promos yet."
          renderItem={(p) => {
            const appr = [...p.history].reverse().find((h) => h.event === 'Approved')
            return (
              <div key={p.id} className="rounded-card border border-[#B7D9C7] bg-[#F3FBF7] px-5 py-4 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <IconCheck width={15} height={15} className="shrink-0 text-success" />
                      <span className="font-medium text-ink">Your promo was approved</span>
                    </div>
                    <div className="mt-1.5 font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted">Promo ID {p.id}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {p.scheme}{appr ? ` · approved ${formatDate(appr.at)} by ${appr.by}` : ''}
                    </div>
                  </div>
                  <button onClick={() => openDetail(p.id)} className="shrink-0 text-sm font-medium text-brand hover:underline">
                    View →
                  </button>
                </div>
              </div>
            )
          }}
        />
      )}

      {tab === 'Rejected' && (
        <TabContent
          items={rejected}
          emptyText="No rejected promos."
          renderItem={(p) => {
            const rej = [...p.history].reverse().find((h) => h.event === 'Rejected')
            return (
              <div key={p.id} className="rounded-card border border-danger-bg bg-surface px-5 py-4 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <IconAlert width={15} height={15} className="shrink-0 text-danger" />
                      <span className="font-medium text-ink">Your promo was rejected</span>
                    </div>
                    <div className="mt-1.5 font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {p.scheme}{rej ? ` · rejected ${formatDate(rej.at)}` : ''}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => editDraft(p.id)}>Edit &amp; Resubmit</Button>
                </div>
                {p.rejectionReason && (
                  <div className="mt-3 rounded-input bg-danger-bg px-3 py-2 text-sm text-danger">
                    <span className="font-medium">Reason: </span>{p.rejectionReason}
                  </div>
                )}
              </div>
            )
          }}
        />
      )}

      {tab === 'Rework' && (
        <TabContent
          items={rework}
          emptyText="Nothing sent back for rework."
          renderItem={(p) => {
            const rw = [...p.history].reverse().find((h) => h.event === 'Sent for rework')
            return (
              <div key={p.id} className="rounded-card border border-[#F5CAAD] bg-surface px-5 py-4 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">✏️</span>
                      <span className="font-medium text-ink">Your promo was sent back for rework</span>
                    </div>
                    <div className="mt-1.5 font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {p.scheme}{rw ? ` · sent back ${formatDate(rw.at)} by ${rw.by}` : ''}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => editDraft(p.id)}>Edit &amp; Resubmit</Button>
                </div>
                {rw?.reason && (
                  <div className="mt-3 rounded-input bg-[#FFF3E0] px-3 py-2 text-sm text-[#8B3700]">
                    <span className="font-medium">Checker's comments: </span>{rw.reason}
                  </div>
                )}
              </div>
            )
          }}
        />
      )}
    </div>
  )
}

// ── Checker Inbox ─────────────────────────────────────────────────────────────
function CheckerInbox({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const { promos, navigate } = useApp()

  // Include Live promos with a pending edit in the queue
  const queue      = promos.filter((p) => p.status === 'Pending' || p.status === 'Resubmitted' || p.pendingEdit !== undefined)
  // Exclude Live promos with a pending edit from the approved tab (they're in queue)
  const approved   = promos.filter((p) => (p.status === 'Approved' || p.status === 'Live') && !p.pendingEdit)
  const rejected   = promos.filter((p) => p.status === 'Rejected')
  const sentRework = promos.filter((p) => p.status === 'Rework')

  const counts = {
    'Pending Approval': queue.length,
    Approved: approved.length,
    Rejected: rejected.length,
    'Sent for Rework': sentRework.length,
  }

  const open = (p: Promo) => navigate({ name: 'approver', promoId: p.id })
  const openEmail = (p: Promo) => navigate({ name: 'email-preview', promoId: p.id })

  return (
    <div className="space-y-5">
      <Tabs
        tabs={['Pending Approval', 'Approved', 'Rejected', 'Sent for Rework']}
        active={tab}
        onChange={onTab}
        counts={counts}
      />

      {tab === 'Pending Approval' && (
        <TabContent
          items={queue}
          emptyText="Your queue is clear."
          renderItem={(p) => {
            const isEdit = p.pendingEdit !== undefined
            const below = isEdit
              ? (p.pendingEdit!.newMargin != null && p.pendingEdit!.newMargin < p.benchmark)
              : (p.margin != null && p.margin < p.benchmark)
            const margin = isEdit ? p.pendingEdit!.newMargin : p.margin
            const submittedDate = isEdit ? p.pendingEdit!.submittedAt : p.createdAt
            return (
              <div
                key={p.id}
                className="flex w-full items-center justify-between rounded-card border border-border bg-surface px-5 py-4 text-left shadow-card"
              >
                <button
                  onClick={() => open(p)}
                  className="flex flex-1 items-center justify-between gap-4 transition hover:opacity-80"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{p.name}</span>
                      {isEdit && (
                        <span className="rounded-full bg-[#FFF3E0] px-2 py-0.5 text-[10px] font-medium text-[#B94500]">
                          Edit
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      by {p.maker} · {isEdit ? 'edit submitted' : 'submitted'} {formatDate(submittedDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {below && (
                      <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-medium text-danger">
                        below benchmark
                      </span>
                    )}
                    <span className="font-mono text-sm tabular text-ink">{margin?.toFixed(1)}%</span>
                    <StatusPill status={p.status} />
                  </div>
                </button>
                {/* Email preview button — only for new promo approvals (not edits) */}
                {!isEdit && (
                  <button
                    onClick={() => openEmail(p)}
                    className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand/40 hover:text-ink"
                    title="View approval email"
                  >
                    📧 Email
                  </button>
                )}
              </div>
            )
          }}
        />
      )}

      {tab === 'Approved' && (
        <TabContent
          items={approved}
          emptyText="Nothing approved yet."
          renderItem={(p) => {
            const appr = [...p.history].reverse().find((h) => h.event === 'Approved')
            return (
              <button
                key={p.id}
                onClick={() => open(p)}
                className="flex w-full items-center justify-between rounded-card border border-border bg-surface px-5 py-4 text-left shadow-card transition hover:border-[#D8D0BF]"
              >
                <div>
                  <div className="font-medium text-ink">{p.name}</div>
                  <div className="mt-0.5 text-xs text-muted">{p.scheme}{appr ? ` · ${formatDate(appr.at)}` : ''}</div>
                </div>
                <StatusPill status={p.status} />
              </button>
            )
          }}
        />
      )}

      {tab === 'Rejected' && (
        <TabContent
          items={rejected}
          emptyText="You haven't rejected anything."
          renderItem={(p) => {
            const rej = [...p.history].reverse().find((h) => h.event === 'Rejected')
            return (
              <div key={p.id} className="rounded-card border border-border bg-surface px-5 py-4 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {p.scheme}{rej ? ` · rejected ${formatDate(rej.at)}` : ''}
                    </div>
                  </div>
                  <button onClick={() => open(p)} className="text-sm font-medium text-brand hover:underline">View</button>
                </div>
                {rej?.reason && (
                  <div className="mt-3 rounded-input bg-danger-bg px-3 py-2 text-sm text-danger">{rej.reason}</div>
                )}
              </div>
            )
          }}
        />
      )}

      {tab === 'Sent for Rework' && (
        <TabContent
          items={sentRework}
          emptyText="No promos sent back for rework."
          renderItem={(p) => {
            const rw = [...p.history].reverse().find((h) => h.event === 'Sent for rework')
            return (
              <div key={p.id} className="rounded-card border border-[#F5CAAD] bg-surface px-5 py-4 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      by {p.maker} · {p.scheme}{rw ? ` · sent back ${formatDate(rw.at)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={p.status} />
                    <button onClick={() => open(p)} className="text-sm font-medium text-brand hover:underline">View</button>
                  </div>
                </div>
                {rw?.reason && (
                  <div className="mt-3 rounded-input bg-[#FFF3E0] px-3 py-2 text-sm text-[#8B3700]">
                    Your instructions: "{rw.reason}"
                  </div>
                )}
              </div>
            )
          }}
        />
      )}
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────
export function Inbox({ role, tab }: { role: Role; tab: string }) {
  const [localTab, setLocalTab] = useState(tab)
  // Sync when external navigation changes the tab (e.g. "Send for Rework" redirects here)
  useEffect(() => { setLocalTab(tab) }, [tab])

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl text-ink">Inbox</h1>
      {role === 'maker' ? (
        <MakerInbox tab={localTab} onTab={setLocalTab} />
      ) : (
        <CheckerInbox tab={localTab} onTab={setLocalTab} />
      )}
    </div>
  )
}
