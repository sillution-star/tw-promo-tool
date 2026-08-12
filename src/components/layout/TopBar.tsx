import { useApp } from '../../store/AppContext'
import { IconSearch, IconBell, IconChevronDown } from '../ui/icons'

function RoleSwitcher() {
  const { role, setRole } = useApp()
  return (
    <div className="flex items-center rounded-full border border-border bg-cream p-0.5">
      {(['maker', 'checker', 'admin'] as const).map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
            role === r ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

export function TopBar({ breadcrumb }: { breadcrumb: string[] }) {
  const { user } = useApp()
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  return (
    <header className="sticky top-0 z-10 flex h-[60px] items-center justify-between border-b border-border bg-cream/85 px-8 backdrop-blur">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        {breadcrumb.map((crumb, i) => {
          const last = i === breadcrumb.length - 1
          return (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-[#C7BFAE]">›</span>}
              <span className={last ? 'font-medium text-ink' : 'text-muted'}>{crumb}</span>
            </span>
          )
        })}
      </nav>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <IconSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            width={16}
            height={16}
          />
          <input
            placeholder="Search"
            className="w-56 rounded-input border border-border bg-surface py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          />
        </div>

        <RoleSwitcher />

        <button className="relative rounded-full p-2 text-muted transition-colors hover:bg-black/[0.04] hover:text-ink">
          <IconBell width={18} height={18} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
        </button>

        <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-black/[0.04]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
            {initials}
          </span>
          <IconChevronDown className="text-muted" width={14} height={14} />
        </button>
      </div>
    </header>
  )
}
