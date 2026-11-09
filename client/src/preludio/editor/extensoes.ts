import { getSchema, mergeAttributes, Node, type AnyExtension, type Extensions } from '@tiptap/core'
import type { DOMOutputSpec } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
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

/** Link para cena, pino ou ficha (F4). Por enquanto só aparece: quem cria e abre é a fatia das Sessões. */
export const LigacaoMesa = Node.create({
  name: PECAS_DO_TEXTO.ligacaoMesa,
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { alvo: { default: null, rendered: false }, rotulo: { default: '', rendered: false } }
  },
  renderHTML({ node }) {
    const rotulo = typeof node.attrs.rotulo === 'string' && node.attrs.rotulo !== '' ? node.attrs.rotulo : 'mesa'
    return ['span', { class: 'pr-mesa', 'data-ligacao-mesa': '' }, rotulo]
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
  /** Lista e desenho da sugestão (`SugestaoDeMencao.tsx`). */
  sugestao: Pick<SuggestionOptions<ItemDaMencao, ItemDaMencao>, 'items' | 'render'>
}

const CHAVE_DA_SUGESTAO = new PluginKey('pr-mencao-sugestao')
const CHAVE_DO_CLIQUE = new PluginKey('pr-mencao-clique')

export const Mencao = Node.create<OpcoesDaMencao>({
  name: PECAS_DO_TEXTO.mencao,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addOptions() {
    return { tituloDe: () => undefined, aoAbrir: () => undefined, sugestao: { items: () => [] } }
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
      return ['span', mergeAttributes(HTMLAttributes, { 'data-mencao': '', class: 'pr-mencao pr-mencao--quebrada', title: 'Este verbete não existe mais' }), `@${rotulo || 'verbete'}`]
    }
    return ['span', mergeAttributes(HTMLAttributes, { 'data-mencao': '', class: 'pr-mencao', title: `Abrir ${titulo}` }), `@${titulo}`]
  },
  renderText({ node }) {
    const id = typeof node.attrs.verbeteId === 'string' ? node.attrs.verbeteId : ''
    return `@${this.options.tituloDe(id) ?? String(node.attrs.rotulo ?? '')}`
  },
  addProseMirrorPlugins() {
    const { aoAbrir, sugestao } = this.options
    return [
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
}

export function extensoesDoTexto(opcoes?: OpcoesDoTexto): Extensions {
  const lista: AnyExtension[] = [
    // `trailingNode` desligado: ele acrescenta um parágrafo no primeiro clique, e só abrir o verbete já contaria como edição.
    // Link sem abrir no clique: no app, abrir trocaria a janela do Labirinto pela página.
    StarterKit.configure({ trailingNode: false, link: { openOnClick: false, autolink: true, linkOnPaste: true } }),
    Imagem.configure(opcoes?.imagem ?? {}),
    Segredo,
    LigacaoMesa,
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
