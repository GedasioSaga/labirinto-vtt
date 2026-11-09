import { ARQUIVO_DO_VERBETE, PECAS_DO_TEXTO, type Forma, type Secao, type TextoRico, type TipoDeVerbete, type Verbete } from './tipos'

/**
 * A ENCICLOPÉDIA E A ESCRITA SEM TELA (docs/planos/preludio-2026-11-08.md §1):
 * o que as telas do Prelúdio calculam a partir dos verbetes, em funções puras.
 *
 * - Árvore: lugar dentro de lugar e página dentro de página, pelo `paiId`.
 *   Pai que não existe (ou que o filtro tirou) põe o filho na raiz; um laço
 *   de `paiId` mexido à mão não trava nada.
 * - Busca no texto inteiro ignorando acento ("sao joao" acha "São João").
 * - "Citado em": quem tem @menção a quem, pelo `verbeteId` do nó `mencao`.
 * - Verbete novo com as seções de cada tipo, no formato desta versão.
 */

// ─── Rótulos ─────────────────────────────────────────────────────────────────

export const ROTULO_DO_TIPO: Readonly<Record<TipoDeVerbete, { readonly um: string; readonly varios: string; readonly novo: string }>> = {
  personagem: { um: 'Personagem', varios: 'Personagens', novo: 'Novo personagem' },
  lugar: { um: 'Lugar', varios: 'Lugares', novo: 'Novo lugar' },
  item: { um: 'Item', varios: 'Itens', novo: 'Novo item' },
  faccao: { um: 'Facção', varios: 'Facções', novo: 'Nova facção' },
  pagina: { um: 'Página', varios: 'Páginas', novo: 'Nova página' },
  sessao: { um: 'Sessão', varios: 'Sessões', novo: 'Nova sessão' },
}

/** Os tipos que a Enciclopédia lista (a sessão é das Sessões, F4). */
export const TIPOS_DA_ENCICLOPEDIA: readonly TipoDeVerbete[] = ['personagem', 'lugar', 'item', 'faccao', 'pagina']

const COLACAO = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

export function compararTitulos(a: string, b: string): number {
  return COLACAO.compare(a, b)
}

// ─── Texto do editor ─────────────────────────────────────────────────────────

interface NoBruto {
  readonly type?: unknown
  readonly text?: unknown
  readonly attrs?: unknown
  readonly content?: unknown
}

function ehNo(valor: unknown): valor is NoBruto {
  return typeof valor === 'object' && valor !== null
}

function atributo(no: NoBruto, nome: string): unknown {
  return ehNo(no.attrs) ? (no.attrs as Record<string, unknown>)[nome] : undefined
}

/** Nós que terminam numa quebra de linha no texto plano. */
const BLOCOS = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'horizontalRule', 'image', PECAS_DO_TEXTO.segredo])

/** O texto que o leitor vê, sem formato: o que a busca e o resumo da lista usam. `tituloDe` dá o nome atual de quem foi @mencionado. */
export function textoPlano(texto: TextoRico | null | undefined, tituloDe?: (id: string) => string | undefined): string {
  if (texto === null || texto === undefined) return ''
  const partes: string[] = []
  const andar = (no: unknown): void => {
    if (!ehNo(no)) return
    const tipo = no.type
    if (tipo === 'text') {
      if (typeof no.text === 'string') partes.push(no.text)
      return
    }
    if (tipo === 'hardBreak') {
      partes.push('\n')
      return
    }
    if (tipo === PECAS_DO_TEXTO.mencao) {
      const id = atributo(no, 'verbeteId')
      const rotulo = atributo(no, 'rotulo')
      const nome = (typeof id === 'string' ? tituloDe?.(id) : undefined) ?? (typeof rotulo === 'string' ? rotulo : '')
      partes.push(`@${nome}`)
      return
    }
    if (tipo === 'image') {
      const legenda = atributo(no, 'legenda') ?? atributo(no, 'alt')
      if (typeof legenda === 'string' && legenda !== '') partes.push(legenda)
    }
    if (Array.isArray(no.content)) for (const filho of no.content) andar(filho)
    if (typeof tipo === 'string' && BLOCOS.has(tipo)) partes.push('\n')
  }
  andar(texto)
  return partes.join('').replace(/\n{3,}/g, '\n\n').trim()
}

