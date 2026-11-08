import type { TextoRico } from '../tipos'

/**
 * HTML DO GRIMÓRIO → TEXTO DO EDITOR (plano §4, passo 4: "o HTML vira texto do
 * editor, e o HTML original fica guardado"). O Grimório grava o HTML do TipTap
 * com o StarterKit e a imagem do cofre (`<img data-rel>`, `ImagemCofre.tsx:159-200`);
 * aqui ele volta a ser o documento JSON do TipTap, que o Prelúdio guarda.
 *
 * Etiqueta que não é do StarterKit vira o texto dela e entra na conta de
 * `naoEntendidos`: nada some, e o relatório diz quantos trechos perderam o
 * formato. O HTML nunca é posto na página: só é lido pelo DOMParser.
 */

interface Marca {
  type: string
  attrs?: Record<string, unknown>
}

interface No {
  type: string
  attrs?: Record<string, unknown>
  content?: No[]
  text?: string
  marks?: Marca[]
}

export interface TextoConvertido {
  readonly texto: TextoRico
  /** Etiquetas que não são do editor e viraram só o texto delas. */
  readonly naoEntendidos: number
  /** `data-rel` de imagens que não estão no cofre. */
  readonly imagensSemArquivo: readonly string[]
}

/** `rel` do cofre → `midia/<sha256>.<ext>` do Prelúdio, ou `null` quando o arquivo não existe. */
export type MidiaDoCaminho = (rel: string) => string | null

const MARCAS: ReadonlyMap<string, string> = new Map([
  ['strong', 'bold'],
  ['b', 'bold'],
  ['em', 'italic'],
  ['i', 'italic'],
  ['u', 'underline'],
  ['s', 'strike'],
  ['strike', 'strike'],
  ['del', 'strike'],
  ['code', 'code'],
])
/** Sem formato próprio, mas também sem perda: o texto de dentro passa direto. */
const INLINE_NEUTRO: ReadonlySet<string> = new Set(['span', 'font', 'small', 'label', 'abbr', 'cite', 'q', 'time'])
const TITULOS: ReadonlyMap<string, number> = new Map([['h1', 1], ['h2', 2], ['h3', 3], ['h4', 4], ['h5', 5], ['h6', 6]])
const BLOCOS: ReadonlySet<string> = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'figure', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'img',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'dl', 'details',
])
const CONTEINERES: ReadonlySet<string> = new Set(['div', 'section', 'article', 'header', 'footer', 'figure'])

function etiqueta(no: Node): string | null {
  return no instanceof Element ? no.tagName.toLowerCase() : null
}

function ehBloco(no: Node): boolean {
  const tag = etiqueta(no)
  return tag !== null && BLOCOS.has(tag)
}

function soEspaco(nos: readonly No[]): boolean {
  return nos.every((no) => no.type === 'text' && (no.text ?? '').trim() === '')
}

/** O espaço do HTML: corridas viram um espaço; as pontas do parágrafo somem. */
function aparar(nos: No[]): No[] {
  const primeiro = nos[0]
  if (primeiro !== undefined && primeiro.type === 'text') primeiro.text = (primeiro.text ?? '').replace(/^ +/, '')
  const ultimo = nos[nos.length - 1]
  if (ultimo !== undefined && ultimo.type === 'text') ultimo.text = (ultimo.text ?? '').replace(/ +$/, '')
  return nos.filter((no) => no.type !== 'text' || (no.text ?? '') !== '')
}

function paragrafo(nos: No[]): No {
  const conteudo = aparar(nos)
  return conteudo.length === 0 ? { type: 'paragraph' } : { type: 'paragraph', content: conteudo }
}

class Conversor {
  naoEntendidos = 0
  readonly imagensSemArquivo: string[] = []

  constructor(private readonly midiaDe: MidiaDoCaminho) {}

  /** Uma sequência de nós em nível de bloco; texto solto entre blocos vira parágrafo. */
  blocos(nos: Iterable<Node>): No[] {
    const saida: No[] = []
    let soltos: No[] = []
    const fecharSoltos = () => {
      if (!soEspaco(soltos)) saida.push(...this.paragrafos(soltos))
      soltos = []
    }
    for (const no of nos) {
      if (no instanceof Element && ehBloco(no)) {
        fecharSoltos()
        saida.push(...this.bloco(no))
      } else {
        soltos.push(...this.inline(no, []))
      }
    }
    fecharSoltos()
    return saida
  }

  /** O editor guarda a imagem como bloco: imagem no meio do texto parte o parágrafo em dois. */
  private paragrafos(nos: readonly No[]): No[] {
    const saida: No[] = []
    let atual: No[] = []
    for (const no of nos) {
      if (no.type !== 'image') {
        atual.push(no)
        continue
      }
      if (!soEspaco(atual)) saida.push(paragrafo(atual))
      saida.push(no)
      atual = []
    }
    if (!soEspaco(atual) || saida.length === 0) saida.push(paragrafo(atual))
    return saida
  }

