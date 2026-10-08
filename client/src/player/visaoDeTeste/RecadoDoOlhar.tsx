import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { JogarIcon } from '../../components/icons'
import type { RecadoDoOlharProps } from '../../net/visaoDeTeste/tipos'
import './RecadoDoOlhar.css'

/**
 * VISÃO DE JOGADOR — o recado do modo Olhar. O mestre tentou uma ação do
 * jogador (andar, abrir porta, passar por pino, chamar o mestre) e o Olhar só
 * vê: em vez de o toque morrer calado, este recado diz por quê e, quando o
 * Jogar existe, leva a ele num clique.
 *
 * Mora embaixo, no meio da janela, onde a tela do jogador dá os avisos dela:
 * não cobre o Painel (no alto à esquerda) nem a pilha do zoom (embaixo à
 * direita). Tem a moldura do editor e não a do jogador: é recado do mestre.
 *
 * Some sozinho em `DURACAO_DO_RECADO_MS`, mas não com o ponteiro ou o foco
 * nele (dá tempo de ler e de clicar). Esc, com o foco nele, fecha na hora.
 * Quem monta o recado de novo (`key` nova) recomeça a contagem.
 */

/** Tempo para ler duas frases e decidir: o de um aviso com ação. */
export const DURACAO_DO_RECADO_MS = 6000

export const RECADO_DO_OLHAR = 'No Olhar, a ficha só vê.'
/** Com o Jogar à mão: o que ele permite, e o botão logo abaixo. */
export const RECADO_COM_JOGAR = 'Para andar, abrir portas ou chamar o mestre, passe para Jogar.'
/** Sem o Jogar nesta versão: o recado não promete um botão que não existe. */
export const RECADO_SEM_JOGAR = 'Andar, abrir portas e chamar o mestre ficam para o Jogar, que ainda não está disponível nesta versão.'

export function RecadoDoOlhar({ onPassarParaJogar, onFechar }: RecadoDoOlharProps) {
  const [ponteiroEmCima, setPonteiroEmCima] = useState(false)
  const [focoDentro, setFocoDentro] = useState(false)
  // Quem monta passa uma função nova a cada render: a contagem não pode recomeçar com ela.
  const onFecharRef = useRef(onFechar)
  useLayoutEffect(() => {
    onFecharRef.current = onFechar
  })
  const parado = ponteiroEmCima || focoDentro

  useEffect(() => {
    if (parado) return
    const relogio = window.setTimeout(() => onFecharRef.current(), DURACAO_DO_RECADO_MS)
    return () => window.clearTimeout(relogio)
  }, [parado])

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    if (evento.key !== 'Escape') return
    // O Esc é deste recado: não fecha junto o cartão ou o Painel do jogador.
    evento.preventDefault()
    evento.stopPropagation()
    evento.nativeEvent.stopImmediatePropagation()
    onFechar()
  }

  return (
    <div
      className="vj-recado-do-olhar"
      onPointerEnter={() => setPonteiroEmCima(true)}
      onPointerLeave={() => setPonteiroEmCima(false)}
      onFocus={() => setFocoDentro(true)}
      onBlur={(evento) => {
        if (!(evento.relatedTarget instanceof Node && evento.currentTarget.contains(evento.relatedTarget))) setFocoDentro(false)
      }}
      onKeyDown={aoTeclar}
    >
      <p className="vj-recado-do-olhar__texto" role="status">
        {RECADO_DO_OLHAR} {onPassarParaJogar === undefined ? RECADO_SEM_JOGAR : RECADO_COM_JOGAR}
      </p>
      {onPassarParaJogar !== undefined && (
        <div className="vj-recado-do-olhar__acoes">
          <button
            type="button"
            className="vj-recado-do-olhar__botao"
            onClick={() => {
              onPassarParaJogar()
              // No Jogar o recado não tem mais o que dizer.
              onFechar()
            }}
          >
            <JogarIcon size={12} />
            Passar para Jogar
          </button>
        </div>
      )}
    </div>
  )
}
