import { useCallback, useEffect, useRef, type PointerEvent as PointerDoReact } from 'react'
import type { DestinoDoEvento } from '../../lib/preparo/linhaDoTempo'

/**
 * ARRASTAR UM EVENTO PELA ALÇA (E3c, como no protótipo aprovado, tela 5).
 *
 * - Começa depois de 6 px; só pela alça, e só com mouse ou caneta.
 * - Durante o gesto nada passa pelo React: o fantasma, a marca de onde ele
 *   cai, o ano aceso e o "Soltar em …" mudam direto no DOM, e só quando o
 *   alvo troca. A linha inteira só redesenha ao soltar (a mudança do tempo).
 * - Alvos: o ano (`data-solta-ano`, com `data-era` e `data-ano`), com a
 *   posição entre os eventos dele (`li[data-evento]`), e a bandeja
 *   (`data-solta-bandeja`), que tira a data; o evento que já está na bandeja
 *   não tem a bandeja como alvo.
 * - Perto da borda do palco, ele rola sozinho.
 * - Esc desiste; soltar fora de um alvo não muda nada.
 * - O fantasma leva só texto (`textContent`).
 */

const DISTANCIA_PARA_COMECAR = 6
const DESLOCAMENTO_DO_FANTASMA = { x: 14, y: 12 }
/** A faixa perto da borda do palco que rola, e quanto ela rola por quadro no máximo. */
const BORDA_QUE_ROLA = 70
const PASSO_MAXIMO_DA_ROLAGEM = 14
const CLASSE_DO_ALVO = 'e-alvo'
const CLASSE_DO_ARRASTADO = 'e-arrastada'
const CLASSE_DO_CORPO = 'lt-arrastando'

export interface OpcoesDoArrastoNaLinha {
  tituloDe: (eventoId: string) => string
  aoSoltar: (eventoId: string, destino: DestinoDoEvento) => void
  /** Avisa o leitor de tela. */
  anunciar: (texto: string) => void
  /** O que rola durante o arrasto (o palco). */
  rolagem: () => HTMLElement | null
}

interface Gesto {
  readonly id: string
  readonly naBandeja: boolean
  readonly x0: number
  readonly y0: number
  readonly origem: HTMLElement
  iniciado: boolean
  x: number
  y: number
  destino: DestinoDoEvento | null
  /** A chave do destino de agora: só redesenha a marca quando ela troca. */
  chave: string
  fantasma: HTMLDivElement | null
  dica: HTMLDivElement | null
  marca: HTMLDivElement | null
  laco: number
}

function apagarAlvos(gesto: Gesto): void {
  for (const aceso of document.querySelectorAll(`.${CLASSE_DO_ALVO}`)) aceso.classList.remove(CLASSE_DO_ALVO)
  gesto.marca?.remove()
  gesto.marca = null
}

function criarFantasma(titulo: string): { fantasma: HTMLDivElement; dica: HTMLDivElement } {
  const fantasma = document.createElement('div')
  fantasma.className = 'lt-fantasma'
  fantasma.setAttribute('aria-hidden', 'true')
  const pilha = document.createElement('div')
  pilha.className = 'lt-fantasma__pilha'
  pilha.textContent = titulo
  const dica = document.createElement('div')
  dica.className = 'lt-fantasma__alvo'
  dica.textContent = 'Solte num ano da linha'
  fantasma.append(pilha, dica)
  document.body.append(fantasma)
  return { fantasma, dica }
}

function escreverDica(dica: HTMLDivElement | null, antes: string, forte: string, depois: string): void {
  if (dica === null) return
  dica.replaceChildren()
  const negrito = document.createElement('b')
  negrito.textContent = forte
  dica.append(antes, negrito, depois)
}

/** O ano sob o ponteiro: em que posição entre os eventos dele (sem o arrastado) o evento cai. */
function destinoNoAno(gesto: Gesto, ano: HTMLElement, y: number): void {
  const lista = ano.querySelector<HTMLElement>('[data-lista-do-ano]')
  const era = ano.dataset.era
  const numero = Number(ano.dataset.ano)
  if (lista === null || era === undefined || !Number.isFinite(numero)) return
  const itens = [...lista.querySelectorAll<HTMLElement>(':scope > li[data-evento]')].filter((item) => item.dataset.evento !== gesto.id)
  const indice = itens.findIndex((item) => {
    const caixa = item.getBoundingClientRect()
    return y < caixa.top + caixa.height / 2
  })
  const posicao = indice === -1 ? itens.length : indice
  const antesDe = itens[posicao]?.dataset.evento ?? null
  const chave = `${era}|${numero}|${antesDe ?? ''}`
  if (chave === gesto.chave) return
  apagarAlvos(gesto)
  gesto.chave = chave
  gesto.destino = { t: 'ano', era, ano: numero, antesDe }
  const caixaDaLista = lista.getBoundingClientRect()
  const proximo = itens[posicao]
  const anterior = itens[posicao - 1]
  const topo =
    proximo !== undefined
      ? proximo.getBoundingClientRect().top - caixaDaLista.top - 4
      : anterior !== undefined
        ? anterior.getBoundingClientRect().bottom - caixaDaLista.top + 2
        : 24
  const marca = document.createElement('div')
  marca.className = 'lt-marca'
  marca.style.transform = `translateY(${Math.round(topo)}px)`
  lista.append(marca)
  gesto.marca = marca
  ano.classList.add(CLASSE_DO_ALVO)
  escreverDica(gesto.dica, 'Soltar em ', String(numero), `, ${posicao + 1}º do ano`)
}

