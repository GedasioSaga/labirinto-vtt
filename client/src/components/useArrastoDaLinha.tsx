import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Personagem } from '../lib/personagem'
import type { CasaDoSoltar } from '../stores/porPersonagemNoMapa'
import { ImagemOuIniciais } from './FichaPecas'
import './FichaDePersonagem.css'

/**
 * O GESTO DE ARRASTAR UMA LINHA DE FICHA, comum à coluna dos jogadores
 * (`PersonagensSection`) e às fichas de NPC do acervo (`LinhaDaFichaNoAcervo`),
 * no molde do acervo de tokens: ouvintes de janela só durante o aperto, limiar
 * de 6 px entre clique e arrasto, Esc desiste, e o `click` que o navegador
 * manda depois do soltar não abre a ficha. Três destinos, nesta ordem: uma
 * pasta (quem monta diz qual aceita), um token do mapa (liga a ficha a ele) e
 * uma casa vazia do mapa (o token nasce ali). Durante o gesto só o fantasma e
 * o realce andam (estilo direto); a lista não re-renderiza a cada quadro.
 */

/** O token sob o ponteiro durante o arrasto: o disco dele na tela, o nome e quantos tokens a ficha vai ligar. */
export interface TokenNaTela {
  tela: { x: number; y: number; lado: number }
  nome: string
  quantos: number
}

/** Uma pasta sob o ponteiro que aceita a ficha: o elemento que acende e o `id` dela (`null` = fora de pasta). */
export interface PastaDoSoltar {
  el: HTMLElement
  pastaId: string | null
}

export interface ArrastoDaLinha {
  /** A casa sob o ponteiro (px de janela) para o realce, `null` fora do mapa. Ausente = a linha não arrasta. */
  casaNaTela?: (clientX: number, clientY: number) => CasaDoSoltar['tela'] | null
  /** O token sob o ponteiro (ganha da casa), `null` = nenhum. */
  tokenNaTela?: (clientX: number, clientY: number) => TokenNaTela | null
  /** Soltou no ponto da tela: `true` = era o mapa (o token nasce, ou a ficha liga ao token de lá). */
  onSoltarNoMapa?: (personagem: Personagem, clientX: number, clientY: number) => boolean
  /** A pasta sob o ponteiro que aceita a ficha; ausente ou `null` = nenhuma (o soltar vai para o mapa). */
  pastaSob?: (clientX: number, clientY: number, personagem: Personagem) => PastaDoSoltar | null
  onMoverParaPasta?: (personagem: Personagem, pastaId: string | null) => void
  /** Como a pasta-alvo acende (atributo e valor). Padrão: o da lista de personagens, `data-alvo-do-soltar="sim"`. */
  marcaDaPasta?: { atributo: string; valor: string }
}

/** Quanto o ponteiro anda (px) antes de o aperto virar arrasto; abaixo disso é clique (o do acervo de tokens). */
const LIMIAR_DO_ARRASTO_PX = 6
/** O anel do token-alvo passa um pouco do disco: o mestre vê o token por dentro dele. */
const FOLGA_DO_ANEL_PX = 10
const MARCA_PADRAO: { atributo: string; valor: string } = { atributo: 'data-alvo-do-soltar', valor: 'sim' }

interface ApertoNaLinha {
  personagem: Personagem
  pointerId: number
  inicio: { x: number; y: number }
  arrastando: boolean
  cancelado: boolean
}

function posicionarFantasma(fantasma: HTMLElement, ponto: { x: number; y: number }): void {
  fantasma.style.transform = `translate(${ponto.x}px, ${ponto.y}px) translate(-50%, -50%)`
}

/** O realce da casa de destino; some (`hidden`) fora do mapa. Estilo direto: anda a cada `pointermove`. */
function posicionarRealce(realce: HTMLElement, casa: CasaDoSoltar['tela'] | null): void {
  realce.hidden = casa === null
  realce.dataset.alvo = 'casa'
  delete realce.dataset.rotulo
  if (casa === null) return
  realce.style.width = `${casa.lado}px`
  realce.style.height = `${casa.lado}px`
  realce.style.transform = `translate(${casa.x - casa.lado / 2}px, ${casa.y - casa.lado / 2}px)`
  realce.dataset.redonda = casa.redonda ? 'sim' : 'nao'
}

/** Em cima de um token: o anel em volta dele e o que vai acontecer ("Ligar a Urso", "Ligar a 3 tokens"). */
function posicionarRealceNoToken(realce: HTMLElement, token: TokenNaTela): void {
  const lado = token.tela.lado + FOLGA_DO_ANEL_PX
  realce.hidden = false
  realce.style.width = `${lado}px`
  realce.style.height = `${lado}px`
  realce.style.transform = `translate(${token.tela.x - lado / 2}px, ${token.tela.y - lado / 2}px)`
  realce.dataset.redonda = 'sim'
  realce.dataset.alvo = 'token'
  realce.dataset.rotulo = token.quantos > 1 ? `Ligar a ${token.quantos} tokens` : `Ligar a ${token.nome.trim() || 'este token'}`
}

