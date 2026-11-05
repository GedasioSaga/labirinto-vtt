import { readCarriedItems } from '../../lib/items'
import { fichasComOPendente, pendentesDoMapaQueEntrou, type DecisaoDoPendente, type ItemPendente } from '../../lib/mochila/pendentes'
import { chaveDoMapa, idDePastaValido, lugarDoMapa, rpgDoArquivo, type RpgDaPasta } from '../../lib/pastasDeMapas'
import type { RecoveryCopy } from '../../lib/recoveryCopy'
import { readMoedas } from '../../lib/troca'
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
 *    linha sai do arquivo.
 *
 * Tudo mora no relatório da pasta (`<appData>/pastas/<id>/migracao-da-mochila.json`,
 * o mesmo da migração), ao lado do que ela escreveu: `mapasPorConferir` e
 * `itensDeMapasQueEntraram`. Um arquivo só, uma gravação por mudança: o aviso
 * pendente e a linha do relatório são a MESMA linha (pendente = sem `decisao`),
 * e sobrevivem a fechar o app.
 *
 * As gravações passam por uma fila: dois cliques seguidos em "Trazer" leem o
 * que o anterior gravou, nas fichas e no relatório.
 */

const MAPAS_POR_CONFERIR = 'mapasPorConferir'
const ITENS_DOS_MAPAS_QUE_ENTRARAM = 'itensDeMapasQueEntraram'
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