function trocarDestino(gesto: Gesto): void {
  const sob = document.elementFromPoint(gesto.x, gesto.y)
  const ano = sob instanceof Element ? sob.closest<HTMLElement>('[data-solta-ano]') : null
  if (ano !== null) {
    destinoNoAno(gesto, ano, gesto.y)
    return
  }
  const bandeja = !gesto.naBandeja && sob instanceof Element ? sob.closest<HTMLElement>('[data-solta-bandeja]') : null
  const chave = bandeja === null ? '' : 'bandeja'
  if (chave === gesto.chave) return
  apagarAlvos(gesto)
  gesto.chave = chave
  if (bandeja === null) {
    gesto.destino = null
    if (gesto.dica !== null) gesto.dica.textContent = 'Solte num ano da linha'
    return
  }
  gesto.destino = { t: 'bandeja' }
  bandeja.classList.add(CLASSE_DO_ALVO)
  escreverDica(gesto.dica, 'Tirar a data: volta para a ', 'bandeja', '')
}

/**
 * Devolve o `onPointerDown` da alça. `naBandeja` = o evento ainda não tem
 * data (a bandeja não é alvo dele).
 */
export function useArrastoNaLinha(opcoes: OpcoesDoArrastoNaLinha) {
  const atuais = useRef(opcoes)
  atuais.current = opcoes
  const gesto = useRef<Gesto | null>(null)

  useEffect(() => {
    const limpar = (fim: Gesto) => {
      cancelAnimationFrame(fim.laco)
      fim.fantasma?.remove()
      apagarAlvos(fim)
      fim.origem.closest('li[data-evento]')?.classList.remove(CLASSE_DO_ARRASTADO)
      document.body.classList.remove(CLASSE_DO_CORPO)
    }
    // Perto da borda do palco, rola um pouco a cada quadro (mais rápido quanto mais perto) e refaz o alvo.
    const rolarNaBorda = () => {
      const atual = gesto.current
      if (atual === null || !atual.iniciado) return
      const palco = atuais.current.rolagem()
      if (palco !== null) {
        const caixa = palco.getBoundingClientRect()
        const acima = atual.y - caixa.top
        const abaixo = caixa.bottom - atual.y
        const passo = acima < BORDA_QUE_ROLA ? -(BORDA_QUE_ROLA - acima) : abaixo < BORDA_QUE_ROLA ? BORDA_QUE_ROLA - abaixo : 0
        if (passo !== 0) {
          palco.scrollTop += Math.max(-PASSO_MAXIMO_DA_ROLAGEM, Math.min(PASSO_MAXIMO_DA_ROLAGEM, Math.round(passo / 5)))
          trocarDestino(atual)
        }
      }
      atual.laco = requestAnimationFrame(rolarNaBorda)
    }
    const comecar = (atual: Gesto) => {
      atual.iniciado = true
      const { fantasma, dica } = criarFantasma(atuais.current.tituloDe(atual.id))
      atual.fantasma = fantasma
      atual.dica = dica
      atual.origem.closest('li[data-evento]')?.classList.add(CLASSE_DO_ARRASTADO)
      document.body.classList.add(CLASSE_DO_CORPO)
      atual.laco = requestAnimationFrame(rolarNaBorda)
      atuais.current.anunciar(atual.naBandeja ? 'Arrastando. Solte num ano da linha, ou Esc para desistir.' : 'Arrastando. Solte num ano, ou na bandeja para tirar a data; Esc desiste.')
    }
    const aoMover = (evento: PointerEvent) => {
      const atual = gesto.current
      if (atual === null) return
      if (!atual.iniciado) {
        if (Math.hypot(evento.clientX - atual.x0, evento.clientY - atual.y0) < DISTANCIA_PARA_COMECAR) return
        comecar(atual)
      }
      atual.x = evento.clientX
      atual.y = evento.clientY
      if (atual.fantasma !== null) atual.fantasma.style.transform = `translate(${evento.clientX + DESLOCAMENTO_DO_FANTASMA.x}px, ${evento.clientY + DESLOCAMENTO_DO_FANTASMA.y}px)`
      trocarDestino(atual)
    }
    const aoSoltar = () => {
      const atual = gesto.current
      gesto.current = null
      if (atual === null || !atual.iniciado) return
      limpar(atual)
      if (atual.destino !== null) atuais.current.aoSoltar(atual.id, atual.destino)
    }
    const aoCancelar = () => {
      const atual = gesto.current
      gesto.current = null
      if (atual?.iniciado === true) limpar(atual)
    }
    const aoTeclar = (evento: KeyboardEvent) => {
      const atual = gesto.current
      if (evento.key !== 'Escape' || atual === null || !atual.iniciado) return
      evento.preventDefault()
      evento.stopPropagation()
      gesto.current = null
      limpar(atual)
      atuais.current.anunciar('Arrasto cancelado.')
    }
    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoCancelar)
    window.addEventListener('keydown', aoTeclar, true)
    return () => {
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      window.removeEventListener('keydown', aoTeclar, true)
      if (gesto.current !== null) limpar(gesto.current)
      gesto.current = null
    }
  }, [])

  // Estável: a alça não redesenha por causa dela.
  const aoApertar = useCallback((id: string, naBandeja: boolean, evento: PointerDoReact<HTMLElement>) => {
    if (evento.button !== 0 || evento.pointerType === 'touch') return
    // Sem isto o navegador começa a selecionar o texto do cartão no arrasto.
    evento.preventDefault()
    gesto.current = {
      id,
      naBandeja,
      x0: evento.clientX,
      y0: evento.clientY,
      origem: evento.currentTarget,
      iniciado: false,
      x: evento.clientX,
      y: evento.clientY,
      destino: null,
      chave: '',
      fantasma: null,
      dica: null,
      marca: null,
      laco: 0,
    }
  }, [])
  return { aoApertar }
}
