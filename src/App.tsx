import { useEffect } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './screens/Dashboard'
import { CreateWizard } from './screens/wizard/CreateWizard'
import { ApproverDecision } from './screens/ApproverDecision'
import { Inbox } from './screens/Inbox'
import { ExistingPromos } from './screens/ExistingPromos'
import { EditPromoView } from './screens/EditPromoView'
import { AdminPromoView } from './screens/AdminPromoView'
import { EmailDecisionView } from './screens/EmailDecisionView'
import { QueryUpdateView } from './screens/QueryUpdateView'
import { MastersHome } from './screens/masters/MastersHome'
import { MasterDetail } from './screens/masters/MasterDetail'
import { AuditLog } from './screens/masters/AuditLog'
import { ReportsHome } from './screens/reports/ReportsHome'
import { ReportView } from './screens/reports/ReportView'
import { getReportConfig } from './screens/reports/reportConfigs'
import type { Promo } from './data/types'

const STEP_NAMES = ['Promo Details', 'Mapping', 'Rates & Charges', 'Profitability', 'Review']

function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      <p className="mt-2 text-muted">Reports & analytics come after the core spine in this MVP.</p>
    </div>
  )
}

// Which sidebar item is highlighted for the current view
function activeNavFor(view: ReturnType<typeof useApp>['view'], role: string): string {
  switch (view.name) {
    case 'dashboard':
      return 'Dashboard'
    case 'wizard':
      return role === 'admin' ? 'Existing Promos' : 'Create New Promo'
    case 'inbox':
      return 'Inbox'
    case 'approver':
      return role === 'checker' ? 'Inbox' : 'Dashboard'
    case 'email-preview':
      return 'Inbox'
    case 'list':
      return view.title
    case 'placeholder':
      return view.title
    case 'existing-promos':
      return 'Existing Promos'
    case 'edit-promo':
      return 'Existing Promos'
    case 'admin-promo':
      return 'Existing Promos'
    case 'query-update':
      return 'Query Update'
    case 'masters':
      return 'Masters'
    case 'master-detail':
      return 'Masters'
    case 'audit':
      return 'Audit'
    case 'promo-history':
      return 'Existing Promos'
    case 'reports':
      return 'Reports'
    case 'report':
      return 'Reports'
  }
}

function breadcrumbFor(
  view: ReturnType<typeof useApp>['view'],
  getPromo: (id: string) => Promo | undefined,
  resubmitting: boolean,
  editingPromoId?: string,
  clonedFromId?: string,
): string[] {
  switch (view.name) {
    case 'dashboard':
      return ['Dashboard']
    case 'wizard':
      if (editingPromoId) return ['Dashboard', 'Existing Promos', `Edit · ${editingPromoId}`, STEP_NAMES[view.step - 1]]
      if (clonedFromId) return ['Dashboard', `Clone · ${clonedFromId}`, STEP_NAMES[view.step - 1]]
      return ['Dashboard', resubmitting ? 'Edit & Resubmit' : 'Create Promo', STEP_NAMES[view.step - 1]]
    case 'inbox':
      return ['Dashboard', 'Inbox', view.tab]
    case 'approver':
      return view.presetAction
        ? ['Dashboard', 'Inbox', getPromo(view.promoId)?.name ?? 'Promo', `${view.presetAction.charAt(0).toUpperCase()}${view.presetAction.slice(1)}`]
        : ['Dashboard', 'Approval', getPromo(view.promoId)?.name ?? 'Promo']
    case 'email-preview':
      return ['Dashboard', 'Inbox', getPromo(view.promoId)?.name ?? 'Promo', 'Approval Email']
    case 'list':
      return ['Dashboard', view.title]
    case 'placeholder':
      return ['Dashboard', view.title]
    case 'existing-promos':
      return ['Dashboard', 'Existing Promos']
    case 'edit-promo':
      return ['Dashboard', 'Existing Promos', `Promo Modification · ${view.promoId}`]
    case 'admin-promo':
      return ['Dashboard', 'Existing Promos', getPromo(view.promoId)?.name ?? view.promoId]
    case 'query-update':
      return ['Dashboard', 'Query Update']
    case 'masters':
      return ['Dashboard', 'Masters']
    case 'master-detail':
      return ['Dashboard', 'Masters', view.masterKey]
    case 'audit':
      return ['Dashboard', 'Audit Log']
    case 'promo-history':
      return ['Dashboard', 'Existing Promos', getPromo(view.promoId)?.name ?? view.promoId, 'History']
    case 'reports':
      return ['Dashboard', 'Reports']
    case 'report':
      return ['Dashboard', 'Reports', getReportConfig(view.reportId)?.name ?? view.reportId]
  }
}

