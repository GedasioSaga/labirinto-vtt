import { useId } from 'react'
import { Toggle } from './Toggle'

/** Um jogador da sala na lista "Quem vê". `color` = cor da ficha dele; `null` = sem ficha. */
export interface PinAudienceChoice {
  playerId: string
  name: string
  color: string | null
}

export interface PinAudienceControlsProps {
  /** Jogadores da sala, na ordem do painel Grupo. */
  players: PinAudienceChoice[]
  /** Quem vê agora; `null` = Todos. */
  chosen: readonly string[] | null
  /** `null` = Todos; lista (mesmo vazia) = "Só estes". Quem aplica é a sessão do host. */
  onChange: (chosen: string[] | null) => void
}

export interface RevealToControlsProps {
  /** Jogadores da sala, na ordem do painel Grupo. */
  players: PinAudienceChoice[]
  /** A quem o item já foi revelado; vazio = segredo de todos. */
  chosen: readonly string[]
  /** Lista nova, na ordem de `players`. Quem aplica é a sessão do host. */
  onChange: (chosen: string[]) => void
}

export interface PlayerSecretControlsProps {
  secret: boolean
  onSecretChange: (secret: boolean) => void
  /**
   * Só do PINO, e só com a sala aberta: "Quem vê: Todos | Só estes". Ausente
   * ou `null` = sem lista a oferecer (outro item, ou não há jogador na mesa).
   */
  audience?: PinAudienceControlsProps | null
  /**
   * Só da ESCADA, e só com a sala aberta: "Revelar para…" quem descobriu.
   * Aparece com o "Oculto para jogadores" ligado — sem ele todos já veem.
   */
  reveal?: RevealToControlsProps | null
}

/**
 * "Oculto para jogadores" (A5) de Região, Escada, Desenho e Pino — Token e
 * Objeto têm o mesmo toggle dentro de `ItemTransformControls`. Diferente de
 * "Oculto no editor": o item continua no editor, só não sai para o jogador.
 *
 * No pino, com a sala aberta, vem junto o "Quem vê": o oculto é tudo ou nada,
 * a lista escolhe quem recebe. Com o oculto ligado a lista some — ninguém
 * recebe de qualquer jeito, e mostrar as caixas marcadas diria o contrário.
 */
export function PlayerSecretControls({ secret, onSecretChange, audience = null, reveal = null }: PlayerSecretControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Jogadores</h2>
      <Toggle label="Oculto para jogadores" checked={secret} onChange={onSecretChange} />
      {audience !== null && !secret && <PinAudienceControls {...audience} />}
      {reveal !== null && secret && <RevealToControls {...reveal} />}
    </section>
  )
}

/**
 * "Revelar para…" da ficha secreta, da escada secreta e da zona oculta: uma
 * caixa por jogador. Marcado = descobriu, e só ele recebe o item (a ficha
 * ainda exige visão). Desmarcar tira no próximo pacote.
 */
export function RevealToControls({ players, chosen, onChange }: RevealToControlsProps) {
  const hintId = useId()
  const chosenSet = new Set(chosen)

  const toggle = (playerId: string, checked: boolean) => {
    const next = new Set(chosenSet)
    if (checked) next.add(playerId)
    else next.delete(playerId)
    // Na ordem da lista, não na ordem dos cliques: a mesma que a sessão devolve.
    onChange(players.filter((p) => next.has(p.playerId)).map((p) => p.playerId))
  }

  if (players.length === 0) return <span className="lb-label">Nenhum jogador na sala.</span>
  return (
    <>
      <span className="lb-label">Revelar para…</span>
      <ul className="lb-gather__list" aria-label="Revelar para" aria-describedby={chosenSet.size === 0 ? hintId : undefined}>
        {players.map((player) => (
          <li key={player.playerId}>
            <label className="lb-gather__item">
              <input
                type="checkbox"
                className="lb-gather__check"
                checked={chosenSet.has(player.playerId)}
                onChange={(event) => toggle(player.playerId, event.target.checked)}
              />
              {/* Mesma bolinha do painel Grupo; jogador sem ficha fica com o aro vazio. */}
              <span className="lb-party__dot" style={player.color === null ? undefined : { background: player.color }} aria-hidden="true" />
              <span className="lb-party__name">{player.name}</span>
            </label>
          </li>
        ))}
      </ul>
      {chosenSet.size === 0 && (
        <span className="lb-label" id={hintId}>
          Ninguém descobriu. Marque quem vê.
        </span>
      )}
    </>
  )
}

function PinAudienceControls({ players, chosen, onChange }: PinAudienceControlsProps) {
  const hintId = useId()
  const onlyThese = chosen !== null
  const chosenSet = new Set(chosen ?? [])

  const toggle = (playerId: string, checked: boolean) => {
    const next = new Set(chosenSet)
    if (checked) next.add(playerId)
    else next.delete(playerId)
    // Na ordem da lista, não na ordem dos cliques: a mesma que a sessão devolve.
    onChange(players.filter((p) => next.has(p.playerId)).map((p) => p.playerId))
  }

  return (
    <>
      <div className="lb-seg" role="radiogroup" aria-label="Quem vê">
        <button type="button" role="radio" aria-checked={!onlyThese} className="lb-seg__option" onClick={() => onlyThese && onChange(null)}>
          Todos
        </button>
        {/* "Só estes" começa sem ninguém: o mestre marca quem recebe a pista. */}
        <button type="button" role="radio" aria-checked={onlyThese} className="lb-seg__option" onClick={() => !onlyThese && onChange([])}>
          Só estes
        </button>
      </div>
      {onlyThese &&
        (players.length === 0 ? (
          <span className="lb-label">Nenhum jogador na sala.</span>
        ) : (
          <>
            <ul className="lb-gather__list" aria-label="Quem vê este pino" aria-describedby={chosenSet.size === 0 ? hintId : undefined}>
              {players.map((player) => (
                <li key={player.playerId}>
                  <label className="lb-gather__item">
                    <input
                      type="checkbox"
                      className="lb-gather__check"
                      checked={chosenSet.has(player.playerId)}
                      onChange={(event) => toggle(player.playerId, event.target.checked)}
                    />
                    {/* Mesma bolinha do painel Grupo; jogador sem ficha fica com o aro vazio. */}
                    <span
                      className="lb-party__dot"
                      style={player.color === null ? undefined : { background: player.color }}
                      aria-hidden="true"
                    />
                    <span className="lb-party__name">{player.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            {chosenSet.size === 0 && (
              <span className="lb-label" id={hintId}>
                Ninguém vê este pino. Marque quem vê.
              </span>
            )}
          </>
        ))}
    </>
  )
}
