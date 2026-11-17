// Copiado do Grimório: src/components/{CharacterCardShape,CenarioCardShape,ItemCardShape}.tsx
// (adaptado: o esquema e as migrações são os mesmos, letra por letra, para os quadros
// importados abrirem; o cartão desenha o verbete do Prelúdio, não a ficha do Grimório).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  useEditor,
  useValue,
  type RecordProps,
  type TLShape,
  type TLShapePartial,
} from 'tldraw'
import { ROTULO_DO_TIPO } from '../../lib/preparo/enciclopedia'
import { estaNaLixeira, soOsVivos } from '../../lib/preparo/lixeira'
import type { Secao, Verbete } from '../../lib/preparo/tipos'
import { lugarDoVerbete } from '../enciclopedia/ListaDeVerbetes'
import { usePreludio, type Lugar } from '../estado/preludio'
import { urlDaMidia, useRaizDaMidia } from '../midia'
import { ajustarLargura, alturaMoldadaAImagem, colunasPaineisVisiveis, colunasTotais, escalaDoCartao } from './cartaoCanvas'
import { verbeteDoCartao } from './cartaoSemTldraw'
import { escalaDosControles } from './escalaFonte'
import { FaixaDeItens, itensVivos } from './FaixaDeItens'
import { ControlesDaFonte, TextoDoCartao } from './PainelDoCartao'
import { colunaDaSecao, descreverGiro, espessuraDaFaixa, larguraDoConteudo, posicaoDoRetrato, proximoLado, tamanhoAoTrocarLado, TITULO_DA_COLUNA, type ChaveDaColuna, type LadoDaFaixa } from './partesDoCartao'

export const CARD_LARGURA_PADRAO = 240
export const CARD_ALTURA_PADRAO = 320

/** Lados da faixa de itens do cartão de cenário (Grimório, `lib/faixaItensCenario.ts`). */
const LADOS_FAIXA = ['oculta', 'baixo', 'direita', 'cima', 'esquerda'] as const
type LadoFaixa = (typeof LADOS_FAIXA)[number]

// tldraw 4.x: formas próprias entram no union TLShape pelo TLGlobalShapePropsMap.
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'character-card': {
      w: number
      h: number
      personagemId: string
      expandido: boolean
      infoExpandido: boolean
      infoAoLado: boolean
      fonteEscala: number
    }
    'cenario-card': {
      w: number
      h: number
      cenarioId: string
      expandido: boolean
      infoExpandido: boolean
      infoAoLado: boolean
      eventosExpandido: boolean
      eventosAoLado: boolean
      itensExpandido: boolean
      itensAoLado: boolean
      fonteEscala: number
      itensFaixa: LadoFaixa
    }
    'item-card': {
      w: number
      h: number
      itemId: string
      expandido: boolean
      infoExpandido: boolean
      infoAoLado: boolean
      efeitoExpandido: boolean
      efeitoAoLado: boolean
      fonteEscala: number
    }
  }
}

export type CartaoDePersonagem = TLShape<'character-card'>
export type CartaoDeLugar = TLShape<'cenario-card'>
export type CartaoDeItem = TLShape<'item-card'>
export type CartaoDeVerbete = CartaoDePersonagem | CartaoDeLugar | CartaoDeItem

// ─── Esquemas (iguais aos do Grimório) ───────────────────────────────────────

const versoesDoPersonagem = createShapePropsMigrationIds('character-card', {
  AdicionaExpandido: 1,
  AdicionaInfoExpandido: 2,
  AdicionaInfoAoLado: 3,
  AdicionaFonteEscala: 4,
})

const versoesDoCenario = createShapePropsMigrationIds('cenario-card', {
  AdicionaSecoesEventosItens: 1,
  AdicionaFonteEscala: 2,
  AdicionaFaixaDeItens: 3,
})

/** O id do verbete que o cartão desenha (cada tipo do Grimório guardou com um nome). */
export function idDoCartao(shape: CartaoDeVerbete): string {
  switch (shape.type) {
    case 'character-card':
      return shape.props.personagemId
    case 'cenario-card':
      return shape.props.cenarioId
    case 'item-card':
      return shape.props.itemId
  }
}