  private bloco(el: Element): No[] {
    const tag = el.tagName.toLowerCase()
    const nivel = TITULOS.get(tag)
    if (nivel !== undefined) return [{ ...paragrafo(this.inlines(el, [])), type: 'heading', attrs: { level: nivel } }]
    if (CONTEINERES.has(tag)) return this.blocos(el.childNodes)
    switch (tag) {
      case 'p':
        return this.paragrafos(this.inlines(el, []))
      case 'ul':
        return [{ type: 'bulletList', content: this.itens(el) }]
      case 'ol':
        return [{ type: 'orderedList', attrs: { start: Number(el.getAttribute('start') ?? '1') || 1 }, content: this.itens(el) }]
      case 'li':
        return [{ type: 'listItem', content: this.conteudoDoItem(el) }]
      case 'blockquote':
        return [{ type: 'blockquote', content: this.blocosOuParagrafo(el) }]
      case 'pre': {
        const texto = el.textContent ?? ''
        return [texto === '' ? { type: 'codeBlock' } : { type: 'codeBlock', content: [{ type: 'text', text: texto }] }]
      }
      case 'hr':
        return [{ type: 'horizontalRule' }]
      case 'img':
        return [this.imagem(el)]
      default:
        this.naoEntendidos += 1
        return this.paragrafos([{ type: 'text', text: (el.textContent ?? '').replace(/\s+/g, ' ') }])
    }
  }

  private blocosOuParagrafo(el: Element): No[] {
    const blocos = this.blocos(el.childNodes)
    return blocos.length === 0 ? [{ type: 'paragraph' }] : blocos
  }

  private itens(lista: Element): No[] {
    const itens: No[] = []
    for (const filho of lista.children) {
      if (filho.tagName.toLowerCase() === 'li') itens.push({ type: 'listItem', content: this.conteudoDoItem(filho) })
      else itens.push({ type: 'listItem', content: this.blocosOuParagrafo(filho) })
    }
    return itens.length === 0 ? [{ type: 'listItem', content: [{ type: 'paragraph' }] }] : itens
  }

  /** O item de lista começa por parágrafo, como o editor exige. */
  private conteudoDoItem(li: Element): No[] {
    const blocos = this.blocosOuParagrafo(li)
    const primeiro = blocos[0]
    return primeiro !== undefined && primeiro.type === 'paragraph' ? blocos : [{ type: 'paragraph' }, ...blocos]
  }

  private inlines(el: Element, marcas: readonly Marca[]): No[] {
    const saida: No[] = []
    for (const filho of el.childNodes) saida.push(...this.inline(filho, marcas))
    return saida
  }

  private inline(no: Node, marcas: readonly Marca[]): No[] {
    if (no instanceof Text) {
      const texto = (no.textContent ?? '').replace(/\s+/g, ' ')
      if (texto === '') return []
      return [marcas.length === 0 ? { type: 'text', text: texto } : { type: 'text', text: texto, marks: [...marcas] }]
    }
    if (!(no instanceof Element)) return []
    const tag = no.tagName.toLowerCase()
    if (tag === 'br') return [{ type: 'hardBreak' }]
    if (tag === 'img') return [this.imagem(no)]
    if (tag === 'a') return this.inlines(no, [...marcas, { type: 'link', attrs: { href: no.getAttribute('href') ?? '' } }])
    const marca = MARCAS.get(tag)
    if (marca !== undefined) return this.inlines(no, marcas.some((m) => m.type === marca) ? marcas : [...marcas, { type: marca }])
    if (!INLINE_NEUTRO.has(tag)) this.naoEntendidos += 1
    return this.inlines(no, marcas)
  }

  /** `<img data-rel>` do cofre: `midia` aponta para o arquivo novo; `rel` guarda o caminho antigo. */
  private imagem(el: Element): No {
    const rel = el.getAttribute('data-rel')
    const midia = rel === null ? null : this.midiaDe(rel)
    if (rel !== null && midia === null) this.imagensSemArquivo.push(rel)
    if (rel === null) this.naoEntendidos += 1
    const largura = Number(el.getAttribute('data-largura'))
    return {
      type: 'image',
      attrs: {
        midia,
        rel,
        alt: el.getAttribute('alt'),
        title: el.getAttribute('title'),
        largura: Number.isFinite(largura) && largura > 0 ? largura : null,
        align: el.getAttribute('data-align'),
        legenda: el.getAttribute('data-legenda'),
      },
    }
  }
}

/** HTML vazio (ou só espaço) vira documento sem conteúdo; `<p></p>` (linha em branco do TipTap) continua parágrafo vazio. */
export function htmlParaTexto(html: string, midiaDe: MidiaDoCaminho): TextoConvertido {
  const conversor = new Conversor(midiaDe)
  const corpo = new DOMParser().parseFromString(html, 'text/html').body
  const conteudo = conversor.blocos(corpo.childNodes)
  return { texto: { type: 'doc', content: conteudo }, naoEntendidos: conversor.naoEntendidos, imagensSemArquivo: conversor.imagensSemArquivo }
}

/** Há texto de verdade (ou imagem) no HTML? Seção vazia não vira seção. */
export function htmlTemConteudo(html: string): boolean {
  if (html.trim() === '') return false
  const corpo = new DOMParser().parseFromString(html, 'text/html').body
  return (corpo.textContent ?? '').trim() !== '' || corpo.querySelector('img, hr') !== null
}