export function useArrastoDaLinha({ casaNaTela, tokenNaTela, onSoltarNoMapa, pastaSob, onMoverParaPasta, marcaDaPasta = MARCA_PADRAO }: ArrastoDaLinha) {
  const [arrastado, setArrastado] = useState<Personagem | null>(null)
  const apertoRef = useRef<ApertoNaLinha | null>(null)
  const ultimoPontoRef = useRef({ x: 0, y: 0 })
  const fantasmaRef = useRef<HTMLDivElement | null>(null)
  const realceRef = useRef<HTMLDivElement | null>(null)
  const engolirCliqueRef = useRef(false)
  const soltarOuvintesRef = useRef<(() => void) | null>(null)
  const pastaMarcadaRef = useRef<HTMLElement | null>(null)

  const marcarPasta = (el: HTMLElement | null) => {
    if (pastaMarcadaRef.current === el) return
    pastaMarcadaRef.current?.removeAttribute(marcaDaPasta.atributo)
    pastaMarcadaRef.current = el
    el?.setAttribute(marcaDaPasta.atributo, marcaDaPasta.valor)
  }

  // Seção desmontada no meio do arrasto (troca de página): os ouvintes não sobrevivem a ela.
  useEffect(
    () => () => {
      soltarOuvintesRef.current?.()
      pastaMarcadaRef.current?.removeAttribute(marcaDaPasta.atributo)
    },
    [marcaDaPasta.atributo],
  )

  /** O destino sob o ponteiro, desenhado: a pasta acende, ou o anel do token, ou a casa. */
  const desenharAlvo = (personagem: Personagem, x: number, y: number) => {
    const pasta = pastaSob?.(x, y, personagem) ?? null
    marcarPasta(pasta?.el ?? null)
    const realce = realceRef.current
    if (realce === null) return
    if (pasta !== null) {
      posicionarRealce(realce, null)
      return
    }
    const token = tokenNaTela?.(x, y) ?? null
    if (token !== null) posicionarRealceNoToken(realce, token)
    else posicionarRealce(realce, casaNaTela?.(x, y) ?? null)
  }

  const comecar = (event: ReactPointerEvent<HTMLButtonElement>, personagem: Personagem) => {
    if (casaNaTela === undefined || onSoltarNoMapa === undefined || event.button !== 0 || !event.isPrimary) return
    soltarOuvintesRef.current?.()
    engolirCliqueRef.current = false
    apertoRef.current = { personagem, pointerId: event.pointerId, inicio: { x: event.clientX, y: event.clientY }, arrastando: false, cancelado: false }

    const mover = (e: PointerEvent) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId || aperto.cancelado) return
      ultimoPontoRef.current = { x: e.clientX, y: e.clientY }
      if (!aperto.arrastando) {
        if (Math.hypot(e.clientX - aperto.inicio.x, e.clientY - aperto.inicio.y) < LIMIAR_DO_ARRASTO_PX) return
        aperto.arrastando = true
        setArrastado(aperto.personagem)
      }
      if (fantasmaRef.current !== null) posicionarFantasma(fantasmaRef.current, ultimoPontoRef.current)
      desenharAlvo(aperto.personagem, e.clientX, e.clientY)
    }

    const encerrar = (e: PointerEvent, soltou: boolean) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId) return
      soltarOuvintesRef.current?.()
      apertoRef.current = null
      if (!aperto.arrastando) return
      setArrastado(null)
      marcarPasta(null)
      // O `click` chega logo depois deste `pointerup`; o `setTimeout` libera o próximo clique de verdade.
      engolirCliqueRef.current = true
      setTimeout(() => {
        engolirCliqueRef.current = false
      }, 0)
      if (!soltou || aperto.cancelado) return
      const pasta = pastaSob?.(e.clientX, e.clientY, aperto.personagem) ?? null
      if (pasta !== null) onMoverParaPasta?.(aperto.personagem, pasta.pastaId)
      else onSoltarNoMapa(aperto.personagem, e.clientX, e.clientY)
    }
    const aoSoltar = (e: PointerEvent) => encerrar(e, true)
    const aoCancelar = (e: PointerEvent) => encerrar(e, false)
    // Esc desiste, na CAPTURA e parando ali: chegando ao mapa, largaria a seleção.
    const aoTeclar = (e: KeyboardEvent) => {
      const aperto = apertoRef.current
      if (e.key !== 'Escape' || aperto === null || !aperto.arrastando || aperto.cancelado) return
      e.preventDefault()
      e.stopImmediatePropagation()
      aperto.cancelado = true
      marcarPasta(null)
      setArrastado(null)
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoCancelar)
    window.addEventListener('keydown', aoTeclar, true)
    soltarOuvintesRef.current = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      window.removeEventListener('keydown', aoTeclar, true)
      soltarOuvintesRef.current = null
    }
  }

  const fantasma =
    arrastado === null
      ? null
      : // Portal no `body`: o painel tem rolagem e recorte, e o fantasma anda por cima do mapa inteiro.
        // `aria-hidden`: eco visual do gesto; o leitor de tela já tem o botão.
        createPortal(
          <>
            <div
              className="lb-rpg__casa-alvo"
              aria-hidden="true"
              ref={(el) => {
                realceRef.current = el
                if (el !== null) desenharAlvo(arrastado, ultimoPontoRef.current.x, ultimoPontoRef.current.y)
              }}
            />
            <div
              className="lb-rpg__fantasma"
              aria-hidden="true"
              ref={(el) => {
                fantasmaRef.current = el
                if (el !== null) posicionarFantasma(el, ultimoPontoRef.current)
              }}
            >
              <span className="lb-rpg__fantasma-retrato">
                <ImagemOuIniciais imagem={arrastado.retrato} nome={arrastado.nome} />
              </span>
              <span className="lb-rpg__fantasma-nome">{arrastado.nome || 'Personagem'}</span>
            </div>
          </>,
          document.body,
        )

  return { comecar, engolirClique: () => engolirCliqueRef.current, fantasma, arrastado }
}
