import { ehRegistro } from './molde'
import { alvoDaForma, alvoDaLigacao, alvoDaSecao, alvoDoVerbete, contaVe, paraDe, revelacoesPorAlvo } from './revelado'
import { ARQUIVO_DO_VERBETE, PECAS_DO_TEXTO, type AlvoDaRevelacao, type Forma, type Ligacao, type Revelado, type TextoRico, type TipoDeVerbete, type Verbete } from './tipos'

/**
 * O PACOTE DO JOGADOR (docs/planos/preludio-2026-11-08.md §2, "Como só o
 * revelado chega ao Lobby"): o que UM jogador de UMA campanha pode ler, montado
 * por esta função só. O "Ver como jogador" do app desenha este mesmo pacote, e
 * o envio ao Lobby (F5) vai mandar este mesmo pacote: o que o mestre vê na
 * prévia é o que sobe.
 *
 * O segredo nunca sai do PC: o pacote é montado do zero, campo a campo, com o
 * que pode sair; nada é copiado do verbete e depois limpo.
 *
 * - Verbete: só o desta campanha e revelado a este jogador (ou a todos). Sessão
 *   nunca sai (é o roteiro do mestre), nem verbete de formato mais novo que esta
 *   versão não sabe filtrar. Sai o nome, o tipo e o pai, se o pai também saiu.
 *   Apelidos, campanhas, ligação com ficha e cena, acervo, cartaz e extras não saem.
 * - Forma: só a revelada (revelar Bruce não revela Hulk), com nome, retrato,
 *   resumo e galeria. Seção: só a revelada e que não é de segredo; seção com
 *   chave desconhecida fica de fora.
 * - Texto: refeito nó a nó, só com o que o editor conhece. Bloco de segredo e
 *   ligação com a mesa (cena, pino, ficha: ferramenta do mestre) somem inteiros;
 *   menção a verbete que o jogador não vê vira texto puro (o nome de agora, sem
 *   o id), e a menção a sessão ou a verbete de formato mais novo some inteira
 *   (eles nunca vão ao jogador, nem o nome); nó ou marca desconhecidos somem
 *   (podem ser um segredo de uma versão mais nova); link só http, https e mailto.
 * - Nome sem link (`nomesSemLink`): onde a menção virou só o nome. Renomear o
 *   mencionado muda o texto que o jogador lê sem ninguém tocar na seção, então
 *   a página avisa ao renomear e o editor marca essa menção.
 * - Imagem: só `midia/<sha256>.<ext>` (nunca o nome do arquivo), só a legenda
 *   (nunca o `alt`, o `title` nem o caminho antigo do cofre).
 * - "Citado em": só quem o jogador vê, e só pela menção que sobrou no texto que ele vê.
 * - Ligação: só a revelada, sem segredo e com as duas pontas no pacote.
 */

export const FORMATO_DO_PACOTE = 1

// ─── O texto do pacote ───────────────────────────────────────────────────────

type MarcaSimples = 'bold' | 'italic' | 'strike' | 'code' | 'underline'
const MARCAS_SIMPLES: readonly MarcaSimples[] = ['bold', 'italic', 'strike', 'code', 'underline']

export type MarcaDoPacote = { readonly type: MarcaSimples } | { readonly type: 'link'; readonly attrs: { readonly href: string } }

export type AlinhamentoDaImagem = 'left' | 'center' | 'right'

export type NoDoPacote =
  | { readonly type: 'text'; readonly text: string; readonly marks?: readonly MarcaDoPacote[] }
  | { readonly type: 'hardBreak' }
  | { readonly type: 'horizontalRule' }
  | { readonly type: 'mencao'; readonly attrs: { readonly verbeteId: string; readonly rotulo: string } }
  | {
      readonly type: 'image'
      readonly attrs: { readonly midia: string; readonly legenda: string | null; readonly largura: number | null; readonly align: AlinhamentoDaImagem | null }
    }
  | { readonly type: 'paragraph' | 'bulletList' | 'listItem' | 'blockquote'; readonly content: readonly NoDoPacote[] }
  | { readonly type: 'heading'; readonly attrs: { readonly level: number }; readonly content: readonly NoDoPacote[] }
  | { readonly type: 'orderedList'; readonly attrs: { readonly start: number }; readonly content: readonly NoDoPacote[] }
  | { readonly type: 'codeBlock'; readonly attrs: { readonly language: string | null }; readonly content: readonly NoDoPacote[] }

