import { ehRegistro } from '../molde'
import { ARQUIVO_DO_QUADRO, ARQUIVO_DO_VERBETE, CAMPANHA, LIGACAO, type Campanha, type Ligacao, type Origem, type Quadro, type Verbete } from '../tipos'
import { compararCaminhos, hashDoTexto } from './cofre'
import type { PlanoDaImportacao } from './relatorio'

/**
 * A REGRA DA REIMPORTAÇÃO (decisão do mestre, 08/11; plano §4 passo 7 e
 * "Depois do conselho"), igual para verbete, quadro, ligação e campanha:
 * - o que o mestre EDITOU no Prelúdio fica como está, e entra na lista
 *   ("mudou no Grimório também", quando o Grimório também mudou);
 * - o verbete que o mestre REVELOU a algum jogador (o verbete, uma forma ou uma
 *   seção, em qualquer campanha) conta como editado quando o Grimório mudou: a
 *   revelação vale para o que o mestre viu, e trocar o verbete passaria o texto
 *   novo do Grimório ao jogador sem um clique (F2c). Quem lê o revelado é
 *   `noPreludio.ts` (`NoPreludio.revelados`);
 * - o resto é atualizado com o que veio do Grimório;
 * - nada de juntar versões: cada um fica ou é trocado inteiro;
 * - nada some do Prelúdio porque sumiu do Grimório: vai para "sumiu lá";
 * - o que o mestre apagou no Prelúdio não volta;
 * - o que só existe no Prelúdio (sem `origem.grimorio`) e o `pastaId` da
 *   campanha (passo 8) nunca são tocados.
 *
 * "Editado" = não bate mais com o hash guardado na importação
 * (`origem.grimorio.hash`). O hash cobre o conteúdo como vai para o disco, menos
 * `origem` (onde mora o próprio hash), `formato` e o que muda sem ser edição:
 * - no texto, o que o editor acrescenta sozinho ao abrir (`projetarDocumento`);
 * - no quadro, a vista do tldraw (`tldraw.session`: câmera, ferramenta escolhida);
 * - na campanha, o `pastaId`, que só existe no Prelúdio.
 * Quem salva no Prelúdio (F2, F3) compara com estas mesmas funções.
 */

/** Chaves em ordem fixa, para o mesmo conteúdo dar o mesmo texto. `textos`: projeta os documentos do editor. */
function canonico(valor: unknown, textos: boolean): unknown {
  if (Array.isArray(valor)) return valor.map((item) => canonico(item, textos))
  if (!ehRegistro(valor)) return valor
  const base = textos && valor.type === 'doc' ? projetarDocumento(valor) : valor
  const chaves = Object.keys(base).sort(compararCaminhos)
  return Object.fromEntries(chaves.filter((chave) => base[chave] !== undefined).map((chave) => [chave, canonico(base[chave], textos)]))
}

// ─── O texto como o editor o devolve ─────────────────────────────────────────

/**
 * Os atributos que o Link do TipTap 3 põe sozinho (`@tiptap/extension-link`
 * 3.27.4, `HTMLAttributes`, lido no `node_modules` do Grimório). O editor do
 * Prelúdio (F2) usa o mesmo StarterKit; se configurar o link de outro jeito,
 * esta tabela muda junto.
 */
const PADRAO_DO_LINK: Readonly<Record<string, unknown>> = { target: '_blank', rel: 'noopener noreferrer nofollow' }
const SEM_PADRAO: Readonly<Record<string, unknown>> = {}

/** Atributo `null` (o esquema preenche o ausente com o padrão, quase sempre `null`) e o padrão somem. */
function semPadrao(attrs: Record<string, unknown>, padrao: Readonly<Record<string, unknown>>): Record<string, unknown> | undefined {
  const saida = Object.fromEntries(
    Object.entries(attrs).filter(([chave, valor]) => valor !== null && valor !== undefined && !(Object.hasOwn(padrao, chave) && padrao[chave] === valor)),
  )
  return Object.keys(saida).length > 0 ? saida : undefined
}

function tipoDe(valor: unknown): string {
  return ehRegistro(valor) && typeof valor.type === 'string' ? valor.type : ''
}

