import type {
  MastersState,
  ProfComponentEntry,
  ProfValueEntry,
  StateMasterEntry,
  CityMasterEntry,
  ManufacturerMasterEntry,
  MakeMasterEntry,
  ModelMasterEntry,
  SalesPointMasterEntry,
  ApprovalMatrixEntry,
  UserMasterEntry,
  ReasonCodeEntry,
  ChargeScheduleEntry,
  MasterAuditEntry,
} from './types'

const now = '2026-07-01T09:00:00Z'
const by = 'Admin'

function base(id: string) {
  const h: MasterAuditEntry = { at: now, by, action: 'Created' }
  return { id, status: 'Active' as const, createdAt: now, updatedAt: now, history: [h] }
}

// ── Profitability Component Master ────────────────────────────────────────

export const SEED_PROF_COMPONENTS: ProfComponentEntry[] = [
  { ...base('PC001'), name: 'Interest Income', type: 'Income', includeInEngine: true, source: 'Calculated' },
  { ...base('PC002'), name: 'Processing Fee', type: 'Income', includeInEngine: true, source: 'Master' },
  { ...base('PC003'), name: 'PDD', type: 'Income', includeInEngine: true, source: 'Master' },
  { ...base('PC004'), name: 'PFF', type: 'Income', includeInEngine: true, source: 'Master' },
  { ...base('PC005'), name: 'LMF', type: 'Income', includeInEngine: true, source: 'Master' },
  { ...base('PC006'), name: 'Dealer Payout', type: 'Expense', includeInEngine: true, source: 'User Input' },
  { ...base('PC007'), name: 'Cost of Funds', type: 'Expense', includeInEngine: true, source: 'Master' },
  { ...base('PC008'), name: 'Opex', type: 'Expense', includeInEngine: true, source: 'Master' },
  { ...base('PC009'), name: 'NCL Rate', type: 'Expense', includeInEngine: true, source: 'Calculated' },
  { ...base('PC010'), name: 'DMI', type: 'Expense', includeInEngine: true, source: 'User Input' },
]

// ── Profitability Value Master ─────────────────────────────────────────────

export const SEED_PROF_VALUES: ProfValueEntry[] = [
  { ...base('PV001'), component: 'CoF', scope: 'PAN-India', state: '', value: 8.5, effectiveFrom: '2026-01-01' },
  { ...base('PV002'), component: 'Opex', scope: 'PAN-India', state: '', value: 1.2, effectiveFrom: '2026-01-01' },
  { ...base('PV003'), component: 'NCL Delinquency', scope: 'State-wise', state: 'Maharashtra', value: 2.1, effectiveFrom: '2026-01-01' },
  { ...base('PV004'), component: 'NCL Delinquency', scope: 'State-wise', state: 'Karnataka', value: 1.8, effectiveFrom: '2026-01-01' },
  { ...base('PV005'), component: 'NCL Delinquency', scope: 'State-wise', state: 'Tamil Nadu', value: 1.9, effectiveFrom: '2026-01-01' },
  { ...base('PV006'), component: 'NCL Delinquency', scope: 'State-wise', state: 'Gujarat', value: 1.6, effectiveFrom: '2026-01-01' },
  { ...base('PV007'), component: 'NCL Delinquency', scope: 'State-wise', state: 'Telangana', value: 2.0, effectiveFrom: '2026-01-01' },
  { ...base('PV008'), component: 'NCL Multiplier', scope: 'PAN-India', state: '', value: 1.5, effectiveFrom: '2026-01-01' },
  { ...base('PV009'), component: 'Benchmark', scope: 'State-wise', state: 'Maharashtra', value: 3.5, effectiveFrom: '2026-01-01' },
  { ...base('PV010'), component: 'Benchmark', scope: 'State-wise', state: 'Karnataka', value: 3.2, effectiveFrom: '2026-01-01' },
  { ...base('PV011'), component: 'Benchmark', scope: 'State-wise', state: 'Tamil Nadu', value: 3.4, effectiveFrom: '2026-01-01' },
  { ...base('PV012'), component: 'Benchmark', scope: 'State-wise', state: 'Gujarat', value: 3.1, effectiveFrom: '2026-01-01' },
  { ...base('PV013'), component: 'Benchmark', scope: 'State-wise', state: 'Telangana', value: 3.3, effectiveFrom: '2026-01-01' },
]

// ── State Master ───────────────────────────────────────────────────────────

