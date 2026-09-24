import { Fragment } from 'react'
import { OUTSIDE_ROOMS_LABEL, whereAmIText, type WhereAmI } from './whereAmI'

interface PlayerWhereAmIProps {
  /** `null` = nenhuma ficha do jogador no mapa: a faixa não aparece. */
  where: WhereAmI | null
  /** Jogador com mais de uma ficha: a faixa diz de qual delas é o caminho. */
  showTokenName: boolean
  /** Toque na faixa: centraliza a ficha, pelo mesmo caminho do "Minha ficha". */
  onFocus: (tokenId: string) => void
}

/**
 * FAIXA "ONDE ESTOU": selo fixo no alto à direita (`player.css`) com o caminho
 * da Sala onde a ficha está — prédio › piso › cômodo. É um `<button>` de
 * verdade: tocar (ou Enter/Espaço) centraliza a ficha. O cômodo fica sempre
 * inteiro; quando falta largura, quem encolhe são as salas de fora.
 */
export function PlayerWhereAmI({ where, showTokenName, onFocus }: PlayerWhereAmIProps) {
  if (where === null) return null
  const { tokenId, tokenName, trail } = where
  const text = whereAmIText(trail)
  return (
    <button
      type="button"
      className="pp-where"
      aria-label={`Onde estou: ${text}. Centralizar ${tokenName}`}
      title="Centralizar a ficha"
      onClick={() => onFocus(tokenId)}
    >
      {showTokenName && <span className="pp-where__who">{tokenName}</span>}
      {trail.length === 0 ? (
        <span className="pp-where__step pp-where__step--here pp-where__step--outside">{OUTSIDE_ROOMS_LABEL}</span>
      ) : (
        trail.map((name, i) => {
          const here = i === trail.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && (
                <span className="pp-where__sep" aria-hidden="true">
                  ›
                </span>
              )}
              <span className={here ? 'pp-where__step pp-where__step--here' : 'pp-where__step'}>{name}</span>
            </Fragment>
          )
        })
      )}
    </button>
  )
}