/** Os ids @mencionados num texto. */
export function mencoesNoTexto(texto: TextoRico, saida: Set<string> = new Set()): Set<string> {
  const pilha: unknown[] = [texto]
  while (pilha.length > 0) {
    const no = pilha.pop()
    if (!ehNo(no)) continue
    if (no.type === PECAS_DO_TEXTO.mencao) {
      const id = atributo(no, 'verbeteId')
      if (typeof id === 'string' && id !== '') saida.add(id)
      continue
    }
    if (Array.isArray(no.content)) pilha.push(...no.content)
  }
  return saida
}

/** Todo id que o verbete @menciona, em qualquer forma e seção (inclusive as de segredo: a lista é do mestre). */
export function mencoesDoVerbete(verbete: Verbete): Set<string> {
  const saida = new Set<string>()
  for (const forma of verbete.formas) for (const secao of forma.secoes) mencoesNoTexto(secao.texto, saida)
  saida.delete(verbete.id)
  return saida
}

/**
 * "Citado em", mantido aos pedaços: trocar um verbete só mexe nas menções
 * dele (o mestre digita num verbete; recalcular os 300 a cada tecla seria à toa).
 */
export class IndiceDeCitacoes {
  private readonly saidas = new Map<string, Set<string>>()
  private readonly entradas = new Map<string, Set<string>>()

  constructor(verbetes: Iterable<Verbete> = []) {
    for (const verbete of verbetes) this.atualizar(verbete)
  }

  atualizar(verbete: Verbete): void {
    const novas = mencoesDoVerbete(verbete)
    const antigas = this.saidas.get(verbete.id) ?? new Set<string>()
    for (const alvo of antigas) if (!novas.has(alvo)) this.entradas.get(alvo)?.delete(verbete.id)
    for (const alvo of novas) {
      const quem = this.entradas.get(alvo) ?? new Set<string>()
      quem.add(verbete.id)
      this.entradas.set(alvo, quem)
    }
    this.saidas.set(verbete.id, novas)
  }

  /** Os ids de quem @menciona `id`. */
  citadoEm(id: string): string[] {
    return [...(this.entradas.get(id) ?? [])]
  }
}

// ─── Busca sem acento ────────────────────────────────────────────────────────

const ACENTOS = /\p{M}/gu

/** "São JOÃO" → "sao joao". */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(ACENTOS, '').toLowerCase()
}

/** O texto sem acento e, para cada caractere dele, a posição no original (o trecho do resultado sai do texto como foi escrito). */
export interface TextoSemAcento {
  readonly texto: string
  readonly origem: Int32Array
}

export function semAcentoComMapa(original: string): TextoSemAcento {
  const partes: string[] = []
  const origem: number[] = []
  for (let i = 0; i < original.length; ) {
    const ponto = original.codePointAt(i) ?? 0
    const caractere = String.fromCodePoint(ponto)
    // ASCII é a maioria do texto e não tem acento: só baixa a caixa.
    const limpo = ponto < 128 ? caractere.toLowerCase() : semAcento(caractere)
    for (let k = 0; k < limpo.length; k += 1) origem.push(i)
    partes.push(limpo)
    i += caractere.length
  }
  return { texto: partes.join(''), origem: Int32Array.from(origem) }
}

export interface EntradaDaBusca {
  readonly id: string
  readonly tipo: TipoDeVerbete
  readonly titulo: string
  readonly tituloSemAcento: string
  readonly apelidos: readonly string[]
  readonly apelidosSemAcento: readonly string[]
  /** Nome, resumo, títulos e texto das seções e legendas de todas as formas. */
  readonly corpo: string
  readonly corpoSemAcento: TextoSemAcento
}

function textoDaForma(forma: Forma, tituloDe?: (id: string) => string | undefined): string {
  const partes = [forma.nome, forma.resumo]
  for (const secao of forma.secoes) partes.push(secao.titulo, textoPlano(secao.texto, tituloDe))
  for (const imagem of forma.imagens) partes.push(imagem.legenda)
  return partes.filter((parte) => parte !== '').join('\n')
}

