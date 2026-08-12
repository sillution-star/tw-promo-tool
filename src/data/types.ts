export type Role = 'maker' | 'checker' | 'admin'

export type PromoStatus =
  | 'Draft'
  | 'Pending'
  | 'Resubmitted'
  | 'Approved'
  | 'Rejected'
  | 'Rework'
  | 'Live'
  | 'Expired'
  | 'Deactivated'

export type PromoGroup = 'Manufacturer' | 'Competitive'

export type DealerType = 'SBO' | 'MBO'

export type ProductType = 'New' | 'Used' | 'Refinance' | 'Direct'

export interface Scheme {
  id: string
  name: string
  minAmount: number
  maxAmount: number
  roiMin: number
  roiMax: number
  tenures: number[] // allowed tenure values (months) from Finnone
}

export interface SalesPoint {
  id: string
  name: string
  city: string
  state: string
  manufacturers: string[]
  dealerType: DealerType
  salesManager: string
}

export interface HistoryEntry {
  at: string // ISO date
  event: string // e.g. "Submitted", "Rejected", "Resubmitted", "Approved"
  by: string
  reason?: string
}

// Full money/mapping detail captured by the create wizard. Optional on seed
// promos (we synthesize a breakdown for those when needed).
export interface PromoDetail {
  minAmount: number
  maxAmount: number
  minTenure: number
  maxTenure: number
  flatRate: number
  pfPct: number | null
  pfAmount: number | null
  pddPct: number | null
  pddAmount: number | null
  pffAmount: number
  lmfAmount: number
  dealerPayout: number // % — inclusive of GST
  dmiOn: boolean
  dmiAmount: number
  advanceEmi: number  // 0–4; shown in SFDC, no charge impact
  states: string[]
  cities: string[]
  salesPointIds: string[]
  modelNames: string[]
  validFrom: string
  validTo: string
}

// Stores the proposed changes while a Live promo's edit awaits approval.
export interface PendingEdit {
  submittedAt: string
  submittedBy: string
  approver: string
  // mapping fields
  dealerType: DealerType | null
  manufacturer: string
  states: string[]
  cities: string[]
  salesPointIds: string[]
  modelNames: string[]
  // rates & charges fields (kept as strings, same as WizardDraft)
  minAmount: string
  maxAmount: string
  minTenure: number | null
  maxTenure: number | null
  flatRate: string
  pfPct: number | null
  pfAmount: number | null
  pddPct: number | null
  pddAmount: number | null
  pffAmount: number | null
  lmfAmount: number | null
  dealerPayout: string
  dmiOn: boolean
  dmiAmount: string
  breachReason: string
  // computed at submit time (so approve() is fast)
  newMargin: number | null
  newHighPayout: boolean
}

export interface Promo {
  id: string
  name: string
  scheme: string
  group: PromoGroup
  status: PromoStatus
  margin: number | null // net margin %
  benchmark: number
  state: string
  city?: string
  zone: 'West' | 'South'
  product?: ProductType
  manufacturer: string
  dealerType: DealerType
  salesPointCount: number
  modelCount: number
  dealerPayout: number // %
  expiry: string | null // ISO date
  createdAt: string // ISO date
  maker: string
  approver?: string
  rejectionReason?: string
  reworkReason?: string
  breachReason?: string
  highPayout: boolean
  history: HistoryEntry[]
  detail?: PromoDetail
  pendingEdit?: PendingEdit      // set while a money-term edit is awaiting approval
  editRejectedReason?: string   // set when checker rejects the edit
}

// ── Create wizard working draft ──────────────────────────────────────────
export interface WizardDraft {
  id?: string // existing promo id when editing a draft / resubmitting
  // Step 1 — Promo Details
  name: string
  schemeName: string
  group: PromoGroup | null
  // Step 2 — Mapping
  product: ProductType | null
  dealerType: DealerType | null
  manufacturer: string
  manufacturers: string[]
  states: string[]
  cities: string[]
  salesPointIds: string[]
  modelNames: string[]
  // Step 3 — Rates & Charges (kept as strings for live input where typed)
  minAmount: string
  maxAmount: string
  minTenure: number | null
  maxTenure: number | null
  flatRate: string
  pfPct: number | null
  pfAmount: number | null
  pddPct: number | null
  pddAmount: number | null
  pffAmount: number | null
  lmfAmount: number | null
  dealerPayout: string
  dmiOn: boolean
  dmiAmount: string
  advanceEmi: number  // 0–4; shown in SFDC, no charge impact
  // Step 4 — Profitability
  breachReason: string
  // Validity
  validFrom: string
  validTo: string
  // carried for resubmission / rework
  history: HistoryEntry[]
  resubmitting?: boolean    // editing a Rejected promo
  reworking?: boolean       // editing a Rework promo (sent back by checker)
  editingPromoId?: string   // set when editing a Live promo (Mapping onwards, Step 1 frozen)
  clonedFromId?: string     // set when cloning a promo — lands on Review at step 5
  clonedFromName?: string   // source promo name shown in the "Cloned from …" banner
}