function projetarMarca(marca: unknown): unknown {
  if (!ehRegistro(marca)) return marca
  const saida: Record<string, unknown> = { ...marca }
  delete saida.attrs
  const attrs = ehRegistro(marca.attrs) ? semPadrao(marca.attrs, marca.type === 'link' ? PADRAO_DO_LINK : SEM_PADRAO) : undefined
  if (attrs !== undefined) saida.attrs = attrs
  return saida
}

function ehTexto(no: unknown): no is Record<string, unknown> & { text: string } {
  return ehRegistro(no) && no.type === 'text' && typeof no.text === 'string'
}

/** Texto vizinho com as mesmas marcas vira um só, como faz o `Fragment.fromArray` do ProseMirror. */
function juntarTextos(nos: readonly unknown[]): unknown[] {
  const saida: unknown[] = []
  for (const no of nos) {
    const anterior = saida[saida.length - 1]
    if (ehTexto(no) && ehTexto(anterior) && JSON.stringify(canonico(anterior.marks ?? [], false)) === JSON.stringify(canonico(no.marks ?? [], false))) {
      saida[saida.length - 1] = { ...anterior, text: anterior.text + no.text }
    } else {
      saida.push(no)
    }
  }
  return saida
}

/** Um nó como o `toJSON` do ProseMirror devolve: sem `attrs`, `content` e `marks` vazios, marcas em ordem. */
function projetarNo(no: unknown): unknown {
  if (!ehRegistro(no)) return no
  const saida: Record<string, unknown> = { ...no }
  if (ehRegistro(no.attrs)) {
    delete saida.attrs
    const attrs = semPadrao(no.attrs, SEM_PADRAO)
    if (attrs !== undefined) saida.attrs = attrs
  }
  if (Array.isArray(no.content)) {
    delete saida.content
    const conteudo = juntarTextos(no.content.map(projetarNo))
    if (conteudo.length > 0) saida.content = conteudo
  }
  if (Array.isArray(no.marks)) {
    delete saida.marks
    const marcas = no.marks.map(projetarMarca).sort((a, b) => compararCaminhos(tipoDe(a), tipoDe(b)))
    if (marcas.length > 0) saida.marks = marcas
  }
  return saida
}

function ehParagrafoVazio(no: unknown): boolean {
  return ehRegistro(no) && no.type === 'paragraph' && no.content === undefined
}

/**
 * O documento do editor como o TipTap 3 o devolve depois de aberto, sem ninguém
 * escrever: o esquema preenche os atributos com o padrão, junta textos vizinhos
 * e ordena as marcas, e o `TrailingNode` do StarterKit 3 (`@tiptap/extensions`)
 * põe um parágrafo vazio no fim quando o documento termina em lista, título ou
 * imagem. Sem esta projeção, abrir uma seção já mudaria o hash.
 */
export function projetarDocumento(documento: Record<string, unknown>): Record<string, unknown> {
  const projetado = projetarNo(documento)
  const saida: Record<string, unknown> = ehRegistro(projetado) ? { ...projetado } : {}
  if (!Array.isArray(saida.content)) return saida
  const conteudo: unknown[] = [...saida.content]
  while (conteudo.length > 0 && ehParagrafoVazio(conteudo[conteudo.length - 1])) conteudo.pop()
  if (conteudo.length > 0) saida.content = conteudo
  else delete saida.content
  return saida
}

// ─── Os hashes ───────────────────────────────────────────────────────────────

function hashDe(noDisco: unknown, tirar: readonly string[], textos: boolean): Promise<string> {
  const conteudo: Record<string, unknown> = ehRegistro(noDisco) ? { ...noDisco } : {}
  for (const chave of tirar) delete conteudo[chave]
  return hashDoTexto(JSON.stringify(canonico(conteudo, textos)))
}

export function hashDoVerbete(verbete: Verbete): Promise<string> {
  return hashDe(ARQUIVO_DO_VERBETE.molde.gravar(verbete), ['origem', 'formato'], true)
}