export class CartaoDePersonagemUtil extends BaseBoxShapeUtil<CartaoDePersonagem> {
  static override type = 'character-card' as const
  static override props: RecordProps<CartaoDePersonagem> = {
    w: T.positiveNumber,
    h: T.positiveNumber,
    personagemId: T.string,
    expandido: T.boolean,
    infoExpandido: T.boolean,
    infoAoLado: T.boolean,
    fonteEscala: T.positiveNumber,
  }

  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: versoesDoPersonagem.AdicionaExpandido,
        up(props) {
          props.expandido = false
        },
        down(props) {
          delete props.expandido
        },
      },
      {
        id: versoesDoPersonagem.AdicionaInfoExpandido,
        up(props) {
          props.infoExpandido = false
        },
        down(props) {
          delete props.infoExpandido
        },
      },
      {
        id: versoesDoPersonagem.AdicionaInfoAoLado,
        up(props) {
          props.infoAoLado = false
        },
        down(props) {
          delete props.infoAoLado
        },
      },
      {
        id: versoesDoPersonagem.AdicionaFonteEscala,
        up(props) {
          props.fonteEscala = 1
        },
        down(props) {
          delete props.fonteEscala
        },
      },
    ],
  })

  override getDefaultProps(): CartaoDePersonagem['props'] {
    return { w: CARD_LARGURA_PADRAO, h: CARD_ALTURA_PADRAO, personagemId: '', expandido: false, infoExpandido: false, infoAoLado: false, fonteEscala: 1 }
  }

  override canEdit() {
    return false
  }

  // Recolhido, o aspecto trava: o cartão segue emoldurado à imagem ao redimensionar.
  override isAspectRatioLocked(shape: CartaoDePersonagem) {
    return !shape.props.expandido
  }

  // Duplo clique abre e fecha o painel do texto, como no Grimório.
  override onDoubleClick = (shape: CartaoDePersonagem) => {
    const expandir = !shape.props.expandido
    const paineis = shape.props.infoAoLado ? 2 : 1
    return { id: shape.id, type: shape.type, props: { expandido: expandir, w: ajustarLargura(shape.props.w, expandir ? paineis : -paineis) } }
  }

  override component(shape: CartaoDePersonagem) {
    return <CartaoNoQuadro shape={shape} colunas={colunasTotais(shape.props.expandido, shape.props.infoAoLado ? 1 : 0)} />
  }

  override indicator(shape: CartaoDePersonagem) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />
  }
}

function aoLadoNoCenario(props: CartaoDeLugar['props']): number {
  return [props.infoAoLado, props.eventosAoLado, props.itensAoLado].filter(Boolean).length
}

export class CartaoDeLugarUtil extends BaseBoxShapeUtil<CartaoDeLugar> {
  static override type = 'cenario-card' as const
  static override props: RecordProps<CartaoDeLugar> = {
    w: T.positiveNumber,
    h: T.positiveNumber,
    cenarioId: T.string,
    expandido: T.boolean,
    infoExpandido: T.boolean,
    infoAoLado: T.boolean,
    eventosExpandido: T.boolean,
    eventosAoLado: T.boolean,
    itensExpandido: T.boolean,
    itensAoLado: T.boolean,
    fonteEscala: T.positiveNumber,
    itensFaixa: T.literalEnum(...LADOS_FAIXA),
  }

  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: versoesDoCenario.AdicionaSecoesEventosItens,
        up(props) {
          props.eventosExpandido = false
          props.eventosAoLado = false
          props.itensExpandido = false
          props.itensAoLado = false
        },
        down(props) {
          delete props.eventosExpandido
          delete props.eventosAoLado
          delete props.itensExpandido
          delete props.itensAoLado
        },
      },
      {
        id: versoesDoCenario.AdicionaFonteEscala,
        up(props) {
          props.fonteEscala = 1
        },
        down(props) {
          delete props.fonteEscala
        },
      },
      {
        id: versoesDoCenario.AdicionaFaixaDeItens,
        up(props) {
          props.itensFaixa = 'oculta'
        },
        down(props) {
          delete props.itensFaixa
        },
      },
    ],
  })

  override getDefaultProps(): CartaoDeLugar['props'] {
    return {
      w: CARD_LARGURA_PADRAO,
      h: CARD_ALTURA_PADRAO,
      cenarioId: '',
      expandido: false,
      infoExpandido: false,
      infoAoLado: false,
      eventosExpandido: false,
      eventosAoLado: false,
      itensExpandido: false,
      itensAoLado: false,
      fonteEscala: 1,
      itensFaixa: 'oculta',
    }
  }

  override canEdit() {
    return false
  }

  override isAspectRatioLocked(shape: CartaoDeLugar) {
    return !shape.props.expandido
  }

  override onDoubleClick = (shape: CartaoDeLugar) => {
    const expandir = !shape.props.expandido
    const delta = colunasPaineisVisiveis(true, aoLadoNoCenario(shape.props))
    return { id: shape.id, type: shape.type, props: { expandido: expandir, w: ajustarLargura(shape.props.w, expandir ? delta : -delta) } }
  }

  override component(shape: CartaoDeLugar) {
    return <CartaoNoQuadro shape={shape} colunas={colunasTotais(shape.props.expandido, aoLadoNoCenario(shape.props))} />
  }

  override indicator(shape: CartaoDeLugar) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />
  }
}

