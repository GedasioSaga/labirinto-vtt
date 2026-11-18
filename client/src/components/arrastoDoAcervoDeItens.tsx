import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { ItemDoCatalogo, PastaDeItens } from '../lib/acervoDeItens'
import { ImagemOuIniciais } from './FichaPecas'
import { FolderIcon } from './icons'

/**
 * O ARRASTO DO ACERVO DE ITENS: um gesto só para o item (até o mapa, como
 * desde a entrega 5, ou até uma pasta do painel) e para a pasta (para dentro
 * de outra, ou para o topo). De ponteiro, não o drag-and-drop do HTML: o mapa
 * é o canvas do Pixi, que não fala `dragover`/`drop`.
 *
 * - Começa depois de 6 px: o clique continua abrindo o item / a pasta.
 * - Durante o gesto nada passa pelo React: o fantasma, a frase dele e a pasta
 *   acesa mudam direto no DOM, só quando o alvo troca. A lista só redesenha ao
 *   começar (o "Sem pasta" de soltar aparece) e ao soltar (a mudança).
 * - Alvo = elemento com `data-itens-pasta` dentro do painel; o mais de dentro
 *   ganha (a subpasta dentro da pasta). A recusa (a pasta dentro dela mesma ou
 *   de uma das de dentro dela) ganha contorno de brasa, cursor de proibido e o
 *   porquê na frase do fantasma; soltar ali não muda nada.
 * - Parar 600 ms sobre uma pasta fechada abre a pasta (como no Prelúdio).
 * - Esc desiste. O item solto fora das pastas vai ao mapa (`soltarNoMapa`
 *   decide se ali é o mapa), com o Alt da estrela como sempre.
 */

/** Atributo do alvo: o id da pasta, ou `TOPO`. */
export const ATRIBUTO_DO_ALVO = 'data-itens-pasta'
/** O alvo "topo": Sem pasta, para o item; fora de todas, para a pasta. */
export const TOPO = ''

const LIMIAR_DO_ARRASTO_PX = 6
const ESPERA_PARA_ABRIR_MS = 600
const CLASSE_DA_RECUSA_NO_BODY = 'lb-itens-recusando'

export type Arrastado = { readonly tipo: 'item'; readonly item: ItemDoCatalogo } | { readonly tipo: 'pasta'; readonly pasta: PastaDeItens }

/** O que soltar ali faz: `pode` acende, `recusa` marca de brasa, `ja-esta` não marca nada (soltar não muda nada). */
export interface Avaliacao {
  readonly t: 'pode' | 'recusa' | 'ja-esta'
  /** A frase do fantasma ("Soltar em Balas", o porquê da recusa). */
  readonly texto: string
}

export interface OpcoesDoArrasto {
  raiz: RefObject<HTMLElement | null>
  /** Há disco: as pastas aceitam o soltar. Sem ele, só o item ao mapa. */
  podeOrganizar: boolean
  /** O item solto fora das pastas, neste ponto da janela; `alt` = o Alt apertado ao soltar. Ausente = o item não vai ao mapa. */
  soltarNoMapa?: (item: ItemDoCatalogo, clientX: number, clientY: number, alt: boolean) => boolean
  /** `destino` = id da pasta, ou `null` para o topo. */
  avaliar: (arrastado: Arrastado, destino: string | null) => Avaliacao
  soltarNaPasta: (arrastado: Arrastado, destino: string | null) => void
  /** A pasta fechada sob o ponteiro há 600 ms: abre. */
  abrirAoParar: (destino: string) => void
}

/** Sem alvo debaixo do ponteiro: o que o fantasma diz. O item não diz nada (a linha de ajuda já fala do mapa). */
function fraseSemAlvo(arrastado: Arrastado): string {
  return arrastado.tipo === 'pasta' ? 'Solte numa pasta, ou no topo' : ''
}

/** O fantasma da pasta fica ao lado do ponteiro, como no Prelúdio: em cima, ele cobriria o nome da pasta de destino. */
const DESLOCAMENTO_DA_PASTA = { x: 14, y: 12 }
/** O mínimo entre o fantasma e a borda esquerda da janela (o trilho do acervo encosta nela). */
const MARGEM_DA_JANELA_PX = 8