/** Sem a vista (`session`): olhar o quadro de outro ângulo não é editar. */
export function hashDoQuadro(quadro: Quadro): Promise<string> {
  const noDisco = ARQUIVO_DO_QUADRO.molde.gravar(quadro)
  const conteudo: Record<string, unknown> = ehRegistro(noDisco) ? { ...noDisco } : {}
  if (ehRegistro(conteudo.tldraw)) {
    const foto: Record<string, unknown> = { ...conteudo.tldraw }
    delete foto.session
    conteudo.tldraw = foto
  }
  return hashDe(conteudo, ['origem', 'formato'], false)
}

export function hashDaLigacao(ligacao: Ligacao): Promise<string> {
  return hashDe(LIGACAO.gravar(ligacao), ['origem'], false)
}

export function hashDaCampanha(campanha: Campanha): Promise<string> {
  return hashDe(CAMPANHA.gravar(campanha), ['origem', 'pastaId'], false)
}

interface ComOrigem {
  readonly origem?: Origem
}

/** Grava no que veio do Grimório o hash dele mesmo: a marca de "não mexido desde a importação". */
async function comHash<T extends ComOrigem>(valor: T, hash: (valor: T) => Promise<string>): Promise<T> {
  const grimorio = valor.origem?.grimorio
  if (grimorio === undefined) return valor
  return { ...valor, origem: { ...valor.origem, grimorio: { ...grimorio, hash: await hash(valor) } } }
}

export const comHashDaImportacao = (verbete: Verbete): Promise<Verbete> => comHash(verbete, hashDoVerbete)
export const quadroComHash = (quadro: Quadro): Promise<Quadro> => comHash(quadro, hashDoQuadro)
export const ligacaoComHash = (ligacao: Ligacao): Promise<Ligacao> => comHash(ligacao, hashDaLigacao)
export const campanhaComHash = (campanha: Campanha): Promise<Campanha> => comHash(campanha, hashDaCampanha)

// ─── O plano ─────────────────────────────────────────────────────────────────

export interface ItemDaLista {
  readonly id: string
  readonly titulo: string
}

export interface EditadoNoPreludio extends ItemDaLista {
  /** O Grimório também mudou desde a última importação: o mestre decide à mão. */
  readonly mudouNoGrimorioTambem: boolean
  /** Ninguém editou: fica porque foi revelado a algum jogador (ausente = editado de verdade). */
  readonly revelado?: true
}

export interface ReimportacaoDoTipo {
  /** Não existem no Prelúdio: entram. */
  readonly novos: readonly string[]
  /** Ninguém mexeu no Prelúdio e o Grimório mudou: são trocados inteiros. */
  readonly atualizar: readonly string[]
  /** Iguais dos dois lados: nada a fazer. */
  readonly iguais: readonly string[]
  /** Editados no Prelúdio (ou com o mesmo id de algo criado lá): ficam como estão. */
  readonly editadosNoPreludio: readonly EditadoNoPreludio[]
  /** Vieram do Grimório e não estão mais lá: ficam no Prelúdio. */
  readonly sumiuLa: readonly ItemDaLista[]
  /** O mestre apagou no Prelúdio e o Grimório ainda tem: não voltam. */
  readonly apagadosNoPreludio: readonly ItemDaLista[]
}

export interface PlanoDeReimportacao {
  readonly verbetes: ReimportacaoDoTipo
  readonly quadros: ReimportacaoDoTipo
  readonly ligacoes: ReimportacaoDoTipo
  readonly campanhas: ReimportacaoDoTipo
}

export interface QuadroComId {
  readonly id: string
  readonly quadro: Quadro
}

/** Ids do Prelúdio, por tipo (a sessão e o quadro dela têm o mesmo id). */
export interface ApagadosNoPreludio {
  readonly verbetes?: readonly string[]
  readonly quadros?: readonly string[]
  readonly ligacoes?: readonly string[]
  readonly campanhas?: readonly string[]
}

/** O que já está no Prelúdio quando o mestre reimporta. */
export interface NoPreludio {
  readonly verbetes: readonly Verbete[]
  readonly quadros?: readonly QuadroComId[]
  readonly ligacoes?: readonly Ligacao[]
  readonly campanhas?: readonly Campanha[]
  /** O que veio do Grimório e o mestre apagou no Prelúdio: a reimportação não traz de volta. */
  readonly apagados?: ApagadosNoPreludio
  /** Ids de verbete com alguma revelação, em qualquer campanha: revelar conta como editar. */
  readonly revelados?: ReadonlySet<string>
}