function aoLadoNoItem(props: CartaoDeItem['props']): number {
  return [props.infoAoLado, props.efeitoAoLado].filter(Boolean).length
}

// Sem migrações, como no Grimório: o cartão de item nasceu com todas as props.
export class CartaoDeItemUtil extends BaseBoxShapeUtil<CartaoDeItem> {
  static override type = 'item-card' as const
  static override props: RecordProps<CartaoDeItem> = {
    w: T.positiveNumber,
    h: T.positiveNumber,
    itemId: T.string,
    expandido: T.boolean,
    infoExpandido: T.boolean,
    infoAoLado: T.boolean,
    efeitoExpandido: T.boolean,
    efeitoAoLado: T.boolean,
    fonteEscala: T.positiveNumber,
  }

  override getDefaultProps(): CartaoDeItem['props'] {
    return { w: CARD_LARGURA_PADRAO, h: CARD_ALTURA_PADRAO, itemId: '', expandido: false, infoExpandido: false, infoAoLado: false, efeitoExpandido: false, efeitoAoLado: false, fonteEscala: 1 }
  }

  override canEdit() {
    return false
  }

  override isAspectRatioLocked(shape: CartaoDeItem) {
    return !shape.props.expandido
  }

  override onDoubleClick = (shape: CartaoDeItem) => {
    const expandir = !shape.props.expandido
    const delta = colunasPaineisVisiveis(true, aoLadoNoItem(shape.props))
    return { id: shape.id, type: shape.type, props: { expandido: expandir, w: ajustarLargura(shape.props.w, expandir ? delta : -delta) } }
  }

  override component(shape: CartaoDeItem) {
    return <CartaoNoQuadro shape={shape} colunas={colunasTotais(shape.props.expandido, aoLadoNoItem(shape.props))} />
  }

  override indicator(shape: CartaoDeItem) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />
  }
}

export const UTILS_DOS_CARTOES = [CartaoDePersonagemUtil, CartaoDeLugarUtil, CartaoDeItemUtil]

// ─── O cartão desenhado ──────────────────────────────────────────────────────

export { verbeteDoCartao } from './cartaoSemTldraw'

/** Para o rótulo e para o tipo de cartão de um verbete novo no quadro. */
export function tipoDeCartaoDo(verbete: Verbete): CartaoDeVerbete['type'] {
  if (verbete.tipo === 'lugar') return 'cenario-card'
  if (verbete.tipo === 'item') return 'item-card'
  return 'character-card'
}

/** A mudança só da altura, com o tipo certo de cada cartão (o tldraw não aceita o tipo em aberto). */
function comAltura(cartao: CartaoDeVerbete, h: number): TLShapePartial<CartaoDeVerbete> {
  switch (cartao.type) {
    case 'character-card':
      return { id: cartao.id, type: cartao.type, props: { h } }
    case 'cenario-card':
      return { id: cartao.id, type: cartao.type, props: { h } }
    case 'item-card':
      return { id: cartao.id, type: cartao.type, props: { h } }
  }
}

/** A mudança só do tamanho da letra, com o tipo certo de cada cartão. */
function comFonte(cartao: CartaoDeVerbete, fonteEscala: number): TLShapePartial<CartaoDeVerbete> {
  switch (cartao.type) {
    case 'character-card':
      return { id: cartao.id, type: cartao.type, props: { fonteEscala } }
    case 'cenario-card':
      return { id: cartao.id, type: cartao.type, props: { fonteEscala } }
    case 'item-card':
      return { id: cartao.id, type: cartao.type, props: { fonteEscala } }
  }
}

