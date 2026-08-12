import type { MastersState, Promo } from '../../data/types'
import { daysUntil } from '../../lib/format'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportContext {
  promos: Promo[]
  masters: MastersState
}

export type FilterKey =
  | 'dateFrom' | 'dateTo'
  | 'state' | 'scheme' | 'manufacturer' | 'promoGroup' | 'status'
  | 'entityFilter' | 'actionFilter'
  | 'operationType' | 'outcome' | 'batchId'

export interface ReportFilters {
  dateFrom: string
  dateTo: string
  state: string
  scheme: string
  manufacturer: string
  promoGroup: string
  status: string
  entityFilter: string
  actionFilter: string
  operationType: string
  outcome: string
  batchId: string
}

export const EMPTY_FILTERS: ReportFilters = {
  dateFrom: '', dateTo: '', state: '', scheme: '',
  manufacturer: '', promoGroup: '', status: '',
  entityFilter: '', actionFilter: '',
  operationType: '', outcome: '', batchId: '',
}

export const OPERATION_TYPES = ['Bulk Map', 'Extend', 'Demap', 'Deactivate', 'Charge Update', 'Query Update']
export const OUTCOME_OPTIONS  = ['Applied', 'Sent to checker', 'Failed', 'Skipped']

export type ColType = 'text' | 'number' | 'currency' | 'pct' | 'date' | 'count' | 'status' | 'sla'

export interface ColDef {
  key: string
  label: string
  type?: ColType
  defaultHidden?: boolean
  group?: string
}

export type ReportRow = Record<string, string | number | null>

