import { useApp } from '../../store/AppContext'
import { REPORT_CONFIGS, COMING_SOON } from './reportConfigs'

type Theme = 'Promos' | 'Profitability' | 'Approval' | 'Governance'

const THEME_ORDER: Theme[] = ['Promos', 'Profitability', 'Approval', 'Governance']

const THEME_DESCRIPTIONS: Record<Theme, string> = {
  Promos:        'Promo inventory, coverage, and lifecycle reports',
  Profitability: 'Margin analysis and benchmark tracking',
  Approval:      'Workflow status and SLA monitoring',
  Governance:    'Audit, deactivation, and bulk-change history',
}

const MVP_LABEL: Record<2 | 3, string> = {
  2: 'MVP 2',
  3: 'MVP 3 · Finnone',
}

export function ReportsHome() {
  const { navigate } = useApp()

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Reports</h1>
        <p className="mt-1 text-sm text-muted">
          Filterable, exportable views of promo data — one layout to learn, ten questions answered.
        </p>
      </div>

      {THEME_ORDER.map(theme => {
        const live    = REPORT_CONFIGS.filter(r => r.theme === theme)
        const pending = COMING_SOON.filter(r => r.theme === theme)
        if (!live.length && !pending.length) return null

        return (
          <section key={theme}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{theme}</h2>
              <span className="text-xs text-muted/60">{THEME_DESCRIPTIONS[theme]}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Live reports */}
              {live.map(cfg => (
                <button
                  key={cfg.id}
                  onClick={() => navigate({ name: 'report', reportId: cfg.id })}
                  className="group flex flex-col rounded-card border border-border bg-surface p-5 text-left transition hover:border-brand/30 hover:shadow-soft"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-ink transition group-hover:text-brand">
                      {cfg.name}
                    </span>
                    <svg className="mt-0.5 shrink-0 text-muted transition group-hover:text-brand" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                  <p className="mt-1 text-sm text-muted">{cfg.question}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full bg-[#EAF6EE] px-2 py-0.5 text-[10px] font-semibold text-[#1A7A3E]">
                      Available
                    </span>
                    <span className="text-[11px] text-muted">
                      CSV · Excel · Sortable
                    </span>
                  </div>
                </button>
              ))}

              {/* Coming-soon reports */}
              {pending.map(r => (
                <div
                  key={r.id}
                  className="flex flex-col rounded-card border border-border/60 bg-surface/60 p-5 opacity-60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="shrink-0 rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-semibold text-muted">
                      {MVP_LABEL[r.mvp]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.question}</p>
                  <div className="mt-3">
                    <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[10px] font-semibold text-muted">
                      Coming soon
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