export const SEED_STATES: StateMasterEntry[] = [
  { ...base('ST001'), code: 'MH', name: 'Maharashtra', zone: 'West' },
  { ...base('ST002'), code: 'KA', name: 'Karnataka', zone: 'South' },
  { ...base('ST003'), code: 'TN', name: 'Tamil Nadu', zone: 'South' },
  { ...base('ST004'), code: 'GJ', name: 'Gujarat', zone: 'West' },
  { ...base('ST005'), code: 'TS', name: 'Telangana', zone: 'South' },
]

// ── City Master ────────────────────────────────────────────────────────────

export const SEED_CITIES: CityMasterEntry[] = [
  { ...base('CT001'), code: 'MUM', name: 'Mumbai', state: 'Maharashtra' },
  { ...base('CT002'), code: 'PUN', name: 'Pune', state: 'Maharashtra' },
  { ...base('CT003'), code: 'NGP', name: 'Nagpur', state: 'Maharashtra' },
  { ...base('CT004'), code: 'NSK', name: 'Nashik', state: 'Maharashtra' },
  { ...base('CT005'), code: 'AUR', name: 'Aurangabad', state: 'Maharashtra' },
  { ...base('CT006'), code: 'KOL', name: 'Kolhapur', state: 'Maharashtra' },
  { ...base('CT007'), code: 'BLR', name: 'Bengaluru', state: 'Karnataka' },
  { ...base('CT008'), code: 'MYS', name: 'Mysuru', state: 'Karnataka' },
  { ...base('CT009'), code: 'MNG', name: 'Mangaluru', state: 'Karnataka' },
  { ...base('CT010'), code: 'HBL', name: 'Hubli', state: 'Karnataka' },
  { ...base('CT011'), code: 'BLG', name: 'Belgaum', state: 'Karnataka' },
  { ...base('CT012'), code: 'CHN', name: 'Chennai', state: 'Tamil Nadu' },
  { ...base('CT013'), code: 'CBE', name: 'Coimbatore', state: 'Tamil Nadu' },
  { ...base('CT014'), code: 'MDU', name: 'Madurai', state: 'Tamil Nadu' },
  { ...base('CT015'), code: 'TRY', name: 'Trichy', state: 'Tamil Nadu' },
  { ...base('CT016'), code: 'SLM', name: 'Salem', state: 'Tamil Nadu' },
  { ...base('CT017'), code: 'AMD', name: 'Ahmedabad', state: 'Gujarat' },
  { ...base('CT018'), code: 'SRT', name: 'Surat', state: 'Gujarat' },
  { ...base('CT019'), code: 'VDR', name: 'Vadodara', state: 'Gujarat' },
  { ...base('CT020'), code: 'RJK', name: 'Rajkot', state: 'Gujarat' },
  { ...base('CT021'), code: 'HYD', name: 'Hyderabad', state: 'Telangana' },
  { ...base('CT022'), code: 'WGL', name: 'Warangal', state: 'Telangana' },
  { ...base('CT023'), code: 'KRM', name: 'Karimnagar', state: 'Telangana' },
]

// ── Manufacturer Master ────────────────────────────────────────────────────

export const SEED_MANUFACTURERS: ManufacturerMasterEntry[] = [
  { ...base('MF001'), code: 'HND', name: 'Honda' },
  { ...base('MF002'), code: 'TVS', name: 'TVS' },
  { ...base('MF003'), code: 'BAJ', name: 'Bajaj' },
  { ...base('MF004'), code: 'HRO', name: 'Hero' },
  { ...base('MF005'), code: 'SUZ', name: 'Suzuki' },
  { ...base('MF006'), code: 'YAM', name: 'Yamaha' },
  { ...base('MF007'), code: 'RE', name: 'Royal Enfield' },
  { ...base('MF008'), code: 'KTM', name: 'KTM' },
]

// ── Make Master ────────────────────────────────────────────────────────────