// ── Navigation ───────────────────────────────────────────────────────────
export type PresetAction = 'approve' | 'reject' | 'rework'

export type View =
  | { name: 'dashboard' }
  | { name: 'wizard'; step: number }
  | { name: 'inbox'; tab: string }
  | { name: 'approver'; promoId: string; presetAction?: PresetAction }
  | { name: 'email-preview'; promoId: string }
  | { name: 'list'; key: string; title: string }
  | { name: 'placeholder'; title: string }
  | { name: 'existing-promos'; tab?: string }
  | { name: 'edit-promo'; promoId: string }
  | { name: 'admin-promo'; promoId: string }
  | { name: 'query-update' }
  | { name: 'masters' }
  | { name: 'master-detail'; masterKey: MasterKey }
  | { name: 'audit' }
  | { name: 'promo-history'; promoId: string }
  | { name: 'reports' }
  | { name: 'report'; reportId: string }

// ── Masters ──────────────────────────────────────────────────────────────

export type MasterKey =
  | 'profComponents'
  | 'profValues'
  | 'states'
  | 'cities'
  | 'manufacturers'
  | 'makes'
  | 'models'
  | 'salesPoints'
  | 'approvalMatrix'
  | 'users'
  | 'reasonCodes'
  | 'chargeSchedules'

export type MasterStatus = 'Active' | 'Inactive'

export interface MasterAuditEntry {
  at: string
  by: string
  action: 'Created' | 'Edited' | 'Deactivated' | 'Reactivated'
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export interface BaseMasterEntry {
  id: string
  status: MasterStatus
  createdAt: string
  updatedAt: string
  history: MasterAuditEntry[]
}

export interface StateMasterEntry extends BaseMasterEntry {
  code: string
  name: string
  zone: string
}

export interface CityMasterEntry extends BaseMasterEntry {
  code: string
  name: string
  state: string
}

export interface ManufacturerMasterEntry extends BaseMasterEntry {
  code: string
  name: string
}

export interface MakeMasterEntry extends BaseMasterEntry {
  code: string
  name: string
  manufacturer: string
}

export interface ModelMasterEntry extends BaseMasterEntry {
  code: string
  name: string
  make: string
  manufacturer: string
}

export interface SalesPointMasterEntry extends BaseMasterEntry {
  code: string
  name: string
  city: string
  manufacturers: string[]
  dealerType: 'SBO' | 'MBO'
}

export interface ApprovalMatrixEntry extends BaseMasterEntry {
  state: string
  promoGroup: 'Manufacturer' | 'Competitive'
  normalApproverName: string
  normalApproverEmail: string
  normalApproverRole: string
  breachApproverName: string
  breachApproverEmail: string
  breachApproverRole: string
  backupApproverEmail: string
  slaHours: number
}

export interface UserMasterEntry extends BaseMasterEntry {
  employeeId: string
  name: string
  email: string
  role: 'Maker' | 'Checker' | 'Admin' | 'Viewer'
  accessScope: 'PAN-India' | 'Zone' | 'State'
  zone: string
  states: string[]
}

export interface ProfComponentEntry extends BaseMasterEntry {
  name: string
  type: 'Income' | 'Expense'
  includeInEngine: boolean
  source: 'Calculated' | 'User Input' | 'Master'
}

export interface ProfValueEntry extends BaseMasterEntry {
  component: 'CoF' | 'Opex' | 'NCL Delinquency' | 'NCL Multiplier' | 'Benchmark'
  scope: 'PAN-India' | 'State-wise'
  state: string
  value: number
  effectiveFrom: string
}

export interface ReasonCodeEntry extends BaseMasterEntry {
  category: 'Reject' | 'Rework' | 'Deactivate' | 'Demap'
  code: string
  text: string
}

export interface ChargeScheduleEntry extends BaseMasterEntry {
  chargeCode: string
  chargeName: string
  allowedType: '%' | 'Amount' | 'Both'
  minValue: number
  maxValue: number
  permittedValues: string
}

export interface MastersState {
  profComponents: ProfComponentEntry[]
  profValues: ProfValueEntry[]
  states: StateMasterEntry[]
  cities: CityMasterEntry[]
  manufacturers: ManufacturerMasterEntry[]
  makes: MakeMasterEntry[]
  models: ModelMasterEntry[]
  salesPoints: SalesPointMasterEntry[]
  approvalMatrix: ApprovalMatrixEntry[]
  users: UserMasterEntry[]
  reasonCodes: ReasonCodeEntry[]
  chargeSchedules: ChargeScheduleEntry[]
}
