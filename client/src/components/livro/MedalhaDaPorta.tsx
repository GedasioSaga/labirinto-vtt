import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import type { DoorState } from '../../types/map'
import { animacaoDePorta, assinarAnimacoesDePorta, duracaoDoSentido, listarAnimacoesDePorta } from '../../portas/animacoesDePorta'
import { movimentoReduzido } from '../grimorio/comum'
import { normalizarCorDaPorta } from '../../lib/corDaPorta'
import './fichaDaPorta.css'

/** Com movimento reduzido a folha troca na hora e só a opacidade volta, em 160 ms (o protótipo). */
const PISCAR_REDUZIDO_MS = 160
const OPACIDADE_DO_PISCAR = 0.35

/** Os tempos da folha DESTA porta, postos no svg: o CSS os lê em cada sentido. A cor própria também. */
type EstiloDaMedalha = CSSProperties & { '--lb-porta-abre': string; '--lb-porta-fecha': string; '--lb-porta-cor'?: string }

export interface MedalhaDaPortaProps {
  porta: Pick<DoorState, 'open' | 'locked' | 'secret' | 'animacao' | 'cor'>
}

/**
 * MEDALHA DA PORTA (fatia 11, o `.cabeca__med--porta` do protótipo): o batente
 * e a folha, que gira 70 graus na dobradiça quando a porta abre — junto com a
 * folha do mapa, no mesmo tempo e na mesma curva (`gr.easePorta`). Quem gira é
 * uma transição de CSS sobre `data-estado`: clicar no meio inverte dali mesmo,
 * e nada anima na montagem (outra porta selecionada remonta a cabeça).
 *
 * Os tempos vêm da animação escolhida para a porta (os mesmos do mapa, então
 * as duas terminam juntas). Troca na hora quando o mapa também troca: sem
 * animação, animação que este app não tem, ou porta secreta (é tracejada no
 * mapa). Com movimento reduzido o CSS tira o giro e a folha só pisca.
 */
export function MedalhaDaPorta({ porta }: MedalhaDaPortaProps) {
  // O pacote de animações pode chegar com a porta selecionada: relê o registro.
  useSyncExternalStore(assinarAnimacoesDePorta, listarAnimacoesDePorta)
  const animacao = porta.secret === true ? null : animacaoDePorta(porta.animacao)
  // COR DA PORTA: só hex conferido entra no CSS; torta ou ausente, a folha de sempre.
  const cor = normalizarCorDaPorta(porta.cor)
  const estilo: EstiloDaMedalha = {
    '--lb-porta-abre': `${animacao === null ? 0 : duracaoDoSentido(animacao, true)}ms`,
    '--lb-porta-fecha': `${animacao === null ? 0 : duracaoDoSentido(animacao, false)}ms`,
    ...(cor === undefined ? {} : { '--lb-porta-cor': cor }),
  }
  const folha = useRef<SVGRectElement>(null)
  const abertaAntes = useRef(porta.open)
  const anima = animacao !== null
  useEffect(() => {
    if (abertaAntes.current === porta.open) return
    abertaAntes.current = porta.open
    const elemento = folha.current
    // `animate` falta no jsdom e em navegador antigo: aí a troca fica só na hora.
    if (!anima || elemento === null || !movimentoReduzido() || typeof elemento.animate !== 'function') return
    elemento.animate([{ opacity: OPACIDADE_DO_PISCAR }, { opacity: 1 }], { duration: PISCAR_REDUZIDO_MS, easing: 'ease-out' })
  }, [porta.open, anima])
  return (
    <svg
      className="lb-medalha-porta"
      data-estado={porta.open ? 'aberta' : 'fechada'}
      data-trancada={porta.locked ? '' : undefined}
      data-cor={cor === undefined ? undefined : ''}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={estilo}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 16h5 M16.5 16h5" />
      <rect ref={folha} className="lb-medalha-porta__folha" x="7.5" y="15" width="9" height="2" rx="0.6" />
    </svg>
  )
}