export const SEED_MAKES: MakeMasterEntry[] = [
  { ...base('MK001'), code: 'ACT', name: 'Activa', manufacturer: 'Honda' },
  { ...base('MK002'), code: 'SHN', name: 'Shine', manufacturer: 'Honda' },
  { ...base('MK003'), code: 'UNI', name: 'Unicorn', manufacturer: 'Honda' },
  { ...base('MK004'), code: 'APR', name: 'Apache', manufacturer: 'TVS' },
  { ...base('MK005'), code: 'JPT', name: 'Jupiter', manufacturer: 'TVS' },
  { ...base('MK006'), code: 'NTQ', name: 'Ntorq', manufacturer: 'TVS' },
  { ...base('MK007'), code: 'PLS', name: 'Pulsar', manufacturer: 'Bajaj' },
  { ...base('MK008'), code: 'PLT', name: 'Platina', manufacturer: 'Bajaj' },
  { ...base('MK009'), code: 'SPL', name: 'Splendor', manufacturer: 'Hero' },
  { ...base('MK010'), code: 'HFD', name: 'HF Deluxe', manufacturer: 'Hero' },
  { ...base('MK011'), code: 'ACC', name: 'Access', manufacturer: 'Suzuki' },
  { ...base('MK012'), code: 'GXR', name: 'Gixxer', manufacturer: 'Suzuki' },
  { ...base('MK013'), code: 'FZS', name: 'FZ-S', manufacturer: 'Yamaha' },
  { ...base('MK014'), code: 'R15', name: 'R15', manufacturer: 'Yamaha' },
  { ...base('MK015'), code: 'CL3', name: 'Classic 350', manufacturer: 'Royal Enfield' },
  { ...base('MK016'), code: 'HNT', name: 'Hunter 350', manufacturer: 'Royal Enfield' },
  { ...base('MK017'), code: 'DK2', name: 'Duke', manufacturer: 'KTM' },
  { ...base('MK018'), code: 'RC2', name: 'RC', manufacturer: 'KTM' },
]

// ── Model Master ───────────────────────────────────────────────────────────

export const SEED_MODELS: ModelMasterEntry[] = [
  { ...base('MD001'), code: 'ACT6G', name: 'Activa 6G', make: 'Activa', manufacturer: 'Honda' },
  { ...base('MD002'), code: 'SHN', name: 'Shine', make: 'Shine', manufacturer: 'Honda' },
  { ...base('MD003'), code: 'UNI', name: 'Unicorn', make: 'Unicorn', manufacturer: 'Honda' },
  { ...base('MD004'), code: 'HNT20', name: 'Hornet 2.0', make: 'Shine', manufacturer: 'Honda' },
  { ...base('MD005'), code: 'APR160', name: 'Apache RTR 160', make: 'Apache', manufacturer: 'TVS' },
  { ...base('MD006'), code: 'JPT', name: 'Jupiter', make: 'Jupiter', manufacturer: 'TVS' },
  { ...base('MD007'), code: 'NTQ125', name: 'Ntorq 125', make: 'Ntorq', manufacturer: 'TVS' },
  { ...base('MD008'), code: 'PLS150', name: 'Pulsar 150', make: 'Pulsar', manufacturer: 'Bajaj' },
  { ...base('MD009'), code: 'PLN160', name: 'Pulsar N160', make: 'Pulsar', manufacturer: 'Bajaj' },
  { ...base('MD010'), code: 'PLT110', name: 'Platina 110', make: 'Platina', manufacturer: 'Bajaj' },
  { ...base('MD011'), code: 'SPL+', name: 'Splendor Plus', make: 'Splendor', manufacturer: 'Hero' },
  { ...base('MD012'), code: 'HFD', name: 'HF Deluxe', make: 'HF Deluxe', manufacturer: 'Hero' },
  { ...base('MD013'), code: 'ACC125', name: 'Access 125', make: 'Access', manufacturer: 'Suzuki' },
  { ...base('MD014'), code: 'GXR', name: 'Gixxer', make: 'Gixxer', manufacturer: 'Suzuki' },
  { ...base('MD015'), code: 'FZS', name: 'FZ-S', make: 'FZ-S', manufacturer: 'Yamaha' },
  { ...base('MD016'), code: 'MT15', name: 'MT-15', make: 'FZ-S', manufacturer: 'Yamaha' },
  { ...base('MD017'), code: 'CL350', name: 'Classic 350', make: 'Classic 350', manufacturer: 'Royal Enfield' },
  { ...base('MD018'), code: 'HNT350', name: 'Hunter 350', make: 'Hunter 350', manufacturer: 'Royal Enfield' },
  { ...base('MD019'), code: 'DK200', name: 'Duke 200', make: 'Duke', manufacturer: 'KTM' },
  { ...base('MD020'), code: 'DK250', name: 'Duke 250', make: 'Duke', manufacturer: 'KTM' },
]

// ── Sales Point Master ─────────────────────────────────────────────────────