export function entradaDaBusca(verbete: Verbete, tituloDe?: (id: string) => string | undefined): EntradaDaBusca {
  const corpo = verbete.formas.map((forma) => textoDaForma(forma, tituloDe)).join('\n')
  return {
    id: verbete.id,
    tipo: verbete.tipo,
    titulo: verbete.titulo,
    tituloSemAcento: semAcento(verbete.titulo),
    apelidos: verbete.apelidos,
    apelidosSemAcento: verbete.apelidos.map(semAcento),
    corpo,
    corpoSemAcento: semAcentoComMapa(corpo),
  }
}

export interface Trecho {
  readonly antes: string
  readonly achado: string
  readonly depois: string
}

export interface Achado {
  readonly id: string
  readonly tipo: TipoDeVerbete
  readonly titulo: string
  /** Onde a consulta bateu primeiro: no título, num apelido ou só no texto. */
  readonly onde: 'titulo' | 'apelido' | 'texto'
  readonly apelido?: string
  readonly trecho?: Trecho
}

const ANTES_DO_TRECHO = 48
const DEPOIS_DO_TRECHO = 96

function trechoEm(entrada: EntradaDaBusca, palavra: string): Trecho | undefined {
  const { texto, origem } = entrada.corpoSemAcento
  const posicao = texto.indexOf(palavra)
  if (posicao < 0) return undefined
  const inicio = origem[posicao] ?? 0
  const ultimo = origem[posicao + palavra.length - 1] ?? inicio
  // Caractere fora do plano básico (emoji) ocupa duas posições no texto do JS.
  const fim = ultimo + ((entrada.corpo.codePointAt(ultimo) ?? 0) > 0xffff ? 2 : 1)
  const corte = (pedaco: string) => pedaco.replace(/\s+/g, ' ')
  // O trecho fica dentro do parágrafo achado: o título da seção de cima não entra colado no texto.
  const linhaComeca = entrada.corpo.lastIndexOf('\n', inicio - 1) + 1
  const quebra = entrada.corpo.indexOf('\n', fim)
  const linhaAcaba = quebra < 0 ? entrada.corpo.length : quebra
  const comeco = Math.max(linhaComeca, inicio - ANTES_DO_TRECHO)
  const final = Math.min(linhaAcaba, fim + DEPOIS_DO_TRECHO)
  return {
    antes: `${comeco > linhaComeca ? '…' : ''}${corte(entrada.corpo.slice(comeco, inicio)).trimStart()}`,
    achado: entrada.corpo.slice(inicio, fim),
    depois: `${corte(entrada.corpo.slice(fim, final)).trimEnd()}${final < linhaAcaba ? '…' : ''}`,
  }
}

/**
 * Procura todas as palavras da consulta no título, nos apelidos e no texto
 * inteiro, sem acento e sem caixa. Ordem: título que começa com a consulta,
 * título que contém, apelido, texto; empate por ordem alfabética.
 */
export function buscar(entradas: readonly EntradaDaBusca[], consulta: string, limite = 40): Achado[] {
  const limpa = semAcento(consulta).trim()
  const palavras = limpa.split(/\s+/).filter((palavra) => palavra !== '')
  if (palavras.length === 0) return []
  const maisLonga = [...palavras].sort((a, b) => b.length - a.length)[0] ?? limpa
  const achados: { achado: Achado; pontos: number }[] = []
  for (const entrada of entradas) {
    const temTudo = palavras.every(
      (palavra) => entrada.tituloSemAcento.includes(palavra) || entrada.apelidosSemAcento.some((apelido) => apelido.includes(palavra)) || entrada.corpoSemAcento.texto.includes(palavra),
    )
    if (!temTudo) continue
    const base = { id: entrada.id, tipo: entrada.tipo, titulo: entrada.titulo }
    if (palavras.every((palavra) => entrada.tituloSemAcento.includes(palavra))) {
      achados.push({ achado: { ...base, onde: 'titulo' }, pontos: entrada.tituloSemAcento.startsWith(limpa) ? 3 : 2 })
      continue
    }
    const apelido = entrada.apelidos.find((_, indice) => palavras.every((palavra) => entrada.apelidosSemAcento[indice]?.includes(palavra)))
    if (apelido !== undefined) {
      achados.push({ achado: { ...base, onde: 'apelido', apelido }, pontos: 1 })
      continue
    }
    achados.push({ achado: { ...base, onde: 'texto', trecho: trechoEm(entrada, maisLonga) }, pontos: 0 })
  }
  achados.sort((a, b) => b.pontos - a.pontos || compararTitulos(a.achado.titulo, b.achado.titulo))
  return achados.slice(0, limite).map(({ achado }) => achado)
}

