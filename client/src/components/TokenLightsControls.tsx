import type { LightOnToken } from '../lib/selectionHitTest'

export interface TokenLightsControlsProps {
  /** Luzes presas na ficha selecionada ou com o centro sob ela (`lightsOnToken`). */
  lights: LightOnToken[]
  /** Seleciona a luz: o painel passa a mostrar Cor, Intensidade, "Prender na ficha" e a alça de raio. */
  onSelectLight: (lightId: string) => void
  onDetach: (lightId: string) => void
}

/**
 * A tocha presa fica no centro da ficha, e no mapa o clique nesse ponto
 * sempre pega a ficha. Este bloco, no painel da ficha, é o caminho de volta
 * para a luz: "Soltar a luz" direto, ou "Ajustar a luz" para abrir o painel
 * dela. Sem luz na ficha, não aparece.
 */
export function TokenLightsControls({ lights, onSelectLight, onDetach }: TokenLightsControlsProps) {
  if (lights.length === 0) return null
  // Com mais de uma luz, o número separa os botões para o leitor de tela.
  const suffix = (index: number): string => (lights.length > 1 ? ` ${index + 1}` : '')
  return (
    <div className="lb-field">
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
    </div>
  )
}
