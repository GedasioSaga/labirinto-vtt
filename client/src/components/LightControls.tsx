/** Ficha da cena que pode carregar a luz (tocha presa na ficha). */
export interface LightCarrierOption {
  id: string
  name: string
}

export interface LightControlsProps {
  color: string
  onColorChange: (color: string) => void
  intensity: number
  onIntensityChange: (intensity: number) => void
  /** Fichas da cena, na ordem do mapa. */
  tokens: LightCarrierOption[]
  /** Ficha que carrega esta luz; `null` = solta. */
  attachedTokenId: string | null
  onAttach: (tokenId: string) => void
  onDetach: () => void
}

const FICHA_SEM_NOME = 'Ficha sem nome'

/**
 * Cor e intensidade da Luz selecionada. O raio não tem campo aqui de
 * propósito — é editado arrastando a alça desenhada em `drawEditHandles.ts`
 * diretamente sobre o círculo da luz no canvas, mesmo padrão de "editar no
 * lugar" usado por vértice de Parede/Região/Curva.
 *
 * "Prender na ficha" faz da luz uma tocha: a ficha escolhida a carrega, com o
 * afastamento que ela tinha, quando o mestre ou o jogador a movem.
 */
export function LightControls({
  color,
  onColorChange,
  intensity,
  onIntensityChange,
  tokens,
  attachedTokenId,
  onAttach,
  onDetach,
}: LightControlsProps) {
  // Vínculo com ficha que não está mais na cena conta como solta.
  const carrier = attachedTokenId === null ? undefined : tokens.find((t) => t.id === attachedTokenId)
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Luz</h2>
      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-light-color">
          Cor
        </label>
        <input
          id="lb-light-color"
          className="lb-swatch"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-light-intensity">
            Intensidade
          </label>
          <span className="lb-num">{Math.round(intensity * 100)}%</span>
        </div>
        <input
          id="lb-light-intensity"
          className="lb-range"
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={intensity}
          onChange={(event) => onIntensityChange(Number(event.target.value))}
        />
      </div>
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-light-carrier">
          Prender na ficha
        </label>
        <select
          id="lb-light-carrier"
          className="lb-input"
          value={carrier?.id ?? ''}
          disabled={tokens.length === 0 && carrier === undefined}
          onChange={(event) => {
            const tokenId = event.target.value
            if (tokenId === '') onDetach()
            else onAttach(tokenId)
          }}
        >
          <option value="">{tokens.length === 0 ? 'Nenhuma ficha na cena' : 'Nenhuma (luz parada)'}</option>
          {tokens.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name.trim() === '' ? FICHA_SEM_NOME : t.name}
            </option>
          ))}
        </select>
        {carrier !== undefined && (
          <div className="lb-section__row">
            <span className="lb-label">Vai junto com {carrier.name.trim() === '' ? FICHA_SEM_NOME : carrier.name}</span>
            <button type="button" className="lb-btn lb-btn--ghost" onClick={onDetach}>
              Soltar
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
