import { useEffect, useState } from 'react'
import { useApp } from '../../store/AppContext'
import { Field, inputCls } from '../../components/ui/primitives'
import { MultiSelect } from '../../components/ui/SearchableSelect'
import { IconCheck } from '../../components/ui/icons'
import { SCHEMES } from '../../data/seed'
import type { PromoGroup, ChannelType } from '../../data/types'
import { nameTaken } from './validators'

const SCHEME_NAMES = SCHEMES.map(s => s.name)

// ── Main export ───────────────────────────────────────────────────────────────

export function StepPromoDetails() {
  const { draft, setDraft, promos, role } = useApp()
  const [checked, setChecked] = useState('')
  const [selectedSchemes, setSelectedSchemes] = useState<string[]>(
    draft.schemeNames.length > 0 ? draft.schemeNames : draft.schemeName ? [draft.schemeName] : [],
  )
  const [selectedGroup, setSelectedGroup] = useState<PromoGroup | null>(
    draft.group ?? null,
  )

  const frozen = !!draft.editingPromoId
  const isMultiScheme = !frozen && selectedSchemes.length > 1

  // Sync scheme selection to draft
  useEffect(() => {
    if (frozen) return
    setDraft(d => ({
      ...d,
      schemeName: selectedSchemes[0] ?? '',
      schemeNames: selectedSchemes,
    }))
  }, [selectedSchemes, frozen, setDraft])

  // Sync group selection to draft
  useEffect(() => {
    if (frozen) return
    setDraft(d => ({ ...d, group: selectedGroup }))
  }, [selectedGroup, frozen, setDraft])

  // Debounced name uniqueness check
  useEffect(() => {
    if (frozen) return
    const t = setTimeout(() => setChecked(draft.name), 400)
    return () => clearTimeout(t)
  }, [draft.name, frozen])

  const trimmed = draft.name.trim()
  const tooLong = trimmed.length > 100
  const taken = nameTaken(draft.name, promos, draft.id)
  const nameIsValid = !frozen && checked === draft.name && trimmed.length > 0 && !taken && !tooLong
  const nameError = frozen
    ? undefined
    : tooLong
      ? 'Promo name must be 100 characters or fewer.'
      : taken && checked === draft.name
        ? 'This name is already in use.'
        : undefined

  const isSalesTeam = role === 'maker'

  const toggleGroup = (g: PromoGroup) => {
    if (isSalesTeam && g === 'Manufacturer') return
    setSelectedGroup(prev => prev === g ? null : g)
  }

  return (
    <div className="max-w-xl space-y-7 animate-rise">
      {frozen && (
        <div className="flex items-center gap-2 rounded-card border border-border bg-cream px-4 py-3 text-sm text-muted">
          <IconCheck width={15} height={15} className="shrink-0 text-success" />
          Promo Details are locked for a Live promo. Proceed to Mapping to make changes.
        </div>
      )}

      {/* 1. Product — frozen as TW */}
      {!frozen && (
        <Field label="Product">
          <div className="rounded-input border border-border bg-cream/60 px-4 py-2.5 text-sm font-medium text-ink">
            TW
          </div>
        </Field>
      )}

      {/* 2. Channel — single-select segmented cards */}
      {!frozen && (
        <Field label="Channel" required>
          <div className="flex gap-3">
            {(['New', 'Used', 'Refinance', 'Direct'] as ChannelType[]).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft(d => ({ ...d, channel: c }))}
                className={`flex-1 rounded-card border-2 py-3 text-center text-sm font-medium transition ${
                  draft.channel === c
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border bg-surface text-ink hover:border-brand/30 hover:bg-cream/40'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* 2. Promo Name — always visible; shared across batch */}
      <Field
        label="Promo Name"
        required={!frozen}
        error={nameError}
        helper={!frozen && !trimmed ? 'Promo name is required.' : undefined}
      >
        <div className="relative">
          <input
            value={draft.name}
            readOnly={frozen}
            onChange={frozen ? undefined : e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Honda Shine Festive – Pune"
            className={`${inputCls} ${
              frozen
                ? 'cursor-default bg-cream/60 text-muted'
                : nameError
                  ? 'border-danger focus:border-danger focus:ring-danger/10'
                  : ''
            }`}
          />
          {nameIsValid && (
            <IconCheck
              className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
              width={18}
              height={18}
            />
          )}
        </div>
        {isMultiScheme && (
          <p className="mt-1 text-xs text-muted">
            Shared across all {selectedSchemes.length} promos in this batch.
          </p>
        )}
      </Field>

      {/* 3. Scheme — multi-select with chips */}
      <Field
        label="Scheme"
        required={!frozen}
        helper={frozen ? undefined : 'Select multiple schemes to create one promo per scheme with shared rates.'}
      >
        {frozen ? (
          <div className={`${inputCls} cursor-default bg-cream/60 text-muted`}>
            {draft.schemeName || '—'}
          </div>
        ) : (
          <MultiSelect
            options={SCHEME_NAMES}
            selected={selectedSchemes}
            onChange={setSelectedSchemes}
            placeholder="Select one or more schemes"
          />
        )}
      </Field>

      {/* 4. Promo Group — multi-select toggle cards */}
      {!frozen && (
        <Field label="Promo Group" required>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'Manufacturer' as PromoGroup, title: 'Manufacturer Scheme', subtitle: 'OEM-funded subvention', disabled: isSalesTeam, note: 'Only Product team can create Manufacturer schemes.' },
              { value: 'Competitive' as PromoGroup, title: 'Competitive Scheme', subtitle: 'Market-led, bank-funded', disabled: false, note: undefined },
            ]).map(opt => {
              const isSelected = selectedGroup === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => toggleGroup(opt.value)}
                  className={`relative rounded-card border-2 p-4 text-left transition ${
                    isSelected
                      ? 'border-brand bg-brand/5'
                      : opt.disabled
                        ? 'cursor-not-allowed border-border bg-cream/40 opacity-50'
                        : 'border-border bg-surface hover:border-brand/30 hover:bg-cream/30'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand">
                      <IconCheck width={11} height={11} className="text-white" />
                    </span>
                  )}
                  <div className="pr-6 font-medium text-ink">{opt.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{opt.subtitle}</div>
                  {opt.disabled && opt.note && (
                    <div className="mt-1.5 text-[10px] text-muted/70">{opt.note}</div>
                  )}
                </button>
              )
            })}
          </div>
        </Field>
      )}

      {/* Multi-scheme info banner */}
      {isMultiScheme && (
        <div className="rounded-card border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand">
          <span className="font-medium">{selectedSchemes.length} schemes selected.</span>{' '}
          One promo per scheme will be created with shared rates, charges, and mapping.
        </div>
      )}
    </div>
  )
}