// ─── Árvore ──────────────────────────────────────────────────────────────────

export interface NoDaArvore {
  readonly verbete: Verbete
  readonly filhos: readonly NoDaArvore[]
}

/** A posição entre irmãs que veio do Grimório (`extras.ordem`); sem ela, a ordem é a do título. */
export function ordemDe(verbete: Verbete): number | undefined {
  const ordem = verbete.extras?.ordem
  return typeof ordem === 'number' && Number.isFinite(ordem) ? ordem : undefined
}

function compararIrmas(a: Verbete, b: Verbete): number {
  const oa = ordemDe(a)
  const ob = ordemDe(b)
  if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob
  if (oa !== undefined && ob === undefined) return -1
  if (oa === undefined && ob !== undefined) return 1
  return compararTitulos(a.titulo, b.titulo)
}

/** Profundidade máxima seguida pelos `paiId`: mais que isso é laço feito à mão. */
const PROFUNDIDADE_MAXIMA = 64

/** Os pais de um verbete, da raiz até o pai direto. Laço ou pai que não existe param a subida. */
export function ancestraisDe(verbete: Verbete, porId: ReadonlyMap<string, Verbete>): Verbete[] {
  const subida: Verbete[] = []
  const vistos = new Set<string>([verbete.id])
  let paiId = verbete.paiId
  while (paiId !== undefined && subida.length < PROFUNDIDADE_MAXIMA && !vistos.has(paiId)) {
    const pai = porId.get(paiId)
    if (pai === undefined) break
    subida.push(pai)
    vistos.add(pai.id)
    paiId = pai.paiId
  }
  return subida.reverse()
}

/** A árvore dos verbetes dados, pelo `paiId`. Quem tem pai fora da lista (ou num laço) vira raiz. */
export function arvoreDe(verbetes: readonly Verbete[]): NoDaArvore[] {
  const porId = new Map(verbetes.map((verbete) => [verbete.id, verbete]))
  const filhosDe = new Map<string, Verbete[]>()
  const raizes: Verbete[] = []
  for (const verbete of verbetes) {
    const pai = verbete.paiId === undefined ? undefined : porId.get(verbete.paiId)
    const emLaco = pai !== undefined && ancestraisDe(verbete, porId).some((ancestral) => ancestral.paiId === verbete.id)
    if (pai === undefined || emLaco) {
      raizes.push(verbete)
      continue
    }
    const irmas = filhosDe.get(pai.id) ?? []
    irmas.push(verbete)
    filhosDe.set(pai.id, irmas)
  }
  const montar = (verbete: Verbete, caminho: Set<string>): NoDaArvore => {
    const filhos = (filhosDe.get(verbete.id) ?? []).filter((filho) => !caminho.has(filho.id)).sort(compararIrmas)
    const proximo = new Set(caminho).add(verbete.id)
    return { verbete, filhos: filhos.map((filho) => montar(filho, proximo)) }
  }
  return raizes.sort(compararIrmas).map((raiz) => montar(raiz, new Set()))
}

/**
 * A página é da Escrita (caderno livre) quando todo o caminho até a raiz é de
 * páginas e a raiz não é o caderno de um quadro: as páginas da sessão são das
 * Sessões (F4) e as do quadro, do Quadro (F3).
 */
export function ehDaEscrita(verbete: Verbete, porId: ReadonlyMap<string, Verbete>): boolean {
  if (verbete.tipo !== 'pagina') return false
  const caminho = [...ancestraisDe(verbete, porId), verbete]
  const raiz = caminho[0]
  // Raiz com `paiId` que não existe mais (a sessão foi apagada) fica na Escrita: assim a página não some.
  if (raiz === undefined || raiz.extras?.quadroId !== undefined) return false
  return caminho.every((passo) => passo.tipo === 'pagina')
}

