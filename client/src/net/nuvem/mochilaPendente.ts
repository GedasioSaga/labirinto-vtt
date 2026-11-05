import { readCarriedItems } from '../../lib/items'
import { bonecoAindaTem, fichasComOPendente, pendentesDoMapaQueEntrou, type DecisaoDoPendente, type ItemPendente } from '../../lib/mochila/pendentes'
import { chaveDoMapa, idDePastaValido, lugarDoMapa, rpgDoArquivo, serializarRpg, type IndiceDasPastas, type RpgDaPasta } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import type { RecoveryCopy } from '../../lib/recoveryCopy'
import { moedasDe, readMoedas } from '../../lib/troca'
import {
  ARQUIVO_DO_RELATORIO,
  ARQUIVO_DO_RPG,
  lerCenasDoMapa,
  lerIndice,
  objetoDoTexto,
  PASTA_DAS_PASTAS,
  PASTA_DOS_MAPAS,
  type Bruto,
  type CenasLidas,
  type DiscoDaMigracao,
} from './migracaoDaMochila'

/**
 * MOCHILA NA FICHA — o MAPA QUE ENTRA numa pasta já convertida, no disco
 * (correção C2; a regra pura é `lib/mochila/pendentes.ts`).
 *
 * 1. O mapa entra ("Mover…" do Carregar Mapa, ou a importação que cai num
 *    mapa que já está numa pasta convertida): `marcarMapaQueEntrou` anota a
 *    chave dele em `mapasPorConferir`.
 * 2. `conferirMapaQueEntrou` lê TODAS as cenas do mapa (a aberta e as de
 *    fundo; o trabalho recuperado no lugar da versão do disco) e anota o que
 *    só os bonecos têm. No "Mover…" confere na hora e a marca fica; ao abrir,
 *    confere de novo (o mapa aberto durante o "Mover…" pode ter ganhado item
 *    depois) e só então a marca sai — antes de o editor ler as fichas, então
 *    o espelho nunca chega a um boneco não conferido.
 * 3. "Trazer para a ficha" (`trazerPendente`) soma na ficha e marca a linha
 *    `trazido`; "Ignorar" (`ignorarPendente`) só marca `ignorado`. Nenhuma
 *    linha sai do arquivo — menos a do pendente cuja ficha nunca chegou a
 *    entrar na pasta (`retirarPendentesSemFicha`, item 6).
 * 4. O mapa que SAI da pasta: fora do espelho o item é do boneco, e trazê-lo
 *    o deixaria nos dois lugares. No "Mover…" (`mapaSaiuDaPasta`, com o
 *    trabalho do mapa aberto) o pendente que o boneco ainda carrega vira
 *    `saiu`; por qualquer caminho, listar e "Trazer" conferem o índice e
 *    escondem/recusam esse pendente enquanto o boneco o tiver, sem gravar. O
 *    que o espelho já tirou do boneco só existe no pendente, e ele continua.
 * 5. A pasta convertida que fica sem Sistema universal e volta
 *    (`sistemaDaPastaMudou`): sem sistema a mochila volta a morar no boneco.
 *    O relatório guarda desde quando (`semSistemaDesde`) e, na volta, cada mapa
 *    da pasta salvo depois disso (ou com cópia de recuperação feita depois
 *    disso) é marcado para conferir, antes do espelho.
 * 6. A FICHA NOVA que entra numa pasta convertida ("Importar personagens…",
 *    "Copiar de um mapa"): os bonecos dela nos mapas da pasta ainda carregam a
 *    mochila, e a ficha chega sem ela. ANTES de gravar o `rpg.json`,
 *    `marcarFichasQueEntram` marca os mapas da pasta com boneco dessas fichas
 *    para conferir SÓ essas fichas (`fichasNovasPorConferir`): o resto do mapa
 *    já foi conferido, e conferir de novo o boneco velho de uma ficha antiga
 *    (salvo antes da conversão) inventaria pendente. O mapa aberto, que o
 *    espelho esvazia assim que o `rpg.json` grava, ganha os pendentes já, na
 *    mesma gravação da marca.
 * 7. O "Trazer" interrompido (`trazendo`): antes de somar, o relatório anota
 *    como a ficha está e como vai ficar — e as marcas de outros "Trazer"
 *    interrompidos da mesma ficha passam a reconhecer a soma que vai entrar.
 *    Se a gravação cair no meio, o segundo "Trazer" confere a ficha: já
 *    somada, só anota; como antes, soma; mudada depois por outro caminho, não
 *    soma e pede ao mestre para conferir. O "Ignorar" desse caso anota
 *    `incerto`, nunca "ficou fora".
 *
 * Tudo mora no relatório da pasta (`<appData>/pastas/<id>/migracao-da-mochila.json`,
 * o mesmo da migração), ao lado do que ela escreveu: `mapasPorConferir`,
 * `fichasNovasPorConferir`, `trazendo` e `itensDeMapasQueEntraram`. Um arquivo
 * só, uma gravação por mudança: o aviso pendente e a linha do relatório são a
 * MESMA linha (pendente = sem `decisao`), e sobrevivem a fechar o app.
 *
 * As gravações passam por uma fila: dois cliques seguidos em "Trazer" leem o
 * que o anterior gravou, nas fichas e no relatório.
 */

const MAPAS_POR_CONFERIR = 'mapasPorConferir'
const FICHAS_NOVAS_POR_CONFERIR = 'fichasNovasPorConferir'
const TRAZENDO = 'trazendo'
const ITENS_DOS_MAPAS_QUE_ENTRARAM = 'itensDeMapasQueEntraram'
const SEM_SISTEMA_DESDE = 'semSistemaDesde'
/** FNV-1a de 32 bits: o resumo da mochila e da bolsa de uma ficha (`impressaoDaFicha`). */
const FNV_INICIO = 0x811c9dc5
const FNV_PRIMO = 0x01000193
const SUFIXO_ANTERIOR = '.anterior'
const SUFIXO_DANIFICADO = '.danificado'
const VERSAO_DO_RELATORIO = 1

export interface OpcoesDosPendentes {
  agora?: () => number
  /** A vaga nova do item que entra na ficha, e o id do pendente. */
  novoId?: () => string
}

