import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { BaseMasterEntry, HistoryEntry, MasterKey, MastersState, PendingEdit, Promo, PromoDetail, ProductType, Role, View, WizardDraft } from '../data/types'
import {
  SEED_PROMOS,
  CURRENT_USER,
  APPROVAL_ROUTING,
  benchmarkForState,
  zoneForState,
  SALES_POINTS,
} from '../data/seed'
import { computeProfit, detailForPromo } from '../lib/profitability'
import { MASTERS_SEED } from '../data/mastersSeed'

const TODAY = '2026-06-25'

// Default validity window: 6 months from today (wizard doesn't capture dates in MVP).
function defaultExpiry(): string {
  const dt = new Date(TODAY + 'T00:00:00')
  dt.setMonth(dt.getMonth() + 6)
  return dt.toISOString().slice(0, 10)
}

export function emptyDraft(): WizardDraft {
  return {
    name: '',
    schemeName: '',
    group: null,
    product: null,
    dealerType: null,
    manufacturer: '',
    manufacturers: [],
    states: [],
    cities: [],
    salesPointIds: [],
    modelNames: [],
    minAmount: '',
    maxAmount: '',
    minTenure: null,
    maxTenure: null,
    flatRate: '',
    pfPct: null,
    pfAmount: null,
    pddPct: null,
    pddAmount: null,
    pffAmount: null,
    lmfAmount: null,
    dealerPayout: '',
    dmiOn: false,
    dmiAmount: '',
    advanceEmi: 0,
    breachReason: '',
    validFrom: TODAY,
    validTo: '',
    history: [],
  }
}

interface AppState {
  role: Role
  setRole: (r: Role) => void
  user: { name: string; role: string }
  promos: Promo[]
  // navigation
  view: View
  navigate: (v: View) => void
  // wizard
  draft: WizardDraft
  setDraft: React.Dispatch<React.SetStateAction<WizardDraft>>
  startNewPromo: () => void
  editDraft: (promoId: string) => void
  saveDraftAndExit: () => void
  submitPromo: () => Promo
  // checker actions
  approve: (promoId: string) => void
  reject: (promoId: string, reason: string) => void
  undoDecision: (promoId: string, snapshot: Promo) => void
  // maker action — pull a pending request back to draft
  revoke: (promoId: string) => void
  // checker action — send back to maker for corrections (not a formal rejection)
  rework: (promoId: string, reason: string) => void
  getPromo: (id: string) => Promo | undefined
  // Story 9 — edit a Live promo (Mapping + Rates & Charges)
  startEditPromo: (promoId: string) => void
  submitEdit: (promoId: string, form: WizardDraft) => void
  approveEdit: (promoId: string) => void
  rejectEdit: (promoId: string, reason: string) => void
  // Story 10 — bulk remap
  applyBulkRemaps: (rows: BulkRow[]) => void
  // Story 13 — admin deactivate / reactivate
  deactivate: (promoId: string, reason: string, note: string) => void
  reactivate: (promoId: string) => void
  // Story 14 — bulk deactivate / demap
  bulkDeactivate: (items: Array<{ promoId: string; reason: string }>) => void
  bulkDemap: (items: Array<{ promoId: string; salesPointsToRemove: string[]; modelsToRemove: string[] }>) => void
  // Story 15 — clone
  startClonePromo: (promoId: string) => void
  // Story 19 — query update (accepts an array of changes applied in sequence)
  queryUpdate: (params: { instantIds: string[]; checkerIds: string[]; changes: Array<{ field: string; how: string; value: string; values?: string[]; cityValues?: string[] }> }) => void
  // Story 20 — bulk create promos from CSV
  bulkCreatePromos: (rows: Array<{
    schemeName: string
    promoName: string
    group: string
    product?: string | null
    dealerType: 'SBO' | 'MBO'
    salesPointIds: string[]
    modelNames: string[]
    detail: PromoDetail
    breachReason: string
    batchId: string
  }>) => void
  // Story 21 — master data management
  masters: MastersState
  addMasterEntry: (key: MasterKey, entry: Record<string, unknown>) => void
  editMasterEntry: (key: MasterKey, id: string, patch: Record<string, unknown>) => void
  deactivateMasterEntry: (key: MasterKey, id: string) => void
  reactivateMasterEntry: (key: MasterKey, id: string) => void
}