export const SEED_SALES_POINTS: SalesPointMasterEntry[] = [
  { ...base('SP001'), code: 'SP001', name: 'Sai Honda, Pune', city: 'Pune', manufacturers: ['Honda', 'Hero'], dealerType: 'MBO' },
  { ...base('SP002'), code: 'SP002', name: 'Pune TVS, Kothrud', city: 'Pune', manufacturers: ['TVS'], dealerType: 'SBO' },
  { ...base('SP003'), code: 'SP003', name: 'Shree Bajaj, Nashik', city: 'Nashik', manufacturers: ['Bajaj'], dealerType: 'SBO' },
  { ...base('SP004'), code: 'SP004', name: 'Galaxy Hero, Mumbai', city: 'Mumbai', manufacturers: ['Hero', 'Suzuki'], dealerType: 'MBO' },
  { ...base('SP005'), code: 'SP005', name: 'Veer Honda, Nagpur', city: 'Nagpur', manufacturers: ['Honda'], dealerType: 'SBO' },
  { ...base('SP006'), code: 'SP006', name: 'Coastal Suzuki, Mangaluru', city: 'Mangaluru', manufacturers: ['Suzuki', 'Yamaha'], dealerType: 'MBO' },
  { ...base('SP007'), code: 'SP007', name: 'Mumbai Yamaha, Andheri', city: 'Mumbai', manufacturers: ['Yamaha'], dealerType: 'SBO' },
  { ...base('SP008'), code: 'SP008', name: 'Royal Motors, Pune', city: 'Pune', manufacturers: ['Royal Enfield'], dealerType: 'SBO' },
  { ...base('SP009'), code: 'SP009', name: 'Speed KTM, Mumbai', city: 'Mumbai', manufacturers: ['KTM', 'Bajaj'], dealerType: 'MBO' },
  { ...base('SP010'), code: 'SP010', name: 'Deccan TVS, Nagpur', city: 'Nagpur', manufacturers: ['TVS'], dealerType: 'SBO' },
]

// ── Approval Matrix Master ─────────────────────────────────────────────────

export const SEED_APPROVAL_MATRIX: ApprovalMatrixEntry[] = [
  {
    ...base('AM001'), state: 'Maharashtra', promoGroup: 'Competitive',
    normalApproverName: 'Kiran Shinde', normalApproverEmail: 'kiran.shinde@idfcfirst.com', normalApproverRole: 'ZH',
    breachApproverName: 'Amitabh Roy', breachApproverEmail: 'amitabh.roy@idfcfirst.com', breachApproverRole: 'NSM',
    backupApproverEmail: 'backup.west@idfcfirst.com', slaHours: 24,
  },
  {
    ...base('AM002'), state: 'Gujarat', promoGroup: 'Competitive',
    normalApproverName: 'Kiran Shinde', normalApproverEmail: 'kiran.shinde@idfcfirst.com', normalApproverRole: 'ZH',
    breachApproverName: 'Amitabh Roy', breachApproverEmail: 'amitabh.roy@idfcfirst.com', breachApproverRole: 'NSM',
    backupApproverEmail: 'backup.west@idfcfirst.com', slaHours: 24,
  },
  {
    ...base('AM003'), state: 'Karnataka', promoGroup: 'Competitive',
    normalApproverName: 'Pradeep Nair', normalApproverEmail: 'pradeep.nair@idfcfirst.com', normalApproverRole: 'ZH',
    breachApproverName: 'Amitabh Roy', breachApproverEmail: 'amitabh.roy@idfcfirst.com', breachApproverRole: 'NSM',
    backupApproverEmail: 'backup.south@idfcfirst.com', slaHours: 24,
  },
  {
    ...base('AM004'), state: 'Tamil Nadu', promoGroup: 'Competitive',
    normalApproverName: 'Pradeep Nair', normalApproverEmail: 'pradeep.nair@idfcfirst.com', normalApproverRole: 'ZH',
    breachApproverName: 'Amitabh Roy', breachApproverEmail: 'amitabh.roy@idfcfirst.com', breachApproverRole: 'NSM',
    backupApproverEmail: 'backup.south@idfcfirst.com', slaHours: 24,
  },
  {
    ...base('AM005'), state: 'Telangana', promoGroup: 'Competitive',
    normalApproverName: 'Pradeep Nair', normalApproverEmail: 'pradeep.nair@idfcfirst.com', normalApproverRole: 'ZH',
    breachApproverName: 'Amitabh Roy', breachApproverEmail: 'amitabh.roy@idfcfirst.com', breachApproverRole: 'NSM',
    backupApproverEmail: 'backup.south@idfcfirst.com', slaHours: 24,
  },
]

// ── User / Role Master ─────────────────────────────────────────────────────