interface EstadoDosPendentes {
  /** O relatório como veio (o que a migração escreveu fica como está). */
  bruto: Bruto
  porConferir: string[]
  itens: ItemPendente[]
  /** Linhas que este app não entende: voltam ao arquivo como vieram. */
  tortas: unknown[]
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
  return valor === 'trazido' || valor === 'ignorado' ? valor : undefined
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

async function lerEstado(disco: DiscoDaMigracao, relatorio: string): Promise<EstadoDosPendentes> {
  const texto = await disco.ler(relatorio)
  const bruto = texto === null ? relatorioNovo() : objetoDoTexto(texto)
  if (bruto === null) return { bruto: relatorioNovo(), porConferir: [], itens: [], tortas: [], danificado: texto }
  const marcas = Array.isArray(bruto[MAPAS_POR_CONFERIR]) ? bruto[MAPAS_POR_CONFERIR] : []
  const porConferir = marcas.filter((chave): chave is string => typeof chave === 'string')
  const itens: ItemPendente[] = []
  const tortas: unknown[] = []
  for (const linha of Array.isArray(bruto[ITENS_DOS_MAPAS_QUE_ENTRARAM]) ? bruto[ITENS_DOS_MAPAS_QUE_ENTRARAM] : []) {
    const lida = pendenteDoArquivo(linha)
    if (lida === null) tortas.push(linha)
    else itens.push(lida)
  }
  return { bruto, porConferir, itens, tortas, danificado: null }
}

/** Grava o estado no relatório. O relatório danificado ganha antes uma cópia ao lado, nunca apagada. */
async function gravarEstado(disco: DiscoDaMigracao, relatorio: string, estado: EstadoDosPendentes, agoraMs: number): Promise<void> {
  if (estado.danificado !== null) await disco.gravar(`${relatorio}${SUFIXO_DANIFICADO}-${agoraMs}`, estado.danificado)
  const bruto = {
    ...estado.bruto,
    [MAPAS_POR_CONFERIR]: estado.porConferir,
    [ITENS_DOS_MAPAS_QUE_ENTRARAM]: [...estado.itens.map(pendenteParaOArquivo), ...estado.tortas],
  }
  await disco.gravar(relatorio, JSON.stringify(bruto, null, 2))
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
 * Confere o mapa `chave` anotado por `marcarMapaQueEntrou`: o que só os
 * bonecos dele têm vira pendente no relatório. `null` = o mapa não usa uma
 * pasta convertida com sistema universal (o espelho da pasta não toca os
 * bonecos dele; a marca, se houver, espera). Mapa sem marca: nada novo, só o
 * id da pasta (quem chama mostra os pendentes dela). Cena que não abriu deixa
 * a marca: a abertura seguinte tenta de novo.
 */
export function conferirMapaQueEntrou(chave: string, disco: DiscoDaMigracao, opcoes: OpcoesDaConferencia): Promise<MapaConferido | null> {
  return emFila(async () => {
    const pasta = await pastaConvertidaDoMapa(disco, chave)
    if (pasta === null || pasta.proprio || pasta.rpg.sistemaDeRpg === undefined) return null
    const estado = await lerEstado(disco, pasta.relatorio)
    if (!estado.porConferir.includes(chave)) return { pastaId: pasta.pastaId, novos: [] }
    const agoraMs = (opcoes.agora ?? Date.now)()
    const lidas: CenasLidas = { cenas: [], naoAbriram: [] }
    await lerCenasDoMapa(disco, await disco.juntar(pasta.pastaDosMapas, chave), opcoes.recuperado ?? null, lidas)
    const novos = pendentesDoMapaQueEntrou(pasta.rpg.personagens, chave, lidas.cenas, estado.itens, agoraMs, opcoes.novoId ?? (() => crypto.randomUUID()))
    const baixar = opcoes.baixarMarca && lidas.naoAbriram.length === 0
    const porConferir = baixar ? estado.porConferir.filter((marcada) => marcada !== chave) : estado.porConferir
    if (novos.length > 0 || porConferir !== estado.porConferir) {
      await gravarEstado(disco, pasta.relatorio, { ...estado, porConferir, itens: [...estado.itens, ...novos] }, agoraMs)
    }
    return { pastaId: pasta.pastaId, novos }
  })
}

/** Os pendentes da pasta que esperam o mestre (sem decisão), na ordem em que entraram. */
export function pendentesDaPasta(pastaId: string, disco: DiscoDaMigracao): Promise<ItemPendente[]> {
  return emFila(async () => {
    const estado = await lerEstado(disco, await relatorioDaPasta(disco, pastaId))
    return estado.itens.filter((pendente) => pendente.decisao === undefined)
  })
}

export type DecisaoTomada =
  | { ok: true; pendente: ItemPendente; moedasDeFora: number }
  | {
      ok: false
      /** `nao-achado`/`ja-decidido`: outro clique já resolveu; `sem-ficha`: a ficha saiu da pasta e o pendente continua esperando. */
      porque: 'nao-achado' | 'ja-decidido' | 'sem-ficha'
    }

/** O pendente `id` ainda esperando, ou por que não. */
function pendenteEsperando(estado: EstadoDosPendentes, id: string): ItemPendente | Extract<DecisaoTomada, { ok: false }> {
  const pendente = estado.itens.find((candidato) => candidato.id === id)
  if (pendente === undefined) return { ok: false, porque: 'nao-achado' }
  return pendente.decisao === undefined ? pendente : { ok: false, porque: 'ja-decidido' }
}

function comDecisao(estado: EstadoDosPendentes, id: string, decisao: DecisaoDoPendente, agoraMs: number): EstadoDosPendentes {
  return { ...estado, itens: estado.itens.map((pendente) => (pendente.id === id ? { ...pendente, decisao, decididoEm: agoraMs } : pendente)) }
}

/** Quem grava as fichas da pasta: no app, `editarRpgDaPasta` (o disco e a cópia aberta no editor). */
export type GravarFichasDaPasta = (mudar: (rpg: RpgDaPasta) => RpgDaPasta) => Promise<unknown>

/**
 * "Trazer para a ficha": soma o pendente na ficha (`fichasComOPendente`) por
 * `gravarFichas` e só então marca a linha `trazido`. `mudar` dá as MESMAS
 * vagas novas a cada vez que roda: o app aplica a mudança ao disco e à cópia
 * aberta, e as duas têm de ficar iguais.
 */
export function trazerPendente(pastaId: string, id: string, disco: DiscoDaMigracao, gravarFichas: GravarFichasDaPasta, opcoes: OpcoesDosPendentes = {}): Promise<DecisaoTomada> {
  return emFila(async () => {
    const relatorio = await relatorioDaPasta(disco, pastaId)
    const estado = await lerEstado(disco, relatorio)
    const pendente = pendenteEsperando(estado, id)
    if ('ok' in pendente) return pendente
    const novoId = opcoes.novoId ?? (() => crypto.randomUUID())
    const vagas: string[] = []
    const somou: { moedasDeFora: number | null } = { moedasDeFora: null }
    await gravarFichas((rpg) => {
      let usadas = 0
      const vaga = (): string => {
        if (usadas === vagas.length) vagas.push(novoId())
        return vagas[usadas++]
      }
      const somadas = fichasComOPendente(rpg.personagens, pendente, vaga)
      if (somadas === null) return rpg
      if (somou.moedasDeFora === null) somou.moedasDeFora = somadas.moedasDeFora
      return { ...rpg, personagens: somadas.personagens }
    })
    if (somou.moedasDeFora === null) return { ok: false, porque: 'sem-ficha' }
    const agoraMs = (opcoes.agora ?? Date.now)()
    await gravarEstado(disco, relatorio, comDecisao(estado, id, 'trazido', agoraMs), agoraMs)
    return { ok: true, pendente, moedasDeFora: somou.moedasDeFora }
  })
}

/** "Ignorar": o pendente sai do aviso; a linha continua no relatório, marcada `ignorado`. A ficha não muda. */
export function ignorarPendente(pastaId: string, id: string, disco: DiscoDaMigracao, opcoes: OpcoesDosPendentes = {}): Promise<DecisaoTomada> {
  return emFila(async () => {
    const relatorio = await relatorioDaPasta(disco, pastaId)
    const estado = await lerEstado(disco, relatorio)
    const pendente = pendenteEsperando(estado, id)
    if ('ok' in pendente) return pendente
    const agoraMs = (opcoes.agora ?? Date.now)()
    await gravarEstado(disco, relatorio, comDecisao(estado, id, 'ignorado', agoraMs), agoraMs)
    return { ok: true, pendente, moedasDeFora: 0 }
  })
}
