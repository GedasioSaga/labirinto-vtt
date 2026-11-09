import { getSchema, mergeAttributes, Node, type AnyExtension, type Editor, type Extensions } from '@tiptap/core'
import type { DOMOutputSpec, Node as NoDoDocumento } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { alvoDaMesa, alvoParaGravar, type AlvoNaMesa } from '../../lib/preparo/sessoes'
import { PECAS_DO_TEXTO, type TextoRico } from '../../lib/preparo/tipos'

/**
 * O ESQUEMA DO TEXTO DO PRELÚDIO (plano §2): o StarterKit (o mesmo do Grimório),
 * a imagem que a importação grava (`importar/texto.ts`) e as 3 peças nossas:
 * `segredo`, `mencao {verbeteId}` e `ligacaoMesa`. Todo nó que pode estar no
 * disco tem de existir aqui: o TipTap esvazia o documento que tem nó desconhecido,
 * e o salvar automático gravaria o vazio por cima.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    segredo: {
      /** Põe os blocos da seleção dentro de um bloco de segredo, ou tira de dentro. */
      alternarSegredo: () => ReturnType
    }
  }
}

// ─── Imagem ──────────────────────────────────────────────────────────────────

export interface OpcoesDaImagem {
  /** `midia/<sha256>.<ext>` → endereço para o `<img>`; `null` = não dá para mostrar. */
  urlDe: (midia: string | null) => string | null
}

/**
 * Um atributo que vai e volta pelo HTML como `data-<nome>`. É o caminho do
 * copiar, recortar e colar, e do arrastar de uma seção para outra: o que não
 * sai no HTML some no colar. `chave` é o nome no documento (`verbeteId`) e
 * `nome`, o do HTML (`verbete-id`).
 */
function atributoDeDado(chave: string, nome: string = chave) {
  return {
    default: null,
    parseHTML: (elemento: HTMLElement) => elemento.getAttribute(`data-${nome}`),
    renderHTML: (atributos: Record<string, unknown>) => {
      const valor = atributos[chave]
      return valor === null || valor === undefined ? {} : { [`data-${nome}`]: String(valor) }
    },
  }
}

const LARGURA_MAXIMA = 4000

function larguraValida(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : null
}

/** A imagem do texto, com os atributos da importação (`rel` guarda o caminho antigo do cofre). */
export const Imagem = Node.create<OpcoesDaImagem>({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: false,
  addOptions() {
    return { urlDe: () => null }
  },
  addAttributes() {
    return {
      midia: atributoDeDado('midia'),
      rel: atributoDeDado('rel'),
      alt: atributoDeDado('alt'),
      title: atributoDeDado('title'),
      largura: {
        default: null,
        parseHTML: (elemento: HTMLElement) => larguraValida(Number(elemento.getAttribute('data-largura'))),
        renderHTML: (atributos: Record<string, unknown>) => {
          const largura = larguraValida(atributos.largura)
          return largura === null ? {} : { 'data-largura': String(largura) }
        },
      },
      align: atributoDeDado('align'),
      legenda: atributoDeDado('legenda'),
    }
  },
  // Só a marcação do próprio Prelúdio volta como imagem (copiar e colar dentro do app): imagem de fora não entra pelo colar.
  parseHTML() {
    return [{ tag: 'figure[data-imagem]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const { midia, alt, title, largura, legenda } = node.attrs as Record<string, unknown>
    const src = this.options.urlDe(typeof midia === 'string' ? midia : null)
    const texto = typeof legenda === 'string' && legenda !== '' ? legenda : typeof alt === 'string' ? alt : ''
    const valida = larguraValida(largura)
    const tamanho = valida === null ? null : Math.min(valida, LARGURA_MAXIMA)
    const figura = mergeAttributes(HTMLAttributes, { 'data-imagem': '', class: 'pr-figura' })
    const conteudo: DOMOutputSpec =
      src === null
        ? ['span', { class: 'pr-figura__falta' }, 'Imagem sem arquivo no Prelúdio']
        : ['img', { src, alt: texto, title: typeof title === 'string' ? title : null, loading: 'lazy', decoding: 'async', style: tamanho === null ? null : `width: ${tamanho}px` }]
    return typeof legenda === 'string' && legenda !== '' ? ['figure', figura, conteudo, ['figcaption', {}, legenda]] : ['figure', figura, conteudo]
  },
})

// ─── Segredo ─────────────────────────────────────────────────────────────────

/** Bloco de segredo: aparece só para o mestre e nunca sai do PC. */
export const Segredo = Node.create({
  name: PECAS_DO_TEXTO.segredo,
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-segredo]' }]
  },
  renderHTML() {
    return ['div', { 'data-segredo': '', class: 'pr-segredo' }, 0]
  },
  addCommands() {
    return {
      alternarSegredo:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    }
  },
})

