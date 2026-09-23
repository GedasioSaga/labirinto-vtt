import type { Prop } from '../types/map'
import { LAYER_LABELS, PROP_LAYER_OPTIONS, propLayer } from '../lib/layers'

export interface PropLayerControlsProps {
  prop: Prop
  onSetPropLayer: (id: string, layer: Prop['layer']) => void
}

/**
 * Seletor "Objetos | Decoração" do Prop selecionado (mapStore.setPropLayer).
 * Saiu da seção Camadas e mora junto dos controles do objeto: é propriedade
 * DESTE item, não do mapa. Prop é o único tipo com override de camada
 * (Prop.layer, types/map.ts), por isso não existe para outros `kind`.
 */
export function PropLayerControls({ prop, onSetPropLayer }: PropLayerControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Camada do objeto selecionado</h2>
      <div className="lb-field">
        <div className="lb-seg" role="radiogroup" aria-label="Camada do objeto selecionado">
          {PROP_LAYER_OPTIONS.map((option) => {
            const active = propLayer(prop) === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                className="lb-seg__option"
                disabled={active}
                onClick={() => onSetPropLayer(prop.id, option)}
              >
                {LAYER_LABELS[option]}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
