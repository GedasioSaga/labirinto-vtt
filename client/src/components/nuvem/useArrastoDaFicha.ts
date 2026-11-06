import { useCallback, useEffect, useRef, useState, type PointerEvent as PointerDoReact, type RefObject } from 'react'

/**
 * ARRASTAR A FICHA ATÉ O JOGADOR, como no protótipo aprovado
 * (docs/design/lobby/prototipo-mestre.html, "ARRASTAR A FICHA ATÉ O JOGADOR"):
 * com o mouse, de qualquer ponto do cartão que não seja controle; no toque, só
 * pela alça. O papel levanta numa cópia que segue o ponteiro; parado sobre um
 * jogador (ou sobre "Sem dono"), a linha acende e a vaga diz o que acontece ao
 * soltar. Soltar fora, Esc ou o sistema cancelar: o papel volta voando ao lugar.
 * O caminho sem arrasto é o "Dono" de cada cartão (teclado e leitor de tela).
 *
 * Quem marca os lugares: `data-ficha` no cartão, `data-alvo` na linha do
 * jogador (o id da conta) e na bandeja (`SEM_DONO`), e `data-fichas-de` na
 * lista onde a vaga entra (o quadro desenha a vaga a partir de `sobre`).
 */

/** O alvo da bandeja "Sem dono". */
export const SEM_DONO = 'sem-dono'

/** Quanto o ponteiro anda antes de o papel levantar: um clique trêmulo não vira arrasto. */
const LIMIAR_PX = 5
/** Perto da borda do que rola, a lista rola sozinha enquanto o papel voa. */
const BORDA_PX = 64
/** A volta do papel cancelado (casa com `.jl-fantasma.is-voltando` no lobby.css). */
const VOLTA_MS = 210

export interface SobreOAlvo {
  fichaId: string
  /** O id da conta, ou `SEM_DONO`. */
  alvo: string
}

interface Arrasto {
  fichaId: string
  el: HTMLElement
  pointerId: number
  x0: number
  y0: number
  x: number
  y: number
  ativo: boolean
  origem: string
  alvo: string | null
  dx: number
  dy: number
  origemRect: DOMRect | null
  camada: HTMLElement | null
  fantasma: HTMLElement | null
  raf: number
}

/** O primeiro ancestral que rola de verdade; `null` = a janela. */
function roladorDe(el: HTMLElement): HTMLElement | null {
  for (let atual = el.parentElement; atual !== null; atual = atual.parentElement) {
    const { overflowY } = getComputedStyle(atual)
    if ((overflowY === 'auto' || overflowY === 'scroll') && atual.scrollHeight > atual.clientHeight) return atual
  }
  return null
}

function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A cópia que voa: sem ids nem `for` (não duplica rótulo na página), com o mesmo dono escolhido no select. */
function fantasmaDe(el: HTMLElement, rect: DOMRect): HTMLElement {
  const copia = el.cloneNode(true)
  if (!(copia instanceof HTMLElement)) throw new Error('O cartão da ficha não pôde ser copiado para o arrasto.')
  copia.removeAttribute('data-ficha')
  copia.removeAttribute('data-origem')
  copia.setAttribute('aria-hidden', 'true')
  copia.querySelectorAll('[id]').forEach((no) => no.removeAttribute('id'))
  copia.querySelectorAll('label[for]').forEach((no) => no.removeAttribute('for'))
  const original = el.querySelector('select')
  const select = copia.querySelector('select')
  if (original !== null && select !== null) select.value = original.value
  copia.classList.add('jl-fantasma')
  copia.style.width = `${rect.width}px`
  copia.style.translate = `${rect.left}px ${rect.top}px`
  return copia
}

/**
 * `origemDe(fichaId)`: onde a ficha está agora (o id da conta, ou `SEM_DONO`).
 * `aoSoltar`: troca o dono; enquanto a promessa corre, o cartão de origem fica
 * tracejado (ele só some da lista de antes quando a troca grava).
 */
