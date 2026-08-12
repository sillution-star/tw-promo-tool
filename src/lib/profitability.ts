import {
  COF,
  OPEX,
  DEFAULT_OPEX,
  NCL,
  DEFAULT_NCL,
  benchmarkForState,
  SCHEMES,
} from '../data/seed'
import type { Promo, PromoDetail } from '../data/types'

// States deliberately missing a master, to demonstrate the "can't calculate"
// path (Screen 5). Empty by default; add a state here to simulate.
export const MISSING_NCL_STATES: string[] = []

export function opexForState(state: string): number {
  return OPEX[state] ?? DEFAULT_OPEX
}
export function nclForState(state: string): number {
  return NCL[state] ?? DEFAULT_NCL
}

// Flat annual rate → reducing-balance (IRR) annual rate.
// Standard approximation: IRR ≈ flat × 2N / (N + 1), N = number of EMIs.
export function flatToIRR(flatRate: number, tenureMonths: number): number {
  if (!tenureMonths) return flatRate
  return flatRate * (2 * tenureMonths) / (tenureMonths + 1)
}

export interface Breakdown {
  loan: number
  tenure: number
  interest: number
  pf: number
  pdd: number
  pff: number
  lmf: number
  income: number
  cof: number
  opex: number
  ncl: number
  payout: number
  dmi: number
  expense: number
  netRs: number
  netPct: number
  irr: number
}

export interface ProfitResult {
  ok: boolean
  missingMaster?: string // e.g. "NCL"
  state: string
  benchmark: number
  breakdown?: Breakdown
  breached?: boolean
}

function num(v: string | number): number {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isFinite(n) ? n : 0
}

// Compute live profitability from a promo's detail + the governing state.
export function computeProfit(detail: PromoDetail): ProfitResult {
  const state = detail.states[0] ?? 'Maharashtra'
  const benchmark = benchmarkForState(state)

  if (MISSING_NCL_STATES.includes(state)) {
    return { ok: false, missingMaster: 'NCL', state, benchmark }
  }

  const loan = (num(detail.minAmount) + num(detail.maxAmount)) / 2
  const tenure = (num(detail.minTenure) + num(detail.maxTenure)) / 2
  const flat = num(detail.flatRate)

  const interest = loan * (flat / 100) * (tenure / 12)
  const pf = detail.pfPct != null ? loan * (detail.pfPct / 100) : num(detail.pfAmount ?? 0)
  const pdd = detail.pddPct != null ? loan * (detail.pddPct / 100) : num(detail.pddAmount ?? 0)
  const pff = num(detail.pffAmount)
  const lmf = num(detail.lmfAmount)
  const income = interest + pf + pdd + pff + lmf

  const cof = COF * loan * (tenure / 12)
  const opex = opexForState(state)
  const ncl = (nclForState(state) / 100) * loan
  const payout = (num(detail.dealerPayout) / 100) * loan
  const dmi = detail.dmiOn ? num(detail.dmiAmount) : 0
  const expense = cof + opex + ncl + payout + dmi

  const netRs = income - expense
  const netPct = loan ? (netRs / loan) * 100 : 0
  const irr = flatToIRR(flat, tenure)

  return {
    ok: true,
    state,
    benchmark,
    breached: netPct < benchmark,
    breakdown: {
      loan, tenure, interest, pf, pdd, pff, lmf, income,
      cof, opex, ncl, payout, dmi, expense, netRs, netPct, irr,
    },
  }
}

// For seed promos lacking a detail, synthesize a plausible one from stored
// margin so the approver/review screens always have a breakdown to show.
export function detailForPromo(promo: Promo): PromoDetail {
  if (promo.detail) return promo.detail
  const scheme = SCHEMES.find((s) => s.name === promo.scheme)
  const minAmount = scheme?.minAmount ?? 30000
  const maxAmount = scheme?.maxAmount ?? 150000
  return {
    minAmount,
    maxAmount,
    minTenure: 12,
    maxTenure: 36,
    flatRate: 12,
    pfPct: 2,
    pfAmount: null,
    pddPct: 1,
    pddAmount: null,
    pffAmount: 500,
    lmfAmount: 300,
    dealerPayout: promo.dealerPayout,
    dmiOn: false,
    dmiAmount: 0,
    advanceEmi: 0,
    states: [promo.state],
    cities: promo.city ? [promo.city] : [],
    salesPointIds: [],
    modelNames: [],
    validFrom: promo.createdAt,
    validTo: promo.expiry ?? '2026-12-31',
  }
}