export interface ReportConfig {
  id: string
  name: string
  question: string
  theme: 'Promos' | 'Profitability' | 'Approval' | 'Governance'
  mvp: 1 | 2 | 3
  filterKeys: FilterKey[]
  columns: ColDef[]
  defaultSortKey: string
  defaultSortDir: 'asc' | 'desc'
  infoNote?: string
  groupByOptions?: Array<{ value: string; label: string }>
  defaultGroupBy?: string
  getData: (ctx: ReportContext, filters: ReportFilters) => ReportRow[]
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

// ── 1. Promo Master ───────────────────────────────────────────────────────────

const G = {
  ID:   'Identity',
  DT:   'Status & Dates',
  GEO:  'Geography & Brand',
  LR:   'Loan & Rate',
  CHG:  'Charges',
  PAY:  'Payouts',
  PROF: 'Profitability',
  PPL:  'People',
} as const

const promoMaster: ReportConfig = {
  id: 'promo-master',
  name: 'Promo Master',
  question: 'What promos exist, with all their details?',
  theme: 'Promos',
  mvp: 1,
  filterKeys: ['dateFrom', 'dateTo', 'state', 'scheme', 'manufacturer', 'promoGroup', 'status'],
  defaultSortKey: 'createdAt',
  defaultSortDir: 'desc',
  columns: [
    // Identity
    { key: 'id',            label: 'Promo ID',         type: 'text',     group: G.ID   },
    { key: 'name',          label: 'Promo Name',       type: 'text',     group: G.ID   },
    { key: 'product',       label: 'Product',          type: 'text',     group: G.ID   },
    { key: 'promoGroup',    label: 'Promo Group',      type: 'text',     group: G.ID   },
    { key: 'scheme',        label: 'Scheme',           type: 'text',     group: G.ID   },
    // Status & Dates
    { key: 'status',        label: 'Status',           type: 'status',   group: G.DT   },
    { key: 'validFrom',     label: 'Start Date',       type: 'date',     group: G.DT   },
    { key: 'validTo',       label: 'End Date',         type: 'date',     group: G.DT   },
    { key: 'daysRemaining', label: 'Days Remaining',   type: 'count',    group: G.DT   },
    { key: 'createdAt',     label: 'Created',          type: 'date',     group: G.DT,  defaultHidden: true },
    { key: 'submittedDate', label: 'Submitted',        type: 'date',     group: G.DT,  defaultHidden: true },
    { key: 'approvedDate',  label: 'Approved',         type: 'date',     group: G.DT,  defaultHidden: true },
    // Geography & Brand
    { key: 'dealerType',    label: 'Dealer Type',      type: 'text',     group: G.GEO  },
    { key: 'manufacturer',  label: 'Manufacturer',     type: 'text',     group: G.GEO  },
    { key: 'state',         label: 'State',            type: 'text',     group: G.GEO  },
    { key: 'cities',        label: 'Cities',           type: 'text',     group: G.GEO, defaultHidden: true },
    { key: 'salesPoints',   label: 'Sales Points',     type: 'count',    group: G.GEO  },
    { key: 'modelCount',    label: 'Models',           type: 'count',    group: G.GEO  },
    // Loan & Rate
    { key: 'loanMin',       label: 'Loan Min',         type: 'currency', group: G.LR   },
    { key: 'loanMax',       label: 'Loan Max',         type: 'currency', group: G.LR,  defaultHidden: true },
    { key: 'tenureMin',     label: 'Tenure Min (m)',   type: 'count',    group: G.LR   },
    { key: 'tenureMax',     label: 'Tenure Max (m)',   type: 'count',    group: G.LR,  defaultHidden: true },
    { key: 'flatRate',      label: 'Flat Rate %',      type: 'pct',      group: G.LR   },
    // Charges
    { key: 'pfPct',         label: 'PF %',             type: 'pct',      group: G.CHG, defaultHidden: true },
    { key: 'pfAmount',      label: 'PF Amount',        type: 'currency', group: G.CHG, defaultHidden: true },
    { key: 'pddPct',        label: 'PDD %',            type: 'pct',      group: G.CHG, defaultHidden: true },
    { key: 'pddAmount',     label: 'PDD Amount',       type: 'currency', group: G.CHG, defaultHidden: true },
    { key: 'pffAmount',     label: 'PFF',              type: 'currency', group: G.CHG, defaultHidden: true },
    { key: 'lmfAmount',     label: 'LMF',              type: 'currency', group: G.CHG, defaultHidden: true },
    { key: 'advanceEmi',    label: 'Advance EMI',      type: 'count',    group: G.CHG, defaultHidden: true },
    // Payouts
    { key: 'dealerPayout',  label: 'Dealer Payout %',  type: 'pct',      group: G.PAY  },
    { key: 'dmiEnabled',    label: 'DM Incentive On',  type: 'text',     group: G.PAY, defaultHidden: true },
    { key: 'dmiAmount',     label: 'DM Incentive Amt', type: 'currency', group: G.PAY, defaultHidden: true },
    // Profitability
    { key: 'margin',        label: 'Net Margin %',     type: 'pct',      group: G.PROF },
    { key: 'benchmark',     label: 'Benchmark %',      type: 'pct',      group: G.PROF, defaultHidden: true },
    { key: 'breachFlag',    label: 'Pass / Breach',    type: 'text',     group: G.PROF },
    { key: 'breachReason',  label: 'Breach Reason',    type: 'text',     group: G.PROF, defaultHidden: true },
    // People
    { key: 'maker',         label: 'Maker',            type: 'text',     group: G.PPL  },
    { key: 'approver',      label: 'Approver',         type: 'text',     group: G.PPL, defaultHidden: true },
  ],
  getData({ promos }, f) {
    let rows = promos
    if (f.dateFrom)     rows = rows.filter(p => p.createdAt >= f.dateFrom)
    if (f.dateTo)       rows = rows.filter(p => p.createdAt <= f.dateTo + 'T23:59:59')
    if (f.state)        rows = rows.filter(p => p.state === f.state)
    if (f.scheme)       rows = rows.filter(p => p.scheme === f.scheme)
    if (f.manufacturer) rows = rows.filter(p => p.manufacturer === f.manufacturer)
    if (f.promoGroup)   rows = rows.filter(p => p.group === f.promoGroup)
    if (f.status)       rows = rows.filter(p => p.status === f.status)
    return rows.map(p => {
      const expiry = p.detail?.validTo ?? p.expiry
      const daysRemaining = daysUntil(expiry)
      const submitted = [...p.history].reverse().find(h => h.event === 'Submitted' || h.event === 'Resubmitted')
      const approved  = p.history.find(h => h.event === 'Approved')
      return {
        id: p.id, name: p.name, product: p.product ?? '—',
        promoGroup: p.group, scheme: p.scheme,
        status: p.status,
        validFrom: p.detail?.validFrom ?? null,
        validTo: expiry ?? null,
        daysRemaining,
        createdAt: p.createdAt,
        submittedDate: submitted?.at?.slice(0, 10) ?? null,
        approvedDate: approved?.at?.slice(0, 10) ?? null,
        dealerType: p.dealerType,
        manufacturer: p.manufacturer,
        state: p.state,
        cities: p.detail?.cities?.join(', ') ?? p.city ?? '—',
        salesPoints: p.salesPointCount,
        modelCount: p.modelCount,
        loanMin: p.detail?.minAmount ?? null,
        loanMax: p.detail?.maxAmount ?? null,
        tenureMin: p.detail?.minTenure ?? null,
        tenureMax: p.detail?.maxTenure ?? null,
        flatRate: p.detail?.flatRate ?? null,
        pfPct: p.detail?.pfPct ?? null,
        pfAmount: p.detail?.pfAmount ?? null,
        pddPct: p.detail?.pddPct ?? null,
        pddAmount: p.detail?.pddAmount ?? null,
        pffAmount: p.detail?.pffAmount ?? null,
        lmfAmount: p.detail?.lmfAmount ?? null,
        advanceEmi: p.detail?.advanceEmi ?? null,
        dealerPayout: p.dealerPayout,
        dmiEnabled: p.detail?.dmiOn ? 'Yes' : 'No',
        dmiAmount: p.detail?.dmiAmount ?? null,
        margin: p.margin,
        benchmark: p.benchmark,
        breachFlag: p.margin !== null ? (p.margin < p.benchmark ? 'Breach' : 'Pass') : '—',
        breachReason: p.breachReason ?? '—',
        maker: p.maker,
        approver: p.approver ?? '—',
      }
    })
  },
}

// ── 2. Expiring Promos ────────────────────────────────────────────────────────

const expiringPromos: ReportConfig = {
  id: 'expiring',
  name: 'Expiring Promos',
  question: "What's about to lapse that needs action?",
  theme: 'Promos',
  mvp: 1,
  filterKeys: ['state', 'scheme', 'manufacturer'],
  defaultSortKey: 'daysRemaining',
  defaultSortDir: 'asc',
  columns: [
    { key: 'id',            label: 'Promo ID',        type: 'text' },
    { key: 'name',          label: 'Name',            type: 'text' },
    { key: 'scheme',        label: 'Scheme',          type: 'text' },
    { key: 'state',         label: 'State',           type: 'text' },
    { key: 'manufacturer',  label: 'Manufacturer',    type: 'text' },
    { key: 'dealerPayout',  label: 'Dealer Payout %', type: 'pct' },
    { key: 'endDate',       label: 'End Date',        type: 'date' },
    { key: 'daysRemaining', label: 'Days Remaining',  type: 'count' },
  ],
  getData({ promos }, f) {
    let rows = promos.filter(p => {
      if (p.status !== 'Live') return false
      const d = daysUntil(p.expiry)
      return d !== null && d >= 0 && d <= 90
    })
    if (f.state)        rows = rows.filter(p => p.state === f.state)
    if (f.scheme)       rows = rows.filter(p => p.scheme === f.scheme)
    if (f.manufacturer) rows = rows.filter(p => p.manufacturer === f.manufacturer)
    return rows.map(p => ({
      id: p.id, name: p.name, scheme: p.scheme, state: p.state,
      manufacturer: p.manufacturer, dealerPayout: p.dealerPayout,
      endDate: p.expiry, daysRemaining: daysUntil(p.expiry),
    }))
  },
}

// ── 3. Sales-Point Coverage ───────────────────────────────────────────────────

const salesPointCoverage: ReportConfig = {
  id: 'sales-point-coverage',
  name: 'Sales-Point Coverage',
  question: 'Which dealers and models does a promo or scheme cover?',
  theme: 'Promos',
  mvp: 1,
  filterKeys: ['state', 'scheme', 'manufacturer', 'status'],
  defaultSortKey: 'name',
  defaultSortDir: 'asc',
  columns: [
    { key: 'id',           label: 'Promo ID',      type: 'text' },
    { key: 'name',         label: 'Promo Name',    type: 'text' },
    { key: 'scheme',       label: 'Scheme',        type: 'text' },
    { key: 'group',        label: 'Group',         type: 'text' },
    { key: 'state',        label: 'State',         type: 'text' },
    { key: 'city',         label: 'City',          type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer',  type: 'text' },
    { key: 'dealerType',   label: 'Dealer Type',   type: 'text' },
    { key: 'salesPoints',  label: 'Sales Points',  type: 'count' },
    { key: 'models',       label: 'Models',        type: 'count' },
    { key: 'status',       label: 'Status',        type: 'status' },
  ],
  getData({ promos }, f) {
    let rows = promos.filter(p => p.status === 'Live' || p.status === 'Approved')
    if (f.state)        rows = rows.filter(p => p.state === f.state)
    if (f.scheme)       rows = rows.filter(p => p.scheme === f.scheme)
    if (f.manufacturer) rows = rows.filter(p => p.manufacturer === f.manufacturer)
    if (f.status)       rows = rows.filter(p => p.status === f.status)
    return rows.map(p => ({
      id: p.id, name: p.name, scheme: p.scheme, group: p.group,
      state: p.state, city: p.city ?? '—', manufacturer: p.manufacturer,
      dealerType: p.dealerType, salesPoints: p.salesPointCount,
      models: p.modelCount, status: p.status,
    }))
  },
}

// ── 4. Bulk Activity (static seed — not tracked at runtime in MVP) ────────────

const GB = { BATCH: 'Batch', PROMO: 'Promo', CHANGE: 'Change', OUT: 'Outcome' } as const

type BulkRow = ReportRow & {
  batchId: string; batchDate: string; operationType: string; runBy: string; totalInBatch: number
  promoId: string; promoName: string; scheme: string; state: string; manufacturer: string
  fieldChanged: string; oldValue: string; newValue: string; direction: string
  outcome: string; checker: string; decision: string; decisionDate: string | null; reason: string
}

const BULK_SEED: BulkRow[] = [
  // BLK-0006 — Bulk Map — Added sales points to 2 promos (applied instantly)
  { batchId:'BLK-0006', batchDate:'2026-06-20', operationType:'Bulk Map',      runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2043', promoName:'Bajaj Pulsar Maharashtra',  scheme:'Banking Proof Program',        state:'Maharashtra', manufacturer:'Bajaj',  fieldChanged:'Sales Points',   oldValue:'3',                    newValue:'5',               direction:'added',    outcome:'Applied',          checker:'—',               decision:'—',      decisionDate:null,         reason:'—' },
  { batchId:'BLK-0006', batchDate:'2026-06-20', operationType:'Bulk Map',      runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2048', promoName:'Honda Activa Gujarat',      scheme:'Credit Card Super Saver',      state:'Gujarat',     manufacturer:'Honda',  fieldChanged:'Sales Points',   oldValue:'4',                    newValue:'6',               direction:'added',    outcome:'Applied',          checker:'—',               decision:'—',      decisionDate:null,         reason:'—' },
  // BLK-0005 — Charge Update — Flat Rate + Dealer Payout decrease on 2 promos (sent to checker, approved)
  { batchId:'BLK-0005', batchDate:'2026-06-15', operationType:'Charge Update', runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2051', promoName:'KTM Duke Bengaluru',        scheme:'Banking Proof Program',        state:'Karnataka',   manufacturer:'KTM',    fieldChanged:'Flat Rate %',    oldValue:'8.5%',                 newValue:'8.0%',            direction:'decrease', outcome:'Sent to checker',  checker:'Anita Deshpande', decision:'Approved', decisionDate:'2026-06-16', reason:'—' },
  { batchId:'BLK-0005', batchDate:'2026-06-15', operationType:'Charge Update', runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2051', promoName:'KTM Duke Bengaluru',        scheme:'Banking Proof Program',        state:'Karnataka',   manufacturer:'KTM',    fieldChanged:'Dealer Payout %',oldValue:'3.5%',                 newValue:'3.2%',            direction:'decrease', outcome:'Sent to checker',  checker:'Anita Deshpande', decision:'Approved', decisionDate:'2026-06-16', reason:'—' },
  { batchId:'BLK-0005', batchDate:'2026-06-15', operationType:'Charge Update', runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2052', promoName:'Hero HF Deluxe Rural',      scheme:'Banking Proof Program Rural',  state:'Tamil Nadu',  manufacturer:'Hero',   fieldChanged:'Flat Rate %',    oldValue:'8.75%',                newValue:'8.25%',           direction:'decrease', outcome:'Sent to checker',  checker:'Anita Deshpande', decision:'Approved', decisionDate:'2026-06-16', reason:'—' },
  { batchId:'BLK-0005', batchDate:'2026-06-15', operationType:'Charge Update', runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2052', promoName:'Hero HF Deluxe Rural',      scheme:'Banking Proof Program Rural',  state:'Tamil Nadu',  manufacturer:'Hero',   fieldChanged:'Dealer Payout %',oldValue:'3.2%',                 newValue:'3.0%',            direction:'decrease', outcome:'Sent to checker',  checker:'Anita Deshpande', decision:'Approved', decisionDate:'2026-06-16', reason:'—' },
  // BLK-0004 — Extend — Extended validity on 2 promos (applied instantly)
  { batchId:'BLK-0004', batchDate:'2026-06-10', operationType:'Extend',        runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2044', promoName:'Hero Splendor TN Wave',     scheme:'Banking Proof Program',        state:'Tamil Nadu',  manufacturer:'Hero',   fieldChanged:'Valid To',        oldValue:'30 Jun 2026',          newValue:'31 Aug 2026',     direction:'extended', outcome:'Applied',          checker:'—',               decision:'—',      decisionDate:null,         reason:'—' },
  { batchId:'BLK-0004', batchDate:'2026-06-10', operationType:'Extend',        runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2045', promoName:'Suzuki Access Mumbai',      scheme:'Credit Card Super Saver',      state:'Maharashtra', manufacturer:'Suzuki', fieldChanged:'Valid To',        oldValue:'31 Jul 2026',          newValue:'30 Sep 2026',     direction:'extended', outcome:'Applied',          checker:'—',               decision:'—',      decisionDate:null,         reason:'—' },
  // BLK-0003 — Demap — Removed models from 2 promos
  { batchId:'BLK-0003', batchDate:'2026-05-28', operationType:'Demap',         runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2043', promoName:'Bajaj Pulsar Maharashtra',  scheme:'Banking Proof Program',        state:'Maharashtra', manufacturer:'Bajaj',  fieldChanged:'Models',          oldValue:'Pulsar NS200, Pulsar 220F', newValue:'Pulsar 220F',   direction:'removed',  outcome:'Applied',          checker:'—',               decision:'—',      decisionDate:null,         reason:'End of model year' },
  { batchId:'BLK-0003', batchDate:'2026-05-28', operationType:'Demap',         runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2048', promoName:'Honda Activa Gujarat',      scheme:'Credit Card Super Saver',      state:'Gujarat',     manufacturer:'Honda',  fieldChanged:'Models',          oldValue:'Activa 6G, CB Shine',      newValue:'Activa 6G',     direction:'removed',  outcome:'Applied',          checker:'—',               decision:'—',      decisionDate:null,         reason:'End of model year' },
  // BLK-0002 — Query Update — Admin direct edits on 1 promo
  { batchId:'BLK-0002', batchDate:'2026-05-15', operationType:'Query Update',  runBy:'Vikram Bose', totalInBatch:1, promoId:'PR-2050', promoName:'Bajaj Chetak EV PAN-India', scheme:'Credit Card EV',               state:'Maharashtra', manufacturer:'Bajaj',  fieldChanged:'Dealer Payout %', oldValue:'3.0%',                 newValue:'3.5%',            direction:'increase', outcome:'Applied',          checker:'—',               decision:'—',      decisionDate:null,         reason:'State policy update' },
  { batchId:'BLK-0002', batchDate:'2026-05-15', operationType:'Query Update',  runBy:'Vikram Bose', totalInBatch:1, promoId:'PR-2050', promoName:'Bajaj Chetak EV PAN-India', scheme:'Credit Card EV',               state:'Maharashtra', manufacturer:'Bajaj',  fieldChanged:'PF %',            oldValue:'1.5%',                 newValue:'1.8%',            direction:'increase', outcome:'Applied',          checker:'—',               decision:'—',      decisionDate:null,         reason:'State policy update' },
  // BLK-0001 — Charge Update — Rate decrease REJECTED
  { batchId:'BLK-0001', batchDate:'2026-05-05', operationType:'Charge Update', runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2058', promoName:'Hero Xtreme Telangana Push', scheme:'Banking Proof Program',       state:'Telangana',   manufacturer:'Hero',   fieldChanged:'Flat Rate %',    oldValue:'9.0%',                 newValue:'8.5%',            direction:'decrease', outcome:'Sent to checker',  checker:'Priya Sharma',    decision:'Rejected', decisionDate:'2026-05-06', reason:'Rate below floor limit' },
  { batchId:'BLK-0001', batchDate:'2026-05-05', operationType:'Charge Update', runBy:'Vikram Bose', totalInBatch:2, promoId:'PR-2060', promoName:'Suzuki Burgman Maharashtra', scheme:'Credit Card Super Saver',     state:'Maharashtra', manufacturer:'Suzuki', fieldChanged:'Flat Rate %',    oldValue:'9.0%',                 newValue:'8.5%',            direction:'decrease', outcome:'Sent to checker',  checker:'Priya Sharma',    decision:'Rejected', decisionDate:'2026-05-06', reason:'Rate below floor limit' },
]

const DECISION_CHIP: Record<string, string> = {
  Approved: 'bg-[#EAF6EE] text-[#1A7A3E]',
  Rejected: 'bg-[#FDF2F3] text-[#BE2134]',
}
void DECISION_CHIP // used in ReportView for colType handling

const bulkActivity: ReportConfig = {
  id: 'bulk-activity',
  name: 'Bulk Activity',
  question: 'What did a bulk upload or query change, and did it work?',
  theme: 'Governance',
  mvp: 1,
  filterKeys: ['dateFrom', 'dateTo', 'operationType', 'outcome', 'batchId'],
  defaultSortKey: 'batchDate',
  defaultSortDir: 'desc',
  groupByOptions: [
    { value: 'batchId',  label: 'By Batch' },
    { value: 'promoId',  label: 'By Promo' },
  ],
  defaultGroupBy: 'batchId',
  columns: [
    { key: 'batchId',       label: 'Batch ID',        type: 'text',     group: GB.BATCH },
    { key: 'batchDate',     label: 'Date',            type: 'date',     group: GB.BATCH },
    { key: 'operationType', label: 'Operation',       type: 'text',     group: GB.BATCH },
    { key: 'runBy',         label: 'Run By',          type: 'text',     group: GB.BATCH },
    { key: 'totalInBatch',  label: 'Promos in Batch', type: 'count',    group: GB.BATCH, defaultHidden: true },
    { key: 'promoId',       label: 'Promo ID',        type: 'text',     group: GB.PROMO },
    { key: 'promoName',     label: 'Promo Name',      type: 'text',     group: GB.PROMO },
    { key: 'scheme',        label: 'Scheme',          type: 'text',     group: GB.PROMO, defaultHidden: true },
    { key: 'state',         label: 'State',           type: 'text',     group: GB.PROMO },
    { key: 'manufacturer',  label: 'Manufacturer',    type: 'text',     group: GB.PROMO, defaultHidden: true },
    { key: 'fieldChanged',  label: 'Field Changed',   type: 'text',     group: GB.CHANGE },
    { key: 'oldValue',      label: 'Old Value',       type: 'text',     group: GB.CHANGE },
    { key: 'newValue',      label: 'New Value',       type: 'text',     group: GB.CHANGE },
    { key: 'direction',     label: 'Direction',       type: 'text',     group: GB.CHANGE, defaultHidden: true },
    { key: 'outcome',       label: 'Outcome',         type: 'text',     group: GB.OUT   },
    { key: 'checker',       label: 'Checker',         type: 'text',     group: GB.OUT   },
    { key: 'decision',      label: 'Decision',        type: 'text',     group: GB.OUT   },
    { key: 'decisionDate',  label: 'Decision Date',   type: 'date',     group: GB.OUT,  defaultHidden: true },
    { key: 'reason',        label: 'Reason',          type: 'text',     group: GB.OUT   },
  ],
  getData(_ctx, f) {
    let rows: ReportRow[] = [...BULK_SEED]
    if (f.dateFrom)       rows = rows.filter(r => String(r.batchDate) >= f.dateFrom)
    if (f.dateTo)         rows = rows.filter(r => String(r.batchDate) <= f.dateTo)
    if (f.operationType)  rows = rows.filter(r => r.operationType === f.operationType)
    if (f.outcome)        rows = rows.filter(r => r.outcome === f.outcome)
    if (f.batchId)        rows = rows.filter(r => String(r.batchId).toLowerCase().includes(f.batchId.toLowerCase()))
    return rows
  },
}

// ── 5. Deactivation / Demap ───────────────────────────────────────────────────

const deactivationDemap: ReportConfig = {
  id: 'deactivation-demap',
  name: 'Deactivation / Demap',
  question: 'What was withdrawn, when, and why?',
  theme: 'Governance',
  mvp: 1,
  filterKeys: ['dateFrom', 'dateTo', 'state', 'manufacturer'],
  defaultSortKey: 'when',
  defaultSortDir: 'desc',
  columns: [
    { key: 'promoId',      label: 'Promo ID',     type: 'text' },
    { key: 'promoName',    label: 'Promo Name',   type: 'text' },
    { key: 'state',        label: 'State',        type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
    { key: 'action',       label: 'Action',       type: 'text' },
    { key: 'reason',       label: 'Reason',       type: 'text' },
    { key: 'by',           label: 'By',           type: 'text' },
    { key: 'when',         label: 'Date',         type: 'date' },
  ],
  getData({ promos }, f) {
    const rows: ReportRow[] = []
    for (const p of promos) {
      for (const h of p.history) {
        const ev = h.event.toLowerCase()
        if (!ev.includes('deactivat') && !ev.includes('demap')) continue
        const dateStr = h.at.slice(0, 10)
        if (f.dateFrom && dateStr < f.dateFrom) continue
        if (f.dateTo   && dateStr > f.dateTo)   continue
        if (f.state        && p.state !== f.state)               continue
        if (f.manufacturer && p.manufacturer !== f.manufacturer) continue
        rows.push({
          promoId: p.id, promoName: p.name, state: p.state,
          manufacturer: p.manufacturer, action: h.event,
          reason: h.reason ?? '—', by: h.by, when: dateStr,
        })
      }
    }
    return rows
  },
}

// ── 6. Profitability ──────────────────────────────────────────────────────────

const profitability: ReportConfig = {
  id: 'profitability',
  name: 'Profitability',
  question: 'Which promos make money, which don\'t, and by how much?',
  theme: 'Profitability',
  mvp: 2,
  filterKeys: ['state', 'scheme', 'manufacturer', 'promoGroup', 'status'],
  defaultSortKey: 'margin',
  defaultSortDir: 'asc',
  columns: [
    { key: 'id',           label: 'Promo ID',        type: 'text' },
    { key: 'name',         label: 'Name',            type: 'text' },
    { key: 'scheme',       label: 'Scheme',          type: 'text' },
    { key: 'state',        label: 'State',           type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer',    type: 'text' },
    { key: 'margin',       label: 'Net Margin %',    type: 'pct' },
    { key: 'benchmark',    label: 'Benchmark %',     type: 'pct' },
    { key: 'gap',          label: 'Gap %',           type: 'pct' },
    { key: 'breach',       label: 'Breach',          type: 'text' },
    { key: 'flatRate',     label: 'Rate %',          type: 'pct' },
    { key: 'dealerPayout', label: 'Dealer Payout %', type: 'pct' },
    { key: 'status',       label: 'Status',          type: 'status' },
  ],
  getData({ promos }, f) {
    let rows = promos.filter(p => p.margin !== null)
    if (f.state)        rows = rows.filter(p => p.state === f.state)
    if (f.scheme)       rows = rows.filter(p => p.scheme === f.scheme)
    if (f.manufacturer) rows = rows.filter(p => p.manufacturer === f.manufacturer)
    if (f.promoGroup)   rows = rows.filter(p => p.group === f.promoGroup)
    if (f.status)       rows = rows.filter(p => p.status === f.status)
    return rows.map(p => {
      const gap = p.margin !== null ? +(p.margin - p.benchmark).toFixed(2) : null
      return {
        id: p.id, name: p.name, scheme: p.scheme, state: p.state,
        manufacturer: p.manufacturer, margin: p.margin,
        benchmark: p.benchmark, gap,
        breach: gap !== null && gap < 0 ? 'Yes' : 'No',
        flatRate: p.detail?.flatRate ?? null,
        dealerPayout: p.dealerPayout, status: p.status,
      }
    })
  },
}

// ── 7. Below-Benchmark ────────────────────────────────────────────────────────

const belowBenchmark: ReportConfig = {
  id: 'below-benchmark',
  name: 'Below-Benchmark',
  question: 'Which live promos run under the benchmark?',
  theme: 'Profitability',
  mvp: 2,
  filterKeys: ['state', 'scheme', 'manufacturer'],
  defaultSortKey: 'gap',
  defaultSortDir: 'asc',
  columns: [
    { key: 'id',           label: 'Promo ID',        type: 'text' },
    { key: 'name',         label: 'Name',            type: 'text' },
    { key: 'scheme',       label: 'Scheme',          type: 'text' },
    { key: 'state',        label: 'State',           type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer',    type: 'text' },
    { key: 'margin',       label: 'Net Margin %',    type: 'pct' },
    { key: 'benchmark',    label: 'Benchmark %',     type: 'pct' },
    { key: 'gap',          label: 'Gap %',           type: 'pct' },
    { key: 'breachReason', label: 'Breach Reason',   type: 'text' },
    { key: 'approver',     label: 'Approved By',     type: 'text' },
    { key: 'dealerPayout', label: 'Dealer Payout %', type: 'pct' },
  ],
  getData({ promos }, f) {
    let rows = promos.filter(p =>
      p.status === 'Live' && p.margin !== null && p.margin < p.benchmark
    )
    if (f.state)        rows = rows.filter(p => p.state === f.state)
    if (f.scheme)       rows = rows.filter(p => p.scheme === f.scheme)
    if (f.manufacturer) rows = rows.filter(p => p.manufacturer === f.manufacturer)
    return rows.map(p => ({
      id: p.id, name: p.name, scheme: p.scheme, state: p.state,
      manufacturer: p.manufacturer, margin: p.margin, benchmark: p.benchmark,
      gap: p.margin !== null ? +(p.margin - p.benchmark).toFixed(2) : null,
      breachReason: p.breachReason ?? '—',
      approver: p.approver ?? '—',
      dealerPayout: p.dealerPayout,
    }))
  },
}

// ── 8. Approval Status ────────────────────────────────────────────────────────

const approvalStatus: ReportConfig = {
  id: 'approval-status',
  name: 'Approval Status',
  question: "What's pending, approved, rejected — are SLAs being met?",
  theme: 'Approval',
  mvp: 2,
  filterKeys: ['dateFrom', 'dateTo', 'state', 'scheme', 'status'],
  defaultSortKey: 'submittedDate',
  defaultSortDir: 'desc',
  columns: [
    { key: 'id',            label: 'Promo ID',       type: 'text' },
    { key: 'name',          label: 'Name',           type: 'text' },
    { key: 'scheme',        label: 'Scheme',         type: 'text' },
    { key: 'state',         label: 'State',          type: 'text' },
    { key: 'status',        label: 'Status',         type: 'status' },
    { key: 'maker',         label: 'Maker',          type: 'text' },
    { key: 'approver',      label: 'Checker',        type: 'text' },
    { key: 'submittedDate', label: 'Submitted',      type: 'date' },
    { key: 'decisionDate',  label: 'Decision',       type: 'date' },
    { key: 'timeTakenDays', label: 'Days Taken',     type: 'count' },
    { key: 'slaDays',       label: 'SLA (days)',     type: 'count' },
    { key: 'slaStatus',     label: 'SLA Status',     type: 'sla' },
  ],
  getData({ promos }, f) {
    const rows: ReportRow[] = []
    for (const p of promos) {
      const submitted = [...p.history].reverse().find(h =>
        h.event === 'Submitted' || h.event === 'Resubmitted'
      )
      if (!submitted) continue
      const submittedDate = submitted.at.slice(0, 10)
      if (f.dateFrom && submittedDate < f.dateFrom) continue
      if (f.dateTo   && submittedDate > f.dateTo)   continue
      if (f.state    && p.state !== f.state)        continue
      if (f.scheme   && p.scheme !== f.scheme)      continue
      if (f.status   && p.status !== f.status)      continue

      const decision = p.history.find(h => h.event === 'Approved' || h.event === 'Rejected')
      const decisionDate = decision?.at?.slice(0, 10) ?? null
      const timeTakenDays = decisionDate ? daysBetween(submittedDate, decisionDate) : null
      const slaStatus = timeTakenDays === null ? 'Pending' : timeTakenDays <= 2 ? 'Within SLA' : 'Breached'

      rows.push({
        id: p.id, name: p.name, scheme: p.scheme, state: p.state,
        status: p.status, maker: p.maker, approver: p.approver ?? '—',
        submittedDate, decisionDate,
        timeTakenDays, slaDays: 2, slaStatus,
      })
    }
    return rows
  },
}

// ── 9. Audit Report ───────────────────────────────────────────────────────────

const MASTER_LABELS: Record<string, string> = {
  profComponents: 'Profitability Component',
  profValues:     'Profitability Value',
  states:         'State',
  cities:         'City',
  manufacturers:  'Manufacturer',
  makes:          'Make',
  models:         'Model',
  salesPoints:    'Sales Point',
  approvalMatrix: 'Approval Matrix',
  users:          'User / Role',
  reasonCodes:    'Reason Code',
  chargeSchedules:'Schedule of Charges',
}

const auditReport: ReportConfig = {
  id: 'audit-report',
  name: 'Audit Report',
  question: 'Who did what, and when? Full lifecycle export.',
  theme: 'Governance',
  mvp: 2,
  filterKeys: ['dateFrom', 'dateTo', 'entityFilter', 'actionFilter'],
  defaultSortKey: 'timestamp',
  defaultSortDir: 'desc',
  columns: [
    { key: 'timestamp',  label: 'Timestamp',   type: 'date' },
    { key: 'entity',     label: 'Entity',      type: 'text' },
    { key: 'entityId',   label: 'Entity ID',   type: 'text' },
    { key: 'entityName', label: 'Name',        type: 'text' },
    { key: 'action',     label: 'Action',      type: 'text' },
    { key: 'by',         label: 'By',          type: 'text' },
    { key: 'reason',     label: 'Reason',      type: 'text' },
  ],
  getData({ promos, masters }, f) {
    const rows: ReportRow[] = []

    // Promo history
    for (const p of promos) {
      if (f.entityFilter && f.entityFilter !== 'Promo') continue
      for (const h of p.history) {
        const dateStr = h.at.slice(0, 10)
        if (f.dateFrom && dateStr < f.dateFrom) continue
        if (f.dateTo   && dateStr > f.dateTo)   continue
        if (f.actionFilter && h.event !== f.actionFilter) continue
        rows.push({
          timestamp: h.at.slice(0, 10),
          entity: 'Promo', entityId: p.id,
          entityName: p.name, action: h.event,
          by: h.by, reason: h.reason ?? '—',
        })
      }
    }

    // Master history
    for (const [key, entries] of Object.entries(masters)) {
      const label = MASTER_LABELS[key] ?? key
      if (f.entityFilter && f.entityFilter !== label) continue
      for (const entry of entries as Array<{
        id: string
        history: Array<{ at: string; by: string; action: string }>
      } & Record<string, unknown>>) {
        const entryName = String(entry.name ?? entry.code ?? entry.chargeCode ?? entry.employeeId ?? entry.id)
        for (const h of entry.history) {
          const dateStr = h.at.slice(0, 10)
          if (f.dateFrom && dateStr < f.dateFrom) continue
          if (f.dateTo   && dateStr > f.dateTo)   continue
          if (f.actionFilter && h.action !== f.actionFilter) continue
          rows.push({
            timestamp: h.at.slice(0, 10),
            entity: label, entityId: entry.id,
            entityName: entryName, action: h.action,
            by: h.by, reason: '—',
          })
        }
      }
    }

    return rows.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
  },
}

// ── 10. Performance ───────────────────────────────────────────────────────────

// Synthetic disbursals: real Finnone data will replace this
function syntheticDisbursals(promoId: string, salesPointCount: number): { disbursals: number; value: number } {
  const hash = promoId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const disbursals = 15 + (hash + salesPointCount * 3) % 120
  return { disbursals, value: disbursals * (80000 + (hash % 5) * 30000) }
}

const performance: ReportConfig = {
  id: 'performance',
  name: 'Performance',
  question: 'How are live promos doing — disbursals and volume?',
  theme: 'Promos',
  mvp: 3,
  filterKeys: ['state', 'scheme', 'manufacturer'],
  defaultSortKey: 'disbursedValue',
  defaultSortDir: 'desc',
  infoNote: 'Sample figures shown — live disbursal data requires Finnone integration.',
  columns: [
    { key: 'id',            label: 'Promo ID',          type: 'text' },
    { key: 'name',          label: 'Promo Name',        type: 'text' },
    { key: 'scheme',        label: 'Scheme',            type: 'text' },
    { key: 'state',         label: 'State',             type: 'text' },
    { key: 'manufacturer',  label: 'Manufacturer',      type: 'text' },
    { key: 'dealerPayout',  label: 'Dealer Payout %',   type: 'pct' },
    { key: 'disbursals',    label: 'Disbursals (count)', type: 'count' },
    { key: 'disbursedValue',label: 'Disbursed Value',   type: 'currency' },
    { key: 'period',        label: 'Period',             type: 'text' },
  ],
  getData({ promos }, f) {
    let rows = promos.filter(p => p.status === 'Live')
    if (f.state)        rows = rows.filter(p => p.state === f.state)
    if (f.scheme)       rows = rows.filter(p => p.scheme === f.scheme)
    if (f.manufacturer) rows = rows.filter(p => p.manufacturer === f.manufacturer)
    return rows.map(p => {
      const { disbursals, value } = syntheticDisbursals(p.id, p.salesPointCount)
      return {
        id: p.id, name: p.name, scheme: p.scheme, state: p.state,
        manufacturer: p.manufacturer, dealerPayout: p.dealerPayout,
        disbursals, disbursedValue: value, period: 'Jun 2026',
      }
    })
  },
}

// ── Full catalog ──────────────────────────────────────────────────────────────

export const REPORT_CONFIGS: ReportConfig[] = [
  promoMaster,
  expiringPromos,
  salesPointCoverage,
  performance,
  profitability,
  belowBenchmark,
  approvalStatus,
  bulkActivity,
  deactivationDemap,
  auditReport,
]

// All reports are now implemented — nothing coming soon
export const COMING_SOON: Array<{ id: string; name: string; theme: string; question: string; mvp: 2 | 3 }> = []

export const AUDIT_ENTITY_OPTIONS = Object.values(MASTER_LABELS).concat(['Promo']).sort()
export const AUDIT_ACTION_OPTIONS = [
  'Approved', 'Cloned', 'Created', 'Deactivated', 'Edited',
  'Draft created', 'Rejected', 'Reactivated', 'Resubmitted',
  'Sent for rework', 'Submitted', 'Auto-expired',
]

export function getReportConfig(id: string): ReportConfig | undefined {
  return REPORT_CONFIGS.find(c => c.id === id)
}
