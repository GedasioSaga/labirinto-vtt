import { useId } from 'react'

/** Um personagem da aventura, como o seletor do token o mostra. */
export interface PersonagemParaToken {
  id: string
  nome: string
}

export interface TokenPersonagemControlsProps {
  /** `Token.characterId`: o personagem ligado, ou `null`. */
  characterId: string | null
  personagens: readonly PersonagemParaToken[]
  /** `null` desliga. */
  onLigar: (personagemId: string | null) => void
  onAbrirFicha: (personagemId: string) => void
}

/**
 * "Personagem" do token: liga o token do mapa ao personagem da aventura
 * (`Token.characterId`) e abre a ficha dele. Id que não está mais na
 * aventura (personagem apagado) aparece como "sem personagem", com o aviso.
 */
export function TokenPersonagemControls({ characterId, personagens, onLigar, onAbrirFicha }: TokenPersonagemControlsProps) {
  const campoId = useId()
  const avisoId = useId()
  const ligado = characterId === null ? undefined : personagens.find((personagem) => personagem.id === characterId)
  const orfao = characterId !== null && ligado === undefined
  return (
    <section className="lb-section lb-token-personagem">
      <div className="lb-field">
        <label className="lb-label" htmlFor={campoId}>
          Personagem
        </label>
        <span className="lb-token-personagem__linha">
          <select
            id={campoId}
            className="lb-input"
            value={ligado?.id ?? ''}
            aria-describedby={orfao ? avisoId : undefined}
            onChange={(event) => onLigar(event.target.value === '' ? null : event.target.value)}
          >
            <option value="">— sem personagem</option>
            {personagens.map((personagem) => (
              <option key={personagem.id} value={personagem.id}>
                {personagem.nome}
              </option>
            ))}
          </select>
          {ligado !== undefined && (
            <button type="button" className="lb-btn lb-btn--compact" onClick={() => onAbrirFicha(ligado.id)}>
              Abrir ficha
            </button>
          )}
        </span>
      </div>
      {orfao && (
        <p id={avisoId} className="lb-field__hint">
          O personagem ligado a este token foi apagado da aventura.
        </p>
      )}
    </section>
  )
}