/** O que a importação nova traz, já com os hashes (`comHashDaImportacao` e irmãos). */
export interface Importado {
  readonly verbetes: readonly Verbete[]
  readonly quadros: readonly QuadroComId[]
  readonly ligacoes: readonly Ligacao[]
  readonly campanhas: readonly Campanha[]
}

interface Jeito<T> {
  readonly id: (valor: T) => string
  readonly titulo: (valor: T) => string
  readonly origem: (valor: T) => Origem | undefined
  readonly hash: (valor: T) => Promise<string>
}

const DO_VERBETE: Jeito<Verbete> = { id: (v) => v.id, titulo: (v) => v.titulo, origem: (v) => v.origem, hash: hashDoVerbete }
const DO_QUADRO: Jeito<QuadroComId> = { id: (q) => q.id, titulo: (q) => q.quadro.nome, origem: (q) => q.quadro.origem, hash: (q) => hashDoQuadro(q.quadro) }
const DA_LIGACAO: Jeito<Ligacao> = { id: (l) => l.id, titulo: (l) => `${l.de} → ${l.para} (${l.tipo})`, origem: (l) => l.origem, hash: hashDaLigacao }
const DA_CAMPANHA: Jeito<Campanha> = { id: (c) => c.id, titulo: (c) => c.nome, origem: (c) => c.origem, hash: hashDaCampanha }

/** `protegidos`: ids que contam como editados mesmo com o hash batendo (o verbete revelado a algum jogador). */
async function planejarTipo<T>(
  existentes: readonly T[],
  novos: readonly T[],
  apagados: readonly string[],
  jeito: Jeito<T>,
  protegidos: ReadonlySet<string> = new Set(),
): Promise<ReimportacaoDoTipo> {
  const doGrimorio = new Map(existentes.filter((valor) => jeito.origem(valor)?.grimorio !== undefined).map((valor) => [jeito.id(valor), valor]))
  const soDoPreludio = new Map(existentes.filter((valor) => jeito.origem(valor)?.grimorio === undefined).map((valor) => [jeito.id(valor), valor]))
  const foiApagado = new Set(apagados)
  const entram: string[] = []
  const atualizar: string[] = []
  const iguais: string[] = []
  const editadosNoPreludio: EditadoNoPreludio[] = []
  const apagadosNoPreludio: ItemDaLista[] = []
  const vistos = new Set<string>()
  for (const novo of novos) {
    const id = jeito.id(novo)
    vistos.add(id)
    const atual = doGrimorio.get(id)
    if (atual === undefined) {
      const doMestre = soDoPreludio.get(id)
      // Mesmo id de algo criado no Prelúdio: o do mestre fica.
      if (doMestre !== undefined) editadosNoPreludio.push({ id, titulo: jeito.titulo(doMestre), mudouNoGrimorioTambem: true })
      else if (foiApagado.has(id)) apagadosNoPreludio.push({ id, titulo: jeito.titulo(novo) })
      else entram.push(id)
      continue
    }
    const guardado = jeito.origem(atual)?.grimorio?.hash
    const hashNovo = jeito.origem(novo)?.grimorio?.hash ?? (await jeito.hash(novo))
    const mudouNoGrimorio = hashNovo !== guardado
    // Sem hash guardado não dá para provar que ninguém mexeu: fica, como se editado.
    const editado = guardado === undefined || (await jeito.hash(atual)) !== guardado
    if (editado) editadosNoPreludio.push({ id, titulo: jeito.titulo(atual), mudouNoGrimorioTambem: mudouNoGrimorio })
    else if (!mudouNoGrimorio) iguais.push(id)
    // Revelado: a revelação vale para o que o mestre viu, e o texto novo do Grimório chegaria ao jogador sem um clique.
    else if (protegidos.has(id)) editadosNoPreludio.push({ id, titulo: jeito.titulo(atual), mudouNoGrimorioTambem: true, revelado: true })
    else atualizar.push(id)
  }
  const sumiuLa = [...doGrimorio.values()].filter((atual) => !vistos.has(jeito.id(atual))).map((atual) => ({ id: jeito.id(atual), titulo: jeito.titulo(atual) }))
  return { novos: entram, atualizar, iguais, editadosNoPreludio, sumiuLa, apagadosNoPreludio }
}