// shape of one parsed CSV row after validation
export interface BulkRow {
  promoId: string
  state?: string
  city?: string
  manufacturer?: string
  model?: string
  salesPointId?: string
  newEndDate?: string
}

const AppContext = createContext<AppState | null>(null)

let idCounter = 2100

function draftToDetail(d: WizardDraft) {
  return {
    minAmount: parseFloat(d.minAmount) || 0,
    maxAmount: parseFloat(d.maxAmount) || 0,
    minTenure: d.minTenure ?? 0,
    maxTenure: d.maxTenure ?? 0,
    flatRate: parseFloat(d.flatRate) || 0,
    pfPct: d.pfPct,
    pfAmount: d.pfAmount,
    pddPct: d.pddPct,
    pddAmount: d.pddAmount,
    pffAmount: d.pffAmount ?? 0,
    lmfAmount: d.lmfAmount ?? 0,
    dealerPayout: parseFloat(d.dealerPayout) || 0,
    dmiOn: d.dmiOn,
    dmiAmount: parseFloat(d.dmiAmount) || 0,
    advanceEmi: d.advanceEmi ?? 0,
    states: d.states,
    cities: d.cities,
    salesPointIds: d.salesPointIds,
    modelNames: d.modelNames,
    validFrom: d.validFrom || TODAY,
    validTo: d.validTo || defaultExpiry(),
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('maker')
  const [promos, setPromos] = useState<Promo[]>(SEED_PROMOS)
  const [view, setView] = useState<View>({ name: 'dashboard' })
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft())
  const [masters, setMasters] = useState<MastersState>(MASTERS_SEED)

  const navigate = useCallback((v: View) => setView(v), [])

  const getPromo = useCallback((id: string) => promos.find((p) => p.id === id), [promos])

  const startNewPromo = useCallback(() => {
    setDraft(emptyDraft())
    setView({ name: 'wizard', step: 1 })
  }, [])

  const editDraft = useCallback(
    (promoId: string) => {
      const p = promos.find((x) => x.id === promoId)
      if (!p) return
      const det = p.detail
      setDraft({
        id: p.id,
        name: p.name,
        schemeName: p.scheme,
        group: p.group,
        product: p.product ?? null,
        dealerType: p.dealerType,
        manufacturer: p.manufacturer,
        manufacturers: p.manufacturer ? [p.manufacturer] : [],
        states: det?.states ?? [p.state],
        cities: det?.cities ?? (p.city ? [p.city] : []),
        salesPointIds: det?.salesPointIds ?? [],
        modelNames: det?.modelNames ?? [],
        minAmount: det ? String(det.minAmount) : '',
        maxAmount: det ? String(det.maxAmount) : '',
        minTenure: det?.minTenure ?? null,
        maxTenure: det?.maxTenure ?? null,
        flatRate: det ? String(det.flatRate) : '',
        pfPct: det?.pfPct ?? null,
        pfAmount: det?.pfAmount ?? null,
        pddPct: det?.pddPct ?? null,
        pddAmount: det?.pddAmount ?? null,
        pffAmount: det?.pffAmount ?? null,
        lmfAmount: det?.lmfAmount ?? null,
        dealerPayout: String(p.dealerPayout),
        dmiOn: det?.dmiOn ?? false,
        dmiAmount: det ? String(det.dmiAmount) : '',
        advanceEmi: det?.advanceEmi ?? 0,
        breachReason: p.breachReason ?? '',
        validFrom: det?.validFrom ?? TODAY,
        validTo: det?.validTo ?? p.expiry ?? '',
        history: p.history,
        resubmitting: p.status === 'Rejected',
        reworking: p.status === 'Rework',
      })
      setView({ name: 'wizard', step: 1 })
    },
    [promos],
  )

  // Build the Promo object that a draft represents (without committing status).
  const draftToPromo = useCallback(
    (d: WizardDraft, status: Promo['status']): Promo => {
      const detail = draftToDetail(d)
      const profit = computeProfit(detail)
      const state = d.states[0] ?? 'Maharashtra'
      const payout = parseFloat(d.dealerPayout) || 0
      const id = d.id ?? `PR-${++idCounter}`
      return {
        id,
        name: d.name || 'Untitled promo',
        scheme: d.schemeName,
        group: d.group ?? 'Competitive',
        status,
        margin: profit.ok ? +(profit.breakdown!.netPct.toFixed(1)) : null,
        benchmark: benchmarkForState(state),
        state,
        city: d.cities[0],
        zone: zoneForState(state),
        product: d.product ?? undefined,
        manufacturer: d.manufacturer,
        dealerType: d.dealerType ?? 'SBO',
        salesPointCount: d.salesPointIds.length,
        modelCount: d.modelNames.length,
        dealerPayout: payout,
        expiry: detail.validTo || null,
        createdAt: TODAY,
        maker: CURRENT_USER.maker.name,
        breachReason: profit.breached ? d.breachReason : undefined,
        highPayout: payout > 5,
        history: d.history,
        detail,
      }
    },
    [],
  )

  const upsert = useCallback((promo: Promo) => {
    setPromos((prev) => {
      const exists = prev.some((p) => p.id === promo.id)
      return exists ? prev.map((p) => (p.id === promo.id ? promo : p)) : [promo, ...prev]
    })
  }, [])

  const saveDraftAndExit = useCallback(() => {
    const promo = draftToPromo(draft, 'Draft')
    if (promo.history.length === 0)
      promo.history = [{ at: TODAY, event: 'Draft saved', by: CURRENT_USER.maker.name }]
    upsert(promo)
    setView({ name: 'dashboard' })
  }, [draft, draftToPromo, upsert])

  const submitPromo = useCallback((): Promo => {
    const wasRejected = draft.resubmitting || draft.reworking
    const status = wasRejected ? 'Resubmitted' : 'Pending'
    const promo = draftToPromo(draft, status)
    const state = promo.state
    const route = APPROVAL_ROUTING[state]
    promo.approver = promo.breachReason ? route?.breach : route?.normal
    const entry: HistoryEntry = {
      at: TODAY,
      event: wasRejected ? 'Resubmitted' : 'Submitted',
      by: CURRENT_USER.maker.name,
    }
    promo.history = [...draft.history, entry]
    upsert(promo)
    return promo
  }, [draft, draftToPromo, upsert])

  const approve = useCallback(
    (promoId: string) => {
      setPromos((prev) =>
        prev.map((p) =>
          p.id === promoId
            ? {
                ...p,
                status: 'Live',
                history: [
                  ...p.history,
                  { at: TODAY, event: 'Approved', by: p.approver ?? CURRENT_USER.checker.name },
                ],
              }
            : p,
        ),
      )
    },
    [],
  )

  const reject = useCallback(
    (promoId: string, reason: string) => {
      setPromos((prev) =>
        prev.map((p) =>
          p.id === promoId
            ? {
                ...p,
                status: 'Rejected',
                rejectionReason: reason,
                history: [
                  ...p.history,
                  { at: TODAY, event: 'Rejected', by: p.approver ?? CURRENT_USER.checker.name, reason },
                ],
              }
            : p,
        ),
      )
    },
    [],
  )

  const undoDecision = useCallback((promoId: string, snapshot: Promo) => {
    setPromos((prev) => prev.map((p) => (p.id === promoId ? snapshot : p)))
  }, [])

  const revoke = useCallback((promoId: string) => {
    setPromos((prev) =>
      prev.map((p) =>
        p.id === promoId
          ? {
              ...p,
              status: 'Draft',
              approver: undefined,
              history: [
                ...p.history,
                { at: TODAY, event: 'Revoked', by: CURRENT_USER.maker.name, reason: 'Pulled back from approval queue' },
              ],
            }
          : p,
      ),
    )
  }, [])

  const rework = useCallback((promoId: string, reason: string) => {
    setPromos((prev) =>
      prev.map((p) =>
        p.id === promoId
          ? {
              ...p,
              status: 'Rework',
              reworkReason: reason,
              history: [
                ...p.history,
                { at: TODAY, event: 'Sent for rework', by: p.approver ?? CURRENT_USER.checker.name, reason },
              ],
            }
          : p,
      ),
    )
  }, [])

  const startEditPromo = useCallback(
    (promoId: string) => {
      const p = promos.find((x) => x.id === promoId)
      if (!p) return
      const det = p.detail
      setDraft({
        id: p.id,
        editingPromoId: promoId,
        name: p.name,
        schemeName: p.scheme,
        group: p.group,
        product: p.product ?? null,
        dealerType: p.dealerType,
        manufacturer: p.manufacturer,
        manufacturers: p.manufacturer ? [p.manufacturer] : [],
        states: det?.states ?? [p.state],
        cities: det?.cities ?? (p.city ? [p.city] : []),
        salesPointIds: det?.salesPointIds ?? [],
        modelNames: det?.modelNames ?? [],
        minAmount: det ? String(det.minAmount) : '',
        maxAmount: det ? String(det.maxAmount) : '',
        minTenure: det?.minTenure ?? null,
        maxTenure: det?.maxTenure ?? null,
        flatRate: det ? String(det.flatRate) : '',
        pfPct: det?.pfPct ?? null,
        pfAmount: det?.pfAmount ?? null,
        pddPct: det?.pddPct ?? null,
        pddAmount: det?.pddAmount ?? null,
        pffAmount: det?.pffAmount ?? null,
        lmfAmount: det?.lmfAmount ?? null,
        dealerPayout: String(p.dealerPayout),
        dmiOn: det?.dmiOn ?? false,
        dmiAmount: det ? String(det.dmiAmount) : '',
        advanceEmi: det?.advanceEmi ?? 0,
        breachReason: p.breachReason ?? '',
        validFrom: det?.validFrom ?? TODAY,
        validTo: det?.validTo ?? p.expiry ?? '',
        history: p.history,
      })
      setView({ name: 'wizard', step: 1 })
    },
    [promos],
  )

  const submitEdit = useCallback((promoId: string, form: WizardDraft) => {
    setPromos((prev) =>
      prev.map((p) => {
        if (p.id !== promoId) return p
        const det = draftToDetail(form)
        const profit = computeProfit(det)
        const state = p.state
        const route = APPROVAL_ROUTING[state]
        const breached = profit.ok && profit.breakdown!.netPct < p.benchmark
        const approver = breached ? (route?.breach ?? 'Zonal Head') : (route?.normal ?? 'Regional Head')
        const payout = parseFloat(form.dealerPayout) || 0
        const pendingEdit: PendingEdit = {
          submittedAt: TODAY,
          submittedBy: CURRENT_USER.maker.name,
          approver,
          dealerType: form.dealerType,
          manufacturer: form.manufacturer,
          states: form.states,
          cities: form.cities,
          salesPointIds: form.salesPointIds,
          modelNames: form.modelNames,
          minAmount: form.minAmount,
          maxAmount: form.maxAmount,
          minTenure: form.minTenure,
          maxTenure: form.maxTenure,
          flatRate: form.flatRate,
          pfPct: form.pfPct,
          pfAmount: form.pfAmount,
          pddPct: form.pddPct,
          pddAmount: form.pddAmount,
          pffAmount: form.pffAmount,
          lmfAmount: form.lmfAmount,
          dealerPayout: form.dealerPayout,
          dmiOn: form.dmiOn,
          dmiAmount: form.dmiAmount,
          breachReason: form.breachReason,
          newMargin: profit.ok ? +(profit.breakdown!.netPct.toFixed(1)) : null,
          newHighPayout: payout > 5,
        }
        return {
          ...p,
          pendingEdit,
          editRejectedReason: undefined,
          history: [...p.history, { at: TODAY, event: 'Edit submitted', by: CURRENT_USER.maker.name }],
        }
      }),
    )
  }, [])

  const approveEdit = useCallback((promoId: string) => {
    setPromos((prev) =>
      prev.map((p) => {
        if (p.id !== promoId || !p.pendingEdit) return p
        const e = p.pendingEdit
        const existingDet = p.detail
        const newDetail: PromoDetail | undefined = existingDet
          ? {
              ...existingDet,
              states: e.states.length ? e.states : existingDet.states,
              cities: e.cities.length ? e.cities : existingDet.cities,
              salesPointIds: e.salesPointIds.length ? e.salesPointIds : existingDet.salesPointIds,
              modelNames: e.modelNames.length ? e.modelNames : existingDet.modelNames,
              minAmount: parseFloat(e.minAmount) || 0,
              maxAmount: parseFloat(e.maxAmount) || 0,
              minTenure: e.minTenure ?? 0,
              maxTenure: e.maxTenure ?? 0,
              flatRate: parseFloat(e.flatRate) || 0,
              pfPct: e.pfPct,
              pfAmount: e.pfAmount,
              pddPct: e.pddPct,
              pddAmount: e.pddAmount,
              pffAmount: e.pffAmount ?? 0,
              lmfAmount: e.lmfAmount ?? 0,
              dealerPayout: parseFloat(e.dealerPayout) || 0,
              dmiOn: e.dmiOn,
              dmiAmount: parseFloat(e.dmiAmount) || 0,
            }
          : undefined
        return {
          ...p,
          manufacturer: e.manufacturer || p.manufacturer,
          dealerType: e.dealerType ?? p.dealerType,
          state: e.states[0] ?? p.state,
          city: e.cities[0] ?? p.city,
          salesPointCount: e.salesPointIds.length || p.salesPointCount,
          modelCount: e.modelNames.length || p.modelCount,
          margin: e.newMargin,
          dealerPayout: parseFloat(e.dealerPayout) || p.dealerPayout,
          highPayout: e.newHighPayout,
          breachReason: e.breachReason || undefined,
          detail: newDetail,
          pendingEdit: undefined,
          editRejectedReason: undefined,
          history: [...p.history, { at: TODAY, event: 'Edit approved', by: e.approver }],
        }
      }),
    )
  }, [])

  const rejectEdit = useCallback((promoId: string, reason: string) => {
    setPromos((prev) =>
      prev.map((p) => {
        if (p.id !== promoId || !p.pendingEdit) return p
        return {
          ...p,
          pendingEdit: undefined,
          editRejectedReason: reason,
          history: [
            ...p.history,
            { at: TODAY, event: 'Edit rejected', by: p.pendingEdit.approver, reason },
          ],
        }
      }),
    )
  }, [])

  const applyBulkRemaps = useCallback((rows: BulkRow[]) => {
    setPromos((prev) =>
      prev.map((p) => {
        const row = rows.find((r) => r.promoId === p.id)
        if (!row) return p
        const patch: Partial<Promo> = {}
        if (row.state) patch.state = row.state
        if (row.city) patch.city = row.city
        if (row.manufacturer) patch.manufacturer = row.manufacturer
        if (row.newEndDate) patch.expiry = row.newEndDate
        // also patch detail if it exists
        let newDetail = p.detail
        if (newDetail) {
          if (row.state) newDetail = { ...newDetail, states: [row.state, ...newDetail.states.slice(1)] }
          if (row.city) newDetail = { ...newDetail, cities: [row.city] }
          if (row.newEndDate) newDetail = { ...newDetail, validTo: row.newEndDate }
        }
        return {
          ...p,
          ...patch,
          detail: newDetail,
          history: [
            ...p.history,
            { at: TODAY, event: 'Bulk re-mapped', by: CURRENT_USER.maker.name },
          ],
        }
      }),
    )
  }, [])

  const startClonePromo = useCallback(
    (promoId: string) => {
      const p = promos.find((x) => x.id === promoId)
      if (!p) return
      const det = p.detail
      setDraft({
        // No id — this will become a brand-new promo on submit
        clonedFromId: p.id,
        clonedFromName: p.name,
        name: '',               // must fill — shown highlighted in Review
        schemeName: p.scheme,
        group: p.group,
        product: p.product ?? null,
        dealerType: p.dealerType,
        manufacturer: p.manufacturer,
        manufacturers: p.manufacturer ? [p.manufacturer] : [],
        states: det?.states ?? [p.state],
        cities: det?.cities ?? (p.city ? [p.city] : []),
        salesPointIds: det?.salesPointIds ?? [],
        modelNames: det?.modelNames ?? [],
        minAmount: det ? String(det.minAmount) : '',
        maxAmount: det ? String(det.maxAmount) : '',
        minTenure: det?.minTenure ?? null,
        maxTenure: det?.maxTenure ?? null,
        flatRate: det ? String(det.flatRate) : '',
        pfPct: det?.pfPct ?? null,
        pfAmount: det?.pfAmount ?? null,
        pddPct: det?.pddPct ?? null,
        pddAmount: det?.pddAmount ?? null,
        pffAmount: det?.pffAmount ?? null,
        lmfAmount: det?.lmfAmount ?? null,
        dealerPayout: String(p.dealerPayout),
        dmiOn: det?.dmiOn ?? false,
        dmiAmount: det ? String(det.dmiAmount) : '',
        advanceEmi: det?.advanceEmi ?? 0,
        breachReason: '',       // fresh — original breach reason doesn't carry over
        validFrom: '',          // must fill — dates cleared to force user input
        validTo: '',
        history: [],            // new promo, fresh history
      })
      setView({ name: 'wizard', step: 5 })
    },
    [promos],
  )

  const deactivate = useCallback((promoId: string, reason: string, note: string) => {
    setPromos((prev) =>
      prev.map((p) =>
        p.id === promoId
          ? {
              ...p,
              status: 'Deactivated',
              history: [
                ...p.history,
                {
                  at: TODAY,
                  event: 'Deactivated',
                  by: CURRENT_USER.admin.name,
                  reason: note ? `${reason} — ${note}` : reason,
                },
              ],
            }
          : p,
      ),
    )
  }, [])

  const reactivate = useCallback((promoId: string) => {
    setPromos((prev) =>
      prev.map((p) =>
        p.id === promoId
          ? {
              ...p,
              status: 'Live',
              history: [
                ...p.history,
                { at: TODAY, event: 'Reactivated', by: CURRENT_USER.admin.name },
              ],
            }
          : p,
      ),
    )
  }, [])

  const bulkDeactivate = useCallback(
    (items: Array<{ promoId: string; reason: string }>) => {
      setPromos((prev) =>
        prev.map((p) => {
          const item = items.find((x) => x.promoId === p.id)
          if (!item) return p
          return {
            ...p,
            status: 'Deactivated',
            history: [
              ...p.history,
              { at: TODAY, event: 'Deactivated', by: CURRENT_USER.admin.name, reason: item.reason },
            ],
          }
        }),
      )
    },
    [],
  )

  const bulkDemap = useCallback(
    (items: Array<{ promoId: string; salesPointsToRemove: string[]; modelsToRemove: string[] }>) => {
      setPromos((prev) =>
        prev.map((p) => {
          const item = items.find((x) => x.promoId === p.id)
          if (!item || !p.detail) return p
          const newSPs = p.detail.salesPointIds.filter((id) => !item.salesPointsToRemove.includes(id))
          const newModels = p.detail.modelNames.filter((m) => !item.modelsToRemove.includes(m))
          return {
            ...p,
            salesPointCount: newSPs.length,
            modelCount: newModels.length,
            detail: { ...p.detail, salesPointIds: newSPs, modelNames: newModels },
            history: [
              ...p.history,
              {
                at: TODAY,
                event: 'Bulk de-mapped',
                by: CURRENT_USER.admin.name,
                reason: [
                  item.salesPointsToRemove.length > 0 ? `${item.salesPointsToRemove.length} sales point(s) removed` : '',
                  item.modelsToRemove.length > 0 ? `${item.modelsToRemove.length} model(s) removed` : '',
                ]
                  .filter(Boolean)
                  .join('; '),
              },
            ],
          }
        }),
      )
    },
    [],
  )

  const queryUpdate = useCallback(
    ({ instantIds, changes }: {
      instantIds: string[]
      checkerIds: string[]
      changes: Array<{ field: string; how: string; value: string; values?: string[]; cityValues?: string[] }>
    }) => {
      setPromos((prev) =>
        prev.map((p) => {
          if (!instantIds.includes(p.id)) return p

          // Apply each change in sequence to the same detail object
          let det: PromoDetail = { ...detailForPromo(p) }
          let newExpiry = p.expiry
          let newDealerPayout = p.dealerPayout
          let newManufacturer = p.manufacturer
          const reasonParts: string[] = []

          for (const ch of changes) {
            const numVal = parseFloat(ch.value)
            const applyNum = (cur: number) => {
              if (ch.how === 'increase by') return cur + numVal
              if (ch.how === 'decrease by') return Math.max(0, cur - numVal)
              return numVal
            }

            if (ch.field === 'flatRate') {
              det = { ...det, flatRate: applyNum(det.flatRate) }
            } else if (ch.field === 'dealerPayout') {
              const np = applyNum(det.dealerPayout)
              det = { ...det, dealerPayout: np }
              newDealerPayout = np
            } else if (ch.field === 'pfPct') {
              det = { ...det, pfPct: applyNum(det.pfPct ?? 2), pfAmount: null }
            } else if (ch.field === 'pddPct') {
              det = { ...det, pddPct: applyNum(det.pddPct ?? 1), pddAmount: null }
            } else if (ch.field === 'pffAmount') {
              det = { ...det, pffAmount: applyNum(det.pffAmount) }
            } else if (ch.field === 'lmfAmount') {
              det = { ...det, lmfAmount: applyNum(det.lmfAmount) }
            } else if (ch.field === 'minTenure') {
              det = { ...det, minTenure: Math.max(1, applyNum(det.minTenure)) }
            } else if (ch.field === 'maxTenure') {
              det = { ...det, maxTenure: Math.max(2, applyNum(det.maxTenure)) }
            } else if (ch.field === 'minAmount') {
              det = { ...det, minAmount: applyNum(det.minAmount) }
            } else if (ch.field === 'maxAmount') {
              det = { ...det, maxAmount: applyNum(det.maxAmount) }
            } else if (ch.field === 'validTo') {
              newExpiry = ch.value
              det = { ...det, validTo: ch.value }
            } else if (ch.field === 'state') {
              const vals = ch.values?.length ? ch.values : [ch.value].filter(Boolean)
              const cities = ch.cityValues ?? []
              if (ch.how === 'add') {
                det = { ...det, states: [...new Set([...det.states, ...vals])], cities: cities.length ? [...new Set([...det.cities, ...cities])] : det.cities }
              } else {
                det = { ...det, states: det.states.filter(s => !vals.includes(s)) }
              }
            } else if (ch.field === 'city') {
              const vals = ch.values?.length ? ch.values : [ch.value].filter(Boolean)
              if (ch.how === 'add') det = { ...det, cities: [...new Set([...det.cities, ...vals])] }
              else det = { ...det, cities: det.cities.filter(c => !vals.includes(c)) }
            } else if (ch.field === 'manufacturer') {
              const vals = ch.values?.length ? ch.values : [ch.value].filter(Boolean)
              if (ch.how === 'add' || ch.how === 'set to') newManufacturer = vals[0] ?? p.manufacturer
              else if (vals.includes(p.manufacturer)) newManufacturer = ''
            } else if (ch.field === 'model') {
              if (ch.how === 'add') det = { ...det, modelNames: [...new Set([...det.modelNames, ch.value])] }
              else det = { ...det, modelNames: det.modelNames.filter(m => m !== ch.value) }
            } else if (ch.field === 'salesPoint') {
              if (ch.how === 'add') det = { ...det, salesPointIds: [...new Set([...det.salesPointIds, ch.value])] }
              else det = { ...det, salesPointIds: det.salesPointIds.filter(s => s !== ch.value) }
            }

            const rv = ch.values?.length ? ch.values.join(', ') : ch.value
            reasonParts.push(`${ch.field} ${ch.how} ${rv}`)
          }

          const result = computeProfit(det)
          return {
            ...p,
            manufacturer: newManufacturer,
            detail: p.detail ? det : undefined,
            margin: result.ok ? result.breakdown!.netPct : p.margin,
            dealerPayout: newDealerPayout,
            expiry: newExpiry,
            history: [
              ...p.history,
              { at: TODAY, event: 'Query update applied', by: CURRENT_USER.admin.name, reason: reasonParts.join('; ') },
            ],
          }
        }),
      )
    },
    [],
  )

  const bulkCreatePromos = useCallback((
    rows: Array<{
      schemeName: string
      promoName: string
      group: string
      product?: string | null
      dealerType: 'SBO' | 'MBO'
      salesPointIds: string[]
      modelNames: string[]
      detail: PromoDetail
      breachReason: string
      batchId: string
    }>
  ) => {
    const created: Promo[] = rows.map(row => {
      const id = `PR-${++idCounter}`
      const state = SALES_POINTS.find(sp => row.salesPointIds.includes(sp.id))?.state ?? 'Maharashtra'
      const city = SALES_POINTS.find(sp => row.salesPointIds.includes(sp.id))?.city
      const mfrs = row.salesPointIds
        .flatMap(sid => SALES_POINTS.find(sp => sp.id === sid)?.manufacturers ?? [])
      const manufacturer = [...new Set(mfrs)][0] ?? ''
      const payout = row.detail.dealerPayout
      const profit = computeProfit(row.detail)
      const route = APPROVAL_ROUTING[state]
      const promo: Promo = {
        id,
        name: row.promoName,
        scheme: row.schemeName,
        group: row.group as 'Manufacturer' | 'Competitive',
        product: (row.product as ProductType) ?? undefined,
        status: 'Pending',
        margin: profit.ok ? +(profit.breakdown!.netPct.toFixed(1)) : null,
        benchmark: benchmarkForState(state),
        state,
        city,
        zone: zoneForState(state),
        manufacturer,
        dealerType: row.dealerType,
        salesPointCount: row.salesPointIds.length,
        modelCount: row.modelNames.length,
        dealerPayout: payout,
        expiry: row.detail.validTo || null,
        createdAt: TODAY,
        maker: CURRENT_USER.maker.name,
        approver: row.breachReason ? route?.breach : route?.normal,
        breachReason: row.breachReason || undefined,
        highPayout: payout > 5,
        history: [{
          at: TODAY,
          event: 'Submitted (bulk batch)',
          by: CURRENT_USER.maker.name,
          reason: row.batchId,
        }],
        detail: row.detail,
      }
      return promo
    })
    setPromos(prev => [...created, ...prev])
  }, [])

  const addMasterEntry = useCallback((key: MasterKey, entry: Record<string, unknown>) => {
    const id = `${key.toUpperCase().slice(0, 3)}-${Date.now()}`
    const now = new Date().toISOString()
    const newEntry = {
      ...entry,
      id,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, by: CURRENT_USER.admin.name, action: 'Created' }],
    } as BaseMasterEntry
    setMasters(prev => ({ ...prev, [key]: [newEntry, ...(prev[key] as BaseMasterEntry[])] }))
  }, [])

  const editMasterEntry = useCallback((key: MasterKey, id: string, patch: Record<string, unknown>) => {
    const now = new Date().toISOString()
    setMasters(prev => ({
      ...prev,
      [key]: (prev[key] as BaseMasterEntry[]).map(e =>
        e.id === id
          ? { ...e, ...patch, updatedAt: now, history: [...e.history, { at: now, by: CURRENT_USER.admin.name, action: 'Edited', before: e, after: patch }] }
          : e
      ),
    }))
  }, [])

  const deactivateMasterEntry = useCallback((key: MasterKey, id: string) => {
    const now = new Date().toISOString()
    setMasters(prev => ({
      ...prev,
      [key]: (prev[key] as BaseMasterEntry[]).map(e =>
        e.id === id
          ? { ...e, status: 'Inactive', updatedAt: now, history: [...e.history, { at: now, by: CURRENT_USER.admin.name, action: 'Deactivated' }] }
          : e
      ),
    }))
  }, [])

  const reactivateMasterEntry = useCallback((key: MasterKey, id: string) => {
    const now = new Date().toISOString()
    setMasters(prev => ({
      ...prev,
      [key]: (prev[key] as BaseMasterEntry[]).map(e =>
        e.id === id
          ? { ...e, status: 'Active', updatedAt: now, history: [...e.history, { at: now, by: CURRENT_USER.admin.name, action: 'Reactivated' }] }
          : e
      ),
    }))
  }, [])

  const value = useMemo<AppState>(
    () => ({
      role,
      setRole,
      user: role === 'admin' ? CURRENT_USER.admin : role === 'maker' ? CURRENT_USER.maker : CURRENT_USER.checker,
      promos,
      view,
      navigate,
      draft,
      setDraft,
      startNewPromo,
      editDraft,
      saveDraftAndExit,
      submitPromo,
      approve,
      reject,
      undoDecision,
      revoke,
      rework,
      getPromo,
      startEditPromo,
      submitEdit,
      approveEdit,
      rejectEdit,
      applyBulkRemaps,
      deactivate,
      reactivate,
      bulkDeactivate,
      bulkDemap,
      startClonePromo,
      queryUpdate,
      bulkCreatePromos,
      masters,
      addMasterEntry,
      editMasterEntry,
      deactivateMasterEntry,
      reactivateMasterEntry,
    }),
    [role, promos, view, navigate, draft, startNewPromo, editDraft, saveDraftAndExit, submitPromo, approve, reject, undoDecision, revoke, rework, getPromo, startEditPromo, submitEdit, approveEdit, rejectEdit, applyBulkRemaps, deactivate, reactivate, bulkDeactivate, bulkDemap, startClonePromo, queryUpdate, bulkCreatePromos, masters, addMasterEntry, editMasterEntry, deactivateMasterEntry, reactivateMasterEntry],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
