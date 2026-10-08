import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { FichaParaTeste } from '../net/visaoDeTeste/tipos'
import { EnterIcon, SearchIcon, TokenIcon } from './icons'
import './EscolherFichaDeTeste.css'

/**
 * VISÃO DE JOGADOR — escolher a ficha. A lista abre colada ao botão que a
 * chamou: "Visão de jogador" na aba Jogo (abre a janela de teste) e "Trocar
 * ficha" na barra da própria janela. É a mesma peça nas duas telas, então
 * mora aqui com CSS próprio: a página do jogador não carrega main.css.
 *
 * Ordem: a ficha selecionada no mapa primeiro (o caminho curto é selecionar,
 * clicar e dar Enter), depois as fichas com jogador e por fim as sem jogador,
 * cada grupo em ordem alfabética. A busca acha pela ficha e pelo jogador, sem
 * ligar para acento nem maiúscula ("ana" acha "Anaïs").
 *
 * Teclado (combobox com lista): o foco nasce na busca; ↑ ↓ andam pela lista
 * (`aria-activedescendant`), Home e End vão às pontas, Enter escolhe, Esc
 * fecha e devolve o foco ao botão, e Tab fecha seguindo a ordem a partir do
 * botão. Aberta pelo teclado, aparece parada: animação depois da tecla
 * parece atraso.
 *
 * A lista vai para o `body` (portal) e se posiciona sozinha: no painel da
 * sala ela nasce dentro de uma seção que rola (`.lb-room`, `overflow: auto`)
 * e com `backdrop-filter`, que prenderia e cortaria qualquer filho flutuante.
 */

/** Largura da lista (maquete 2A); numa janela mais estreita, a tela menos as margens. */
export const LARGURA_DA_ESCOLHA = 300
/** Respiro entre o botão e a lista: o dos menus do app. */
export const FOLGA_DA_ANCORA = 4
/** A lista nunca encosta na borda da tela. */
export const MARGEM_DA_TELA = 8
/** Com menos que isto embaixo do botão, e mais espaço em cima, a lista abre para cima. */
const ALTURA_MINIMA_ABAIXO = 240
/** PageUp e PageDown andam quase uma lista visível (cabem 9 linhas). */
const PASSO_DE_PAGINA = 8
/** Ficha sem nome ainda tem linha: o mestre precisa poder escolhê-la. */
export const NOME_VAZIO = 'Ficha sem nome'
/** Brilho (YIQ, 0 a 255) a partir do qual o disco é claro e as iniciais vão escuras. */
const LIMIAR_DO_DISCO_CLARO = 150

