import type { LightOnToken } from '../lib/selectionHitTest'
import type { CarriedItem } from '../types/map'

export interface TokenLightsControlsProps {
  /** Luzes presas na ficha selecionada ou com o centro sob ela (`lightsOnToken`). */
  lights: LightOnToken[]
  /** Seleciona a luz: o painel passa a mostrar Cor, Intensidade, "Prender na ficha" e a alça de raio. */
  onSelectLight: (lightId: string) => void
  onDetach: (lightId: string) => void
  /**
   * ITEM QUE ILUMINA: as vagas da mochila da ficha cujo item ilumina (`luz`),
   * acesas ou não. É o lugar do mestre para o NPC sem ficha de personagem: a
   * ficha do personagem já tem o "Acender" dela. Ausente = nenhuma.
   */
  itensQueIluminam?: readonly CarriedItem[]
  /** "Acender"/"Apagar" a vaga `itemId`. Ausente = a lista não aparece. */
  onAcenderItem?: (itemId: string, acesa: boolean) => void
}

/**
 * A tocha presa fica no centro da ficha, e no mapa o clique nesse ponto
 * sempre pega a ficha. Este bloco, no painel da ficha, é o caminho de volta
 * para a luz: "Soltar a luz" direto, ou "Ajustar a luz" para abrir o painel
 * dela. Embaixo, os itens da mochila que iluminam, com "Acender"/"Apagar".
 * Sem luz nem item que ilumina, não aparece.
 *
 * Seção própria, o último dos opcionais de comportamento da ficha (peça
 * ficha-em-ordem-de-tarefa), dentro do grupo "Comportamento" (peça
 * ux-ficha-grupos): o respiro e a divisória são do grupo, como os das outras
 * linhas.
 */
export function TokenLightsControls({ lights, onSelectLight, onDetach, itensQueIluminam = [], onAcenderItem }: TokenLightsControlsProps) {
  const itens = onAcenderItem === undefined ? [] : itensQueIluminam
  if (lights.length === 0 && itens.length === 0) return null
  // Com mais de uma luz, o número separa os botões para o leitor de tela.
  const suffix = (index: number): string => (lights.length > 1 ? ` ${index + 1}` : '')
  return (
    <>
      {lights.length > 0 && (
        <section className="lb-section">
          <span className="lb-label">{lights.length > 1 ? 'Luzes nesta ficha' : 'Luz nesta ficha'}</span>
          {lights.map((light, index) => (
            <div key={light.id} className="lb-section__row">
              <span className="lb-label">{light.attached ? 'Presa, vai junto' : 'Solta, embaixo da ficha'}</span>
              <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onSelectLight(light.id)}>
                {`Ajustar a luz${suffix(index)}`}
              </button>
              {light.attached && (
                <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onDetach(light.id)}>
                  {`Soltar a luz${suffix(index)}`}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {onAcenderItem !== undefined && itens.length > 0 && (
        <section className="lb-section">
          <span className="lb-label">{itens.length > 1 ? 'Itens que iluminam' : 'Item que ilumina'}</span>
          {itens.map((item) => {
            const acesa = item.acesa === true
            return (
              <div key={item.id} className="lb-section__row">
                <span className="lb-label">{acesa ? `${item.nome}, aceso` : item.nome}</span>
                <button
                  type="button"
                  className="lb-btn lb-btn--ghost"
                  aria-label={`${acesa ? 'Apagar' : 'Acender'}: ${item.nome}`}
                  aria-pressed={acesa}
                  onClick={() => onAcenderItem(item.id, !acesa)}
                >
                  {acesa ? 'Apagar' : 'Acender'}
                </button>
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}
