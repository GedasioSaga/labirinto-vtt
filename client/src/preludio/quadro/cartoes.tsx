// Copiado do Grimório: src/components/{CharacterCardShape,CenarioCardShape,ItemCardShape}.tsx
// (adaptado: o esquema e as migrações são os mesmos, letra por letra, para os quadros
// importados abrirem; o cartão desenha o verbete do Prelúdio, não a ficha do Grimório).
import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
import { ROTULO_DO_TIPO, textoPlano } from '../../lib/preparo/enciclopedia'
import type { Verbete } from '../../lib/preparo/tipos'
import { lugarDoVerbete } from '../enciclopedia/ListaDeVerbetes'
import { usePreludio, type Lugar } from '../estado/preludio'
import { urlDaMidia, useRaizDaMidia } from '../midia'
import { ajustarLargura, alturaMoldadaAImagem, colunasPaineisVisiveis, colunasTotais, escalaDoCartao } from './cartaoCanvas'
import { verbeteDoCartao } from './cartaoSemTldraw'

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
  const painel = useRef<HTMLDivElement | null>(null)
  const forma = verbete?.formas.find((cada) => cada.id === verbete.formaAtivaId) ?? verbete?.formas[0]
  const retrato = raiz === null ? null : urlDaMidia(raiz, forma?.retrato)
  const { expandido, fonteEscala } = shape.props
  const escala = escalaDoCartao(shape.props.w, colunas) * fonteEscala
  const selecionado = useValue('cartão selecionado', () => editor.getSelectedShapeIds().includes(shape.id), [editor, shape.id])
  const [chegou] = useState(() => recemChegados.delete(shape.id))

  // A roda dentro do painel rola o texto, não o quadro.
  useEffect(() => {
    const elemento = painel.current
    if (elemento === null) return
    const aoRolar = (evento: WheelEvent) => evento.stopPropagation()
    elemento.addEventListener('wheel', aoRolar, { passive: true })
    return () => elemento.removeEventListener('wheel', aoRolar)
  }, [expandido])

  // Cartão novo, do tamanho padrão: a altura se molda à imagem (como no Grimório), fora do desfazer.
  useEffect(() => {
    if (retrato === null) return
    let vivo = true
    const imagem = new Image()
    imagem.onload = () => {
      if (!vivo || imagem.naturalWidth <= 0 || imagem.naturalHeight <= 0 || editor.getInstanceState().isReadonly) return
      const atual = editor.getShape<CartaoDeVerbete>(shape.id)
      if (atual === undefined || atual.props.expandido) return
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
  const estilo = { '--pr-cartao-fe': escala, '--pr-cartao-coluna': `${shape.props.w / colunas}px` } as CSSProperties
  if (verbete === undefined || forma === undefined) {
    return (
      <HTMLContainer className="pr-cartao pr-cartao--sumiu" style={estilo}>
        <p className="pr-cartao__sumiu">Este verbete não existe mais no Prelúdio.</p>
      </HTMLContainer>
    )
  }

  const nome = verbete.titulo || 'Sem nome'
  const indiceDaForma = verbete.formas.indexOf(forma)
  const trocarForma = (passo: number) => {
    const proxima = verbete.formas[(indiceDaForma + passo + verbete.formas.length) % verbete.formas.length]
    if (proxima !== undefined) usePreludio.getState().mudarVerbete(verbete.id, (atual) => ({ ...atual, formaAtivaId: proxima.id }))
  }
  const secoes = forma.secoes.filter((secao) => textoPlano(secao.texto).trim() !== '')

  return (
    <HTMLContainer className={`pr-cartao${expandido ? ' pr-cartao--aberto' : ''}${selecionado ? ' pr-cartao--selecionado' : ''}${chegou ? ' pr-cartao--chegou' : ''}`} style={estilo}>
      <div className="pr-cartao__principal">
        <div className="pr-cartao__retrato">
          {retrato === null ? <span className="pr-cartao__inicial" aria-hidden="true">{nome.charAt(0).toUpperCase()}</span> : <img src={retrato} alt="" draggable={false} />}
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
        </div>
      </div>
      {expandido && (
        <div className="pr-cartao__painel" ref={painel} onPointerDown={pararNoCartao}>
          {secoes.length === 0 ? (
            <p className="pr-cartao__vazio">Sem texto nesta forma.</p>
          ) : (
            secoes.map((secao) => (
              <section key={secao.id} className="pr-cartao__secao">
                <h3>
                  {secao.titulo || 'Sem título'}
                  {secao.segredo && <span className="pr-cartao__segredo">Segredo</span>}
                </h3>
                <p>{textoPlano(secao.texto, (outro) => usePreludio.getState().verbetes.get(outro)?.titulo)}</p>
              </section>
            ))
          )}
          <button type="button" className="pr-cartao__abrir" onClick={() => abrirVerbeteDoQuadro(verbete)}>
            Abrir o verbete
          </button>
        </div>
      )}
    </HTMLContainer>
  )
}