export function useArrastoDaFicha(raiz: RefObject<HTMLElement | null>, origemDe: (fichaId: string) => string, aoSoltar: (fichaId: string, alvo: string) => Promise<void>) {
  const [sobre, setSobre] = useState<SobreOAlvo | null>(null)
  const arrasto = useRef<Arrasto | null>(null)
  // As funções de agora para os ouvintes do documento, que nascem uma vez por arrasto.
  const atuais = useRef({ origemDe, aoSoltar })
  useEffect(() => {
    atuais.current = { origemDe, aoSoltar }
  })

  const acharAlvo = useCallback(() => {
    const a = arrasto.current
    const casa = raiz.current
    if (a === null || casa === null) return
    const sob = document.elementFromPoint(a.x, a.y)
    const alvoEl = sob instanceof Element ? sob.closest<HTMLElement>('[data-alvo]') : null
    const alvo = alvoEl !== null && casa.contains(alvoEl) ? (alvoEl.dataset.alvo ?? null) : null
    if (alvo === a.alvo) return
    a.alvo = alvo
    setSobre(alvo === null || alvo === a.origem ? null : { fichaId: a.fichaId, alvo })
  }, [raiz])

  const rolarNaBorda = useCallback(() => {
    const a = arrasto.current
    const casa = raiz.current
    if (a === null || !a.ativo || casa === null) return
    const rolador = roladorDe(casa)
    const topo = rolador === null ? 0 : rolador.getBoundingClientRect().top
    const fundo = rolador === null ? window.innerHeight : rolador.getBoundingClientRect().bottom
    let passo = 0
    if (a.y < topo + BORDA_PX) passo = -Math.ceil((topo + BORDA_PX - a.y) / 5)
    else if (a.y > fundo - BORDA_PX) passo = Math.ceil((a.y - (fundo - BORDA_PX)) / 5)
    if (passo !== 0) {
      if (rolador === null) window.scrollBy(0, passo)
      else rolador.scrollTop += passo
      acharAlvo()
    }
    a.raf = requestAnimationFrame(rolarNaBorda)
  }, [raiz, acharAlvo])

  /** Tira os ouvintes, a vaga e o cursor de mão fechada. O fantasma fica com quem chamou. */
  const terminar = useRef<() => void>(() => undefined)

  const cancelar = useCallback(() => {
    const a = arrasto.current
    if (a === null) return
    terminar.current()
    const { fantasma, camada, el, origemRect } = a
    const fim = () => {
      camada?.remove()
      delete el.dataset.origem
    }
    if (fantasma === null || origemRect === null || movimentoReduzido()) {
      fim()
      return
    }
    fantasma.classList.add('is-voltando')
    fantasma.classList.remove('is-no-ar')
    fantasma.style.translate = `${origemRect.left}px ${origemRect.top}px`
    setTimeout(fim, VOLTA_MS)
  }, [])

  const soltar = useCallback(() => {
    const a = arrasto.current
    if (a === null) return
    const { alvo, origem, fichaId, el, camada } = a
    if (alvo === null || alvo === origem) {
      cancelar()
      return
    }
    terminar.current()
    camada?.remove()
    void atuais.current.aoSoltar(fichaId, alvo).finally(() => {
      // Gravou: o cartão já saiu desta lista. Não gravou: ele volta ao normal no lugar de antes.
      if (el.isConnected) delete el.dataset.origem
    })
  }, [cancelar])

  const comecar = useCallback(() => {
    const a = arrasto.current
    if (a === null) return
    const rect = a.el.getBoundingClientRect()
    a.dx = a.x0 - rect.left
    a.dy = a.y0 - rect.top
    a.origemRect = rect
    a.origem = atuais.current.origemDe(a.fichaId)
    // A camada leva a classe do quadro: a cópia herda as medidas (--jl-*) e o desenho do cartão.
    const camada = document.createElement('div')
    camada.className = 'jl jl-camada'
    const fantasma = fantasmaDe(a.el, rect)
    camada.appendChild(fantasma)
    document.body.appendChild(camada)
    a.camada = camada
    a.fantasma = fantasma
    a.ativo = true
    a.el.dataset.origem = '1'
    document.body.classList.add('jl-arrastando')
    requestAnimationFrame(() => fantasma.classList.add('is-no-ar'))
    a.raf = requestAnimationFrame(rolarNaBorda)
  }, [rolarNaBorda])

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const a = arrasto.current
      if (a === null || event.pointerId !== a.pointerId) return
      a.x = event.clientX
      a.y = event.clientY
      if (!a.ativo) {
        if (Math.hypot(a.x - a.x0, a.y - a.y0) < LIMIAR_PX) return
        comecar()
      }
      event.preventDefault()
      if (a.fantasma !== null) a.fantasma.style.translate = `${a.x - a.dx}px ${a.y - a.dy}px`
      acharAlvo()
    },
    [comecar, acharAlvo],
  )

  const onPointerUp = useCallback(
    (event: PointerEvent) => {
      const a = arrasto.current
      if (a === null || event.pointerId !== a.pointerId) return
      if (a.ativo) soltar()
      else terminar.current()
    },
    [soltar],
  )

  const onPointerCancel = useCallback(
    (event: PointerEvent) => {
      const a = arrasto.current
      if (a === null || event.pointerId !== a.pointerId) return
      if (a.ativo) cancelar()
      else terminar.current()
    },
    [cancelar],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || arrasto.current?.ativo !== true) return
      // O Esc é do arrasto: não fecha o que está em volta.
      event.preventDefault()
      event.stopPropagation()
      cancelar()
    },
    [cancelar],
  )

  terminar.current = () => {
    const a = arrasto.current
    if (a !== null) cancelAnimationFrame(a.raf)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerCancel)
    document.removeEventListener('keydown', onKeyDown, true)
    document.body.classList.remove('jl-arrastando')
    arrasto.current = null
    setSobre(null)
  }

  // Saiu da tela no meio do arrasto: nada fica pendurado no documento.
  useEffect(
    () => () => {
      const a = arrasto.current
      terminar.current()
      a?.camada?.remove()
    },
    [],
  )

  const onPointerDown = (event: PointerDoReact<HTMLElement>) => {
    if (event.button !== 0 || arrasto.current !== null) return
    const alvo = event.target
    if (!(alvo instanceof Element)) return
    const cartao = alvo.closest<HTMLElement>('[data-ficha]')
    if (cartao === null || !event.currentTarget.contains(cartao)) return
    if (alvo.closest('select, button, input, label') !== null) return
    // No toque, arrastar o cartão inteiro brigaria com a rolagem: só a alça levanta o papel.
    if (event.pointerType !== 'mouse' && alvo.closest('.jl-alca') === null) return
    const fichaId = cartao.dataset.ficha
    if (fichaId === undefined) return
    if (event.pointerType !== 'mouse') event.preventDefault()
    arrasto.current = {
      fichaId,
      el: cartao,
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      x: event.clientX,
      y: event.clientY,
      ativo: false,
      origem: SEM_DONO,
      alvo: null,
      dx: 0,
      dy: 0,
      origemRect: null,
      camada: null,
      fantasma: null,
      raf: 0,
    }
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
    document.addEventListener('keydown', onKeyDown, true)
  }

  return { sobre, onPointerDown }
}