function isRecord(value: unknown): value is Bruto {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

let fila: Promise<unknown> = Promise.resolve()

/** Uma gravação de cada vez, na ordem dos pedidos; a que falha não trava as seguintes. */
function emFila<T>(fazer: () => Promise<T>): Promise<T> {
  const vez = fila.then(fazer)
  fila = vez.catch(() => undefined)
  return vez
}

// ───────────────────────────────────────────────────────────────────────────
// O relatório como arquivo
// ───────────────────────────────────────────────────────────────────────────

/**
 * O "Trazer" começado e ainda não anotado: como a ficha está sem a soma
 * (`antes`) e com ela (`depois`), por `impressaoDaFicha`. Listas: o "Trazer"
 * de outro pendente da MESMA ficha (as moedas do mesmo boneco) acrescenta a
 * impressão que vai deixar (`marcasComASoma`), e esta marca continua
 * reconhecendo a ficha — com ou sem a soma dela.
 */
interface MarcaDoTrazer {
  antes: string[]
  depois: string[]
  moedasDeFora: number
}

interface EstadoDosPendentes {
  /** O relatório como veio (o que a migração escreveu fica como está). */
  bruto: Bruto
  /** Mapas a conferir com TODAS as fichas da pasta (o mapa que entrou, a volta do sistema). */
  porConferir: string[]
  /** Mapas a conferir SÓ com estas fichas (a ficha nova que entrou na pasta), por chave. */
  fichasPorConferir: ReadonlyMap<string, readonly string[]>
  /** O "Trazer" começado, por id do pendente. */
  trazendo: ReadonlyMap<string, MarcaDoTrazer>
  itens: ItemPendente[]
  /** Linhas que este app não entende: voltam ao arquivo como vieram. */
  tortas: unknown[]
  /** A pasta convertida está sem Sistema universal desde então (ms); `null` = tem sistema. */
  semSistemaDesde: number | null
  /** O texto do relatório danificado, para a cópia ao lado antes da primeira gravação; `null` = leu limpo. */
  danificado: string | null
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null
}

function horaDoArquivo(valor: unknown): number | null {
  if (typeof valor !== 'string') return null
  const ms = Date.parse(valor)
  return Number.isFinite(ms) ? ms : null
}

function decisaoDoArquivo(valor: unknown): DecisaoDoPendente | undefined {
  return valor === 'trazido' || valor === 'ignorado' || valor === 'incerto' || valor === 'saiu' ? valor : undefined
}

/** Uma linha do relatório; torta = `null` (fica no arquivo como veio, ver `tortas`). */
function pendenteDoArquivo(valor: unknown): ItemPendente | null {
  if (!isRecord(valor)) return null
  const id = textoOuNulo(valor.id)
  const chave = textoOuNulo(valor.chave)
  const personagemId = textoOuNulo(valor.fichaId)
  if (id === null || chave === null || personagemId === null) return null
  const decisao = decisaoDoArquivo(valor.decisao)
  const decididoEm = horaDoArquivo(valor.decididoEm)
  const comum = {
    id,
    chave,
    mapa: textoOuNulo(valor.mapa) ?? '',
    cena: textoOuNulo(valor.cena) ?? '',
    personagemId,
    personagem: textoOuNulo(valor.ficha) ?? '',
    boneco: textoOuNulo(valor.boneco) ?? '',
    entrouEm: horaDoArquivo(valor.entrouEm) ?? 0,
    ...(decisao === undefined ? {} : { decisao }),
    ...(decididoEm === null ? {} : { decididoEm }),
  }
  if (valor.tipo === 'item') {
    const item = readCarriedItems([valor.item])?.[0]
    return item === undefined ? null : { ...comum, tipo: 'item', item }
  }
  if (valor.tipo === 'moedas') {
    const moedas = readMoedas(valor.moedas)
    return moedas === undefined || moedas <= 0 ? null : { ...comum, tipo: 'moedas', moedas }
  }
  return null
}

function hora(ms: number): string {
  return new Date(ms).toISOString()
}

/** A linha como o mestre lê no relatório: a ficha pelo nome e pelo id, as horas por extenso. */
function pendenteParaOArquivo(pendente: ItemPendente): Bruto {
  const conteudo = pendente.tipo === 'item' ? { tipo: pendente.tipo, item: pendente.item } : { tipo: pendente.tipo, moedas: pendente.moedas }
  return {
    id: pendente.id,
    chave: pendente.chave,
    mapa: pendente.mapa,
    cena: pendente.cena,
    ficha: pendente.personagem,
    fichaId: pendente.personagemId,
    boneco: pendente.boneco,
    ...conteudo,
    entrouEm: hora(pendente.entrouEm),
    ...(pendente.decisao === undefined ? {} : { decisao: pendente.decisao }),
    ...(pendente.decididoEm === undefined ? {} : { decididoEm: hora(pendente.decididoEm) }),
  }
}

function relatorioNovo(): Bruto {
  return { versao: VERSAO_DO_RELATORIO }
}

/** `fichasNovasPorConferir`: chave do mapa → ids das fichas; o que não é lista de texto fica de fora. */
function fichasPorConferirDoArquivo(valor: unknown): Map<string, string[]> {
  const marcas = new Map<string, string[]>()
  if (!isRecord(valor)) return marcas
  for (const [chave, ids] of Object.entries(valor)) {
    const validos = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
    if (validos.length > 0) marcas.set(chave, validos)
  }
  return marcas
}

/** As impressões de uma marca: a lista, ou o texto só que a versão anterior gravava. O que não é texto fica de fora. */
function impressoesDoArquivo(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor]
  return Array.isArray(valor) ? valor.filter((impressao): impressao is string => typeof impressao === 'string') : []
}

/** `trazendo`: id do pendente → a marca; a torta fica de fora (o "Trazer" seguinte soma como se fosse o primeiro). */
function trazendoDoArquivo(valor: unknown): Map<string, MarcaDoTrazer> {
  const marcas = new Map<string, MarcaDoTrazer>()
  if (!isRecord(valor)) return marcas
  for (const [id, marca] of Object.entries(valor)) {
    if (!isRecord(marca)) continue
    const antes = impressoesDoArquivo(marca.antes)
    const depois = impressoesDoArquivo(marca.depois)
    if (antes.length === 0 || depois.length === 0) continue
    const { moedasDeFora } = marca
    marcas.set(id, { antes, depois, moedasDeFora: typeof moedasDeFora === 'number' && Number.isSafeInteger(moedasDeFora) && moedasDeFora > 0 ? moedasDeFora : 0 })
  }
  return marcas
}

