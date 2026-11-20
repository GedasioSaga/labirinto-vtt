/**
 * ARRASTAR UMA PEÇA DA MOCHILA ATÉ O QUADRO (o `comecarArrasto`/`soltarArrasto`
 * do protótipo v2). O gesto inteiro mora aqui, fora do React: o fantasma que
 * segue o ponteiro e o alvo que acende sob ele mudam só o DOM do que se move.
 * A tela re-renderiza duas vezes por gesto (ao levantar e ao soltar), nunca a
 * cada movimento.
 *
 * O que vai no gesto: a vaga da mochila (`vagaId`). O que o alvo aceita quem
 * diz é a tela (`podeSoltar`), com o que o jogador sabe: o encaixe livre (ou com
 * a peça dele), a bandeja aberta. Se a peça serve de verdade, só o host sabe; o
 * "não encaixa" chega depois, como recusa. Soltar fora de um alvo devolve o
 * fantasma à vaga.
 */
import { useCallback, useEffect, useMemo, useRef, type PointerEvent as PointerDoReact, type RefObject } from 'react'
import { EASE_OUT, movimentoReduzido } from './movimento'

/** Um lugar do quadro que recebe peça: um encaixe ou a bandeja da troca. */
export type AlvoNoQuadro = { tipo: 'encaixe'; id: string } | { tipo: 'bandeja' }

/** O desenho do fantasma: a imagem da peça, ou a inicial do nome (como no encaixe). */
export interface DesenhoDaPeca {
  src: string | null
  inicial: string
}

interface OpcoesDoArrasto {
  /** O quadro, onde moram os alvos (`[data-alvo]` do `QuadroDoPuzzle`). */
  quadro: RefObject<HTMLElement | null>
  /** A raiz da tela: o fantasma entra nela, para o CSS da tela valer. */
  raiz: RefObject<HTMLElement | null>
  podeSoltar: (alvo: AlvoNoQuadro) => boolean
  /** A peça levantou (passou da folga): a tela acende os alvos. */
  aoLevantar: (vagaId: string) => void
  /** A peça caiu num alvo que aceita: a tela pede a ação. */
  aoSoltar: (vagaId: string, alvo: AlvoNoQuadro) => void
  /** Caiu num alvo que não aceita: a tela treme e diz por quê. */
  aoRecusar: (alvo: AlvoNoQuadro, el: HTMLElement) => void
  /** O gesto acabou, de qualquer jeito: a tela apaga os alvos. */
  aoTerminar: () => void
}

/** A folga antes de virar arrasto: menos que isso é um toque (escolher a peça). */
const FOLGA_PX = 6
const LADO_DO_FANTASMA_PX = 64
const VOLTA_DO_FANTASMA_MS = 200

interface Gesto {
  vagaId: string
  item: HTMLButtonElement
  ponteiro: number
  x0: number
  y0: number
  desenho: DesenhoDaPeca
  ativo: boolean
  fantasma: HTMLDivElement | null
  /** O elemento aceso agora e o que ele é. */
  sob: { el: HTMLElement; alvo: AlvoNoQuadro; ok: boolean } | null
  soltar: () => void
}

export interface ArrastoDaPeca {
  /** No `onPointerDown` de cada peça da mochila. */
  aoApertar: (evento: PointerDoReact<HTMLButtonElement>, vagaId: string, desenho: DesenhoDaPeca) => void
  /** Esc no meio do gesto: o fantasma volta. `true` = havia gesto. */
  cancelar: () => boolean
  /** O clique que o navegador manda logo depois de soltar não pode escolher a peça. */
  acabouDeSoltar: () => boolean
}

function alvoDoElemento(el: HTMLElement): AlvoNoQuadro | null {
  if (el.dataset.alvo === 'bandeja') return { tipo: 'bandeja' }
  const id = el.dataset.enc
  return el.dataset.alvo === 'encaixe' && id !== undefined ? { tipo: 'encaixe', id } : null
}

function criarFantasma(desenho: DesenhoDaPeca): HTMLDivElement {
  const fantasma = document.createElement('div')
  fantasma.className = 'tpz-fantasma'
  fantasma.setAttribute('aria-hidden', 'true')
  if (desenho.src !== null) {
    const img = document.createElement('img')
    img.src = desenho.src
    img.alt = ''
    img.draggable = false
    fantasma.append(img)
  } else {
    const inicial = document.createElement('span')
    inicial.className = 'tpz-fantasma__inicial'
    // textContent, nunca innerHTML: o nome vem do mestre.
    inicial.textContent = desenho.inicial
    fantasma.append(inicial)
  }
  return fantasma
}

function posicionar(fantasma: HTMLDivElement, x: number, y: number): void {
  const meio = LADO_DO_FANTASMA_PX / 2
  fantasma.style.transform = `translate3d(${x - meio}px, ${y - meio}px, 0) scale(1.08)`
}

function apagarAlvo(sob: Gesto['sob']): void {
  sob?.el.classList.remove('is-pairando-ok', 'is-pairando-nao')
}