// ─── Ligação com a mesa ──────────────────────────────────────────────────────

export interface EstadoDaMesaNoTexto {
  /** O alvo sumiu: o link fica riscado, com a dica dizendo o quê. */
  readonly quebrado: boolean
  readonly dica: string
  /** O clique leva a algum lugar (a ficha sem verbete ligado não leva). */
  readonly abre: boolean
}

export interface OpcoesDaMesa {
  /** Como o link está agora; a lista mudou fora do texto (o catálogo da mesa leu o disco): `reavaliarMesa`. */
  estadoDe: (alvo: AlvoNaMesa) => EstadoDaMesaNoTexto
  aoAbrir: (alvo: AlvoNaMesa) => void
}

const CHAVE_DA_MESA = new PluginKey<DecorationSet>('pr-mesa-estado')
const CHAVE_DO_CLIQUE_NA_MESA = new PluginKey('pr-mesa-clique')

/** "pino", "cena" ou "ficha": o desenho do link muda o ícone por ele. */
function tipoDoLink(alvo: AlvoNaMesa | null): string {
  if (alvo === null) return 'torto'
  return alvo.tipo === 'ficha' ? 'ficha' : alvo.pinoId === undefined ? 'cena' : 'pino'
}

function decoracoesDaMesa(documento: NoDoDocumento, estadoDe: OpcoesDaMesa['estadoDe']): DecorationSet {
  const decoracoes: Decoration[] = []
  documento.descendants((no, posicao) => {
    if (no.type.name !== PECAS_DO_TEXTO.ligacaoMesa) return true
    const alvo = alvoDaMesa(no.attrs.alvo)
    const estado = alvo === null ? { quebrado: true, dica: 'Este link não aponta para nada que o Labirinto entenda.', abre: false } : estadoDe(alvo)
    // Quebrado: o "não existe mais" aparece escrito ao lado do nome (preludio.css), e a dica diz o que sumiu.
    const atributos = estado.quebrado ? { class: 'pr-mesa--quebrada', title: estado.dica, 'data-aviso': 'não existe mais' } : { class: estado.abre ? 'pr-mesa--abre' : '', title: estado.dica }
    decoracoes.push(Decoration.node(posicao, posicao + no.nodeSize, atributos))
    return false
  })
  return DecorationSet.create(documento, decoracoes)
}

/** Refaz o estado dos links depois que o catálogo da mesa leu o disco. Não mexe no texto nem entra no desfazer. */
export function reavaliarMesa(editor: Editor): void {
  if (editor.isDestroyed) return
  editor.view.dispatch(editor.state.tr.setMeta(CHAVE_DA_MESA, true).setMeta('addToHistory', false))
}

/**
 * Link para cena, pino ou ficha (F4), pelo id (`lib/preparo/sessoes.ts`). O
 * rótulo é o nome na hora de ligar; o estado (existe, "não existe mais") vem
 * da decoração, refeita quando o catálogo da mesa muda. O alvo vai e volta
 * pelo HTML (`data-alvo`), para o link sobreviver ao copiar e colar.
 */