async function lerEstado(disco: DiscoDaMigracao, relatorio: string): Promise<EstadoDosPendentes> {
  const texto = await disco.ler(relatorio)
  const bruto = texto === null ? relatorioNovo() : objetoDoTexto(texto)
  if (bruto === null) {
    return { bruto: relatorioNovo(), porConferir: [], fichasPorConferir: new Map(), trazendo: new Map(), itens: [], tortas: [], danificado: texto, semSistemaDesde: null }
  }
  const marcas = Array.isArray(bruto[MAPAS_POR_CONFERIR]) ? bruto[MAPAS_POR_CONFERIR] : []
  const porConferir = marcas.filter((chave): chave is string => typeof chave === 'string')
  const itens: ItemPendente[] = []
  const tortas: unknown[] = []
  for (const linha of Array.isArray(bruto[ITENS_DOS_MAPAS_QUE_ENTRARAM]) ? bruto[ITENS_DOS_MAPAS_QUE_ENTRARAM] : []) {
    const lida = pendenteDoArquivo(linha)
    if (lida === null) tortas.push(linha)
    else itens.push(lida)
  }
  return {
    bruto,
    porConferir,
    fichasPorConferir: fichasPorConferirDoArquivo(bruto[FICHAS_NOVAS_POR_CONFERIR]),
    trazendo: trazendoDoArquivo(bruto[TRAZENDO]),
    itens,
    tortas,
    danificado: null,
    semSistemaDesde: horaDoArquivo(bruto[SEM_SISTEMA_DESDE]),
  }
}

/** Grava o estado no relatório. O relatório danificado ganha antes uma cópia ao lado, nunca apagada. */
async function gravarEstado(disco: DiscoDaMigracao, relatorio: string, estado: EstadoDosPendentes, agoraMs: number): Promise<void> {
  if (estado.danificado !== null) await disco.gravar(`${relatorio}${SUFIXO_DANIFICADO}-${agoraMs}`, estado.danificado)
  // O que este arquivo controla sai do que veio e volta só quando tem conteúdo: a marca resolvida não fica para trás.
  const { [SEM_SISTEMA_DESDE]: _desdeAntes, [FICHAS_NOVAS_POR_CONFERIR]: _fichasAntes, [TRAZENDO]: _trazendoAntes, ...semOQueMuda } = estado.bruto
  const bruto = {
    ...semOQueMuda,
    ...(estado.semSistemaDesde === null ? {} : { [SEM_SISTEMA_DESDE]: hora(estado.semSistemaDesde) }),
    [MAPAS_POR_CONFERIR]: estado.porConferir,
    ...(estado.fichasPorConferir.size === 0 ? {} : { [FICHAS_NOVAS_POR_CONFERIR]: Object.fromEntries(estado.fichasPorConferir) }),
    ...(estado.trazendo.size === 0 ? {} : { [TRAZENDO]: Object.fromEntries(estado.trazendo) }),
    [ITENS_DOS_MAPAS_QUE_ENTRARAM]: [...estado.itens.map(pendenteParaOArquivo), ...estado.tortas],
  }
  await disco.gravar(relatorio, JSON.stringify(bruto, null, 2))
}

/** Os mapas com alguma marca de conferir (todas as fichas ou só as novas), sem repetir. */
function chavesMarcadas(estado: EstadoDosPendentes): string[] {
  return [...estado.porConferir, ...[...estado.fichasPorConferir.keys()].filter((chave) => !estado.porConferir.includes(chave))]
}

function temMarca(estado: EstadoDosPendentes, chave: string): boolean {
  return estado.porConferir.includes(chave) || estado.fichasPorConferir.has(chave)
}

/** O estado sem as marcas de conferir do mapa `chave`. */
function semAMarca(estado: EstadoDosPendentes, chave: string): EstadoDosPendentes {
  const fichasPorConferir = new Map(estado.fichasPorConferir)
  fichasPorConferir.delete(chave)
  return { ...estado, porConferir: estado.porConferir.filter((marcada) => marcada !== chave), fichasPorConferir }
}

