import { useId } from 'react'
import { clueDotLabel, cluesHeading, type ClueDot, type ClueRow } from '../lib/clues'

export interface CluesSectionProps {
  /** `lib/clues.ts` `clueRows`: uma linha por pino "!"/"?" das cenas abertas. */
  rows: ClueRow[]
  /** Clicou na linha: o editor abre a cena do pino com ele no centro. */
  onCenter(row: ClueRow): void
  /** Clicou na bolinha: revela a pista para o jogador, ou esconde dele. */
  onToggle(pinId: string, playerId: string): void
}

export const CLUES_EMPTY_TEXT = 'Nenhum pino ! ou ? nas cenas abertas.'

/** A dica da bolinha diz o que o clique FAZ; o nome acessível diz o estado. */
function dotActionText(dot: ClueDot): string {
  return dot.hidden ? `Revelar para ${dot.name}` : `Esconder de ${dot.name}`
}

/**
 * "Pistas", na aba Jogo, logo abaixo do Grupo: o mestre confere antes do
 * confronto quem recebeu e quem leu cada pista. A bolinha é da cor da ficha
 * do jogador (a mesma do Grupo): vazia = não recebeu, com miolo = recebeu,
 * cheia = leu; tracejada = escondida dele pelo "Quem vê". Cada bolinha é um
 * botão de alternar (`aria-pressed` = a pista chega a ele): o estado de
 * leitura vai no nome, e o clique revela ou esconde.
 */
export function CluesSection({ rows, onCenter, onToggle }: CluesSectionProps) {
  const headingId = useId()
  return (
    <section className="lb-clues" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        {cluesHeading(rows.length)}
      </h3>
      {rows.length === 0 ? (
        <p className="lb-label">{CLUES_EMPTY_TEXT}</p>
      ) : (
        <ul className="lb-clues__list">
          {rows.map((row) => (
            <li key={row.pinId} className="lb-clues__item">
              <button type="button" className="lb-clues__pin" title={row.label} onClick={() => onCenter(row)}>
                <span className="lb-clues__glyph" aria-hidden="true">
                  {row.glyph}
                </span>
                <span className="lb-clues__label">{row.label}</span>
                {/* O espaço é do texto: sem ele o leitor de tela lê "BilheteAndar de cima". */}
                {row.sceneName !== null && (
                  <>
                    {' '}
                    <span className="lb-clues__scene">{row.sceneName}</span>
                  </>
                )}
              </button>
              <div className="lb-clues__dots" role="group" aria-label={`Quem tem ${row.label}`}>
                {row.dots.map((dot) => (
                  <button
                    key={dot.playerId}
                    type="button"
                    className={dot.hidden ? 'lb-clues__dot lb-clues__dot--hidden' : 'lb-clues__dot'}
                    data-estado={dot.state}
                    aria-label={clueDotLabel(dot)}
                    aria-pressed={!dot.hidden}
                    title={dotActionText(dot)}
                    // A cor entra por `color` e o CSS pinta com `currentColor`: sem ficha, fica a do tema.
                    style={dot.color === null ? undefined : { color: dot.color }}
                    onClick={() => onToggle(row.pinId, dot.playerId)}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