export interface TextoDoPacote {
  readonly type: 'doc'
  readonly content: readonly NoDoPacote[]
}

// ─── O pacote ────────────────────────────────────────────────────────────────

export interface SecaoDoPacote {
  readonly id: string
  readonly titulo: string
  readonly texto: TextoDoPacote
}

export interface ImagemDoPacote {
  /** `midia/<sha256>.<ext>`. */
  readonly midia: string
  readonly legenda: string
}

export interface FormaDoPacote {
  readonly id: string
  readonly nome: string
  readonly retrato?: string
  readonly resumo: string
  readonly secoes: readonly SecaoDoPacote[]
  readonly imagens: readonly ImagemDoPacote[]
}

export interface VerbeteDoPacote {
  readonly id: string
  readonly tipo: TipoDeVerbete
  readonly titulo: string
  /** Só quando o pai também está no pacote. */
  readonly paiId?: string
  readonly formas: readonly FormaDoPacote[]
  /** Os verbetes do pacote que mencionam este, no texto que o jogador vê. */
  readonly citadoEm: readonly string[]
}

export interface LigacaoDoPacote {
  readonly id: string
  readonly de: string
  readonly para: string
  readonly tipo: string
  readonly notas: string
}

export interface PacoteDoJogador {
  readonly formato: number
  readonly campanhaId: string
  /** `null` = um jogador qualquer: só o que foi revelado a todos. */
  readonly contaId: string | null
  /** Em ordem de id. */
  readonly verbetes: readonly VerbeteDoPacote[]
  readonly ligacoes: readonly LigacaoDoPacote[]
  /** Toda imagem que o pacote usa, sem repetição: só estas sobem (F5). */
  readonly midias: readonly string[]
}

export interface EntradaDoPacote {
  readonly campanhaId: string
  /** A conta do jogador; `null` = um jogador qualquer (só o revelado a todos). */
  readonly contaId: string | null
  /** Todos os verbetes do Prelúdio (o pacote escolhe; a menção a quem ficou de fora precisa do nome). */
  readonly verbetes: Iterable<Verbete>
  /** O `revelado/<campanhaId>.json`; `null` = não abriu, e nada é revelado. */
  readonly revelado: Revelado | null
  readonly ligacoes?: readonly Ligacao[]
}

/** Onde uma menção virou só o nome no pacote (o jogador lê o nome de agora, sem link): o mencionado e a seção que o menciona. */
export interface NomeSemLink {
  /** O verbete mencionado, que este jogador não vê. */
  readonly mencionadoId: string
  readonly verbeteId: string
  readonly formaId: string
  readonly secaoId: string
}

/** Verbete que pode chegar a um jogador, se for revelado: a sessão é do mestre, e o formato mais novo esta versão não sabe filtrar. */
export function podeIrAoJogador(verbete: Verbete): boolean {
  return verbete.tipo !== 'sessao' && verbete.formato <= ARQUIVO_DO_VERBETE.formato
}

// ─── Imagens e links ─────────────────────────────────────────────────────────

const MIDIA_DO_PACOTE = /^midia\/[0-9a-f]{64}\.[a-z0-9]{1,8}$/i

/** Só o caminho da importação, pelo conteúdo: um nome de arquivo nunca sai. */
export function midiaDoPacote(midia: unknown): string | null {
  return typeof midia === 'string' && MIDIA_DO_PACOTE.test(midia) ? midia : null
}

const PROTOCOLOS_DO_LINK = new Set(['http:', 'https:', 'mailto:'])
const LINK_MAX = 2048

function hrefSeguro(href: unknown): string | null {
  if (typeof href !== 'string' || href.length > LINK_MAX) return null
  try {
    const url = new URL(href)
    return PROTOCOLOS_DO_LINK.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

const LARGURA_MAXIMA = 4000
const ALINHAMENTOS: readonly AlinhamentoDaImagem[] = ['left', 'center', 'right']
const LINGUAGEM = /^[A-Za-z0-9+#._-]{1,32}$/
const NIVEL_MAXIMO = 6

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null
}

function larguraOuNula(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.min(valor, LARGURA_MAXIMA) : null
}

function alinhamentoOuNulo(valor: unknown): AlinhamentoDaImagem | null {
  return ALINHAMENTOS.find((alinhamento) => alinhamento === valor) ?? null
}

function nivelDoTitulo(valor: unknown): number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1 && valor <= NIVEL_MAXIMO ? valor : 1
}

function inicioDaLista(valor: unknown): number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 ? valor : 1
}

