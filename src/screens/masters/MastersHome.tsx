import { useApp } from '../../store/AppContext'
import type { MasterKey } from '../../data/types'

interface MasterCard {
  key: MasterKey
  name: string
  description: string
}

const GROUPS: { title: string; cards: MasterCard[] }[] = [
  {
    title: 'Profitability Engine',
    cards: [
      { key: 'profComponents', name: 'Profitability Component Master', description: 'Income & expense components that feed the margin engine' },
      { key: 'profValues', name: 'Profitability Value Master', description: 'CoF, Opex, NCL, and benchmark values — PAN-India or state-wise' },
    ],
  },
  {
    title: 'Charges',
    cards: [
      { key: 'chargeSchedules', name: 'Schedule of Charges', description: 'Permitted charge types and value bands — synced with Finnone' },
    ],
  },
  {
    title: 'Geography & Brand',
    cards: [
      { key: 'states', name: 'State Master', description: 'States and their zone mapping' },
      { key: 'cities', name: 'City Master', description: 'Cities linked to states' },
      { key: 'manufacturers', name: 'Manufacturer Master', description: 'OEM brands supported by the tool' },
      { key: 'makes', name: 'Make Master', description: 'Make lines linked to manufacturers' },
      { key: 'models', name: 'Model Master', description: 'Models linked to makes and manufacturers' },
      { key: 'salesPoints', name: 'Sales Point Master', description: 'Dealer outlets — city, manufacturers, and dealer type' },
    ],
  },
  {
    title: 'Approval & Access',
    cards: [
      { key: 'approvalMatrix', name: 'Approval Matrix Master', description: 'State-wise normal and breach approver routing' },
      { key: 'users', name: 'User / Role Master', description: 'All users, their roles, and geographic access scope' },
    ],
  },
  {
    title: 'Configuration',
    cards: [
      { key: 'reasonCodes', name: 'Reason Code Master', description: 'Pre-defined reasons for Reject, Rework, Deactivate, and Demap' },
    ],
  },
]

export function MastersHome() {
  const { navigate, masters } = useApp()

  function countActive(key: MasterKey) {
    const entries = masters[key] as Array<{ status: string }>
    return entries.filter(e => e.status === 'Active').length
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Masters</h1>
        <p className="mt-1 text-sm text-muted">Manage all reference data that powers the promo engine.</p>
      </div>

      {GROUPS.map(group => (
        <section key={group.title}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            {group.title}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.cards.map(card => {
              const active = countActive(card.key)
              const total = (masters[card.key] as Array<unknown>).length
              return (
                <button
                  key={card.key}
                  onClick={() => navigate({ name: 'master-detail', masterKey: card.key })}
                  className="group flex items-start justify-between rounded-card border border-border bg-surface p-4 text-left transition hover:border-brand/30 hover:shadow-soft"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-ink group-hover:text-brand transition-colors">
                      {card.name}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{card.description}</div>
                    <div className="mt-2 text-xs text-muted">
                      <span className="font-medium text-success">{active} active</span>
                      {total - active > 0 && (
                        <span className="ml-2 text-muted">· {total - active} inactive</span>
                      )}
                    </div>
                  </div>
                  <svg
                    className="ml-3 mt-0.5 shrink-0 text-muted transition group-hover:text-brand"
                    width={16} height={16} viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth={1.8}
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
