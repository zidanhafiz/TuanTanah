import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: ReactNode
}

/**
 * Brutalist segmented control: a framed strip of tabs where the active one is
 * raised with an accent fill and hard shadow. Controlled — the parent owns the
 * `active` id and updates it from `onChange`.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div
      className={`flex gap-1 rounded-xl border-2 border-ink bg-surface-sunken p-1 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              isActive
                ? 'border-2 border-ink bg-accent text-ink shadow-brutal-sm'
                : 'border-2 border-transparent text-ink-muted hover:bg-surface'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
