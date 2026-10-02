export type AppTab = 'today' | 'history' | 'analytics' | 'settings'

interface BottomNavigationProps {
  readonly activeTab: AppTab
  readonly onChange: (tab: AppTab) => void
}

const items: readonly { id: AppTab; label: string; path: string }[] = [
  { id: 'today', label: 'Bugün', path: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8' },
  { id: 'history', label: 'Geçmiş', path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2' },
  { id: 'analytics', label: 'Analiz', path: 'M4 3v17h17M8 16v-4M13 16V8M18 16V5' },
  { id: 'settings', label: 'Ayarlar', path: 'M4 7h16M4 17h16M8 4v6M16 14v6' },
]

export function BottomNavigation({ activeTab, onChange }: BottomNavigationProps) {
  return (
    <nav className="bottom-navigation" aria-label="Ana navigasyon">
      {items.map((item) => (
        <button
          className={activeTab === item.id ? 'active' : ''}
          type="button"
          key={item.id}
          aria-current={activeTab === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          <svg className="nav-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d={item.path} />
          </svg>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
