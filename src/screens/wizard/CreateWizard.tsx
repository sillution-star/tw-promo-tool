import { useState } from 'react'
import { useApp } from '../../store/AppContext'
import { Button } from '../../components/ui/primitives'
import { IconCheck, IconAlert } from '../../components/ui/icons'
import { formatDate } from '../../lib/format'
import { step1Valid, step2Valid, step3Valid, step4Valid } from './validators'
import { StepPromoDetails } from './StepPromoDetails'
import { StepMapping } from './StepMapping'
import { StepRates } from './StepRates'
import { StepProfitability } from './StepProfitability'
import { StepReview } from './StepReview'

const STEPS = ['Promo Details', 'Mapping', 'Rates & Charges', 'Profitability', 'Review']

function StepIndicator({ current, editMode }: { current: number; editMode?: boolean }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        const locked = editMode && n === 1
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                locked
                  ? 'bg-[#ECE7DA] text-muted'
                  : done
                    ? 'bg-success text-white'
                    : active
                      ? 'bg-brand text-white'
                      : 'bg-[#ECE7DA] text-muted'
              }`}
            >
              {locked ? '🔒' : done ? <IconCheck width={13} height={13} /> : n}
            </span>
            <span className={`text-sm ${active ? 'font-medium text-ink' : 'text-muted'}`}>
              {label}{locked && <span className="ml-1 text-[10px]">(locked)</span>}
            </span>
            {n < STEPS.length && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}

export function CreateWizard({ step }: { step: number }) {
  const { draft, promos, navigate, saveDraftAndExit } = useApp()
  const [bulkMode, setBulkMode] = useState(false)

  const isEditMode = !!draft.editingPromoId
  const isCloneMode = !!draft.clonedFromId
  const goTo = (s: number) => navigate({ name: 'wizard', step: s })

  const valid =
    step === 1
      ? (isEditMode || isCloneMode) || step1Valid(draft, promos)  // locked in edit, free in clone
      : step === 2
        // in edit mode: only require manufacturer + states (sales points optional — empty = keep existing)
        ? isEditMode ? (!!draft.manufacturer && draft.states.length > 0) : step2Valid(draft)
        : step === 3
          ? step3Valid(draft)
          : step === 4
            ? step4Valid(draft)
            : true

  const nextLabel: Record<number, string> = {
    1: 'Next: Mapping',
    2: 'Next: Rates & Charges',
    3: 'Next: Profitability',
    4: 'Next: Review',
  }

  const lastRejection = [...draft.history].reverse().find((h) => h.event === 'Rejected')
  const lastRework = [...draft.history].reverse().find((h) => h.event === 'Sent for rework')

  let title = 'Create Promo'
  if (isEditMode) title = 'Edit Promo'
  else if (isCloneMode) title = 'Clone Promo'
  else if (draft.resubmitting || draft.reworking) title = 'Edit & Resubmit'

  return (
    <div className="space-y-8 pb-24">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-ink">{title}</h1>
          <span className="text-sm text-muted">Step {step} of 5</span>
        </div>
        <StepIndicator current={step} editMode={isEditMode} />
      </div>

      {!isEditMode && !isCloneMode && draft.resubmitting && lastRejection && (
        <div className="rounded-card border border-[#E3B7B0] bg-danger-bg px-4 py-3">
          <div className="flex items-start gap-3">
            <IconAlert width={18} height={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="text-sm text-danger">
              <p className="font-medium">Rejected on {formatDate(lastRejection.at)} by {lastRejection.by}</p>
              <p className="mt-0.5">"{lastRejection.reason}" — edit the relevant section and resubmit.</p>
            </div>
          </div>
        </div>
      )}

      {!isEditMode && !isCloneMode && draft.reworking && lastRework && (
        <div className="rounded-card border border-[#F5CAAD] bg-[#FFF3E0] px-4 py-3">
          <div className="flex items-start gap-3">
            <IconAlert width={18} height={18} className="mt-0.5 shrink-0 text-[#B94500]" />
            <div className="text-sm text-[#8B3700]">
              <p className="font-medium">Sent back for rework on {formatDate(lastRework.at)} by {lastRework.by}</p>
              <p className="mt-0.5">"{lastRework.reason}" — address the feedback and resubmit.</p>
            </div>
          </div>
        </div>
      )}

      {step === 1 && <StepPromoDetails onBulkModeChange={setBulkMode} />}
      {step === 2 && <StepMapping />}
      {step === 3 && <StepRates />}
      {step === 4 && <StepProfitability />}
      {step === 5 && <StepReview onEdit={goTo} />}

      {/* Footer (steps 1–4; hidden in bulk mode; Review carries its own actions) */}
      {step < 5 && !bulkMode && (
        <div className="fixed bottom-0 left-[248px] right-0 z-10 flex items-center justify-between border-t border-border bg-cream/90 px-8 py-4 backdrop-blur">
          <div>
            {step > 1 && (
              <Button variant="secondary" onClick={() => goTo(step - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isEditMode && !isCloneMode && step > 1 && (
              <Button variant="ghost" onClick={saveDraftAndExit}>
                Save &amp; exit
              </Button>
            )}
            <Button disabled={!valid} onClick={() => goTo(step + 1)}>
              {nextLabel[step]}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