export const LigacaoMesa = Node.create<OpcoesDaMesa>({
  name: PECAS_DO_TEXTO.ligacaoMesa,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addOptions() {
    return { estadoDe: () => ({ quebrado: false, dica: '', abre: false }), aoAbrir: () => undefined }
  },
  addAttributes() {
    return {
      alvo: {
        default: null,
        parseHTML: (elemento: HTMLElement) => {
          try {
            const alvo = alvoDaMesa(JSON.parse(elemento.getAttribute('data-alvo') ?? 'null'))
            return alvo === null ? null : alvoParaGravar(alvo)
          } catch {
            return null
          }
        },
        renderHTML: (atributos: Record<string, unknown>) => {
          const alvo = alvoDaMesa(atributos.alvo)
          return alvo === null ? {} : { 'data-alvo': JSON.stringify(alvoParaGravar(alvo)) }
        },
      },
      rotulo: { default: '', parseHTML: (elemento: HTMLElement) => elemento.getAttribute('data-rotulo') ?? '', renderHTML: (atributos: Record<string, unknown>) => ({ 'data-rotulo': String(atributos.rotulo ?? '') }) },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-ligacao-mesa]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const rotulo = typeof node.attrs.rotulo === 'string' && node.attrs.rotulo !== '' ? node.attrs.rotulo : 'mesa'
    return ['span', mergeAttributes(HTMLAttributes, { class: 'pr-mesa', 'data-ligacao-mesa': '', 'data-tipo': tipoDoLink(alvoDaMesa(node.attrs.alvo)) }), rotulo]
  },
  renderText({ node }) {
    return typeof node.attrs.rotulo === 'string' ? node.attrs.rotulo : ''
  },
  addProseMirrorPlugins() {
    const { estadoDe, aoAbrir } = this.options
    return [
      new Plugin<DecorationSet>({
        key: CHAVE_DA_MESA,
        state: {
          init: (_configuracao, estado) => decoracoesDaMesa(estado.doc, estadoDe),
          apply: (transacao, antes, _estadoAntes, estadoDepois) => (transacao.docChanged || transacao.getMeta(CHAVE_DA_MESA) === true ? decoracoesDaMesa(estadoDepois.doc, estadoDe) : antes),
        },
        props: { decorations: (estado) => CHAVE_DA_MESA.getState(estado) },
      }),
      new Plugin({
        key: CHAVE_DO_CLIQUE_NA_MESA,
        props: {
          handleClickOn: (_vista, _posicao, no) => {
            if (no.type.name !== PECAS_DO_TEXTO.ligacaoMesa) return false
            const alvo = alvoDaMesa(no.attrs.alvo)
            if (alvo === null || !estadoDe(alvo).abre) return false
            aoAbrir(alvo)
            return true
          },
        },
      }),
    ]
  },
})

// ─── Citação do quadro (F3b) ─────────────────────────────────────────────────

export interface AlvoDaCitacao {
  readonly quadroId: string
  /** A forma citada (`shape:…`); `null` = o quadro inteiro. */
  readonly formaId: string | null
}

export interface OpcoesDaCitacao {
  aoAbrir: (alvo: AlvoDaCitacao) => void
}

const CHAVE_DO_CLIQUE_NA_CITACAO = new PluginKey('pr-citacao-clique')

/** Lê os `attrs` de uma citação; sem quadro, `null`. */
export function alvoDaCitacao(atributos: unknown): AlvoDaCitacao | null {
  if (typeof atributos !== 'object' || atributos === null) return null
  const { quadroId, formaId } = atributos as { quadroId?: unknown; formaId?: unknown }
  if (typeof quadroId !== 'string' || quadroId === '') return null
  return { quadroId, formaId: typeof formaId === 'string' && formaId !== '' ? formaId : null }
}

/**
 * O texto cita um quadro: o quadro inteiro, uma moldura ou um cartão (pelo id da
 * forma). O rótulo é o nome na hora de citar; um clique abre o quadro naquele
 * ponto (`EditorDeTexto.tsx`). O jogador nunca recebe a citação: o pacote do
 * revelado só leva os nós que conhece (`pacoteDoJogador.ts`).
 */
export const CitacaoQuadro = Node.create<OpcoesDaCitacao>({
  name: PECAS_DO_TEXTO.citacaoQuadro,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addOptions() {
    return { aoAbrir: () => undefined }
  },
  addAttributes() {
    return {
      quadroId: { default: '', parseHTML: (elemento: HTMLElement) => elemento.getAttribute('data-quadro') ?? '', renderHTML: (atributos: Record<string, unknown>) => ({ 'data-quadro': String(atributos.quadroId ?? '') }) },
      formaId: {
        default: null,
        parseHTML: (elemento: HTMLElement) => elemento.getAttribute('data-forma') || null,
        renderHTML: (atributos: Record<string, unknown>) => (typeof atributos.formaId === 'string' && atributos.formaId !== '' ? { 'data-forma': atributos.formaId } : {}),
      },
      rotulo: { default: '', parseHTML: (elemento: HTMLElement) => elemento.getAttribute('data-rotulo') ?? '', renderHTML: (atributos: Record<string, unknown>) => ({ 'data-rotulo': String(atributos.rotulo ?? '') }) },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-citacao-quadro]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const rotulo = typeof node.attrs.rotulo === 'string' && node.attrs.rotulo !== '' ? node.attrs.rotulo : 'quadro'
    const dica = node.attrs.formaId === null ? `Abrir o quadro ${rotulo}` : `Abrir o quadro em ${rotulo}`
    return ['span', mergeAttributes(HTMLAttributes, { class: 'pr-citacao', 'data-citacao-quadro': '', title: dica }), rotulo]
  },
  renderText({ node }) {
    return typeof node.attrs.rotulo === 'string' ? node.attrs.rotulo : ''
  },
  addProseMirrorPlugins() {
    const { aoAbrir } = this.options
    return [
      new Plugin({
        key: CHAVE_DO_CLIQUE_NA_CITACAO,
        props: {
          handleClickOn: (_vista, _posicao, no) => {
            if (no.type.name !== PECAS_DO_TEXTO.citacaoQuadro) return false
            const alvo = alvoDaCitacao(no.attrs)
            if (alvo === null) return false
            aoAbrir(alvo)
            return true
          },
        },
      }),
    ]
  },
})

