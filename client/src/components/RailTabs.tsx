import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type RailTab = 'map' | 'room'

export interface RailTabsProps {
  active: RailTab
  onChange(tab: RailTab): void
  mapPanel: ReactNode
  roomPanel: ReactNode
}

const TABS: { id: RailTab; label: string }[] = [
  { id: 'map', label: 'Mapa' },
  { id: 'room', label: 'Sala' },
]

const tabId = (tab: RailTab) => `lb-rail-tab-${tab}`
const panelId = (tab: RailTab) => `lb-rail-panel-${tab}`

/**
 * Abas "Mapa | Sala" do rail. Os dois painéis ficam montados (o inativo com
 * `hidden`) para o inspetor não perder estado interno ao trocar de aba.
 */
export function RailTabs({ active, onChange, mapPanel, roomPanel }: RailTabsProps) {
  const buttons = useRef<Partial<Record<RailTab, HTMLButtonElement | null>>>({})

  const select = (tab: RailTab) => {
    onChange(tab)
    buttons.current[tab]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((tab) => tab.id === active)
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (offset === 0 || index < 0) return
    event.preventDefault()
    select(TABS[(index + offset + TABS.length) % TABS.length].id)
  }

  return (
    <>
      <div className="lb-panel lb-railtabs" role="tablist" aria-label="Painel lateral" onKeyDown={onKeyDown}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              buttons.current[tab.id] = el
            }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            className="lb-railtabs__tab"
            aria-selected={active === tab.id}
            aria-controls={panelId(tab.id)}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId('map')} aria-labelledby={tabId('map')} className="lb-railtabs__panel" hidden={active !== 'map'}>
        {mapPanel}
      </div>
      <div role="tabpanel" id={panelId('room')} aria-labelledby={tabId('room')} className="lb-railtabs__panel lb-railtabs__panel--fill" hidden={active !== 'room'}>
        {roomPanel}
      </div>
    </>
  )
}
