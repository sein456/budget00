export type AppTab = 'today' | 'history' | 'analytics' | 'settings'

interface BottomNavigationProps {
  readonly activeTab: AppTab
  readonly onChange: (tab: AppTab) => void
}

const items: readonly { id: AppTab; label: string; icon: string }[] = [
  { id: 'today', label: 'Bugün', icon: '⌂' },
  { id: 'history', label: 'Geçmiş', icon: '◷' },
  { id: 'analytics', label: 'Analiz', icon: '⌁' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙︎' },
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
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
