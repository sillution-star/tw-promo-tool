import type { Promo, WizardDraft } from '../../data/types'
import { SCHEMES } from '../../data/seed'
import { computeProfit } from '../../lib/profitability'

export function schemeFor(name: string) {
  return SCHEMES.find((s) => s.name === name)
}

export function nameTaken(name: string, promos: Promo[], selfId?: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n) return false
  return promos.some((p) => p.id !== selfId && p.name.trim().toLowerCase() === n)
}

export function step1Valid(d: WizardDraft, promos: Promo[]): boolean {
  const n = d.name.trim()
  return (
    !!d.product &&
    n.length > 0 &&
    n.length <= 100 &&
    !nameTaken(d.name, promos, d.id) &&
    !!d.schemeName &&
    !!d.group
  )
}

export function step2Valid(d: WizardDraft): boolean {
  const datesOk = !!d.validFrom && !!d.validTo && d.validTo > d.validFrom
  return (
    !!d.manufacturer &&
    d.states.length > 0 &&
    d.salesPointIds.length > 0 &&
    d.modelNames.length > 0 &&
    datesOk
  )
}

export function ratesErrors(d: WizardDraft): Record<string, string> {
  const e: Record<string, string> = {}
  const scheme = schemeFor(d.schemeName)
  const min = parseFloat(d.minAmount)
  const max = parseFloat(d.maxAmount)
  if (d.minAmount && scheme && min < scheme.minAmount)
    e.minAmount = `Min for this scheme is ₹${scheme.minAmount.toLocaleString('en-IN')}.`
  if (d.maxAmount && scheme && max > scheme.maxAmount)
    e.maxAmount = `Max for this scheme is ₹${scheme.maxAmount.toLocaleString('en-IN')}.`
  if (d.minAmount && d.maxAmount && min >= max) e.maxAmount = 'Max must be greater than Min.'
  if (d.minTenure != null && d.maxTenure != null && d.minTenure >= d.maxTenure)
    e.maxTenure = 'Max tenure must be greater than Min.'
  const payout = parseFloat(d.dealerPayout)
  if (d.dealerPayout && payout > 10) e.dealerPayout = 'Payout cannot exceed 10%.'
  return e
}

export function step3Valid(d: WizardDraft): boolean {
  if (Object.keys(ratesErrors(d)).length > 0) return false
  const filled =
    !!d.minAmount &&
    !!d.maxAmount &&
    d.minTenure != null &&
    d.maxTenure != null &&
    !!d.flatRate &&
    (d.pfPct != null || d.pfAmount != null) &&
    (d.pddPct != null || d.pddAmount != null) &&
    d.pffAmount != null &&
    d.lmfAmount != null &&
    !!d.dealerPayout
  return filled
}

export function step4Valid(d: WizardDraft): boolean {
  const detail = {
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
    validFrom: d.validFrom,
    validTo: d.validTo,
  }
  const profit = computeProfit(detail)
  if (!profit.ok) return false
  if (profit.breached && !d.breachReason.trim()) return false
  return true
}