// ─── @menção ─────────────────────────────────────────────────────────────────

export interface ItemDaMencao {
  readonly id: string
  readonly titulo: string
  readonly tipo: string
}

export interface OpcoesDaMencao {
  /** O nome atual do verbete; `undefined` = ele não existe mais. */
  tituloDe: (id: string) => string | undefined
  aoAbrir: (id: string) => void
  /**
   * O jogador lê este verbete só pelo nome, sem link, no texto revelado deste
   * campo (F2c: ele vê a seção e não vê o verbete mencionado). A lista mudou
   * fora do texto (revelar, ocultar): `reavaliarSoNome`.
   */
  soNome: (id: string) => boolean
  /** Lista e desenho da sugestão (`SugestaoDeMencao.tsx`). */
  sugestao: Pick<SuggestionOptions<ItemDaMencao, ItemDaMencao>, 'items' | 'render'>
}

const CHAVE_DA_SUGESTAO = new PluginKey('pr-mencao-sugestao')
const CHAVE_DO_CLIQUE = new PluginKey('pr-mencao-clique')
const CHAVE_DO_SO_NOME = new PluginKey<DecorationSet>('pr-mencao-so-nome')

/** A dica da menção: o desenho do nó e a decoração usam a mesma. */
function dicaDaMencao(titulo: string | undefined, soNome: boolean): string {
  if (titulo === undefined) return 'Este verbete não existe mais'
  return soNome ? `Abrir ${titulo}. O jogador lê só o nome, sem link.` : `Abrir ${titulo}`
}

/** O bloco de segredo nunca vai ao jogador: a menção dentro dele não chega nem como nome. */
function dentroDeSegredo(documento: NoDoDocumento, posicao: number): boolean {
  const resolvida = documento.resolve(posicao)
  for (let nivel = resolvida.depth; nivel > 0; nivel--) if (resolvida.node(nivel).type.name === PECAS_DO_TEXTO.segredo) return true
  return false
}

/**
 * A marca do "só o nome" (F2c). Toda menção ganha a decoração, mesmo a comum:
 * quando a decoração sai, o ProseMirror apaga do nó o `title` que ela pôs, e a
 * menção ficaria sem a dica de abrir.
 */
function decoracoesDasMencoes(documento: NoDoDocumento, tituloDe: OpcoesDaMencao['tituloDe'], soNome: OpcoesDaMencao['soNome']): DecorationSet {
  const decoracoes: Decoration[] = []
  documento.descendants((no, posicao) => {
    if (no.type.name !== PECAS_DO_TEXTO.mencao) return true
    const id = typeof no.attrs.verbeteId === 'string' ? no.attrs.verbeteId : ''
    const titulo = tituloDe(id)
    const marcada = titulo !== undefined && soNome(id) && !dentroDeSegredo(documento, posicao)
    const dica = dicaDaMencao(titulo, marcada)
    decoracoes.push(Decoration.node(posicao, posicao + no.nodeSize, marcada ? { class: 'pr-mencao--so-nome', title: dica } : { title: dica }))
    return false
  })
  return DecorationSet.create(documento, decoracoes)
}

/** Refaz a marca do "só o nome" depois que a lista mudou. Não mexe no texto: não conta como edição nem entra no desfazer. */
export function reavaliarSoNome(editor: Editor): void {
  if (editor.isDestroyed) return
  editor.view.dispatch(editor.state.tr.setMeta(CHAVE_DO_SO_NOME, true).setMeta('addToHistory', false))
}