/** O texto com as chaves de todo objeto em ordem: o mesmo conteúdo dá o mesmo texto, venha o objeto de onde vier. */
function textoCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(textoCanonico).join(',')}]`
  if (isRecord(valor)) {
    const chaves = Object.keys(valor)
      .filter((chave) => valor[chave] !== undefined)
      .sort()
    return `{${chaves.map((chave) => `${JSON.stringify(chave)}:${textoCanonico(valor[chave])}`).join(',')}}`
  }
  return JSON.stringify(valor) ?? 'null'
}

function resumo(texto: string): string {
  let hash = FNV_INICIO
  for (let i = 0; i < texto.length; i++) hash = Math.imul(hash ^ texto.charCodeAt(i), FNV_PRIMO) >>> 0
  return `${texto.length}-${hash.toString(16)}`
}

/**
 * A mochila e a bolsa da ficha como o `rpg.json` as devolve (gravada e lida
 * de novo, para a ficha prevista e a lida do disco darem o mesmo texto), num
 * resumo curto: o "Trazer" interrompido confere por ela se a soma já entrou.
 */
function impressaoDaFicha(ficha: Personagem): string {
  const lida = rpgDoArquivo(objetoDoTexto(serializarRpg({ personagens: [ficha] }))).personagens.find((personagem) => personagem.id === ficha.id) ?? ficha
  return resumo(textoCanonico({ mochila: lida.mochila ?? [], moedas: moedasDe(lida) }))
}

// ───────────────────────────────────────────────────────────────────────────
// A pasta do mapa
// ───────────────────────────────────────────────────────────────────────────

/** A pasta (já convertida) do mapa que entrou. */
interface PastaConvertida {
  pastaId: string
  relatorio: string
  pastaDosMapas: string
  rpg: RpgDaPasta
  /** "Configurar só neste mapa": o mapa usa as próprias fichas, e o espelho da pasta não toca os bonecos dele. */
  proprio: boolean
}

/** O `rpg.json` como o app o lê (`lerRpgDaPasta`): o arquivo, senão a cópia `.anterior`; `null` = nenhum dos dois abre. */
async function lerRpg(disco: DiscoDaMigracao, dir: string): Promise<RpgDaPasta | null> {
  const caminho = await disco.juntar(dir, ARQUIVO_DO_RPG)
  const texto = await disco.ler(caminho)
  if (texto === null) return null
  const bruto = objetoDoTexto(texto) ?? objetoDoTexto((await disco.ler(`${caminho}${SUFIXO_ANTERIOR}`)) ?? '')
  return bruto === null ? null : rpgDoArquivo(bruto)
}

/** A pasta do mapa `chave` quando ela já mora na ficha (marcador `mochilaMigrada`); `null` = fora das pastas, pasta ainda não convertida ou ilegível. */
async function pastaConvertidaDoMapa(disco: DiscoDaMigracao, chave: string): Promise<PastaConvertida | null> {
  const pastaDoApp = await disco.pastaDoApp()
  const pastaDasPastas = await disco.juntar(pastaDoApp, PASTA_DAS_PASTAS)
  const indice = await lerIndice(disco, pastaDasPastas)
  if (indice === null) return null
  const lugar = lugarDoMapa(indice, chave)
  if (lugar === null || !idDePastaValido(lugar.pasta.id)) return null
  const dir = await disco.juntar(pastaDasPastas, lugar.pasta.id)
  const rpg = await lerRpg(disco, dir)
  // Pasta ainda não convertida: a migração da próxima abertura junta este mapa com os outros, sem pendente.
  if (rpg === null || rpg.mochilaMigrada === undefined) return null
  return {
    pastaId: lugar.pasta.id,
    relatorio: await disco.juntar(dir, ARQUIVO_DO_RELATORIO),
    pastaDosMapas: await disco.juntar(pastaDoApp, PASTA_DOS_MAPAS),
    rpg,
    proprio: lugar.proprio,
  }
}

async function relatorioDaPasta(disco: DiscoDaMigracao, pastaId: string): Promise<string> {
  if (!idDePastaValido(pastaId)) throw new Error(`O id "${pastaId}" não serve de nome de pasta.`)
  return disco.juntar(await disco.pastaDoApp(), PASTA_DAS_PASTAS, pastaId, ARQUIVO_DO_RELATORIO)
}

/** A pasta pelo id, com o que a saída e a troca de sistema leem. */
interface PastaPeloId {
  pastaId: string
  relatorio: string
  pastaDosMapas: string
  /** `null` = o `rpg.json` não abre. */
  rpg: RpgDaPasta | null
  /** `null` = o índice não abre. */
  indice: IndiceDasPastas | null
}

async function pastaPeloId(disco: DiscoDaMigracao, pastaId: string): Promise<PastaPeloId> {
  const relatorio = await relatorioDaPasta(disco, pastaId)
  const pastaDoApp = await disco.pastaDoApp()
  const pastaDasPastas = await disco.juntar(pastaDoApp, PASTA_DAS_PASTAS)
  return {
    pastaId,
    relatorio,
    pastaDosMapas: await disco.juntar(pastaDoApp, PASTA_DOS_MAPAS),
    rpg: await lerRpg(disco, await disco.juntar(pastaDasPastas, pastaId)),
    indice: await lerIndice(disco, pastaDasPastas),
  }
}

/** Os mapas com pendente esperando (ou marca de conferir) que o índice já não põe nesta pasta; índice ilegível = nenhum (não dá para saber). */
function chavesQueSairam(pasta: PastaPeloId, estado: EstadoDosPendentes): Set<string> {
  const { indice } = pasta
  if (indice === null) return new Set()
  const chaves = [...estado.itens.filter((pendente) => pendente.decisao === undefined).map((pendente) => pendente.chave), ...chavesMarcadas(estado)]
  return new Set(chaves.filter((chave) => lugarDoMapa(indice, chave)?.pasta.id !== pasta.pastaId))
}

/** As cenas do mapa `chave` (o trabalho recuperado, se for dele, no lugar das do disco). */
async function cenasDoMapa(disco: DiscoDaMigracao, pastaDosMapas: string, chave: string, recuperado: RecoveryCopy | null): Promise<CenasLidas> {
  const lidas: CenasLidas = { cenas: [], naoAbriram: [] }
  await lerCenasDoMapa(disco, await disco.juntar(pastaDosMapas, chave), recuperado, lidas)
  return lidas
}

/**
 * Os pendentes esperando dos mapas `chaves` (que saíram da pasta) que o
 * boneco AINDA carrega (`bonecoAindaTem`, contra as fichas de agora). O que só
 * o pendente guarda — o espelho já tirou do boneco, ou o mapa sumiu — fica de
 * fora. Fichas da pasta ilegíveis: nenhum (não dá para saber).
 */
async function osQueOBonecoAindaTem(
  disco: DiscoDaMigracao,
  pasta: PastaPeloId,
  estado: EstadoDosPendentes,
  chaves: ReadonlySet<string>,
  agoraMs: number,
  recuperado: RecoveryCopy | null,
): Promise<Set<string>> {
  const ainda = new Set<string>()
  if (pasta.rpg === null) return ainda
  for (const chave of chaves) {
    const esperando = estado.itens.filter((pendente) => pendente.chave === chave && pendente.decisao === undefined)
    if (esperando.length === 0) continue
    const lidas = await cenasDoMapa(disco, pasta.pastaDosMapas, chave, recuperado)
    const conferidos = pendentesDoMapaQueEntrou(pasta.rpg.personagens, chave, lidas.cenas, [], agoraMs, () => chave)
    for (const pendente of esperando) if (bonecoAindaTem(pendente, conferidos)) ainda.add(pendente.id)
  }
  return ainda
}

/** A chave do mapa em `caminho` (`<appData>/maps/<chave>/...`); `null` = mapa de fora da pasta dos mapas. */
export async function chaveDoCaminho(caminho: string, disco: DiscoDaMigracao): Promise<string | null> {
  return chaveDoMapa(caminho, await disco.juntar(await disco.pastaDoApp(), PASTA_DOS_MAPAS))
}

// ───────────────────────────────────────────────────────────────────────────
// O que o app chama
// ───────────────────────────────────────────────────────────────────────────

/**
 * O mapa `chave` acabou de entrar na pasta dele (já gravada no índice).
 * Pasta já convertida: anota o mapa para conferir e devolve o id dela. `null`
 * = nada a anotar (fora das pastas, pasta ainda não convertida). A pasta sem
 * sistema universal também anota: se o sistema voltar, o mapa ainda é conferido.
 */
export function marcarMapaQueEntrou(chave: string, disco: DiscoDaMigracao, opcoes: OpcoesDosPendentes = {}): Promise<string | null> {
  return emFila(async () => {
    const pasta = await pastaConvertidaDoMapa(disco, chave)
    if (pasta === null) return null
    const estado = await lerEstado(disco, pasta.relatorio)
    if (!estado.porConferir.includes(chave)) {
      await gravarEstado(disco, pasta.relatorio, { ...estado, porConferir: [...estado.porConferir, chave] }, (opcoes.agora ?? Date.now)())
    }
    return pasta.pastaId
  })
}

export interface MapaConferido {
  pastaId: string
  /** Os pendentes anotados agora (os de antes continuam no relatório). */
  novos: ItemPendente[]
}

export interface OpcoesDaConferencia extends OpcoesDosPendentes {
  /** O trabalho recuperado (`handleRecover`): as cenas dele entram no lugar das do disco. */
  recuperado?: RecoveryCopy | null
  /** A abertura: tira o mapa de `mapasPorConferir` depois de conferir. O "Mover…" deixa a marca para a abertura conferir de novo. */
  baixarMarca: boolean
}

/**
 * Confere o mapa `chave` anotado por `marcarMapaQueEntrou` (todas as fichas)
 * ou por `marcarFichasQueEntram` (só as fichas novas): o que só os bonecos
 * dele têm vira pendente no relatório. `null` = o mapa não usa uma pasta
 * convertida com sistema universal (o espelho da pasta não toca os bonecos
 * dele; a marca, se houver, espera). Mapa sem marca: nada novo, só o id da
 * pasta (quem chama mostra os pendentes dela). Cena que não abriu deixa a
 * marca: a abertura seguinte tenta de novo.
 */
export function conferirMapaQueEntrou(chave: string, disco: DiscoDaMigracao, opcoes: OpcoesDaConferencia): Promise<MapaConferido | null> {
  return emFila(async () => {
    const pasta = await pastaConvertidaDoMapa(disco, chave)
    if (pasta === null || pasta.proprio || pasta.rpg.sistemaDeRpg === undefined) return null
    const estado = await lerEstado(disco, pasta.relatorio)
    if (!temMarca(estado, chave)) return { pastaId: pasta.pastaId, novos: [] }
    const soAsNovas = estado.porConferir.includes(chave) ? undefined : estado.fichasPorConferir.get(chave)
    const personagens = soAsNovas === undefined ? pasta.rpg.personagens : pasta.rpg.personagens.filter((personagem) => soAsNovas.includes(personagem.id))
    const agoraMs = (opcoes.agora ?? Date.now)()
    const lidas: CenasLidas = { cenas: [], naoAbriram: [] }
    await lerCenasDoMapa(disco, await disco.juntar(pasta.pastaDosMapas, chave), opcoes.recuperado ?? null, lidas)
    const novos = pendentesDoMapaQueEntrou(personagens, chave, lidas.cenas, estado.itens, agoraMs, opcoes.novoId ?? (() => crypto.randomUUID()))
    const baixar = opcoes.baixarMarca && lidas.naoAbriram.length === 0
    if (novos.length > 0 || baixar) {
      const marcas = baixar ? semAMarca(estado, chave) : estado
      await gravarEstado(disco, pasta.relatorio, { ...marcas, itens: [...estado.itens, ...novos] }, agoraMs)
    }
    return { pastaId: pasta.pastaId, novos }
  })
}

export interface OpcoesDasFichasQueEntram extends OpcoesDosPendentes {
  /** O trabalho do mapa aberto no editor: a ficha nova espelha na hora as cenas abertas da pasta, e o disco ainda não sabe o que os bonecos delas têm. */
  recuperado?: RecoveryCopy | null
  /**
   * A chave do mapa aberto no editor (o trabalho dele é `recuperado`).
   * Gravado o `rpg.json`, o espelho tira NA HORA a mochila dos bonecos dele, e
   * só a memória sabe o que carregavam: o pendente dele é anotado já.
   */
  aberto?: string | null
}

export interface FichasQueEntram {
  /** Os mapas marcados para conferir só as fichas novas; gravado o `rpg.json`, quem chama confere cada um. */
  marcados: string[]
  /** Os pendentes do mapa aberto, já no relatório. */
  novos: ItemPendente[]
}

/**
 * "Importar personagens…" e "Copiar de um mapa" vão pôr `fichas` na pasta
 * `pastaId` — chamar ANTES de gravar o `rpg.json`. Pasta convertida: o mapa
 * da pasta com boneco de uma dessas fichas (que ela ainda não tem) fica
 * marcado para conferir só essas fichas — a ficha chega sem a mochila, e o
 * espelho da abertura faria a ficha vencer o boneco. Mapa com cena que não
 * abre também (não dá para saber). O mapa ABERTO (`aberto`), que o espelho
 * esvazia assim que o `rpg.json` grava, ganha os pendentes na mesma gravação
 * da marca: se a conferência de depois cair e o mestre salvar, o pendente já
 * está no relatório. Quem chama, gravado o `rpg.json`, confere cada mapa
 * marcado (`conferirMapaQueEntrou`); não gravado, tira os pendentes da ficha
 * que não entrou (`retirarPendentesSemFicha`). Pasta ainda não convertida:
 * nada (a migração da abertura junta os bonecos).
 */
export function marcarFichasQueEntram(pastaId: string, fichas: readonly Personagem[], disco: DiscoDaMigracao, opcoes: OpcoesDasFichasQueEntram = {}): Promise<FichasQueEntram> {
  return emFila(async () => {
    const nada: FichasQueEntram = { marcados: [], novos: [] }
    const pasta = await pastaPeloId(disco, pastaId)
    const { rpg, indice } = pasta
    if (rpg === null || rpg.mochilaMigrada === undefined) return nada
    const novas = fichas.filter((ficha) => !rpg.personagens.some((personagem) => personagem.id === ficha.id))
    if (novas.length === 0) return nada
    if (indice === null) throw new Error('o índice das pastas não abriu')
    const ids = new Set(novas.map((ficha) => ficha.id))
    const aberto = opcoes.aberto ?? null
    const marcados: string[] = []
    let cenasDoAberto: CenasLidas['cenas'] = []
    for (const { chave } of indice.mapas) {
      const lugar = lugarDoMapa(indice, chave)
      if (lugar === null || lugar.pasta.id !== pastaId) continue
      const lidas = await cenasDoMapa(disco, pasta.pastaDosMapas, chave, opcoes.recuperado ?? null)
      const temBonecoDelas = lidas.cenas.some(({ bonecos }) => bonecos.some(({ characterId }) => characterId !== null && ids.has(characterId)))
      if (temBonecoDelas || lidas.naoAbriram.length > 0) marcados.push(chave)
      // O espelho só toca o mapa que herda a pasta com Sistema universal (como em `conferirMapaQueEntrou`).
      if (chave === aberto && temBonecoDelas && !lugar.proprio && rpg.sistemaDeRpg !== undefined) cenasDoAberto = lidas.cenas
    }
    if (marcados.length === 0) return nada
    const agoraMs = (opcoes.agora ?? Date.now)()
    const estado = await lerEstado(disco, pasta.relatorio)
    const novos = aberto === null ? [] : pendentesDoMapaQueEntrou(novas, aberto, cenasDoAberto, estado.itens, agoraMs, opcoes.novoId ?? (() => crypto.randomUUID()))
    const fichasPorConferir = new Map(estado.fichasPorConferir)
    for (const chave of marcados) fichasPorConferir.set(chave, [...new Set([...(fichasPorConferir.get(chave) ?? []), ...ids])])
    await gravarEstado(disco, pasta.relatorio, { ...estado, fichasPorConferir, itens: [...estado.itens, ...novos] }, agoraMs)
    return { marcados, novos }
  })
}

/**
 * O `rpg.json` do "Importar personagens…"/"Copiar de um mapa" não gravou:
 * tira os pendentes `ids` (de `marcarFichasQueEntram`) ainda sem decisão cuja
 * ficha não está na pasta — sem ela, o espelho não tocou os bonecos, o item
 * segue com eles, e o aviso seria falso. A única linha que sai do relatório:
 * nunca valeu. A ficha que entrou mesmo assim (a gravação caiu depois do
 * disco) segura os dela. `rpg.json` ilegível: nada sai (não dá para saber).
 */
export function retirarPendentesSemFicha(pastaId: string, ids: readonly string[], disco: DiscoDaMigracao, opcoes: OpcoesDosPendentes = {}): Promise<void> {
  return emFila(async () => {
    if (ids.length === 0) return
    const pasta = await pastaPeloId(disco, pastaId)
    const { rpg } = pasta
    if (rpg === null) return
    const estado = await lerEstado(disco, pasta.relatorio)
    const semFicha = (pendente: ItemPendente): boolean =>
      ids.includes(pendente.id) && pendente.decisao === undefined && !rpg.personagens.some((personagem) => personagem.id === pendente.personagemId)
    const itens = estado.itens.filter((pendente) => !semFicha(pendente))
    if (itens.length === estado.itens.length) return
    await gravarEstado(disco, pasta.relatorio, { ...estado, itens }, (opcoes.agora ?? Date.now)())
  })
}

/**
 * Os pendentes da pasta que esperam o mestre (sem decisão), na ordem em que
 * entraram — menos os de mapa que saiu da pasta (por qualquer caminho) com o
 * item ainda no boneco: lá ele é do boneco, e trazê-lo o deixaria nos dois
 * lugares. Só esconde, não grava: o mapa que volta, ou cujo boneco o espelho
 * esvaziou antes de sair (salvo depois), mostra o pendente de novo.
 */
export function pendentesDaPasta(pastaId: string, disco: DiscoDaMigracao, opcoes: OpcoesDosPendentes = {}): Promise<ItemPendente[]> {
  return emFila(async () => {
    const pasta = await pastaPeloId(disco, pastaId)
    const estado = await lerEstado(disco, pasta.relatorio)
    const comOBoneco = await osQueOBonecoAindaTem(disco, pasta, estado, chavesQueSairam(pasta, estado), (opcoes.agora ?? Date.now)(), null)
    return estado.itens.filter((pendente) => pendente.decisao === undefined && !comOBoneco.has(pendente.id))
  })
}

export interface OpcoesDaSaida extends OpcoesDosPendentes {
  /** O trabalho do mapa aberto no editor, quando é ele que sai: o espelho já tirou dele o que só o pendente guarda, e o disco ainda não sabe. */
  recuperado?: RecoveryCopy | null
}

/**
 * O "Mover…" tirou o mapa `chave` da pasta `pastaId` (já gravado no índice),
 * antes de ele entrar noutra pasta: o pendente que o boneco ainda carrega vira
 * `saiu` (fica no relatório; se o mapa voltar, é conferido como novo), o que só
 * o pendente guarda continua esperando, e a marca de conferir do mapa sai.
 * Pasta não convertida, ou o mapa ainda nela: nada.
 */
export function mapaSaiuDaPasta(chave: string, pastaId: string, disco: DiscoDaMigracao, opcoes: OpcoesDaSaida = {}): Promise<void> {
  return emFila(async () => {
    const pasta = await pastaPeloId(disco, pastaId)
    if (pasta.rpg === null || pasta.rpg.mochilaMigrada === undefined) return
    const estado = await lerEstado(disco, pasta.relatorio)
    if (!chavesQueSairam(pasta, estado).has(chave)) return
    const agoraMs = (opcoes.agora ?? Date.now)()
    const saem = await osQueOBonecoAindaTem(disco, pasta, estado, new Set([chave]), agoraMs, opcoes.recuperado ?? null)
    if (saem.size === 0 && !temMarca(estado, chave)) return
    const itens = estado.itens.map((pendente): ItemPendente => (saem.has(pendente.id) ? { ...pendente, decisao: 'saiu', decididoEm: agoraMs } : pendente))
    await gravarEstado(disco, pasta.relatorio, { ...semAMarca(estado, chave), itens }, agoraMs)
  })
}

export interface OpcoesDaTrocaDeSistema extends OpcoesDosPendentes {
  /** A chave do mapa aberto no editor, quando é desta pasta: o trabalho dele, ainda não salvo, conta como salvo agora. */
  aberto?: string | null
  /**
   * A cópia de recuperação no disco (o app caiu com trabalho sem salvar): as
   * cenas do mapa dela contam com a hora da cópia. Jogado sem sistema e não
   * salvo, o trabalho só existe nela — e o "Recuperar" confere o mapa com ela.
   */
  recuperacao?: RecoveryCopy | null
}

/** Alguma cena do mapa foi salva (ou entrou na cópia de recuperação) desde `desde` (ms), ou não dá para saber (hora ausente, cena que não abriu). */
async function salvoDesde(disco: DiscoDaMigracao, pastaDosMapas: string, chave: string, desde: number, recuperacao: RecoveryCopy | null): Promise<boolean> {
  const lidas = await cenasDoMapa(disco, pastaDosMapas, chave, recuperacao)
  return lidas.naoAbriram.length > 0 || lidas.cenas.some(({ origem }) => origem.gravadaEm <= 0 || origem.gravadaEm >= desde)
}

/**
 * O "Configurar pasta" mudou o Sistema universal da pasta `pastaId` (o
 * `rpg.json` já gravado). Só vale para a pasta convertida (`mochilaMigrada`):
 *
 * - ficou sem sistema ("Nenhum"): a mochila volta a morar no boneco; o
 *   relatório guarda desde quando (`semSistemaDesde`, a primeira vez);
 * - voltou a ter sistema (`vinhaSemSistema`, ou o relatório diz desde quando):
 *   cada mapa da pasta salvo depois disso — sem a hora anotada, todos — e o
 *   mapa aberto dela (`aberto`) ficam marcados para conferir, e a hora sai.
 *
 * Devolve as chaves dos mapas da pasta marcados para conferir (as de agora e
 * as que já esperavam): quem chama confere cada uma (`conferirMapaQueEntrou`)
 * antes de o mestre abrir um mapa e o espelho fazer a ficha vencer o boneco.
 */
export function sistemaDaPastaMudou(pastaId: string, vinhaSemSistema: boolean, disco: DiscoDaMigracao, opcoes: OpcoesDaTrocaDeSistema = {}): Promise<string[]> {
  return emFila(async () => {
    const pasta = await pastaPeloId(disco, pastaId)
    if (pasta.rpg === null || pasta.rpg.mochilaMigrada === undefined) return []
    const estado = await lerEstado(disco, pasta.relatorio)
    const agoraMs = (opcoes.agora ?? Date.now)()
    if (pasta.rpg.sistemaDeRpg === undefined) {
      if (estado.semSistemaDesde === null) await gravarEstado(disco, pasta.relatorio, { ...estado, semSistemaDesde: agoraMs }, agoraMs)
      return []
    }
    if (!vinhaSemSistema && estado.semSistemaDesde === null) return []
    const { indice } = pasta
    if (indice === null) throw new Error('o índice das pastas não abriu')
    const daPasta = indice.mapas.map(({ chave }) => chave).filter((chave) => lugarDoMapa(indice, chave)?.pasta.id === pastaId)
    const marcar: string[] = []
    for (const chave of daPasta) {
      const desde = estado.semSistemaDesde
      if (chave === opcoes.aberto || desde === null || (await salvoDesde(disco, pasta.pastaDosMapas, chave, desde, opcoes.recuperacao ?? null))) marcar.push(chave)
    }
    const depois: EstadoDosPendentes = { ...estado, porConferir: [...estado.porConferir, ...marcar.filter((chave) => !estado.porConferir.includes(chave))], semSistemaDesde: null }
    await gravarEstado(disco, pasta.relatorio, depois, agoraMs)
    return chavesMarcadas(depois).filter((chave) => daPasta.includes(chave))
  })
}

export type DecisaoTomada =
  | {
      ok: true
      /**
       * O que ficou anotado. O "Ignorar" de um "Trazer" interrompido: com a
       * soma na ficha, `trazido` (a ficha tem o item); com a ficha mudada
       * depois, `incerto` (não dá para dizer que o item ficou fora).
       */
      decisao: Exclude<DecisaoDoPendente, 'saiu'>
      pendente: ItemPendente
      moedasDeFora: number
      /** A ficha recebeu a soma, mas o relatório não gravou (a razão): o pendente continua, e o próximo "Trazer" só anota. */
      naoAnotado?: string
    }
  | {
      ok: false
      /** `nao-achado`/`ja-decidido`: outro clique já resolveu; `sem-ficha`: a ficha saiu da pasta e o pendente continua esperando. */
      porque: 'nao-achado' | 'ja-decidido' | 'sem-ficha'
    }
  /** O mapa saiu da pasta com o item ainda no boneco: a ficha não mudou, e o pendente sai do aviso enquanto o boneco o tiver. */
  | { ok: false; porque: 'saiu'; pendente: ItemPendente }
  /** Um "Trazer" de antes caiu no meio e a ficha mudou depois: não dá para saber se a soma entrou, e nada foi somado. */
  | { ok: false; porque: 'incerto'; pendente: ItemPendente }

/** O pendente `id` ainda esperando, ou por que não. */
function pendenteEsperando(estado: EstadoDosPendentes, id: string): ItemPendente | Extract<DecisaoTomada, { ok: false }> {
  const pendente = estado.itens.find((candidato) => candidato.id === id)
  if (pendente === undefined) return { ok: false, porque: 'nao-achado' }
  if (pendente.decisao === 'saiu') return { ok: false, porque: 'saiu', pendente }
  return pendente.decisao === undefined ? pendente : { ok: false, porque: 'ja-decidido' }
}

function comDecisao(estado: EstadoDosPendentes, id: string, decisao: DecisaoDoPendente, agoraMs: number): EstadoDosPendentes {
  return { ...estado, itens: estado.itens.map((pendente) => (pendente.id === id ? { ...pendente, decisao, decididoEm: agoraMs } : pendente)) }
}

/** Quem grava as fichas da pasta: no app, `editarRpgDaPasta` (o disco e a cópia aberta no editor). */
export type GravarFichasDaPasta = (mudar: (rpg: RpgDaPasta) => RpgDaPasta) => Promise<unknown>

/** Anota a decisão e tira a marca do "Trazer" começado: decidido, ela não serve mais. */
function comDecisaoFinal(estado: EstadoDosPendentes, id: string, decisao: DecisaoDoPendente, agoraMs: number): EstadoDosPendentes {
  const trazendo = new Map(estado.trazendo)
  trazendo.delete(id)
  return { ...comDecisao(estado, id, decisao, agoraMs), trazendo }
}

/** A soma já está na ficha: anota `trazido`. O relatório que não grava não desfaz a soma — vira `naoAnotado`, e a marca do "Trazer" fica para o próximo só anotar. */
async function anotarTrazido(disco: DiscoDaMigracao, relatorio: string, estado: EstadoDosPendentes, pendente: ItemPendente, moedasDeFora: number, agoraMs: number): Promise<DecisaoTomada> {
  const feito: Extract<DecisaoTomada, { ok: true }> = { ok: true, decisao: 'trazido', pendente, moedasDeFora }
  try {
    await gravarEstado(disco, relatorio, comDecisaoFinal(estado, pendente.id, 'trazido', agoraMs), agoraMs)
    return feito
  } catch (erro) {
    return { ...feito, naoAnotado: erro instanceof Error ? erro.message : String(erro) }
  }
}

/** A ficha do pendente na pasta, como está no disco; `null` = saiu da lista. Fichas ilegíveis: lança (gravar por cima seria pior). */
function fichaDoPendente(pasta: PastaPeloId, pendente: ItemPendente): Personagem | null {
  if (pasta.rpg === null) throw new Error('as fichas da pasta não abriram')
  return pasta.rpg.personagens.find((personagem) => personagem.id === pendente.personagemId) ?? null
}

/**
 * As marcas do relatório com a soma de `pendente` a caminho: a dele (a ficha
 * passa de `de` para `para`) e as dos OUTROS "Trazer" interrompidos da mesma
 * ficha, que passam a reconhecer `para` onde reconheciam `de`. Gravadas
 * ANTES de a ficha mudar: se a gravação da ficha cair, `de` continua valendo
 * para todas. A ficha só cresce com cada soma, então `para` nunca cai na
 * lista errada.
 */
function marcasComASoma(estado: EstadoDosPendentes, pendente: ItemPendente, de: string, para: string, moedasDeFora: number): Map<string, MarcaDoTrazer> {
  const daMesmaFicha = new Set(estado.itens.filter((outro) => outro.personagemId === pendente.personagemId).map((outro) => outro.id))
  const comPara = (impressoes: readonly string[]): string[] => (impressoes.includes(de) && !impressoes.includes(para) ? [...impressoes, para] : [...impressoes])
  const marcas = new Map<string, MarcaDoTrazer>()
  for (const [outroId, marca] of estado.trazendo) {
    marcas.set(outroId, outroId !== pendente.id && daMesmaFicha.has(outroId) ? { ...marca, antes: comPara(marca.antes), depois: comPara(marca.depois) } : marca)
  }
  marcas.set(pendente.id, { antes: [de], depois: [para], moedasDeFora })
  return marcas
}

/**
 * O "Ignorar" de um "Trazer" interrompido: a ficha com a soma anota
 * `trazido` (é o que ela tem); sem a soma, `ignorado`; mudada depois por
 * outro caminho (o mestre gastou uma Poção), ilegível ou fora da pasta,
 * `incerto` — a soma pode ter entrado, e o aviso não diz que ficou fora.
 */
function decisaoDoIgnorarInterrompido(pasta: PastaPeloId, pendente: ItemPendente, marca: MarcaDoTrazer): Exclude<DecisaoDoPendente, 'saiu'> {
  const ficha = pasta.rpg === null ? null : fichaDoPendente(pasta, pendente)
  if (ficha === null) return 'incerto'
  const agora = impressaoDaFicha(ficha)
  if (marca.depois.includes(agora)) return 'trazido'
  return marca.antes.includes(agora) ? 'ignorado' : 'incerto'
}

/**
 * "Trazer para a ficha": soma o pendente na ficha (`fichasComOPendente`) por
 * `gravarFichas` e marca a linha `trazido`. Idempotente: ANTES de somar, o
 * relatório anota a ficha antes e depois da soma (`trazendo`). Se a gravação
 * cair entre a ficha e o relatório, o próximo "Trazer" acha a ficha já somada
 * e só anota; achando-a como antes, soma; mudada desde então, não soma
 * (`incerto`). `mudar` dá as MESMAS vagas novas a cada vez que roda: o app
 * aplica a mudança ao disco e à cópia aberta, e as duas têm de ficar iguais —
 * e iguais à ficha prevista na marca.
 */
export function trazerPendente(pastaId: string, id: string, disco: DiscoDaMigracao, gravarFichas: GravarFichasDaPasta, opcoes: OpcoesDosPendentes = {}): Promise<DecisaoTomada> {
  return emFila(async () => {
    const pasta = await pastaPeloId(disco, pastaId)
    const { relatorio } = pasta
    const estado = await lerEstado(disco, relatorio)
    const pendente = pendenteEsperando(estado, id)
    if ('ok' in pendente) return pendente
    const agoraMs = (opcoes.agora ?? Date.now)()
    // O mapa saiu da pasta com o item ainda no boneco: trazer o deixaria nos dois lugares.
    const doMapa = new Set([pendente.chave])
    if (chavesQueSairam(pasta, estado).has(pendente.chave) && (await osQueOBonecoAindaTem(disco, pasta, estado, doMapa, agoraMs, null)).has(id)) {
      return { ok: false, porque: 'saiu', pendente }
    }
    const ficha = fichaDoPendente(pasta, pendente)
    if (ficha === null) return { ok: false, porque: 'sem-ficha' }
    const marca = estado.trazendo.get(id)
    if (marca !== undefined) {
      const agora = impressaoDaFicha(ficha)
      if (marca.depois.includes(agora)) return anotarTrazido(disco, relatorio, estado, pendente, marca.moedasDeFora, agoraMs)
      if (!marca.antes.includes(agora)) return { ok: false, porque: 'incerto', pendente }
    }
    const novoId = opcoes.novoId ?? (() => crypto.randomUUID())
    const vagas: string[] = []
    /** Cada aplicação da soma pega as vagas do começo: a prevista, a do disco e a da cópia aberta saem iguais. */
    const vagasDaVez = (): (() => string) => {
      let usadas = 0
      return () => {
        if (usadas === vagas.length) vagas.push(novoId())
        return vagas[usadas++]
      }
    }
    const prevista = fichasComOPendente([ficha], pendente, vagasDaVez())
    const depois = prevista?.personagens[0]
    if (prevista === null || depois === undefined) return { ok: false, porque: 'sem-ficha' }
    // Antes de mexer na ficha: o relatório sabe como ela vai ficar, e o segundo clique não soma de novo.
    const comMarca: EstadoDosPendentes = { ...estado, trazendo: marcasComASoma(estado, pendente, impressaoDaFicha(ficha), impressaoDaFicha(depois), prevista.moedasDeFora) }
    await gravarEstado(disco, relatorio, comMarca, agoraMs)
    // A cópia do relatório danificado já ficou ao lado: a anotação final não a faz de novo.
    const gravado: EstadoDosPendentes = { ...comMarca, danificado: null }
    const somou: { moedasDeFora: number | null } = { moedasDeFora: null }
    await gravarFichas((rpg) => {
      const somadas = fichasComOPendente(rpg.personagens, pendente, vagasDaVez())
      if (somadas === null) return rpg
      if (somou.moedasDeFora === null) somou.moedasDeFora = somadas.moedasDeFora
      return { ...rpg, personagens: somadas.personagens }
    })
    if (somou.moedasDeFora === null) return { ok: false, porque: 'sem-ficha' }
    return anotarTrazido(disco, relatorio, gravado, pendente, somou.moedasDeFora, agoraMs)
  })
}

/**
 * "Ignorar": o pendente sai do aviso; a linha continua no relatório, marcada
 * `ignorado`. A ficha não muda. O de um "Trazer" interrompido anota o que dá
 * para saber (`decisaoDoIgnorarInterrompido`): `trazido`, `ignorado` ou
 * `incerto`.
 */
export function ignorarPendente(pastaId: string, id: string, disco: DiscoDaMigracao, opcoes: OpcoesDosPendentes = {}): Promise<DecisaoTomada> {
  return emFila(async () => {
    const pasta = await pastaPeloId(disco, pastaId)
    const { relatorio } = pasta
    const estado = await lerEstado(disco, relatorio)
    const pendente = pendenteEsperando(estado, id)
    if ('ok' in pendente) return pendente
    const agoraMs = (opcoes.agora ?? Date.now)()
    const marca = estado.trazendo.get(id)
    const decisao = marca === undefined ? 'ignorado' : decisaoDoIgnorarInterrompido(pasta, pendente, marca)
    await gravarEstado(disco, relatorio, comDecisaoFinal(estado, id, decisao, agoraMs), agoraMs)
    return { ok: true, decisao, pendente, moedasDeFora: decisao === 'trazido' && marca !== undefined ? marca.moedasDeFora : 0 }
  })
}