function Workspace() {
  const { role, view, navigate, startNewPromo, editDraft, getPromo, draft } = useApp()

  // Reset to Dashboard when switching role (nav items differ per role)
  useEffect(() => {
    navigate({ name: 'dashboard' })
  }, [role, navigate])

  const onNavigate = (label: string) => {
    if (role === 'maker') {
      switch (label) {
        case 'Dashboard': return navigate({ name: 'dashboard' })
        case 'Create New Promo': return startNewPromo()
        case 'Inbox': return navigate({ name: 'inbox', tab: 'Pending' })
        case 'Existing Promos': return navigate({ name: 'existing-promos' })
        case 'My Promos': return navigate({ name: 'list', key: 'mine', title: 'My Promos' })
        case 'Reports': return navigate({ name: 'reports' })
      }
    } else if (role === 'admin') {
      switch (label) {
        case 'Dashboard': return navigate({ name: 'dashboard' })
        case 'Existing Promos': return navigate({ name: 'existing-promos' })
        case 'Query Update': return navigate({ name: 'query-update' })
        case 'Masters': return navigate({ name: 'masters' })
        case 'Audit': return navigate({ name: 'audit' })
        case 'Reports': return navigate({ name: 'reports' })
      }
    } else {
      switch (label) {
        case 'Dashboard': return navigate({ name: 'dashboard' })
        case 'Inbox': return navigate({ name: 'inbox', tab: 'Pending Approval' })
        case 'Reports': return navigate({ name: 'reports' })
      }
    }
  }

  const openPromo = (p: Promo) => {
    if (p.status === 'Draft') return editDraft(p.id)
    navigate({ name: 'admin-promo', promoId: p.id })
  }

  const active = activeNavFor(view, role)
  const breadcrumb = breadcrumbFor(view, getPromo, !!draft.resubmitting, draft.editingPromoId, draft.clonedFromId)

  let content: React.ReactNode
  switch (view.name) {
    case 'dashboard':
      content = <Dashboard onCreate={startNewPromo} onOpen={openPromo} />
      break
    case 'list': // My Promos — reuse the dashboard list
      content = <Dashboard onCreate={startNewPromo} onOpen={openPromo} />
      break
    case 'wizard':
      content = <CreateWizard step={view.step} />
      break
    case 'approver':
      content = <ApproverDecision promoId={view.promoId} presetAction={view.presetAction} />
      break
    case 'email-preview':
      content = <EmailDecisionView promoId={view.promoId} />
      break
    case 'inbox':
      content = <Inbox role={role} tab={view.tab} />
      break
    case 'existing-promos':
      content = <ExistingPromos initialTab={view.tab} />
      break
    case 'edit-promo':
      content = <EditPromoView promoId={view.promoId} />
      break
    case 'admin-promo':
      content = <AdminPromoView promoId={view.promoId} />
      break
    case 'query-update':
      content = <QueryUpdateView />
      break
    case 'masters':
      content = <MastersHome />
      break
    case 'master-detail':
      content = <MasterDetail masterKey={view.masterKey} />
      break
    case 'audit':
      content = <AuditLog />
      break
    case 'promo-history':
      content = <AdminPromoView promoId={view.promoId} />
      break
    case 'reports':
      content = <ReportsHome />
      break
    case 'report':
      content = <ReportView reportId={view.reportId} />
      break
    case 'placeholder':
      content = <Placeholder title={view.title} />
      break
  }

  return (
    <AppShell active={active} onNavigate={onNavigate} breadcrumb={breadcrumb}>
      {content}
    </AppShell>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Workspace />
    </AppProvider>
  )
}
