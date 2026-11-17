import { useCallback, useEffect, useRef, type PointerEvent as PointerDoReact } from 'react'

/**
 * ARRASTAR O RETRATO ATÉ UMA PASTA (E3, como no protótipo aprovado).
 *
 * - Começa depois de 6 px: clicar continua abrindo o verbete.
 * - Durante o gesto nada passa pelo React: o fantasma, o "Soltar em …" e o
 *   alvo aceso mudam direto no DOM, e só quando o alvo troca. A lista inteira
 *   só redesenha ao soltar (a mudança dos verbetes).
 * - Alvo = qualquer elemento com `data-solta-pasta` (a linha da árvore, o
 *   grupo da lista). Parar 600 ms em cima de uma pasta fechada com subpastas
 *   abre a pasta (`aoParar`).
 * - Esc desiste; soltar fora de um alvo não muda nada.
 * - O fantasma leva só texto (`textContent`) e a imagem já mostrada no cartão.
 *
 * Em Lugares (16/11) o alvo também é outro cartão (pôr o lugar dentro de
 * outro): as frases vêm de fora (`textos`) e `recusa` diz quando o alvo não
 * serve (o lugar dentro dele mesmo). O alvo recusado não acende e a dica diz
 * o porquê; quem decide de verdade continua sendo o `aoSoltar`.
 */

const DISTANCIA_PARA_COMECAR = 6
const ESPERA_PARA_ABRIR_MS = 600
const DESLOCAMENTO_DO_FANTASMA = { x: 14, y: 12 }
const CLASSE_DO_ALVO = 'e-alvo'
const CLASSE_DO_ARRASTADO = 'e-arrastada'

export interface OpcoesDoArrasto {
  /** Os ids que vão junto (os marcados, se este estiver marcado). */
  idsDoArrasto: (id: string) => readonly string[]
  /** O rótulo do fantasma ("Capitão Ivo" ou "3 personagens"). */
  rotuloDoArrasto: (ids: readonly string[]) => string
  /** O nome do alvo para o "Soltar em …" (`'sem'` = Sem pasta). */
  nomeDoAlvo: (alvo: string) => string
  /** Pasta fechada com subpastas sob o ponteiro por um tempo: abre. */
  aoParar: (alvo: string) => void
  aoSoltar: (ids: readonly string[], alvo: string) => void
  /** Avisa o leitor de tela ("Arrastando. Solte numa pasta, ou Esc para desistir."). */
  anunciar: (texto: string) => void
  /** As frases do fantasma e do anúncio; sem elas, as das pastas. */
  textos?: TextosDoArrasto
  /** Por que os `ids` não podem cair em `alvo` (`null` = podem). */
  recusa?: (ids: readonly string[], alvo: string) => string | null
}

export interface TextosDoArrasto {
  /** Sem alvo debaixo do ponteiro: "Solte numa pasta". */
  readonly semAlvo: string
  /** Antes do nome do alvo: "Soltar em ". */
  readonly antesDoAlvo: (alvo: string) => string
  /** O anúncio do começo, para o leitor de tela. */
  readonly anuncio: string
}

const TEXTOS_DAS_PASTAS: TextosDoArrasto = {
  semAlvo: 'Solte numa pasta',
  antesDoAlvo: () => 'Soltar em ',
  anuncio: 'Arrastando. Solte numa pasta, ou Esc para desistir.',
}

interface Gesto {
  readonly id: string
  readonly x0: number
  readonly y0: number
  readonly origem: HTMLElement
  iniciado: boolean
  ids: readonly string[]
  alvo: string | null
  /** O porquê de o alvo debaixo do ponteiro não servir; soltar ali não faz nada. */
  recusa: string | null
  fantasma: HTMLDivElement | null
  dica: HTMLDivElement | null
  mola: ReturnType<typeof setTimeout> | undefined
}