export function naCampanha(verbete: Verbete, campanhaId: string | null): boolean {
  return campanhaId === null || verbete.campanhas.includes(campanhaId)
}

// ─── Verbete novo ────────────────────────────────────────────────────────────

const ID_ALEATORIO = 8

/** Id novo que serve de nome de arquivo em preparo/ (`disco.ts`): letras, números e hífen. */
export function idNovo(prefixo: string): string {
  const bytes = new Uint8Array(ID_ALEATORIO)
  crypto.getRandomValues(bytes)
  const sorte = Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('')
  return `${prefixo}-${Date.now().toString(36)}-${sorte}`
}

interface SecaoPadrao {
  readonly titulo: string
  readonly segredo: boolean
}

const ANOTACOES: SecaoPadrao = { titulo: 'Anotações', segredo: true }

/** As seções de cada tipo: as mesmas que a importação do Grimório cria (`importar/converter.ts`). */
const SECOES_DO_TIPO: Readonly<Record<TipoDeVerbete, readonly SecaoPadrao[]>> = {
  personagem: [{ titulo: 'Descrição', segredo: false }, { titulo: 'Informações', segredo: false }, { titulo: 'História', segredo: false }, ANOTACOES],
  lugar: [{ titulo: 'Descrição', segredo: false }, { titulo: 'Informações', segredo: false }, { titulo: 'Eventos', segredo: false }, ANOTACOES],
  item: [{ titulo: 'Descrição', segredo: false }, { titulo: 'Efeito', segredo: false }, ANOTACOES],
  faccao: [{ titulo: 'Descrição', segredo: false }, { titulo: 'Membros', segredo: false }, { titulo: 'História', segredo: false }, ANOTACOES],
  pagina: [{ titulo: '', segredo: false }],
  sessao: [{ titulo: '', segredo: false }],
}

function secaoNova(formaId: string, padrao: SecaoPadrao, indice: number): Secao {
  return { id: `${formaId}-s${indice + 1}`, titulo: padrao.titulo, texto: { type: 'doc', content: [{ type: 'paragraph' }] }, segredo: padrao.segredo }
}

export interface OpcoesDoVerbeteNovo {
  readonly campanhas: readonly string[]
  readonly paiId?: string
  /** Posição entre as irmãs (página da Escrita). */
  readonly ordem?: number
}

export function verbeteNovo(tipo: TipoDeVerbete, titulo: string, opcoes: OpcoesDoVerbeteNovo, gerarId: (prefixo: string) => string = idNovo): Verbete {
  const id = gerarId(tipo === 'pagina' ? 'pg' : 'vb')
  const formaId = `${id}-f1`
  const forma: Forma = { id: formaId, nome: titulo, resumo: '', secoes: SECOES_DO_TIPO[tipo].map((padrao, indice) => secaoNova(formaId, padrao, indice)), imagens: [] }
  const verbete: Verbete = { formato: ARQUIVO_DO_VERBETE.formato, id, tipo, titulo, apelidos: [], campanhas: [...opcoes.campanhas], formas: [forma], formaAtivaId: formaId }
  if (opcoes.paiId !== undefined) verbete.paiId = opcoes.paiId
  if (opcoes.ordem !== undefined) verbete.extras = { ordem: opcoes.ordem }
  return verbete
}

/** Outra forma do mesmo verbete (Dia/Noite): as mesmas seções, vazias, e nenhuma imagem. */
export function formaNova(base: Forma, nome: string, gerarId: (prefixo: string) => string = idNovo): Forma {
  const id = gerarId('fm')
  return {
    id,
    nome,
    resumo: '',
    secoes: base.secoes.map((secao, indice) => secaoNova(id, { titulo: secao.titulo, segredo: secao.segredo }, indice)),
    imagens: [],
  }
}

/** A forma que a tela mostra: a pedida, a ativa, ou a primeira. */
export function formaDe(verbete: Verbete, formaId: string | null): Forma | undefined {
  return verbete.formas.find((forma) => forma.id === formaId) ?? verbete.formas.find((forma) => forma.id === verbete.formaAtivaId) ?? verbete.formas[0]
}
