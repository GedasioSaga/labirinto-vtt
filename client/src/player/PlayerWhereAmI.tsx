import { Fragment } from 'react'
import { OUTSIDE_ROOMS_LABEL, whereAmIText, type WhereAmI } from './whereAmI'

/** Entre a cena e o caminho de Salas: "Casa do porto · Fora das salas". */
const SCENE_SEPARATOR = ' · '

interface PlayerWhereAmIProps {
  /** Nome público da cena. `undefined` ou vazio = cena sem nome público: o selo é só a sala. */
  sceneName: string | undefined
  /** `null` = nenhuma ficha do jogador no mapa: o selo diz só a cena (ou some, sem cena). */
  where: WhereAmI | null
  /** Jogador com mais de uma ficha: o selo diz de qual delas é o caminho. */
  showTokenName: boolean
  /**
   * Toque no selo: centraliza a ficha, pelo mesmo caminho do "Minha ficha".
   * `animate`: veio do dedo ou do mouse, e a câmera desliza. Sem ele (o
   * teclado), é o pedido de sempre: a câmera salta.
   */
  onFocus: (tokenId: string, animate?: boolean) => void
}

interface WhereAmIButtonProps {
  /** Cena já aparada; vazia = sem nome público. */
  scene: string
  where: WhereAmI
  showTokenName: boolean
  onFocus: (tokenId: string, animate?: boolean) => void
}

/** Mesmo nome, sem ligar para caixa nem para espaço nas pontas. */
function isSameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')
}

/**
 * SELO "ONDE ESTOU": um selo só, fixo no alto à direita (`player.css`), com a
 * cena e o caminho da Sala onde a ficha está — "Casa do porto · Farol › piso 5
 * › cômodo". Antes eram dois, um embaixo do outro: o selo da cena e a faixa da
 * sala. Com ficha no mapa é um `<button>` de verdade: tocar (ou Enter/Espaço)
 * centraliza a ficha. Sem ficha, diz só a cena e não é botão: não há o que
 * centralizar. A troca de cena continua sendo falada ao leitor de tela, por
 * uma região viva fora da vista.
 */
export function PlayerWhereAmI({ sceneName, where, showTokenName, onFocus }: PlayerWhereAmIProps) {
  const scene = sceneName?.trim() ?? ''
  if (where === null && scene === '') return null
  return (
    <>
      {/* Sempre no mesmo lugar da árvore: ter ou não ficha no mapa não recria a região viva. */}
      {scene !== '' && (
        <p className="pp-sr-only" role="status" aria-live="polite">
          {`Onde estou: ${scene}`}
        </p>
      )}
      {where === null ? (
        <p className="pp-where pp-where--static" aria-hidden="true">
          <span className="pp-where__scene pp-where__scene--here">{scene}</span>
        </p>
      ) : (
        <WhereAmIButton scene={scene} where={where} showTokenName={showTokenName} onFocus={onFocus} />
      )}
    </>
  )
}

/** A cena, depois prédio › piso › cômodo. O cômodo fica sempre inteiro; quando falta largura, quem encolhe são a cena e as salas de fora. */
function WhereAmIButton({ scene, where, showTokenName, onFocus }: WhereAmIButtonProps) {
  const { tokenId, tokenName, trail } = where
  // A cena com o nome de uma das Salas do caminho não se repete ("Farol · Farol").
  const shownScene = trail.some((room) => isSameName(room, scene)) ? '' : scene
  const rooms = whereAmIText(trail)
  const text = shownScene === '' ? rooms : `${shownScene}${SCENE_SEPARATOR}${rooms}`
  return (
    <button
      type="button"
      className="pp-where"
      aria-label={`Onde estou: ${text}. Centralizar ${tokenName}`}
      title="Centralizar a ficha"
      // `detail` conta os cliques do dedo ou do mouse, que pedem o deslize. Enter e Espaço
      // sintetizam o clique com 0 e fazem o pedido de sempre, só com a ficha: a câmera salta.
      onClick={(event) => {
        if (event.detail === 0) onFocus(tokenId)
        else onFocus(tokenId, true)
      }}
    >
      {showTokenName && <span className="pp-where__who">{tokenName}</span>}
      {shownScene !== '' && (
        <>
          {/* Fora das salas, a cena é o lugar mais preciso que se sabe: ela leva o destaque. */}
          <span className={trail.length === 0 ? 'pp-where__scene pp-where__scene--here' : 'pp-where__scene'}>{shownScene}</span>
          <span className="pp-where__sep" aria-hidden="true">
            ·
          </span>
        </>
      )}
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