// ─── O filtro do texto ───────────────────────────────────────────────────────

interface Contexto {
  /** Todos os verbetes do Prelúdio: o nome de quem foi mencionado. */
  readonly todos: ReadonlyMap<string, Verbete>
  /** Os que estão no pacote. */
  readonly noPacote: ReadonlySet<string>
  readonly midias: Set<string>
  /** Quem o texto deste verbete menciona e ficou como menção. */
  readonly mencionados: Set<string>
  /** Onde a menção virou só o nome, no pacote inteiro. */
  readonly nomesSemLink: NomeSemLink[]
}

/** O contexto do texto de uma seção: onde ele mora. */
interface ContextoDoTexto extends Contexto {
  readonly verbeteId: string
  readonly formaId: string
  readonly secaoId: string
}

/** As marcas do texto; `null` = há uma marca que esta versão não conhece, e o texto fica de fora. */
function marcasDoPacote(marcas: unknown): MarcaDoPacote[] | null {
  if (marcas === undefined) return []
  if (!Array.isArray(marcas)) return null
  const saida: MarcaDoPacote[] = []
  for (const marca of marcas) {
    if (!ehRegistro(marca)) return null
    const tipo = MARCAS_SIMPLES.find((simples) => simples === marca.type)
    if (tipo !== undefined) {
      saida.push({ type: tipo })
      continue
    }
    if (marca.type !== 'link') return null
    // Link de protocolo que não serve (javascript:, file:, caminho do PC): fica o texto, sem o link.
    const href = hrefSeguro(ehRegistro(marca.attrs) ? marca.attrs.href : undefined)
    if (href !== null) saida.push({ type: 'link', attrs: { href } })
  }
  return saida
}

function filhosDoPacote(no: Readonly<Record<string, unknown>>, contexto: ContextoDoTexto): NoDoPacote[] {
  return Array.isArray(no.content) ? no.content.flatMap((filho) => noDoPacote(filho, contexto)) : []
}

function mencaoDoPacote(atributos: Readonly<Record<string, unknown>>, contexto: ContextoDoTexto): NoDoPacote[] {
  const id = atributos.verbeteId
  const alvo = typeof id === 'string' ? contexto.todos.get(id) : undefined
  // Sessão e formato mais novo nunca vão ao jogador: nem o nome deles sai pela menção.
  if (alvo !== undefined && !podeIrAoJogador(alvo)) return []
  if (alvo !== undefined && contexto.noPacote.has(alvo.id)) {
    contexto.mencionados.add(alvo.id)
    // O nome de agora: o `rotulo` guardado é o nome de quando a menção foi feita, e pode ser um que o jogador não conhece.
    return [{ type: 'mencao', attrs: { verbeteId: alvo.id, rotulo: alvo.titulo } }]
  }
  // Mesmo com o nome vazio agora: o nome que ele ganhar aparece aqui.
  if (alvo !== undefined) contexto.nomesSemLink.push({ mencionadoId: alvo.id, verbeteId: contexto.verbeteId, formaId: contexto.formaId, secaoId: contexto.secaoId })
  // Fora do pacote: o nome que o mestre lê no texto, sem o id. Verbete apagado: o nome guardado.
  const nome = alvo !== undefined ? alvo.titulo : textoOuNulo(atributos.rotulo)
  return nome === null || nome === '' ? [] : [{ type: 'text', text: nome }]
}