/** As seções que cada cartão põe numa coluna própria (Grimório: no personagem, Informações; no lugar, Informações, Eventos e Itens; no item, Informações e Efeito). */
const COLUNAS_DO_CARTAO: Readonly<Record<CartaoDeVerbete['type'], readonly ChaveDaColuna[]>> = {
  'character-card': ['informacao'],
  'cenario-card': ['informacao', 'eventos', 'itens'],
  'item-card': ['informacao', 'efeito'],
}

/** As colunas "ao lado" ligadas neste cartão. */
function colunasAoLado(cartao: CartaoDeVerbete): ReadonlySet<ChaveDaColuna> {
  const ligadas = new Set<ChaveDaColuna>()
  if (cartao.props.infoAoLado) ligadas.add('informacao')
  if (cartao.type === 'cenario-card' && cartao.props.eventosAoLado) ligadas.add('eventos')
  if (cartao.type === 'cenario-card' && cartao.props.itensAoLado) ligadas.add('itens')
  if (cartao.type === 'item-card' && cartao.props.efeitoAoLado) ligadas.add('efeito')
  return ligadas
}

/** A mudança de uma coluna "ao lado" e da largura, com o tipo certo de cada cartão; `null` = a coluna não existe neste cartão. */
function comColuna(cartao: CartaoDeVerbete, chave: ChaveDaColuna, aoLado: boolean, w: number): TLShapePartial<CartaoDeVerbete> | null {
  switch (cartao.type) {
    case 'character-card':
      return chave === 'informacao' ? { id: cartao.id, type: cartao.type, props: { infoAoLado: aoLado, w } } : null
    case 'cenario-card':
      if (chave === 'informacao') return { id: cartao.id, type: cartao.type, props: { infoAoLado: aoLado, w } }
      if (chave === 'eventos') return { id: cartao.id, type: cartao.type, props: { eventosAoLado: aoLado, w } }
      return chave === 'itens' ? { id: cartao.id, type: cartao.type, props: { itensAoLado: aoLado, w } } : null
    case 'item-card':
      if (chave === 'informacao') return { id: cartao.id, type: cartao.type, props: { infoAoLado: aoLado, w } }
      return chave === 'efeito' ? { id: cartao.id, type: cartao.type, props: { efeitoAoLado: aoLado, w } } : null
  }
}

/** O acervo vazio, sempre o mesmo: o seletor raso não vê mudança e o cartão não redesenha. */
const SEM_ITENS: readonly (Verbete | undefined)[] = []

const BOLSA = (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M5 7.5h10l-.8 8.1a1 1 0 0 1-1 .9H6.8a1 1 0 0 1-1-.9zM7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5" />
  </svg>
)

function pararNoCartao(evento: { stopPropagation: () => void }) {
  evento.stopPropagation()
}

/** De onde se volta à página do verbete: o quadro como está (sem alvo, a câmera volta onde estava). */
function voltaDoQuadro(lugar: Lugar): Lugar {
  if (lugar.secao === 'quadros') return { secao: 'quadros', quadroId: lugar.quadroId }
  if (lugar.secao === 'sessoes') return { secao: 'sessoes', sessaoId: lugar.sessaoId, aba: 'quadro' }
  return lugar
}

/** Abre a página do verbete, com "‹ Voltar ao quadro" no topo. */
export function abrirVerbeteDoQuadro(verbete: Verbete): void {
  const { lugar, verbetes, ir } = usePreludio.getState()
  ir(lugarDoVerbete(verbete, verbetes), { lugar: voltaDoQuadro(lugar), rotulo: 'Voltar ao quadro' })
}

/** Cartões que acabaram de ser postos pelo mestre: entram com um assentar curto, uma vez (os que abrem com o quadro, não). */
const recemChegados = new Set<string>()

export function marcarChegada(formaId: string): void {
  recemChegados.add(formaId)
}

