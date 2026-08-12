import { useApp } from '../../store/AppContext'
import {
  IconDashboard,
  IconPlus,
  IconInbox,
  IconList,
  IconEdit,
  IconReports,
  IconFilter,
  IconDatabase,
  IconAudit,
} from '../ui/icons'
import type { ComponentType, SVGProps } from 'react'

type NavItem = { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }

const MAKER_NAV: NavItem[] = [
  { label: 'Dashboard', icon: IconDashboard },
  { label: 'Create New Promo', icon: IconPlus },
  { label: 'Inbox', icon: IconInbox },
  { label: 'Existing Promos', icon: IconEdit },
  { label: 'My Promos', icon: IconList },
  { label: 'Reports', icon: IconReports },
]

const CHECKER_NAV: NavItem[] = [
  { label: 'Dashboard', icon: IconDashboard },
  { label: 'Inbox', icon: IconInbox },
  { label: 'Reports', icon: IconReports },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: IconDashboard },
  { label: 'Existing Promos', icon: IconEdit },
  { label: 'Query Update', icon: IconFilter },
  { label: 'Masters', icon: IconDatabase },
  { label: 'Audit', icon: IconAudit },
  { label: 'Reports', icon: IconReports },
]

export function Sidebar({
  active,
  onNavigate,
}: {
  active: string
  onNavigate: (label: string) => void
}) {
  const { role, user } = useApp()
  const nav = role === 'admin' ? ADMIN_NAV : role === 'maker' ? MAKER_NAV : CHECKER_NAV
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[248px] flex-col bg-sidebar text-[#E9E3D7]">
      {/* Logo block */}
      <div className="px-6 pb-6 pt-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-serif text-lg leading-none text-white">
            F
          </div>
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#8B8174]">TW Lending</div>
          </div>
        </div>
      </div>

      {/* User block */}
      <div className="mx-4 mb-4 flex items-center gap-3 rounded-card bg-white/[0.04] px-3 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
          {initials}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium text-white">{user.name}</div>
          <div className="truncate text-[11px] text-[#9A9082]">{user.role}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const isActive = item.label === active
          const Icon = item.icon
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.label)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-white/[0.07] font-medium text-white'
                  : 'text-[#A79C8C] hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Icon
                className={isActive ? 'text-brand' : 'text-[#7C7264] group-hover:text-[#A79C8C]'}
                width={18}
                height={18}
              />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="px-6 py-4 text-[11px] text-[#6A6155]">Promo Code Tool · MVP</div>
    </aside>
  )
}