function noDoPacote(bruto: unknown, contexto: ContextoDoTexto): NoDoPacote[] {
  if (!ehRegistro(bruto)) return []
  const tipo = bruto.type
  const atributos = ehRegistro(bruto.attrs) ? bruto.attrs : {}
  switch (tipo) {
    case 'text': {
      if (typeof bruto.text !== 'string' || bruto.text === '') return []
      const marcas = marcasDoPacote(bruto.marks)
      if (marcas === null) return []
      return [marcas.length === 0 ? { type: 'text', text: bruto.text } : { type: 'text', text: bruto.text, marks: marcas }]
    }
    case 'hardBreak':
    case 'horizontalRule':
      return [{ type: tipo }]
    case 'paragraph':
    case 'bulletList':
    case 'listItem':
    case 'blockquote':
      return [{ type: tipo, content: filhosDoPacote(bruto, contexto) }]
    case 'heading':
      return [{ type: 'heading', attrs: { level: nivelDoTitulo(atributos.level) }, content: filhosDoPacote(bruto, contexto) }]
    case 'orderedList':
      return [{ type: 'orderedList', attrs: { start: inicioDaLista(atributos.start) }, content: filhosDoPacote(bruto, contexto) }]
    case 'codeBlock': {
      const linguagem = atributos.language
      return [{ type: 'codeBlock', attrs: { language: typeof linguagem === 'string' && LINGUAGEM.test(linguagem) ? linguagem : null }, content: filhosDoPacote(bruto, contexto) }]
    }
    case 'image': {
      const midia = midiaDoPacote(atributos.midia)
      if (midia === null) return []
      contexto.midias.add(midia)
      return [{ type: 'image', attrs: { midia, legenda: textoOuNulo(atributos.legenda), largura: larguraOuNula(atributos.largura), align: alinhamentoOuNulo(atributos.align) } }]
    }
    case PECAS_DO_TEXTO.mencao:
      return mencaoDoPacote(atributos, contexto)
    case PECAS_DO_TEXTO.segredo:
    case PECAS_DO_TEXTO.ligacaoMesa:
      return []
    default:
      return []
  }
}

/** O texto de uma seção como o jogador o lê. */
function textoDoPacote(texto: TextoRico, contexto: ContextoDoTexto): TextoDoPacote {
  return { type: 'doc', content: (texto.content ?? []).flatMap((filho) => noDoPacote(filho, contexto)) }
}

// ─── A montagem ──────────────────────────────────────────────────────────────