function escaparAtributo(valor: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(valor) : valor.replace(/["\\]/g, '')
}

function acenderAlvo(alvo: string | null): void {
  for (const aceso of document.querySelectorAll(`.${CLASSE_DO_ALVO}[data-solta-pasta]`)) aceso.classList.remove(CLASSE_DO_ALVO)
  if (alvo === null) return
  for (const elemento of document.querySelectorAll(`[data-solta-pasta="${escaparAtributo(alvo)}"]`)) elemento.classList.add(CLASSE_DO_ALVO)
}

function marcarArrastados(ids: readonly string[], ligado: boolean): void {
  for (const id of ids) for (const elemento of document.querySelectorAll(`[data-verbete="${escaparAtributo(id)}"]`)) elemento.classList.toggle(CLASSE_DO_ARRASTADO, ligado)
}

/** O fantasma: a foto que o cartão já mostra (ou as iniciais) e o nome; tudo como texto. */
function criarFantasma(origem: HTMLElement, rotulo: string, semAlvo: string): { fantasma: HTMLDivElement; dica: HTMLDivElement } {
  const fantasma = document.createElement('div')
  fantasma.className = 'pp-fantasma'
  fantasma.setAttribute('aria-hidden', 'true')
  const pilha = document.createElement('div')
  pilha.className = 'pp-fantasma__pilha'
  const foto = document.createElement('span')
  foto.className = 'pr-retrato pp-fantasma__foto'
  const imagem = origem.querySelector('img')
  if (imagem !== null && imagem.currentSrc !== '') {
    const copia = document.createElement('img')
    copia.src = imagem.currentSrc
    copia.alt = ''
    foto.append(copia)
  } else {
    const iniciais = document.createElement('span')
    iniciais.className = 'pr-retrato__iniciais'
    iniciais.textContent = origem.querySelector('.pp-carta__iniciais, .pr-retrato__iniciais')?.textContent ?? ''
    foto.append(iniciais)
  }
  const nome = document.createElement('span')
  nome.textContent = rotulo
  pilha.append(foto, nome)
  const dica = document.createElement('div')
  dica.className = 'pp-fantasma__alvo'
  dica.textContent = semAlvo
  fantasma.append(pilha, dica)
  document.body.append(fantasma)
  return { fantasma, dica }
}

type Dica = { readonly t: 'nada'; readonly texto: string } | { readonly t: 'alvo'; readonly antes: string; readonly nome: string; readonly comSubpastas: boolean } | { readonly t: 'recusa'; readonly texto: string }

function mostrarDica(dica: HTMLDivElement, qual: Dica): void {
  dica.replaceChildren()
  dica.classList.toggle('e-recusa', qual.t === 'recusa')
  if (qual.t !== 'alvo') {
    dica.textContent = qual.texto
    return
  }
  const forte = document.createElement('b')
  forte.textContent = qual.nome
  dica.append(qual.antes, forte, qual.comSubpastas ? ', ou numa subpasta' : '')
}

/**
 * Devolve o `onPointerDown` do cartão (ponha no botão que abre o verbete) e
 * `acabouDeSoltar()`, para o clique que vem depois do soltar não abrir o verbete.
 */
export function useArrastoParaPasta(opcoes: OpcoesDoArrasto) {
  const atuais = useRef(opcoes)
  atuais.current = opcoes
  const gesto = useRef<Gesto | null>(null)
  const soltouAgora = useRef(false)

  useEffect(() => {
    const limpar = (fim: Gesto) => {
      clearTimeout(fim.mola)
      fim.fantasma?.remove()
      acenderAlvo(null)
      marcarArrastados(fim.ids, false)
      document.body.classList.remove('pp-arrastando')
    }
    const textos = () => atuais.current.textos ?? TEXTOS_DAS_PASTAS
    const comecar = (atual: Gesto) => {
      atual.iniciado = true
      atual.ids = atuais.current.idsDoArrasto(atual.id)
      const { fantasma, dica } = criarFantasma(atual.origem, atuais.current.rotuloDoArrasto(atual.ids), textos().semAlvo)
      atual.fantasma = fantasma
      atual.dica = dica
      marcarArrastados(atual.ids, true)
      document.body.classList.add('pp-arrastando')
      atuais.current.anunciar(textos().anuncio)
    }
    const dicaDoAlvo = (alvo: string, comSubpastas: boolean): Dica => ({ t: 'alvo', antes: textos().antesDoAlvo(alvo), nome: atuais.current.nomeDoAlvo(alvo), comSubpastas })
    const trocarAlvo = (atual: Gesto, x: number, y: number) => {
      const sob = document.elementFromPoint(x, y)
      const elemento = sob instanceof Element ? sob.closest<HTMLElement>('[data-solta-pasta]') : null
      const alvo = elemento?.dataset.soltaPasta ?? null
      if (alvo === atual.alvo) return
      atual.alvo = alvo
      atual.recusa = alvo === null ? null : (atuais.current.recusa?.(atual.ids, alvo) ?? null)
      clearTimeout(atual.mola)
      acenderAlvo(atual.recusa === null ? alvo : null)
      const fechadaComSub = elemento !== null && elemento.getAttribute('aria-expanded') === 'false'
      if (atual.dica !== null) mostrarDica(atual.dica, alvo === null ? { t: 'nada', texto: textos().semAlvo } : atual.recusa !== null ? { t: 'recusa', texto: atual.recusa } : dicaDoAlvo(alvo, false))
      if (alvo === null || atual.recusa !== null || !fechadaComSub) return
      atual.mola = setTimeout(() => {
        if (gesto.current !== atual || atual.alvo !== alvo) return
        atuais.current.aoParar(alvo)
        // A árvore redesenha com as subpastas: a pasta continua acesa e a dica oferece as de dentro.
        requestAnimationFrame(() => acenderAlvo(atual.alvo))
        if (atual.dica !== null) mostrarDica(atual.dica, dicaDoAlvo(alvo, textos() === TEXTOS_DAS_PASTAS))
      }, ESPERA_PARA_ABRIR_MS)
    }
    const aoMover = (evento: PointerEvent) => {
      const atual = gesto.current
      if (atual === null) return
      if (!atual.iniciado) {
        if (Math.hypot(evento.clientX - atual.x0, evento.clientY - atual.y0) < DISTANCIA_PARA_COMECAR) return
        comecar(atual)
      }
      if (atual.fantasma !== null) atual.fantasma.style.transform = `translate(${evento.clientX + DESLOCAMENTO_DO_FANTASMA.x}px, ${evento.clientY + DESLOCAMENTO_DO_FANTASMA.y}px)`
      trocarAlvo(atual, evento.clientX, evento.clientY)
    }
    const aoSoltar = () => {
      const atual = gesto.current
      gesto.current = null
      if (atual === null || !atual.iniciado) return
      limpar(atual)
      soltouAgora.current = true
      // O clique que o navegador manda logo depois do soltar não abre o verbete.
      setTimeout(() => {
        soltouAgora.current = false
      }, 0)
      if (atual.alvo === null) return
      if (atual.recusa !== null) atuais.current.anunciar(atual.recusa)
      else atuais.current.aoSoltar(atual.ids, atual.alvo)
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

  // Estáveis: os cartões são memorizados e não redesenham por causa delas.
  const aoApertar = useCallback((id: string, evento: PointerDoReact<HTMLElement>) => {
    if (evento.button !== 0 || evento.pointerType === 'touch') return
    gesto.current = { id, x0: evento.clientX, y0: evento.clientY, origem: evento.currentTarget, iniciado: false, ids: [], alvo: null, recusa: null, fantasma: null, dica: null, mola: undefined }
  }, [])
  const acabouDeSoltar = useCallback(() => soltouAgora.current, [])
  return { aoApertar, acabouDeSoltar }
}