function CartaoNoQuadro({ shape, colunas }: { shape: CartaoDeVerbete; colunas: number }) {
  const editor = useEditor()
  const id = idDoCartao(shape)
  const verbete = usePreludio((estado) => verbeteDoCartao(estado.verbetes, id))
  const raiz = useRaizDaMidia()
  const corpo = useRef<HTMLDivElement | null>(null)
  const forma = verbete?.formas.find((cada) => cada.id === verbete.formaAtivaId) ?? verbete?.formas[0]
  const retrato = raiz === null ? null : urlDaMidia(raiz, forma?.retrato)
  const { expandido, fonteEscala } = shape.props
  // A faixa de itens (só o lugar) não entra na escala: ligar a faixa ao lado não aumenta o texto (Grimório, `larguraDoConteudo`).
  const lado: LadoDaFaixa = shape.type === 'cenario-card' ? shape.props.itensFaixa : 'oculta'
  const largura = larguraDoConteudo(shape.props.w, lado, colunas)
  const escala = escalaDoCartao(largura, colunas) * fonteEscala
  // Os verbetes dos itens do acervo: o cartão só redesenha quando um deles muda (e não a cada letra digitada em outro verbete).
  const acervo = shape.type === 'cenario-card' ? forma?.acervo : undefined
  const verbetesDosItens = usePreludio(useShallow((estado) => (acervo === undefined ? SEM_ITENS : acervo.map((entrada) => verbeteDoCartao(estado.verbetes, entrada.itemId)))))
  // O item que está na Lixeira sai da faixa, como o que não existe mais; restaurado, volta.
  const itens = useMemo(() => (verbetesDosItens === SEM_ITENS ? [] : itensVivos(acervo, soOsVivos(usePreludio.getState().verbetes))), [verbetesDosItens, acervo])
  const selecionado = useValue('cartão selecionado', () => editor.getSelectedShapeIds().includes(shape.id), [editor, shape.id])
  const somenteVer = useValue('quadro só para ver', () => editor.getInstanceState().isReadonly, [editor])
  const verbeteTravado = usePreludio((estado) => estado.travado || (verbete !== undefined && estado.soLeitura.has(verbete.id)))
  // Os controles do cartão escolhido não somem com a câmera afastada (Grimório, `escalaDosControles`).
  const controles = useValue('escala dos controles', () => (selecionado ? escalaDosControles(escala, editor.getZoomLevel()) : 1), [editor, selecionado, escala])
  const [chegou] = useState(() => recemChegados.delete(shape.id))
  const [editando, setEditando] = useState<string | null>(null)

  // Trocar de forma ou fechar o painel fecha o editor (o que estava para gravar vai antes).
  const formaId = forma?.id
  useEffect(() => {
    setEditando(null)
  }, [formaId, expandido])

  // A roda dentro de um painel ou da faixa rola o texto ou os itens, não o quadro (um ouvinte no corpo cobre todas as colunas).
  // Restaurado da Lixeira, o corpo é montado de novo e o ouvinte volta com ele.
  const existe = verbete !== undefined && forma !== undefined && !estaNaLixeira(verbete)
  useEffect(() => {
    const elemento = corpo.current
    if (elemento === null) return
    const aoRolar = (evento: WheelEvent) => {
      if (evento.target instanceof Element && evento.target.closest('.pr-cartao__painel, .pr-faixa') !== null) evento.stopPropagation()
    }
    elemento.addEventListener('wheel', aoRolar, { passive: true })
    return () => elemento.removeEventListener('wheel', aoRolar)
  }, [existe])

  // Cartão novo, do tamanho padrão: a altura se molda à imagem (como no Grimório), fora do desfazer.
  useEffect(() => {
    if (retrato === null) return
    let vivo = true
    const imagem = new Image()
    imagem.onload = () => {
      if (!vivo || imagem.naturalWidth <= 0 || imagem.naturalHeight <= 0 || editor.getInstanceState().isReadonly) return
      const atual = editor.getShape<CartaoDeVerbete>(shape.id)
      if (atual === undefined || atual.props.expandido) return
      // Com a faixa, a altura padrão já não é a da imagem: emoldurar esmagaria a faixa.
      if (atual.type === 'cenario-card' && atual.props.itensFaixa !== 'oculta') return
      if (atual.props.w !== CARD_LARGURA_PADRAO || atual.props.h !== CARD_ALTURA_PADRAO) return
      const altura = alturaMoldadaAImagem(atual.props.w, imagem.naturalWidth / imagem.naturalHeight)
      if (altura !== atual.props.h) editor.run(() => editor.updateShape(comAltura(atual, altura)), { history: 'ignore' })
    }
    imagem.src = retrato
    return () => {
      vivo = false
    }
  }, [retrato, shape.id, editor])

  // A coluna da imagem tem a largura de uma coluna do cartão; a letra segue a escala (e o "tamanho da fonte" do Grimório).
  const estilo = {
    '--pr-cartao-fe': escala,
    '--pr-cartao-ctrl': controles,
    '--pr-cartao-coluna': `${largura / colunas}px`,
    '--pr-faixa-esp': `${espessuraDaFaixa(shape.props.w, lado, colunas)}px`,
  } as CSSProperties // o tipo do React não conhece as variáveis CSS (--pr-*); os valores são número e px
  // Na Lixeira o cartão fica no lugar, apagado, e volta inteiro quando o verbete é restaurado.
  if (verbete === undefined || forma === undefined || estaNaLixeira(verbete)) {
    return (
      <HTMLContainer className="pr-cartao pr-cartao--sumiu" style={estilo}>
        <p className="pr-cartao__sumiu">
          {verbete === undefined || forma === undefined ? 'Este verbete não existe mais no Prelúdio.' : `${verbete.titulo || 'Sem nome'} está na Lixeira. Restaure pela Lixeira da Enciclopédia para o cartão voltar.`}
        </p>
      </HTMLContainer>
    )
  }

  const nome = verbete.titulo || 'Sem nome'
  const indiceDaForma = verbete.formas.indexOf(forma)
  const trocarForma = (passo: number) => {
    const proxima = verbete.formas[(indiceDaForma + passo + verbete.formas.length) % verbete.formas.length]
    if (proxima !== undefined) usePreludio.getState().mudarVerbete(verbete.id, (atual) => ({ ...atual, formaAtivaId: proxima.id }))
  }
  const mudarFonte = (proxima: number) => {
    const atual = editor.getShape<CartaoDeVerbete>(shape.id)
    if (atual === undefined || editor.getInstanceState().isReadonly) return
    editor.markHistoryStoppingPoint('tamanho da letra do cartão')
    editor.updateShape(comFonte(atual, proxima))
  }

  // As colunas "ao lado" (Grimório: Informações, Eventos, Itens, Efeito numa coluna própria do cartão aberto).
  const chaves = COLUNAS_DO_CARTAO[shape.type]
  const ligadas = colunasAoLado(shape)
  const principais: Secao[] = []
  const porColuna = new Map<ChaveDaColuna, Secao[]>()
  for (const secao of forma.secoes) {
    const chave = colunaDaSecao(secao, chaves)
    if (chave === null || !ligadas.has(chave)) principais.push(secao)
    else porColuna.set(chave, [...(porColuna.get(chave) ?? []), secao])
  }
  const alternarColuna = (chave: ChaveDaColuna) => {
    const atual = editor.getShape<CartaoDeVerbete>(shape.id)
    if (atual === undefined || editor.getInstanceState().isReadonly) return
    const aoLado = colunasAoLado(atual).has(chave)
    const mudanca = comColuna(atual, chave, !aoLado, ajustarLargura(atual.props.w, aoLado ? -1 : 1))
    if (mudanca === null) return
    // A coluna e a largura numa mudança só: um Ctrl+Z desfaz as duas.
    editor.markHistoryStoppingPoint('coluna do cartão')
    editor.updateShape(mudanca)
  }
  const ladoDaSecao = (secao: Secao) => {
    const chave = colunaDaSecao(secao, chaves)
    return chave === null || somenteVer ? null : { aoLado: ligadas.has(chave), alternar: () => alternarColuna(chave) }
  }

  // A faixa de itens do lugar: o botão da bolsa gira a faixa pelos quatro lados e a esconde (um Ctrl+Z desfaz o giro inteiro).
  const proximo = proximoLado(lado)
  const girarFaixa = () => {
    const atual = editor.getShape<CartaoDeVerbete>(shape.id)
    if (atual === undefined || atual.type !== 'cenario-card' || editor.getInstanceState().isReadonly) return
    const para = proximoLado(atual.props.itensFaixa)
    editor.markHistoryStoppingPoint('girar a faixa de itens')
    editor.updateShape({ id: atual.id, type: atual.type, props: { itensFaixa: para, ...tamanhoAoTrocarLado(atual.props, colunas, atual.props.itensFaixa, para) } })
  }
  const textoDoCartao = (secoes: readonly Secao[], semSecao?: { titulo: string; alternar: (() => void) | null }) => (
    <TextoDoCartao
      verbete={verbete}
      forma={forma}
      raiz={raiz}
      podeEscrever={!somenteVer && !verbeteTravado}
      editando={editando}
      aoEditar={setEditando}
      aoAbrirVerbete={abrirVerbeteDoQuadro}
      secoes={secoes}
      {...(semSecao === undefined ? {} : { semSecao })}
      ladoDaSecao={ladoDaSecao}
    />
  )

  return (
    <HTMLContainer
      className={`pr-cartao${expandido ? ' pr-cartao--aberto' : ''}${selecionado ? ' pr-cartao--selecionado' : ''}${chegou ? ' pr-cartao--chegou' : ''}${lado === 'oculta' ? '' : ` pr-cartao--faixa-${lado}`}`}
      style={estilo}
    >
      <div ref={corpo} className="pr-cartao__corpo">
        <div className="pr-cartao__conteudo">
          <div className="pr-cartao__principal">
            <div className="pr-cartao__retrato">
              {retrato === null ? (
                <span className="pr-cartao__inicial" aria-hidden="true">
                  {nome.charAt(0).toUpperCase()}
                </span>
              ) : (
                // O enquadramento que veio do Grimório (`forma.extras.foco`): sem ele, o centro.
                <img src={retrato} alt="" draggable={false} style={{ objectPosition: posicaoDoRetrato(forma.extras?.foco) }} />
              )}
              <button type="button" className="pr-cartao__ir" aria-label={`Abrir o verbete ${nome}`} title="Abrir o verbete" onPointerDown={pararNoCartao} onClick={() => abrirVerbeteDoQuadro(verbete)}>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M8 4.5H5.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V12M11 4.5h4.5V9M15.5 4.5 9 11" />
                </svg>
              </button>
            </div>
            <div className="pr-cartao__texto">
              <span className="pr-cartao__tipo">{ROTULO_DO_TIPO[verbete.tipo].um}</span>
              <span className="pr-cartao__nome">{nome}</span>
              {forma.resumo !== '' && <span className="pr-cartao__resumo">{forma.resumo}</span>}
              {verbete.formas.length >= 2 && (
                <span className="pr-cartao__formas" onPointerDown={pararNoCartao}>
                  <button type="button" aria-label="Forma anterior" onClick={() => trocarForma(-1)}>
                    ‹
                  </button>
                  <span>{forma.nome || 'Forma sem nome'}</span>
                  <button type="button" aria-label="Próxima forma" onClick={() => trocarForma(1)}>
                    ›
                  </button>
                </span>
              )}
              {(selecionado && !somenteVer) || (shape.type === 'cenario-card' && (itens.length > 0 || lado !== 'oculta')) ? (
                <span className="pr-cartao__controles">
                  {selecionado && !somenteVer && <ControlesDaFonte escala={fonteEscala} aoMudar={mudarFonte} />}
                  {shape.type === 'cenario-card' && (itens.length > 0 || lado !== 'oculta') && (
                    <button
                      type="button"
                      className="pr-cartao__bolsa"
                      aria-label={descreverGiro(lado, proximo)}
                      title={descreverGiro(lado, proximo)}
                      disabled={somenteVer}
                      onPointerDown={pararNoCartao}
                      onClick={girarFaixa}
                    >
                      {BOLSA}
                      {itens.length}
                    </button>
                  )}
                </span>
              ) : null}
            </div>
          </div>
          {expandido && (
            <>
              <div className="pr-cartao__painel" onPointerDown={pararNoCartao}>
                {textoDoCartao(principais)}
                <button type="button" className="pr-cartao__abrir" onClick={() => abrirVerbeteDoQuadro(verbete)}>
                  Abrir o verbete
                </button>
              </div>
              {chaves
                .filter((chave) => ligadas.has(chave))
                .map((chave) => {
                  const secoes = porColuna.get(chave) ?? []
                  return (
                    <div key={chave} className="pr-cartao__painel pr-cartao__painel--ao-lado" onPointerDown={pararNoCartao}>
                      {secoes.length === 0 ? textoDoCartao(secoes, { titulo: TITULO_DA_COLUNA[chave], alternar: somenteVer ? null : () => alternarColuna(chave) }) : textoDoCartao(secoes)}
                    </div>
                  )
                })}
            </>
          )}
        </div>
        {lado !== 'oculta' && <FaixaDeItens shapeId={shape.id} itens={itens} lado={lado} raiz={raiz} aoAbrir={abrirVerbeteDoQuadro} />}
      </div>
    </HTMLContainer>
  )
}