function porId(a: { readonly id: string }, b: { readonly id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function formaDoPacote(verbeteId: string, forma: Forma, ve: (alvo: AlvoDaRevelacao) => boolean, contexto: Contexto): FormaDoPacote {
  const retrato = midiaDoPacote(forma.retrato)
  if (retrato !== null) contexto.midias.add(retrato)
  const imagens = forma.imagens.flatMap((imagem): ImagemDoPacote[] => {
    const midia = imagem.extras === undefined ? midiaDoPacote(imagem.midia) : null
    if (midia === null) return []
    contexto.midias.add(midia)
    return [{ midia, legenda: imagem.legenda }]
  })
  const secoes = forma.secoes
    .filter((secao) => !secao.segredo && secao.extras === undefined && ve(alvoDaSecao(verbeteId, forma.id, secao.id)))
    .map((secao): SecaoDoPacote => ({ id: secao.id, titulo: secao.titulo, texto: textoDoPacote(secao.texto, { ...contexto, verbeteId, formaId: forma.id, secaoId: secao.id }) }))
  const base = { id: forma.id, nome: forma.nome, resumo: forma.resumo, secoes, imagens }
  return retrato === null ? base : { ...base, retrato }
}

interface Montagem {
  readonly pacote: PacoteDoJogador
  readonly nomesSemLink: readonly NomeSemLink[]
}

/**
 * O pacote e, junto, onde a menção virou só o nome. `textosDe` percorre só o
 * texto destes verbetes (os outros entram só pelo nome): o pacote sai
 * incompleto, e serve apenas para `nomesSemLink`.
 */
function montar({ campanhaId, contaId, verbetes, revelado, ligacoes = [] }: EntradaDoPacote, textosDe?: ReadonlySet<string>): Montagem {
  const porAlvo = revelacoesPorAlvo(revelado)
  const ve = (alvo: AlvoDaRevelacao): boolean => contaVe(paraDe(porAlvo, alvo), contaId)

  const todos = new Map<string, Verbete>()
  for (const verbete of verbetes) todos.set(verbete.id, verbete)
  // Primeiro quem entra: a menção de um texto depende de quem mais está no pacote.
  const entram = [...todos.values()].filter((verbete) => podeIrAoJogador(verbete) && verbete.campanhas.includes(campanhaId) && ve(alvoDoVerbete(verbete.id))).sort(porId)
  const noPacote = new Set(entram.map((verbete) => verbete.id))

  const midias = new Set<string>()
  const citadoEm = new Map<string, string[]>()
  const nomesSemLink: NomeSemLink[] = []
  const montados = entram.map((verbete): { verbete: Verbete; formas: FormaDoPacote[] } => {
    if (textosDe !== undefined && !textosDe.has(verbete.id)) return { verbete, formas: [] }
    const contexto: Contexto = { todos, noPacote, midias, mencionados: new Set(), nomesSemLink }
    const formas = verbete.formas.filter((forma) => ve(alvoDaForma(verbete.id, forma.id))).map((forma) => formaDoPacote(verbete.id, forma, ve, contexto))
    for (const mencionado of contexto.mencionados) {
      if (mencionado === verbete.id) continue
      const quem = citadoEm.get(mencionado) ?? []
      quem.push(verbete.id)
      citadoEm.set(mencionado, quem)
    }
    return { verbete, formas }
  })

  const verbetesDoPacote = montados.map(({ verbete, formas }): VerbeteDoPacote => {
    const base = { id: verbete.id, tipo: verbete.tipo, titulo: verbete.titulo, formas, citadoEm: (citadoEm.get(verbete.id) ?? []).sort() }
    return verbete.paiId !== undefined && noPacote.has(verbete.paiId) ? { ...base, paiId: verbete.paiId } : base
  })

  const ligacoesDoPacote = ligacoes
    .filter((ligacao) => ligacao.extras === undefined && !ligacao.segredo && noPacote.has(ligacao.de) && noPacote.has(ligacao.para) && ve(alvoDaLigacao(ligacao.id)))
    .map(({ id, de, para, tipo, notas }): LigacaoDoPacote => ({ id, de, para, tipo, notas }))
    .sort(porId)

  return { pacote: { formato: FORMATO_DO_PACOTE, campanhaId, contaId, verbetes: verbetesDoPacote, ligacoes: ligacoesDoPacote, midias: [...midias].sort() }, nomesSemLink }
}

export function montarPacoteDoJogador(entrada: EntradaDoPacote): PacoteDoJogador {
  return montar(entrada).pacote
}

// ─── Nome sem link ───────────────────────────────────────────────────────────

/**
 * Onde, no pacote deste jogador, a menção virou só o nome (o de agora, sem
 * link). `textosDe` limita a busca ao texto destes verbetes; sem ele, todos.
 */
export function nomesSemLink(entrada: EntradaDoPacote, textosDe?: ReadonlySet<string>): readonly NomeSemLink[] {
  return montar(entrada, textosDe).nomesSemLink
}

export interface RevelacoesParaOPacote {
  readonly campanhaId: string
  /** `null` = o arquivo não abriu, e nada é revelado. */
  readonly revelado: Revelado | null
}

/** As contas com alguma revelação só para elas: qualquer outra conta vê o mesmo que um jogador qualquer. */
function contasComRevelacaoPropria(revelado: Revelado | null): string[] {
  const contas = new Set<string>()
  for (const { para } of revelacoesPorAlvo(revelado).values()) if (para !== 'todos') for (const conta of para) contas.add(conta)
  return [...contas].sort()
}

/**
 * `nomesSemLink` de todo jogador de todas as campanhas, sem repetição e em
 * ordem. Basta olhar um jogador qualquer (só o revelado a todos) e cada conta
 * com revelação própria: as outras contas recebem o mesmo pacote que o jogador qualquer.
 */
export function nomesSemLinkNasCampanhas(campanhas: Iterable<RevelacoesParaOPacote>, verbetes: Iterable<Verbete>, textosDe?: ReadonlySet<string>): NomeSemLink[] {
  // Lista, e não o iterável: cada pacote percorre os verbetes de novo.
  const lista = [...verbetes]
  const unicos = new Map<string, NomeSemLink>()
  for (const { campanhaId, revelado } of campanhas) {
    for (const contaId of [null, ...contasComRevelacaoPropria(revelado)]) {
      for (const nome of nomesSemLink({ campanhaId, contaId, verbetes: lista, revelado }, textosDe)) {
        unicos.set(JSON.stringify([nome.verbeteId, nome.formaId, nome.secaoId, nome.mencionadoId]), nome)
      }
    }
  }
  return [...unicos].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, nome]) => nome)
}
