import { Fragment } from 'react'
import type { LayerId, Prop } from '../types/map'
import { LAYER_IDS } from '../types/map'
import { LAYER_LABELS, PROP_LAYER_OPTIONS, propLayer } from '../lib/layers'
import { Toggle } from './Toggle'

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
  /** Prop atualmente selecionado (mesmo contrato de
   *  PropertiesPanelProps.selectedProp) — habilita o seletor "camada deste
   *  objeto" abaixo da lista. `null` quando a seleção não é um Prop: Prop é o
   *  ÚNICO tipo com override de camada (ver Prop.layer, types/map.ts), então
   *  o seletor não faz sentido pra nenhum outro `kind`. */
  selectedProp: Prop | null
  onSetPropLayer: (id: string, layer: Prop['layer']) => void
}

/**
 * Lista as 9 camadas do mapa com um interruptor de visibilidade e um de
 * trava cada, mais — quando a seleção atual é um Prop — o seletor "Objetos |
 * Decoração" que expõe mapStore.setPropLayer (capacidade que existe desde a
 * Fase 1 e nunca teve caminho de UI). Puramente apresentação: quem decide o
 * que é "camada oculta"/"camada travada"/"camada do Prop" é MapData (via
 * mapStore); este componente só lê e emite o pedido.
 */
export function LayersPanel({
  hiddenLayers,
  lockedLayers,
  counts,
  onToggleLayer,
  onToggleLock,
  selectedProp,
  onSetPropLayer,
}: LayersPanelProps) {
  return (
    <>
      <section className="lb-section">
        <h2 className="lb-eyebrow">Camadas</h2>
        {LAYER_IDS.map((id) => (
          <Fragment key={id}>
            <Toggle
              label={`${LAYER_LABELS[id]} (${counts[id]})`}
              checked={!hiddenLayers.includes(id)}
              onChange={() => onToggleLayer(id)}
            />
            <Toggle
              label={`Travar ${LAYER_LABELS[id]}`}
              checked={lockedLayers.includes(id)}
              onChange={() => onToggleLock(id)}
            />
          </Fragment>
        ))}
      </section>
      {selectedProp && (
        <section className="lb-section">
          <h2 className="lb-eyebrow">Camada do objeto selecionado</h2>
          <div className="lb-field">
            <div className="lb-seg" role="radiogroup" aria-label="Camada do objeto selecionado">
              {PROP_LAYER_OPTIONS.map((option) => {
                const active = propLayer(selectedProp) === option
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className="lb-seg__option"
                    disabled={active}
                    onClick={() => onSetPropLayer(selectedProp.id, option)}
                  >
                    {LAYER_LABELS[option]}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