export const SEED_USERS: UserMasterEntry[] = [
  { ...base('USR001'), employeeId: 'EMP001', name: 'Rajesh Menon', email: 'rajesh.menon@idfcfirst.com', role: 'Maker', accessScope: 'Zone', zone: 'West', states: [] },
  { ...base('USR002'), employeeId: 'EMP002', name: 'Anita Sharma', email: 'anita.sharma@idfcfirst.com', role: 'Checker', accessScope: 'Zone', zone: 'West', states: [] },
  { ...base('USR003'), employeeId: 'EMP003', name: 'System Admin', email: 'admin@idfcfirst.com', role: 'Admin', accessScope: 'PAN-India', zone: '', states: [] },
  { ...base('USR004'), employeeId: 'EMP004', name: 'Kiran Shinde', email: 'kiran.shinde@idfcfirst.com', role: 'Checker', accessScope: 'Zone', zone: 'West', states: [] },
  { ...base('USR005'), employeeId: 'EMP005', name: 'Pradeep Nair', email: 'pradeep.nair@idfcfirst.com', role: 'Checker', accessScope: 'Zone', zone: 'South', states: [] },
]

// ── Reason Code Master ─────────────────────────────────────────────────────

export const SEED_REASON_CODES: ReasonCodeEntry[] = [
  { ...base('RC001'), category: 'Reject', code: 'BELOW_BENCH', text: 'Margin below benchmark — not approved' },
  { ...base('RC002'), category: 'Reject', code: 'DUPLICATE', text: 'Duplicate promo already exists for this scheme and geography' },
  { ...base('RC003'), category: 'Reject', code: 'INVALID_RATE', text: 'Rate outside permissible band for this scheme' },
  { ...base('RC004'), category: 'Rework', code: 'WRONG_DEALERS', text: 'Dealer selection needs correction' },
  { ...base('RC005'), category: 'Rework', text: 'Payout percentage needs justification', code: 'HIGH_PAYOUT' },
  { ...base('RC006'), category: 'Rework', code: 'MISSING_DOCS', text: 'Supporting documentation missing' },
  { ...base('RC007'), category: 'Deactivate', code: 'EXPIRED', text: 'Promo period has ended' },
  { ...base('RC008'), category: 'Deactivate', code: 'SCHEME_CLOSED', text: 'Underlying scheme has been closed by Finnone' },
  { ...base('RC009'), category: 'Demap', code: 'DEALER_EXIT', text: 'Dealer has exited the network' },
  { ...base('RC010'), category: 'Demap', code: 'MFR_CHANGE', text: 'Dealer manufacturer alignment has changed' },
]

// ── Schedule of Charges Master ─────────────────────────────────────────────

export const SEED_CHARGE_SCHEDULES: ChargeScheduleEntry[] = [
  { ...base('CS001'), chargeCode: 'PF', chargeName: 'Processing Fee', allowedType: 'Both', minValue: 0, maxValue: 5, permittedValues: '0–5% or ₹0–5000' },
  { ...base('CS002'), chargeCode: 'PDD', chargeName: 'Pre-Disbursement Due', allowedType: 'Both', minValue: 0, maxValue: 3, permittedValues: '0–3% or ₹0–3000' },
  { ...base('CS003'), chargeCode: 'PFF', chargeName: 'Processing Fee Float', allowedType: 'Amount', minValue: 0, maxValue: 2000, permittedValues: '₹0–2000' },
  { ...base('CS004'), chargeCode: 'LMF', chargeName: 'Loan Management Fee', allowedType: 'Amount', minValue: 0, maxValue: 1000, permittedValues: '₹0–1000' },
  { ...base('CS005'), chargeCode: 'DP', chargeName: 'Dealer Payout', allowedType: '%', minValue: 0, maxValue: 10, permittedValues: '0–10% (incl. GST)' },
  { ...base('CS006'), chargeCode: 'DMI', chargeName: 'Direct Marketing Incentive', allowedType: 'Amount', minValue: 0, maxValue: 5000, permittedValues: '₹0–5000' },
]

// ── Combined seed ──────────────────────────────────────────────────────────

export const MASTERS_SEED: MastersState = {
  profComponents: SEED_PROF_COMPONENTS,
  profValues: SEED_PROF_VALUES,
  states: SEED_STATES,
  cities: SEED_CITIES,
  manufacturers: SEED_MANUFACTURERS,
  makes: SEED_MAKES,
  models: SEED_MODELS,
  salesPoints: SEED_SALES_POINTS,
  approvalMatrix: SEED_APPROVAL_MATRIX,
  users: SEED_USERS,
  reasonCodes: SEED_REASON_CODES,
  chargeSchedules: SEED_CHARGE_SCHEDULES,
}