/**
 * Leva o fantasma ao ponteiro. Estilo direto: sem render do React por quadro.
 * O do item vai centrado (é onde ele cai no mapa), mas não passa da borda
 * esquerda: a frase longa ("Uma pasta não entra…") o alarga, e o trilho
 * encosta na borda.
 */
function posicionarFantasma(fantasma: HTMLElement, ponto: { x: number; y: number }, tipo: Arrastado['tipo']): void {
  if (tipo === 'pasta') {
    fantasma.style.transform = `translate(${ponto.x + DESLOCAMENTO_DA_PASTA.x}px, ${ponto.y + DESLOCAMENTO_DA_PASTA.y}px)`
    return
  }
  const x = Math.max(ponto.x, fantasma.offsetWidth / 2 + MARGEM_DA_JANELA_PX)
  fantasma.style.transform = `translate(${x}px, ${ponto.y}px) translate(-50%, -50%)`
}

export function useArrastoDoAcervoDeItens(opcoes: OpcoesDoArrasto) {
  const opcoesRef = useRef(opcoes)
  opcoesRef.current = opcoes
  const [arrastado, setArrastado] = useState<Arrastado | null>(null)
  const fantasmaRef = useRef<HTMLDivElement | null>(null)
  const dicaRef = useRef<HTMLSpanElement | null>(null)
  /** A frase do fantasma agora; quem a escreve na tela é o DOM, não o React. */
  const fraseRef = useRef('')
  const pontoRef = useRef({ x: 0, y: 0 })
  const engolirCliqueRef = useRef(false)
  const soltarOuvintesRef = useRef<(() => void) | null>(null)

  // Painel desmontado no meio do arrasto: os ouvintes de janela não podem sobreviver a ele.
  useEffect(() => () => soltarOuvintesRef.current?.(), [])

  const comecar = (event: ReactPointerEvent<HTMLElement>, quem: Arrastado) => {
    const { podeOrganizar, soltarNoMapa } = opcoesRef.current
    const podeArrastar = quem.tipo === 'item' ? podeOrganizar || soltarNoMapa !== undefined : podeOrganizar
    if (!podeArrastar || event.button !== 0 || !event.isPrimary) return
    soltarOuvintesRef.current?.()
    engolirCliqueRef.current = false
    const pointerId = event.pointerId
    const inicio = { x: event.clientX, y: event.clientY }
    let arrastando = false
    let cancelado = false
    let alvo: HTMLElement | null = null
    let destino: string | null = null
    let avaliacao: Avaliacao | null = null
    let mola: ReturnType<typeof setTimeout> | undefined

    fraseRef.current = fraseSemAlvo(quem)
    // A frase vale também antes de o fantasma existir: o primeiro passo do arrasto já acha o alvo, e o fantasma monta depois.
    const dizer = (texto: string) => {
      fraseRef.current = texto
      if (dicaRef.current !== null) dicaRef.current.textContent = texto
    }
    const apagarAlvo = () => {
      clearTimeout(mola)
      alvo?.removeAttribute('data-alvo')
      document.body.classList.remove(CLASSE_DA_RECUSA_NO_BODY)
      alvo = null
      avaliacao = null
    }
    const trocarAlvo = (x: number, y: number) => {
      const atuais = opcoesRef.current
      const sob = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null
      const achado = sob === null ? null : sob.closest<HTMLElement>(`[${ATRIBUTO_DO_ALVO}]`)
      const novo = achado !== null && atuais.podeOrganizar && atuais.raiz.current?.contains(achado) === true ? achado : null
      if (novo === alvo) return
      apagarAlvo()
      if (novo === null) {
        dizer(fraseSemAlvo(quem))
        return
      }
      const id = novo.getAttribute(ATRIBUTO_DO_ALVO) ?? TOPO
      alvo = novo
      destino = id === TOPO ? null : id
      avaliacao = atuais.avaliar(quem, destino)
      if (avaliacao.t !== 'ja-esta') novo.setAttribute('data-alvo', avaliacao.t === 'pode' ? 'dentro' : 'recusa')
      document.body.classList.toggle(CLASSE_DA_RECUSA_NO_BODY, avaliacao.t === 'recusa')
      dizer(avaliacao.texto === '' ? fraseSemAlvo(quem) : avaliacao.texto)
      // A pasta fechada que aceita o soltar abre se o ponteiro parar nela: dá para descer até a subpasta.
      const fechada = novo.querySelector(':scope > .lb-acervo__pasta-topo [aria-expanded="false"]') !== null
      const paraAbrir = destino
      if (avaliacao.t === 'pode' && paraAbrir !== null && fechada) mola = setTimeout(() => opcoesRef.current.abrirAoParar(paraAbrir), ESPERA_PARA_ABRIR_MS)
    }

    const mover = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || cancelado) return
      pontoRef.current = { x: e.clientX, y: e.clientY }
      if (!arrastando) {
        if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < LIMIAR_DO_ARRASTO_PX) return
        arrastando = true
        setArrastado(quem)
      }
      // O alvo antes: a frase dele muda a largura do fantasma, e a posição a lê.
      trocarAlvo(e.clientX, e.clientY)
      if (fantasmaRef.current !== null) posicionarFantasma(fantasmaRef.current, pontoRef.current, quem.tipo)
    }
    const encerrar = (e: PointerEvent, soltou: boolean) => {
      if (e.pointerId !== pointerId) return
      // Lido ANTES de desligar os ouvintes: o desligar apaga o alvo.
      const ondeCaiu = alvo === null ? null : { destino, avaliacao }
      soltarOuvintesRef.current?.()
      if (!arrastando) return
      setArrastado(null)
      // O `click` chega logo depois deste `pointerup`; o `setTimeout` libera o próximo clique de verdade.
      engolirCliqueRef.current = true
      setTimeout(() => {
        engolirCliqueRef.current = false
      }, 0)
      if (!soltou || cancelado) return
      const atuais = opcoesRef.current
      if (ondeCaiu !== null) {
        if (ondeCaiu.avaliacao?.t === 'pode') atuais.soltarNaPasta(quem, ondeCaiu.destino)
        return
      }
      if (quem.tipo === 'item') atuais.soltarNoMapa?.(quem.item, e.clientX, e.clientY, e.altKey)
    }
    const aoSoltar = (e: PointerEvent) => encerrar(e, true)
    const aoCancelar = (e: PointerEvent) => encerrar(e, false)
    // Esc desiste, na CAPTURA e parando ali: no mapa ele largaria a seleção.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !arrastando || cancelado) return
      e.preventDefault()
      e.stopImmediatePropagation()
      cancelado = true
      apagarAlvo()
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
      apagarAlvo()
      soltarOuvintesRef.current = null
    }
  }

  const fantasma =
    arrastado === null
      ? null
      : createPortal(
          <div
            className="lb-acervo__fantasma lb-itens__fantasma"
            aria-hidden="true"
            ref={(el) => {
              fantasmaRef.current = el
              if (el !== null) posicionarFantasma(el, pontoRef.current, arrastado.tipo)
            }}
          >
            {arrastado.tipo === 'item' ? (
              <span className="lb-itens__foto lb-itens__fantasma-foto">
                <ImagemOuIniciais imagem={arrastado.item.imagem} nome={arrastado.item.nome} />
              </span>
            ) : (
              <FolderIcon size={16} />
            )}
            <span className="lb-itens__fantasma-texto">
              <span>{arrastado.tipo === 'item' ? arrastado.item.nome : arrastado.pasta.nome}</span>
              {/* Sem filho do React: o texto é posto aqui (ao montar) e trocado pelo gesto direto no DOM. */}
              <span
                className="lb-itens__fantasma-alvo"
                ref={(el) => {
                  dicaRef.current = el
                  if (el !== null) el.textContent = fraseRef.current
                }}
              />
            </span>
          </div>,
          document.body,
        )

  return { comecar, arrastado, fantasma, engolirClique: () => engolirCliqueRef.current }
}