/** Compara o que já está no Prelúdio com a importação nova, tipo por tipo. */
export async function planejarReimportacao(noPreludio: NoPreludio, novos: Importado): Promise<PlanoDeReimportacao> {
  const apagados = noPreludio.apagados ?? {}
  return {
    verbetes: await planejarTipo(noPreludio.verbetes, novos.verbetes, apagados.verbetes ?? [], DO_VERBETE, noPreludio.revelados ?? new Set()),
    quadros: await planejarTipo(noPreludio.quadros ?? [], novos.quadros, apagados.quadros ?? [], DO_QUADRO),
    ligacoes: await planejarTipo(noPreludio.ligacoes ?? [], novos.ligacoes, apagados.ligacoes ?? [], DA_LIGACAO),
    campanhas: await planejarTipo(noPreludio.campanhas ?? [], novos.campanhas, apagados.campanhas ?? [], DA_CAMPANHA),
  }
}

/** Os que o "Aplicar" grava: os novos e os trocados. */
function quemEntra(plano: ReimportacaoDoTipo): ReadonlySet<string> {
  return new Set([...plano.novos, ...plano.atualizar])
}

/** O arquivo inteiro (índice, ligações): o que está no Prelúdio, com os trocados no lugar e os novos no fim. */
function mesclar<T>(atuais: readonly T[], novos: readonly T[], plano: ReimportacaoDoTipo, id: (valor: T) => string, trocar: (atual: T, novo: T) => T): T[] {
  const novoPorId = new Map(novos.map((valor) => [id(valor), valor]))
  const atualizar = new Set(plano.atualizar)
  const saida = atuais.map((atual) => {
    const novo = atualizar.has(id(atual)) ? novoPorId.get(id(atual)) : undefined
    return novo === undefined ? atual : trocar(atual, novo)
  })
  for (const idNovo of plano.novos) {
    const novo = novoPorId.get(idNovo)
    if (novo !== undefined) saida.push(novo)
  }
  return saida
}

/** A campanha trocada guarda a pasta do Labirinto que o mestre ligou no Prelúdio (passo 8). */
function comAPastaDoMestre(atual: Campanha, nova: Campanha): Campanha {
  return atual.pastaId === undefined ? nova : { ...nova, pastaId: atual.pastaId }
}

/**
 * O plano da reimportação, pronto para o "Aplicar": verbetes e quadros só os
 * novos e os trocados (o resto fica como está no disco); o índice e as ligações
 * trazem a lista inteira, mesclada com o que é do Prelúdio (o "Aplicar" troca só
 * a lista no arquivo, e o resto dele volta igual). O chat, a Teia e a lixeira
 * são só leitura no Prelúdio: vêm do Grimório, menos o chat de um dono que o
 * mestre apagou.
 */
export function planoDaReimportacao(plano: PlanoDaImportacao, noPreludio: NoPreludio, reimportacao: PlanoDeReimportacao): PlanoDaImportacao {
  const verbetes = quemEntra(reimportacao.verbetes)
  const quadros = quemEntra(reimportacao.quadros)
  const apagados = new Set([...(noPreludio.apagados?.verbetes ?? []), ...(noPreludio.apagados?.quadros ?? [])])
  return {
    ...plano,
    modo: 'reimportacao',
    verbetes: plano.verbetes.filter((verbete) => verbetes.has(verbete.id)),
    quadros: plano.quadros.filter((quadro) => quadros.has(quadro.id)),
    indice: { ...plano.indice, campanhas: mesclar(noPreludio.campanhas ?? [], plano.indice.campanhas, reimportacao.campanhas, (c) => c.id, comAPastaDoMestre) },
    ligacoes: { ...plano.ligacoes, ligacoes: mesclar(noPreludio.ligacoes ?? [], plano.ligacoes.ligacoes, reimportacao.ligacoes, (l) => l.id, (_atual, nova) => nova) },
    chats: plano.chats.filter((chat) => !apagados.has(chat.donoId)),
  }
}