export function useArrastoDaPeca(opcoes: OpcoesDoArrasto): ArrastoDaPeca {
  const gesto = useRef<Gesto | null>(null)
  const soltouAgora = useRef(false)
  const atuais = useRef(opcoes)
  useEffect(() => {
    atuais.current = opcoes
  })

  /** O fantasma volta à vaga (ou some, se a vaga já saiu da mochila). */
  const devolverFantasma = useCallback((g: Gesto) => {
    const fantasma = g.fantasma
    if (fantasma === null) return
    const caixa = g.item.isConnected ? g.item.getBoundingClientRect() : null
    const fim = () => {
      fantasma.remove()
      g.item.classList.remove('is-levantado')
    }
    if (caixa === null || movimentoReduzido() || typeof fantasma.animate !== 'function') {
      fim()
      return
    }
    const meio = LADO_DO_FANTASMA_PX / 2
    const volta = fantasma.animate(
      [{ transform: fantasma.style.transform }, { transform: `translate3d(${caixa.left + caixa.width / 2 - meio}px, ${caixa.top + caixa.height / 2 - meio}px, 0) scale(1)` }],
      { duration: VOLTA_DO_FANTASMA_MS, easing: EASE_OUT },
    )
    volta.onfinish = fim
    volta.oncancel = fim
  }, [])

  const encerrar = useCallback((g: Gesto) => {
    g.soltar()
    gesto.current = null
    apagarAlvo(g.sob)
    document.body.classList.remove('tpz-arrastando')
    if (g.ativo) atuais.current.aoTerminar()
  }, [])

  const cancelar = useCallback(() => {
    const g = gesto.current
    if (g === null) return false
    encerrar(g)
    if (g.ativo) devolverFantasma(g)
    return g.ativo
  }, [encerrar, devolverFantasma])

  const aoApertar = useCallback(
    (evento: PointerDoReact<HTMLButtonElement>, vagaId: string, desenho: DesenhoDaPeca) => {
      // Um dedo só: o segundo toque no meio do gesto não rouba a peça.
      if (evento.button !== 0 || gesto.current !== null) return
      const item = evento.currentTarget
      const ponteiro = evento.pointerId
      try {
        item.setPointerCapture(ponteiro)
      } catch {
        // O ponteiro já foi solto entre o evento e aqui: o gesto não começa.
        return
      }

      const mover = (e: PointerEvent) => {
        const g = gesto.current
        if (g === null || e.pointerId !== g.ponteiro) return
        if (!g.ativo) {
          if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < FOLGA_PX) return
          g.ativo = true
          g.fantasma = criarFantasma(g.desenho)
          ;(atuais.current.raiz.current ?? document.body).append(g.fantasma)
          g.item.classList.add('is-levantado')
          document.body.classList.add('tpz-arrastando')
          atuais.current.aoLevantar(g.vagaId)
        }
        if (g.fantasma !== null) posicionar(g.fantasma, e.clientX, e.clientY)
        marcar(g, e.clientX, e.clientY)
      }
      const subir = (e: PointerEvent) => {
        const g = gesto.current
        if (g === null || e.pointerId !== g.ponteiro) return
        encerrar(g)
        if (!g.ativo) return
        soltouAgora.current = true
        window.setTimeout(() => {
          soltouAgora.current = false
        }, 0)
        const sob = g.sob
        if (sob !== null && sob.ok) {
          g.fantasma?.remove()
          g.item.classList.remove('is-levantado')
          atuais.current.aoSoltar(g.vagaId, sob.alvo)
          return
        }
        if (sob !== null) atuais.current.aoRecusar(sob.alvo, sob.el)
        devolverFantasma(g)
      }
      const perder = (e: PointerEvent) => {
        const g = gesto.current
        if (g === null || e.pointerId !== g.ponteiro) return
        encerrar(g)
        if (g.ativo) devolverFantasma(g)
      }

      item.addEventListener('pointermove', mover)
      item.addEventListener('pointerup', subir)
      item.addEventListener('pointercancel', perder)
      gesto.current = {
        vagaId,
        item,
        ponteiro,
        x0: evento.clientX,
        y0: evento.clientY,
        desenho,
        ativo: false,
        fantasma: null,
        sob: null,
        soltar: () => {
          item.removeEventListener('pointermove', mover)
          item.removeEventListener('pointerup', subir)
          item.removeEventListener('pointercancel', perder)
        },
      }
    },
    [encerrar, devolverFantasma],
  )

  /** Acende o alvo sob o ponteiro: latão se aceita, brasa se não. Só o DOM do alvo muda. */
  function marcar(g: Gesto, x: number, y: number): void {
    const quadro = atuais.current.quadro.current
    const achado = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-alvo]') ?? null
    const el = achado !== null && quadro !== null && quadro.contains(achado) && achado.getAttribute('aria-disabled') !== 'true' ? achado : null
    const alvo = el === null ? null : alvoDoElemento(el)
    if (el === null || alvo === null) {
      apagarAlvo(g.sob)
      g.sob = null
      return
    }
    if (g.sob?.el !== el) {
      apagarAlvo(g.sob)
      g.sob = { el, alvo, ok: atuais.current.podeSoltar(alvo) }
    }
    // De novo a cada movimento: uma vista nova no meio do gesto pode ter trocado a classe do encaixe.
    el.classList.add(g.sob.ok ? 'is-pairando-ok' : 'is-pairando-nao')
  }

  // A tela fechou no meio do gesto: nada de fantasma órfão no corpo da página.
  useEffect(
    () => () => {
      const g = gesto.current
      if (g === null) return
      g.soltar()
      g.fantasma?.remove()
      document.body.classList.remove('tpz-arrastando')
      gesto.current = null
    },
    [],
  )

  const acabouDeSoltar = useCallback(() => soltouAgora.current, [])
  // O mesmo objeto entre renders: a tela o usa em dependências de efeito (o teclado).
  return useMemo(() => ({ aoApertar, cancelar, acabouDeSoltar }), [aoApertar, cancelar, acabouDeSoltar])
}
