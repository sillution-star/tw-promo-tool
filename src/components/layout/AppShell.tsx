import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell({
  active,
  onNavigate,
  breadcrumb,
  children,
}: {
  active: string
  onNavigate: (label: string) => void
  breadcrumb: string[]
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-cream">
      <Sidebar active={active} onNavigate={onNavigate} />
      <div className="pl-[248px]">
        <TopBar breadcrumb={breadcrumb} />
        <main className="px-8 py-7">{children}</main>
      </div>
    </div>
  )
}
