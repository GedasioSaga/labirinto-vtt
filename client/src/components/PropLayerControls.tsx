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
 *
 * Mora na ficha "No mapa" do objeto (fatia 16a), que já tem título: o bloco
 * trocou o dele pelo rótulo curto "Camada", e o grupo segue com o nome
 * inteiro para o leitor de tela.
 */
export function PropLayerControls({ prop, onSetPropLayer }: PropLayerControlsProps) {
  return (
    <section className="lb-section">
      <div className="lb-field">
        <span className="lb-label">Camada</span>
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
