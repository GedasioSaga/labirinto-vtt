import { useRef, type KeyboardEvent } from 'react'
import { sortFloorLabels } from '../lib/buildingFloors'
import type { PlayerFloorMemory, PlayerFloors } from './playerConnection'

interface PlayerFloorTabsProps {
  andares: PlayerFloors
  /** Rótulo da aba escolhida; o do andar atual = o mapa ao vivo. */
  selected: string
  onSelect: (rotulo: string) => void
}

/**
 * MAPA POR ANDARES — o que a tela do jogador desenha para `selected`: a
 * memória de OUTRO andar conhecido, ou `null` para o mapa ao vivo (a aba do
 * andar dele, ou uma aba que sumiu porque ele mudou de prédio).
 */
export function floorShown(andares: PlayerFloors | undefined, selected: string): PlayerFloorMemory | null {
  if (andares === undefined || selected === andares.atual) return null
  return andares.outros.find((o) => o.rotulo === selected) ?? null
}

/** Setas andam uma aba (com volta nas pontas); Home e End vão às pontas. `null` = tecla que não é das abas. */
function nextIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count
    case 'ArrowLeft':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/**
 * Abas dos andares do prédio (1F, 2F, B1), do subsolo ao alto — só os
 * rótulos que o mestre deixou o jogador conhecer. A fileira é UMA parada do
 * Tab (só a escolhida tem `tabIndex` 0); as setas trocam de aba na hora e
 * levam o foco junto. O painel é o próprio mapa atrás.
 */
export function PlayerFloorTabs({ andares, selected, onSelect }: PlayerFloorTabsProps) {
  const labels = sortFloorLabels([andares.atual, ...andares.outros.map((o) => o.rotulo)])
  const active = labels.includes(selected) ? selected : andares.atual
  const tabs = useRef(new Map<string, HTMLButtonElement>())

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextIndex(event.key, index, labels.length)
    if (next === null) return
    event.preventDefault()
    const label = labels[next]
    if (label === undefined) return
    onSelect(label)
    tabs.current.get(label)?.focus()
  }

  return (
    <div className="pp-floors">
      <div className="pp-floors__list" role="tablist" aria-label="Andares do prédio">
        {labels.map((label, index) => {
          const here = label === andares.atual
          return (
            <button
              key={label}
              ref={(el) => {
                if (el === null) tabs.current.delete(label)
                else tabs.current.set(label, el)
              }}
              type="button"
              role="tab"
              className={here ? 'pp-floors__tab pp-floors__tab--here' : 'pp-floors__tab'}
              aria-selected={label === active}
              aria-label={here ? `${label}, você está aqui` : label}
              tabIndex={label === active ? 0 : -1}
              onClick={() => onSelect(label)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {label}
            </button>
          )
        })}
      </div>
      {/* Olhando outro andar, a tela não tem ficha nem visão: diz por quê. */}
      <p className="pp-floors__hint" role="status" aria-live="polite">
        {active === andares.atual ? '' : `${active} como você lembra`}
      </p>
    </div>
  )
}
