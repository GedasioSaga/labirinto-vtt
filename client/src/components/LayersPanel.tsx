import type { ReactNode } from 'react'
import type { LayerId } from '../types/map'
import { LAYER_IDS } from '../types/map'
import { LAYER_LABELS } from '../lib/layers'
import { EyeIcon, EyeOffIcon, LockIcon, UnlockIcon } from './icons'

export interface LayersPanelProps {
  hiddenLayers: LayerId[]
  /** Onda 4, Frente D — "travar camada inteira" (mesma forma de
   *  hiddenLayers, por pedido do integrador). Item numa camada listada aqui
   *  continua visível (independente de hiddenLayers) mas não pode ser
   *  selecionado nem movido — ver lib/layers.ts:isLayerLocked/canInteractInLayer. */
  lockedLayers: LayerId[]
  /** Uma entrada por LayerId — ver countEntitiesByLayer em lib/layers.ts.
   *  Puramente informativo (mostrado ao lado do nome); não afeta o toggle. */
  counts: Record<LayerId, number>
  onToggleLayer: (id: LayerId) => void
  onToggleLock: (id: LayerId) => void
  /** Linha de acesso rápido acima da lista (hoje: Mostrar grade / Grudar). */
  quickToggles?: ReactNode
}

/**
 * Lista compacta das 9 camadas: uma linha por camada com nome, contagem e dois
 * botões de ícone. Os dois usam `aria-pressed` para o estado FORA do padrão
 * (oculta / travada), assim o destaque visual de `lb-iconbtn[aria-pressed]`
 * só aparece no que o usuário mexeu; o nome acessível descreve a ação do
 * próximo clique ("Ocultar Paredes" ↔ "Mostrar Paredes").
 *
 * Só apresentação: quem decide o que é camada oculta/travada é MapData (via
 * mapStore); este componente lê e emite o pedido. O título e o abre/fecha
 * ficam com quem envolve (`CollapsibleSection` em PropertiesPanel).
 */
export function LayersPanel({ hiddenLayers, lockedLayers, counts, onToggleLayer, onToggleLock, quickToggles }: LayersPanelProps) {
  return (
    <>
      {quickToggles}
      <ul className="lb-layers" aria-label="Camadas do mapa">
        {LAYER_IDS.map((id) => {
          const label = LAYER_LABELS[id]
          const hidden = hiddenLayers.includes(id)
          const locked = lockedLayers.includes(id)
          return (
            <li key={id} className="lb-layers__row" data-hidden={hidden || undefined}>
              <span className="lb-layers__name">{label}</span>
              <span className="lb-num lb-layers__count">{counts[id]}</span>
              <button
                type="button"
                className="lb-iconbtn lb-iconbtn--sm"
                aria-pressed={hidden}
                aria-label={hidden ? `Mostrar ${label}` : `Ocultar ${label}`}
                title={hidden ? `Mostrar ${label}` : `Ocultar ${label}`}
                onClick={() => onToggleLayer(id)}
              >
                {hidden ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
              <button
                type="button"
                className="lb-iconbtn lb-iconbtn--sm"
                aria-pressed={locked}
                aria-label={locked ? `Destravar ${label}` : `Travar ${label}`}
                title={locked ? `Destravar ${label}` : `Travar ${label}`}
                onClick={() => onToggleLock(id)}
              >
                {locked ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