export const Mencao = Node.create<OpcoesDaMencao>({
  name: PECAS_DO_TEXTO.mencao,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addOptions() {
    return { tituloDe: () => undefined, aoAbrir: () => undefined, soNome: () => false, sugestao: { items: () => [] } }
  },
  addAttributes() {
    return {
      verbeteId: atributoDeDado('verbeteId', 'verbete-id'),
      /** O nome no momento da menção: o que aparece se o verbete sumir. */
      rotulo: { default: '', parseHTML: (elemento: HTMLElement) => elemento.getAttribute('data-rotulo') ?? '', renderHTML: (atributos: Record<string, unknown>) => ({ 'data-rotulo': String(atributos.rotulo ?? '') }) },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-mencao]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const id = typeof node.attrs.verbeteId === 'string' ? node.attrs.verbeteId : ''
    const titulo = this.options.tituloDe(id)
    const rotulo = typeof node.attrs.rotulo === 'string' ? node.attrs.rotulo : ''
    if (titulo === undefined) {
      return ['span', mergeAttributes(HTMLAttributes, { 'data-mencao': '', class: 'pr-mencao pr-mencao--quebrada', title: dicaDaMencao(undefined, false) }), `@${rotulo || 'verbete'}`]
    }
    return ['span', mergeAttributes(HTMLAttributes, { 'data-mencao': '', class: 'pr-mencao', title: dicaDaMencao(titulo, false) }), `@${titulo}`]
  },
  renderText({ node }) {
    const id = typeof node.attrs.verbeteId === 'string' ? node.attrs.verbeteId : ''
    return `@${this.options.tituloDe(id) ?? String(node.attrs.rotulo ?? '')}`
  },
  addProseMirrorPlugins() {
    const { aoAbrir, sugestao, tituloDe, soNome } = this.options
    return [
      new Plugin<DecorationSet>({
        key: CHAVE_DO_SO_NOME,
        state: {
          init: (_configuracao, estado) => decoracoesDasMencoes(estado.doc, tituloDe, soNome),
          apply: (transacao, antes, _estadoAntes, estadoDepois) =>
            transacao.docChanged || transacao.getMeta(CHAVE_DO_SO_NOME) === true ? decoracoesDasMencoes(estadoDepois.doc, tituloDe, soNome) : antes,
        },
        props: {
          decorations: (estado) => CHAVE_DO_SO_NOME.getState(estado),
        },
      }),
      Suggestion<ItemDaMencao, ItemDaMencao>({
        editor: this.editor,
        pluginKey: CHAVE_DA_SUGESTAO,
        char: '@',
        ...sugestao,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: PECAS_DO_TEXTO.mencao, attrs: { verbeteId: props.id, rotulo: props.titulo } },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
      }),
      new Plugin({
        key: CHAVE_DO_CLIQUE,
        props: {
          handleClickOn: (_vista, _posicao, no) => {
            if (no.type.name !== PECAS_DO_TEXTO.mencao || typeof no.attrs.verbeteId !== 'string') return false
            aoAbrir(no.attrs.verbeteId)
            return true
          },
        },
      }),
    ]
  },
})

// ─── O conjunto ──────────────────────────────────────────────────────────────

export interface OpcoesDoTexto {
  readonly convite: string
  readonly imagem: OpcoesDaImagem
  readonly mencao: OpcoesDaMencao
  /** Sem ela, o link para a mesa só aparece (sem estado nem clique). */
  readonly mesa?: OpcoesDaMesa
  /** Sem ela, a citação do quadro só aparece (sem clique). */
  readonly citacao?: OpcoesDaCitacao
}

export function extensoesDoTexto(opcoes?: OpcoesDoTexto): Extensions {
  const lista: AnyExtension[] = [
    // `trailingNode` desligado: ele acrescenta um parágrafo no primeiro clique, e só abrir o verbete já contaria como edição.
    // Link sem abrir no clique: no app, abrir trocaria a janela do Labirinto pela página.
    StarterKit.configure({ trailingNode: false, link: { openOnClick: false, autolink: true, linkOnPaste: true } }),
    Imagem.configure(opcoes?.imagem ?? {}),
    Segredo,
    LigacaoMesa.configure(opcoes?.mesa ?? {}),
    CitacaoQuadro.configure(opcoes?.citacao ?? {}),
    Mencao.configure(opcoes?.mencao ?? {}),
  ]
  if (opcoes !== undefined) lista.push(Placeholder.configure({ placeholder: opcoes.convite }))
  return lista
}

let esquema: ReturnType<typeof getSchema> | null = null

/** O documento cabe no esquema? Não coube = abre só para leitura (o TipTap o esvaziaria). */
export function textoCabeNoEditor(texto: TextoRico): boolean {
  esquema ??= getSchema(extensoesDoTexto())
  try {
    esquema.nodeFromJSON(texto).check()
    return true
  } catch {
    return false
  }
}