const COR_HEX = /^#[0-9a-f]{6}$/i
const COLACAO = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
const TECLAS_DA_LISTA: ReadonlySet<string> = new Set(['Escape', 'Tab', 'Enter', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'])

export type AberturaDaEscolha = 'ponteiro' | 'teclado'

// ------------------------------------------------------------------ busca

/** Um caractere sem acento e em minúscula; o combinante solto vira nada. */
function normalizarCaractere(caractere: string): string {
  return caractere.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * O texto como a busca o enxerga e, para cada caractere dele, onde ele
 * começa no original: o realce volta ao texto com acento. É a régua do
 * `normalizeForSearch` do editor (lib/mapObjects), copiada de propósito:
 * aquele módulo puxa o editor inteiro, e esta lista também vive na página
 * do jogador.
 */
function textoDeBusca(texto: string): { normal: string; origem: number[] } {
  let normal = ''
  const origem: number[] = []
  let posicao = 0
  for (const caractere of texto) {
    const parte = normalizarCaractere(caractere)
    for (const letra of parte) {
      normal += letra
      origem.push(posicao)
    }
    posicao += caractere.length
  }
  return { normal, origem }
}

/** As palavras digitadas, já na régua da busca. Busca vazia não tem palavra. */
export function palavrasDaBusca(busca: string): string[] {
  return textoDeBusca(busca)
    .normal.split(/\s+/)
    .filter((palavra) => palavra !== '')
}

/** Cada palavra precisa aparecer no nome da ficha ou no do jogador. */
export function fichaCasaComBusca(ficha: Pick<FichaParaTeste, 'nome' | 'dono'>, palavras: readonly string[]): boolean {
  if (palavras.length === 0) return true
  const nome = textoDeBusca(ficha.nome).normal
  const dono = ficha.dono === null ? '' : textoDeBusca(ficha.dono).normal
  return palavras.every((palavra) => nome.includes(palavra) || dono.includes(palavra))
}

export interface TrechoDaBusca {
  texto: string
  marca: boolean
}

/** O texto em pedaços, com o que casou com alguma palavra marcado (a primeira ocorrência de cada uma). */
export function trechosComBusca(texto: string, palavras: readonly string[]): TrechoDaBusca[] {
  if (palavras.length === 0 || texto === '') return [{ texto, marca: false }]
  const { normal, origem } = textoDeBusca(texto)
  const marcado: boolean[] = new Array<boolean>(texto.length).fill(false)
  for (const palavra of palavras) {
    const inicio = normal.indexOf(palavra)
    if (inicio < 0) continue
    const fim = inicio + palavra.length
    const ate = fim < origem.length ? origem[fim] : texto.length
    for (let i = origem[inicio]; i < ate; i += 1) marcado[i] = true
  }
  const trechos: TrechoDaBusca[] = []
  let inicio = 0
  while (inicio < texto.length) {
    const marca = marcado[inicio]
    let fim = inicio
    while (fim < texto.length && marcado[fim] === marca) fim += 1
    trechos.push({ texto: texto.slice(inicio, fim), marca })
    inicio = fim
  }
  return trechos
}

/** O contador da busca: "30 fichas" parada, "2 de 30" filtrando. */
export function contadorDaBusca(achadas: number, total: number, buscando: boolean): string {
  if (buscando) return `${achadas} de ${total}`
  return total === 1 ? '1 ficha' : `${total} fichas`
}

// ------------------------------------------------------------------ ordem

function compararFichas(a: FichaParaTeste, b: FichaParaTeste): number {
  return COLACAO.compare(a.nome, b.nome) || COLACAO.compare(a.dono ?? '', b.dono ?? '')
}

/**
 * A ordem da lista: a selecionada no mapa primeiro; depois quem tem jogador;
 * por último as sem jogador. Dentro de cada grupo, alfabética sem ligar para
 * acento e com número em ordem de número ("Goblin 2" antes de "Goblin 10").
 */
export function ordenarFichas(fichas: readonly FichaParaTeste[], selecionadaId: string | null): FichaParaTeste[] {
  const selecionada = selecionadaId === null ? undefined : fichas.find((ficha) => ficha.id === selecionadaId)
  const resto = fichas.filter((ficha) => ficha !== selecionada)
  const comJogador = resto.filter((ficha) => ficha.dono !== null).sort(compararFichas)
  const semJogador = resto.filter((ficha) => ficha.dono === null).sort(compararFichas)
  return [...(selecionada === undefined ? [] : [selecionada]), ...comJogador, ...semJogador]
}

/** A linha que já nasce ativa: a primeira que trocaria alguma coisa (a ficha que a janela já mostra, não). */
function primeiraParaAtivar(fichas: readonly FichaParaTeste[], abertaId: string | null): FichaParaTeste | undefined {
  return fichas.find((ficha) => ficha.id !== abertaId) ?? fichas[0]
}

// ---------------------------------------------------------------- retrato

const LETRA_OU_NUMERO = /[\p{L}\p{N}]/u
const NUMERO_NO_INICIO = /^\p{N}{1,2}/u
const PEDACO_FORTE = /^[\p{Lu}\p{N}]/u
/** Apelido entre aspas ("Tobias “Pé-Leve” Moreira") não entra nas iniciais. */
const APELIDO = /[“"«][^”"»]*[”"»]/g

/** O que a palavra põe no disco: a primeira letra, ou o número inteiro (até dois algarismos). */
function pedacoDaPalavra(palavra: string): string | undefined {
  const inicio = palavra.search(LETRA_OU_NUMERO)
  if (inicio < 0) return undefined
  const resto = palavra.slice(inicio)
  return NUMERO_NO_INICIO.exec(resto)?.[0] ?? Array.from(resto)[0]
}

/**
 * As iniciais do disco sem foto. Vale o começo das duas primeiras palavras
 * que começam com maiúscula ou número ("Irmã Benedita das Sete…" → IB); o
 * número entra inteiro, porque numa leva de goblins é ele que diferencia
 * ("Goblin batedor 13" → G13). Com menos de duas palavras assim, as duas
 * primeiras palavras ("Cultista encapuzado" → CE).
 */
export function iniciaisDaFicha(nome: string): string {
  const pedacos = nome
    .replace(APELIDO, ' ')
    .split(/\s+/)
    .map(pedacoDaPalavra)
    .filter((pedaco): pedaco is string => pedaco !== undefined)
  if (pedacos.length === 0) return '?'
  const fortes = pedacos.filter((pedaco) => PEDACO_FORTE.test(pedaco))
  return (fortes.length >= 2 ? fortes : pedacos).slice(0, 2).join('').toLocaleUpperCase('pt-BR')
}

/**
 * Iniciais escuras no disco claro. É a escolha da maquete aprovada: claras
 * sobre as cores saturadas das fichas (verde, azul, roxo, vermelho) e escuras
 * sobre o âmbar e o cinza — o brilho YIQ separa os dois grupos em 150.
 */
export function iniciaisEscuras(cor: string): boolean {
  if (!COR_HEX.test(cor)) return false
  const valor = Number.parseInt(cor.slice(1), 16)
  const vermelho = (valor >> 16) & 0xff
  const verde = (valor >> 8) & 0xff
  const azul = valor & 0xff
  return (vermelho * 299 + verde * 587 + azul * 114) / 1000 >= LIMIAR_DO_DISCO_CLARO
}

/** Só a cópia embutida da foto: a janela de teste é a tela do jogador e não busca nada fora. */
function fotoEmbutida(retrato: string | null): retrato is string {
  return retrato !== null && retrato.startsWith('data:image/')
}

export type TamanhoDoRetrato = 18 | 24 | 28

export interface RetratoDaFichaProps {
  ficha: Pick<FichaParaTeste, 'nome' | 'retrato' | 'cor'>
  tamanho?: TamanhoDoRetrato
}

/**
 * O retrato da ficha: a foto, ou o disco na cor dela com as iniciais.
 * Decorativo (`aria-hidden`): o nome está sempre escrito ao lado.
 */
export function RetratoDaFicha({ ficha, tamanho = 28 }: RetratoDaFichaProps) {
  // A foto que não carregou cai para o disco; uma foto nova tenta de novo.
  const [fotoQueFalhou, setFotoQueFalhou] = useState<string | null>(null)
  const foto = fotoEmbutida(ficha.retrato) && ficha.retrato !== fotoQueFalhou ? ficha.retrato : null
  const cor = COR_HEX.test(ficha.cor) ? ficha.cor : null
  const classes = ['vj-retrato', `vj-retrato--${tamanho}`]
  if (foto === null && cor !== null && iniciaisEscuras(cor)) classes.push('vj-retrato--escuro')
  return (
    <span className={classes.join(' ')} style={foto === null && cor !== null ? { backgroundColor: cor } : undefined} aria-hidden="true">
      {foto !== null ? <img src={foto} alt="" draggable={false} onError={() => setFotoQueFalhou(foto)} /> : iniciaisDaFicha(ficha.nome)}
    </span>
  )
}

// ---------------------------------------------------------------- posição

export interface CaixaDaAncora {
  esquerda: number
  topo: number
  direita: number
  base: number
}

export interface LugarDaEscolha {
  esquerda: number
  largura: number
  /** Do alto da tela (abre para baixo) ou do pé da tela (abre para cima); o outro é `null`. */
  topo: number | null
  base: number | null
  /** O espaço que sobra até a margem da tela: a lista rola por dentro do resto. */
  alturaMaxima: number
  /** De onde a entrada cresce: o canto do botão (`transform-origin`). */
  origem: string
}

/**
 * Onde a lista abre: logo abaixo do botão, com a borda direita alinhada à
 * dele, crescendo para a esquerda (no painel, sobre o mapa). Presa à margem
 * da tela; sem espaço embaixo, abre para cima.
 */
export function lugarDaEscolha(ancora: CaixaDaAncora, tela: { largura: number; altura: number }): LugarDaEscolha {
  const largura = Math.max(0, Math.min(LARGURA_DA_ESCOLHA, tela.largura - 2 * MARGEM_DA_TELA))
  const esquerda = Math.max(MARGEM_DA_TELA, Math.min(ancora.direita - largura, tela.largura - MARGEM_DA_TELA - largura))
  const abaixo = tela.altura - MARGEM_DA_TELA - (ancora.base + FOLGA_DA_ANCORA)
  const acima = ancora.topo - FOLGA_DA_ANCORA - MARGEM_DA_TELA
  const origemX = Math.round(Math.min(largura, Math.max(0, ancora.direita - esquerda)))
  if (abaixo < ALTURA_MINIMA_ABAIXO && acima > abaixo) {
    return { esquerda, largura, topo: null, base: tela.altura - ancora.topo + FOLGA_DA_ANCORA, alturaMaxima: acima, origem: `${origemX}px 100%` }
  }
  return { esquerda, largura, topo: ancora.base + FOLGA_DA_ANCORA, base: null, alturaMaxima: Math.max(0, abaixo), origem: `${origemX}px 0` }
}

function medirLugar(ancora: HTMLElement): LugarDaEscolha {
  const caixa = ancora.getBoundingClientRect()
  // `clientWidth` não conta a barra de rolagem da página; no jsdom ele é 0 e vale a janela.
  const largura = document.documentElement.clientWidth || window.innerWidth
  const altura = document.documentElement.clientHeight || window.innerHeight
  return lugarDaEscolha({ esquerda: caixa.left, topo: caixa.top, direita: caixa.right, base: caixa.bottom }, { largura, altura })
}

function mesmoLugar(a: LugarDaEscolha, b: LugarDaEscolha): boolean {
  return a.esquerda === b.esquerda && a.largura === b.largura && a.topo === b.topo && a.base === b.base && a.alturaMaxima === b.alturaMaxima && a.origem === b.origem
}

// ------------------------------------------------------------- componente

export interface EscolherFichaDeTesteProps {
  /** As fichas da cena aberta no editor. */
  fichas: readonly FichaParaTeste[]
  /** A selecionada no mapa: vem primeiro, com o selo "Selecionada". */
  fichaSelecionadaId: string | null
  /**
   * A ficha que a janela já mostra (o "Trocar ficha" da barra): leva o selo
   * "Na janela", não nasce ativa, e escolhê-la só fecha a lista.
   */
  fichaAbertaId?: string | null
  /** O botão que abriu: a lista se prende a ele e devolve o foco a ele. */
  ancora: HTMLElement
  /** Pelo teclado a lista aparece parada; pelo ponteiro, cresce do botão em 120 ms. */
  abertura: AberturaDaEscolha
  /** O que o Enter faz, no rodapé ("abrir", "trocar"). */
  acaoDoEnter: string
  /** `id` da lista, para o `aria-controls` do botão. */
  id?: string
  onEscolher(tokenId: string): void
  /** A lista fechou (Esc, escolha, Tab, clique fora): quem abriu a desmonta. */
  onFechar(): void
}

/** O valor mais recente de uma prop, para ouvintes que não devem se refazer a cada render. */
function useUltimo<T>(valor: T) {
  const ref = useRef(valor)
  useLayoutEffect(() => {
    ref.current = valor
  })
  return ref
}

function Realce({ texto, palavras }: { texto: string; palavras: readonly string[] }) {
  if (palavras.length === 0) return <>{texto}</>
  return (
    <>
      {trechosComBusca(texto, palavras).map((trecho, indice) =>
        trecho.marca ? (
          <mark key={indice} className="vj-escolha__marca">
            {trecho.texto}
          </mark>
        ) : (
          <Fragment key={indice}>{trecho.texto}</Fragment>
        ),
      )}
    </>
  )
}

function seloDaFicha(ficha: FichaParaTeste, selecionadaId: string | null, abertaId: string | null): string | null {
  if (ficha.id === abertaId) return 'Na janela'
  if (ficha.id === selecionadaId) return 'Selecionada'
  return null
}

/** O nome da linha para o leitor de tela: o que o olho junta (ficha, dono e selo) numa frase. */
function rotuloDaLinha(ficha: FichaParaTeste, selo: string | null): string {
  const nome = ficha.nome.trim() === '' ? NOME_VAZIO : ficha.nome
  const dono = ficha.dono === null ? 'sem jogador' : `de ${ficha.dono}`
  const extra = selo === 'Na janela' ? ', já está na janela' : selo === 'Selecionada' ? ', selecionada no mapa' : ''
  return `${nome}, ${dono}${extra}`
}

export function EscolherFichaDeTeste({
  fichas,
  fichaSelecionadaId,
  fichaAbertaId = null,
  ancora,
  abertura,
  acaoDoEnter,
  id,
  onEscolher,
  onFechar,
}: EscolherFichaDeTesteProps) {
  const [busca, setBusca] = useState('')
  const [ativaId, setAtivaId] = useState<string | null>(null)
  const [lugar, setLugar] = useState<LugarDaEscolha>(() => medirLugar(ancora))
  const raizRef = useRef<HTMLDivElement>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const rolarAteAtiva = useRef(false)
  const onFecharRef = useUltimo(onFechar)
  const idProprio = useId()
  const raizId = id ?? idProprio
  const listaId = useId()

  const ordenadas = useMemo(() => ordenarFichas(fichas, fichaSelecionadaId), [fichas, fichaSelecionadaId])
  const palavras = useMemo(() => palavrasDaBusca(busca), [busca])
  const buscando = palavras.length > 0
  const achadas = useMemo(() => ordenadas.filter((ficha) => fichaCasaComBusca(ficha, palavras)), [ordenadas, palavras])
  // A ativa é lembrada pelo id: a lista pode mudar ao vivo (o mestre mexe no editor) sem pular de linha.
  const ativa = achadas.find((ficha) => ficha.id === ativaId) ?? primeiraParaAtivar(achadas, fichaAbertaId)
  const indiceAtivo = ativa === undefined ? -1 : achadas.indexOf(ativa)
  const idDaLinha = (indice: number) => `${listaId}-${indice}`
  const idDaAtiva = indiceAtivo < 0 ? undefined : idDaLinha(indiceAtivo)
  // O separador só na lista parada: a selecionada é um grupo à parte do resto.
  const separarSelecionada = !buscando && achadas.length > 1 && achadas[0]?.id === fichaSelecionadaId

  // O foco nasce na busca (ou na própria lista, numa cena sem ficha).
  useLayoutEffect(() => {
    ;(buscaRef.current ?? raizRef.current)?.focus({ preventScroll: true })
  }, [])

  // A cena ficou sem ficha com a lista aberta: a busca sai, e o foco não pode cair no vazio.
  useEffect(() => {
    if (fichas.length === 0 && document.activeElement === document.body) raizRef.current?.focus({ preventScroll: true })
  }, [fichas.length])

  // Presa ao botão: a janela muda de tamanho e o painel rola sem levar a lista para longe dele.
  useLayoutEffect(() => {
    const reposicionar = (evento?: Event): void => {
      // Rolar a própria lista não move o botão.
      if (evento?.target instanceof Node && raizRef.current?.contains(evento.target)) return
      const novo = medirLugar(ancora)
      setLugar((atual) => (mesmoLugar(atual, novo) ? atual : novo))
    }
    reposicionar()
    window.addEventListener('resize', reposicionar)
    window.addEventListener('scroll', reposicionar, true)
    return () => {
      window.removeEventListener('resize', reposicionar)
      window.removeEventListener('scroll', reposicionar, true)
    }
  }, [ancora])

  // O clique fora e o foco que sai fecham. O botão fica de fora: o clique nele alterna a lista.
  useEffect(() => {
    const fecharSeForFora = (evento: Event): void => {
      const alvo = evento.target
      if (!(alvo instanceof Node)) return
      if (raizRef.current?.contains(alvo) || ancora.contains(alvo)) return
      onFecharRef.current()
    }
    document.addEventListener('pointerdown', fecharSeForFora, true)
    document.addEventListener('focusin', fecharSeForFora)
    return () => {
      document.removeEventListener('pointerdown', fecharSeForFora, true)
      document.removeEventListener('focusin', fecharSeForFora)
    }
  }, [ancora, onFecharRef])

  // Pelo teclado a ativa nunca sai da vista; pelo ponteiro ela já está sob ele.
  useLayoutEffect(() => {
    if (!rolarAteAtiva.current || idDaAtiva === undefined) return
    rolarAteAtiva.current = false
    document.getElementById(idDaAtiva)?.scrollIntoView?.({ block: 'nearest' })
  }, [idDaAtiva])

  function fecharDevolvendoFoco(): void {
    ancora.focus({ preventScroll: true })
    onFechar()
  }

  function escolher(ficha: FichaParaTeste): void {
    ancora.focus({ preventScroll: true })
    // A ficha que a janela já mostra: não há o que trocar.
    if (ficha.id !== fichaAbertaId) onEscolher(ficha.id)
    onFechar()
  }

  function ativarIndice(indice: number): void {
    const ficha = achadas[indice]
    if (ficha === undefined) return
    rolarAteAtiva.current = true
    setAtivaId(ficha.id)
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    const tecla = evento.key
    if (!TECLAS_DA_LISTA.has(tecla) || evento.nativeEvent.isComposing) return
    // Shift+Home/End selecionam o texto da busca: a tecla é do campo.
    if ((tecla === 'Home' || tecla === 'End') && evento.shiftKey) return
    // A tecla é desta lista. No editor, o Esc soltaria a ficha selecionada no
    // mapa (e mudaria a própria lista) e as setas empurrariam o objeto; na
    // janela de teste, o Esc fecharia o cartão do jogador.
    evento.stopPropagation()
    evento.nativeEvent.stopImmediatePropagation()
    if (tecla === 'Tab') {
      // Sem `preventDefault`: com o foco de volta no botão, o Tab do navegador segue dali.
      ancora.focus({ preventScroll: true })
      onFechar()
      return
    }
    evento.preventDefault()
    if (tecla === 'Escape') {
      fecharDevolvendoFoco()
      return
    }
    const total = achadas.length
    if (total === 0) return
    const atual = Math.max(0, indiceAtivo)
    switch (tecla) {
      case 'Enter':
        if (ativa !== undefined) escolher(ativa)
        return
      case 'ArrowDown':
        ativarIndice((atual + 1) % total)
        return
      case 'ArrowUp':
        ativarIndice((atual - 1 + total) % total)
        return
      case 'Home':
        ativarIndice(0)
        return
      case 'End':
        ativarIndice(total - 1)
        return
      case 'PageDown':
        ativarIndice(Math.min(total - 1, atual + PASSO_DE_PAGINA))
        return
      case 'PageUp':
        ativarIndice(Math.max(0, atual - PASSO_DE_PAGINA))
        return
    }
  }

  // Clicar no que não é campo (rodapé, borda, linha) não tira o foco da busca: o teclado continua valendo.
  // A própria lista fica de fora: ali o aperto pode ser na barra de rolagem, que precisa do gesto inteiro.
  function manterFocoNaBusca(evento: MouseEvent<HTMLDivElement>): void {
    if (buscaRef.current === null || evento.target === buscaRef.current || evento.target === listaRef.current) return
    evento.preventDefault()
  }

  // O foco que caiu na caixa (aperto na barra de rolagem, no vão entre linhas) volta para a busca.
  function devolverFocoABusca(evento: FocusEvent<HTMLDivElement>): void {
    if (evento.target === raizRef.current) buscaRef.current?.focus({ preventScroll: true })
  }

  const estilo: CSSProperties = {
    left: lugar.esquerda,
    width: lugar.largura,
    top: lugar.topo ?? undefined,
    bottom: lugar.base ?? undefined,
    maxHeight: lugar.alturaMaxima,
    transformOrigin: lugar.origem,
  }

  const conteudo =
    fichas.length === 0 ? (
      // 2D: cena sem ficha. O botão nunca fica desligado: quem clica ouve o motivo.
      <div className="vj-escolha__vazio vj-escolha__vazio--cena" role="status">
        <span className="vj-escolha__vazio-icone">
          <TokenIcon size={24} />
        </span>
        <p className="vj-escolha__vazio-titulo">Nenhuma ficha nesta cena</p>
        <p className="vj-escolha__vazio-texto">A Visão de jogador olha pelos olhos de uma ficha. Ponha uma ficha no mapa e abra de novo.</p>
      </div>
    ) : (
      <>
        <div className="vj-escolha__busca">
          <span className="vj-escolha__lupa">
            <SearchIcon size={16} />
          </span>
          <input
            ref={buscaRef}
            className="vj-escolha__campo"
            type="text"
            role="combobox"
            aria-label="Buscar ficha ou jogador"
            aria-expanded="true"
            aria-controls={achadas.length > 0 ? listaId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={idDaAtiva}
            placeholder="Buscar ficha ou jogador"
            autoComplete="off"
            spellCheck={false}
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value)
              // Outra busca, outra lista: volta para a primeira linha, no alto.
              setAtivaId(null)
              listaRef.current?.scrollTo?.({ top: 0 })
            }}
          />
          <span className="vj-escolha__contador" aria-live="polite">
            {contadorDaBusca(achadas.length, fichas.length, buscando)}
          </span>
        </div>
        {achadas.length === 0 ? (
          // 2C: a busca não achou nada. Diz o que procurar, sem caixa vazia.
          <div className="vj-escolha__vazio" role="status">
            <p className="vj-escolha__vazio-titulo">Nenhuma ficha com “{busca.trim()}”.</p>
            <p className="vj-escolha__vazio-texto">Busque pelo nome da ficha ou do jogador.</p>
          </div>
        ) : (
          <div ref={listaRef} id={listaId} className="vj-escolha__lista" role="listbox" aria-label="Fichas">
            {achadas.map((ficha, indice) => {
              const selo = seloDaFicha(ficha, fichaSelecionadaId, fichaAbertaId)
              const nome = ficha.nome.trim() === '' ? NOME_VAZIO : ficha.nome
              const ehAtiva = indice === indiceAtivo
              return (
                <Fragment key={ficha.id}>
                  <div
                    id={idDaLinha(indice)}
                    role="option"
                    aria-selected={ehAtiva}
                    aria-label={rotuloDaLinha(ficha, selo)}
                    className="vj-escolha__linha"
                    onPointerMove={() => {
                      if (!ehAtiva) setAtivaId(ficha.id)
                    }}
                    onClick={() => escolher(ficha)}
                  >
                    <RetratoDaFicha ficha={ficha} tamanho={28} />
                    <span className="vj-escolha__nomes">
                      <span className={ficha.nome.trim() === '' ? 'vj-escolha__nome vj-escolha__nome--vazio' : 'vj-escolha__nome'} title={nome}>
                        <Realce texto={nome} palavras={palavras} />
                      </span>
                      {ficha.dono === null ? (
                        <span className="vj-escolha__dono vj-escolha__dono--sem">sem jogador</span>
                      ) : (
                        <span className="vj-escolha__dono" title={ficha.dono}>
                          <Realce texto={ficha.dono} palavras={palavras} />
                        </span>
                      )}
                    </span>
                    {selo !== null && <span className={selo === 'Na janela' ? 'vj-escolha__selo vj-escolha__selo--janela' : 'vj-escolha__selo'}>{selo}</span>}
                    {/* O lugar do Enter existe em toda linha: a ativa não encolhe o nome ao acender. */}
                    <span className="vj-escolha__enter">
                      <EnterIcon size={14} />
                    </span>
                  </div>
                  {indice === 0 && separarSelecionada && <div className="vj-escolha__sep" aria-hidden="true" />}
                </Fragment>
              )
            })}
          </div>
        )}
      </>
    )

  return createPortal(
    <div
      ref={raizRef}
      id={raizId}
      className="vj-escolha"
      role="dialog"
      aria-label="Escolher a ficha"
      tabIndex={-1}
      data-abertura={abertura}
      data-lado={lugar.base === null ? 'abaixo' : 'acima'}
      style={estilo}
      onKeyDown={aoTeclar}
      onMouseDown={manterFocoNaBusca}
      onFocus={devolverFocoABusca}
    >
      {conteudo}
      <div className="vj-escolha__pe" aria-hidden="true">
        {achadas.length > 0 && (
          <>
            <span className="vj-escolha__dica">
              <kbd className="vj-escolha__tecla">↑</kbd>
              <kbd className="vj-escolha__tecla">↓</kbd>
              escolher
            </span>
            <span className="vj-escolha__dica">
              <kbd className="vj-escolha__tecla">Enter</kbd>
              {acaoDoEnter}
            </span>
          </>
        )}
        <span className="vj-escolha__dica">
          <kbd className="vj-escolha__tecla">Esc</kbd>
          fechar
        </span>
      </div>
    </div>,
    document.body,
  )
}
