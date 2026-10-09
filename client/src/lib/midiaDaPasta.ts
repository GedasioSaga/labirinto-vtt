import { copyFile, mkdir, readDir, readFile, stat, writeFile } from '@tauri-apps/plugin-fs'
import { dirname, join } from '@tauri-apps/api/path'
import type { MapData, Token } from '../types/map'
import type { CartaoDaFicha, Personagem } from './personagem'
import { useToastStore } from '../stores/toastStore'
import { baseName } from './adventure'
import { carriedItemsOf } from './items'
import { ehIdDeMidia, idDaRef, idDosBytes, MIDIA_MAX_BYTES } from './midia'
import { pastaDaMidia } from './midiaNoDisco'

/**
 * MÍDIA QUE VIAJA COM A AVENTURA. A mídia da mesa mora uma vez só em
 * `<appData>/midia` (`lib/midiaNoDisco.ts`), fora da pasta da aventura: a
 * aventura copiada para outro computador (ou o backup restaurado) abria com o
 * retrato e a imagem do item apontando para um arquivo que só existia no
 * computador de origem. Antes da mídia, o retrato ia embutido no
 * `adventure.json` e viajava junto — isto devolve essa garantia.
 *
 * A pasta leva uma CÓPIA de toda mídia que usa, com o mesmo nome (o hash do
 * conteúdo, `lib/midia.ts`):
 *  - ao SALVAR, cada imagem usada vai de `<appData>/midia` para a pasta;
 *  - ao ABRIR, cada imagem da pasta que falta em `<appData>/midia` volta para
 *    lá, conferida antes: o conteúdo tem de ser o que o nome diz. O resolvedor
 *    do mestre e a rota `/media` da sala continuam lendo só de `<appData>/midia`.
 *
 * Onde a cópia mora:
 *  - aventura: `<pasta da aventura>/midia/`, irmã do `adventure.json` e de
 *    `scenes/` — uma pasta para todas as cenas, como a ficha cruza cenas;
 *  - mapa solto: `<pasta do arquivo>/<nome sem .json>.midia/`. Vários mapas
 *    soltos podem morar na mesma pasta (a área de trabalho): uma `midia/`
 *    comum misturaria as imagens de todos e não diria de quem é cada uma, e
 *    quem leva `masmorra.json` para outro computador vê pelo nome que
 *    `masmorra.midia` vai junto. O ponto no nome também nunca colide com a
 *    `midia` da aventura que esse mapa venha a virar.
 *
 * Nada aqui apaga arquivo: a imagem que deixou de ser usada fica na pasta.
 * Nada aqui lança: a imagem que não foi (ou não voltou) vira aviso, e a
 * gravação ou a abertura seguem — o mapa e as fichas valem mais que a foto.
 *
 * Permissão: a pasta da mídia fica DENTRO da pasta que o app já lê e grava —
 * a de `<appData>` (escopo fixo da capability) ou a que o mestre escolheu e
 * `loadMapFromDisk`/`exportMapFolder` liberaram com `grant_fs_access`
 * recursivo. Nenhum escopo novo é pedido aqui.
 */

/** Nome da pasta de mídia dentro da pasta da aventura. */
export const PASTA_DE_MIDIA_DA_AVENTURA = 'midia'
/** O que a pasta irmã do mapa solto leva depois do nome do arquivo. */
const SUFIXO_DA_MIDIA_DO_MAPA_SOLTO = '.midia'
/** Avisos de mídia ficam um pouco mais que o "Mapa salvo": pedem leitura, não ação. */
const AVISO_DE_MIDIA_MS = 7000

/** `masmorra.json` → `masmorra.midia`; arquivo sem `.json` só ganha o sufixo. */
export function nomeDaMidiaDoMapaSolto(arquivo: string): string {
  return `${arquivo.replace(/\.json$/i, '')}${SUFIXO_DA_MIDIA_DO_MAPA_SOLTO}`
}

export async function pastaDaMidiaDaAventura(pastaDaAventura: string): Promise<string> {
  return join(pastaDaAventura, PASTA_DE_MIDIA_DA_AVENTURA)
}

export async function pastaDaMidiaDoMapaSolto(caminhoDoMapa: string): Promise<string> {
  return join(await dirname(caminhoDoMapa), nomeDaMidiaDoMapaSolto(baseName(caminhoDoMapa)))
}

// ───────────────────────────────────────────────────────────────────────────
// Quem usa qual mídia (regra pura)
// ───────────────────────────────────────────────────────────────────────────

/** Onde a aventura (ou o mapa solto) guarda referência de mídia. */
export interface UsoDaMidia {
  /** As fichas da aventura: retrato e imagem de cartão. */
  personagens?: readonly Personagem[]
  /** As cenas: a mochila de cada token e os itens soltos no mapa (pino de item, item no chão). */
  mapas?: readonly MapData[]
  /** Fichas guardadas fora do mapa (`StoredToken`), que o arquivo continua levando. */
  tokens?: readonly Token[]
}

function guardarId(ref: unknown, ids: Set<string>): void {
  const id = idDaRef(ref)
  if (id !== null) ids.add(id)
}

function idsDoCartao(cartao: CartaoDaFicha, ids: Set<string>): void {
  guardarId(cartao.imagem, ids)
  for (const sub of cartao.subcartoes) idsDoCartao(sub, ids)
}

function idsDaMochila(token: Token, ids: Set<string>): void {
  for (const item of carriedItemsOf(token)) guardarId(item.imagem, ids)
}

/** ITEM NO MAPA (entrega 5): a imagem do pino de item e a do item deitado no chão (objeto). */
function idsDosItensNoMapa(mapa: MapData, ids: Set<string>): void {
  for (const pin of mapa.pins) guardarId(pin.item?.imagem, ids)
  for (const prop of mapa.props) guardarId(prop.item?.imagem, ids)
}

/**
 * Os ids de mídia usados, sem repetir e em ordem. A imagem embutida
 * (`data:image/...`) não entra: ela já mora dentro do arquivo. A imagem
 * própria do pino também não: é embutida no `map.json` (`Pin.image`) — só a do
 * ITEM do pino (e do item no chão) é referência.
 */
export function idsDaMidiaUsada(uso: UsoDaMidia): string[] {
  const ids = new Set<string>()
  for (const personagem of uso.personagens ?? []) {
    guardarId(personagem.retrato, ids)
    for (const cartoes of Object.values(personagem.abas)) for (const cartao of cartoes) idsDoCartao(cartao, ids)
  }
  for (const mapa of uso.mapas ?? []) {
    for (const token of mapa.tokens) idsDaMochila(token, ids)
    idsDosItensNoMapa(mapa, ids)
  }
  for (const token of uso.tokens ?? []) idsDaMochila(token, ids)
  return [...ids].sort()
}

// ───────────────────────────────────────────────────────────────────────────
// Disco
// ───────────────────────────────────────────────────────────────────────────

/** Os nomes dos arquivos comuns da pasta; pasta que não existe é vazia. Atalho (symlink) fica fora: poderia apontar para fora da pasta. */
async function arquivosDaPasta(pasta: string): Promise<Set<string>> {
  try {
    const entradas = await readDir(pasta)
    return new Set(entradas.filter((entrada) => entrada.isFile && !entrada.isSymlink).map((entrada) => entrada.name))
  } catch {
    return new Set()
  }
}

/**
 * O alvo já tem a cópia inteira? Mesmo nome é mesmo conteúdo (o nome É o
 * hash); o tamanho igual descarta a cópia que ficou pela metade — app fechado
 * no meio da gravação deixaria o arquivo truncado com o nome certo para sempre.
 */
async function copiaInteira(alvo: string, tamanho: number): Promise<boolean> {
  return (await stat(alvo)).size === tamanho
}

/** O que salvar levou para a pasta. */
export interface MidiaLevada {
  /** Ids gravados agora (o que já estava inteiro na pasta não conta). */
  copiados: string[]
  /** Ids que não foram: a imagem não está neste computador, ou o disco recusou. */
  faltaram: string[]
}

/**
 * Copia de `<appData>/midia` para `pasta` cada id de `ids` que ainda não está
 * lá inteiro. Só os pedidos: a pasta não vira espelho da mídia do app. Nunca
 * apaga; só sobrescreve a cópia truncada de um nome que é dela.
 */
export async function copiarMidiaParaAPasta(pasta: string, ids: readonly string[]): Promise<MidiaLevada> {
  const levada: MidiaLevada = { copiados: [], faltaram: [] }
  const pedidos = ids.filter(ehIdDeMidia)
  if (pedidos.length === 0) return levada
  let origem: string
  try {
    origem = await pastaDaMidia()
    await mkdir(pasta, { recursive: true })
  } catch {
    return { copiados: [], faltaram: pedidos }
  }
  const naOrigem = await arquivosDaPasta(origem)
  const naPasta = await arquivosDaPasta(pasta)
  for (const id of pedidos) {
    try {
      if (!naOrigem.has(id)) {
        // Sumiu deste computador: a cópia que a pasta já tem (veio de outro) basta.
        if (!naPasta.has(id)) levada.faltaram.push(id)
        continue
      }
      const fonte = await join(origem, id)
      const alvo = await join(pasta, id)
      if (naPasta.has(id) && (await copiaInteira(alvo, (await stat(fonte)).size))) continue
      await copyFile(fonte, alvo)
      levada.copiados.push(id)
    } catch {
      levada.faltaram.push(id)
    }
  }
  return levada
}

/** O que abrir trouxe da pasta. */
export interface MidiaTrazida {
  /** Ids gravados agora em `<appData>/midia`. */
  importados: string[]
  /** Arquivos da pasta recusados: conteúdo que não é o do nome, grande demais, ou ilegível. */
  recusados: string[]
  /** A pasta existe mas não deu para listá-la: nada foi conferido. */
  pastaIlegivel: boolean
}

/**
 * Um arquivo da pasta para `<appData>/midia`, conferido. A pasta veio de outro
 * computador (ou de qualquer um): o que entra aqui a sala serve aos jogadores,
 * então o conteúdo tem de ser imagem aceita, caber no teto e ter o hash do nome.
 */
async function importarUm(fonte: string, alvo: string, id: string, jaEsta: boolean): Promise<'importado' | 'ja-estava' | 'recusado'> {
  const tamanho = (await stat(fonte)).size
  // O tamanho antes dos bytes: arquivo enorme com nome de mídia não entra na memória.
  if (tamanho > MIDIA_MAX_BYTES) return 'recusado'
  if (jaEsta && (await copiaInteira(alvo, tamanho))) return 'ja-estava'
  const bytes = await readFile(fonte)
  if (bytes.length > MIDIA_MAX_BYTES || (await idDosBytes(bytes)) !== id) return 'recusado'
  await writeFile(alvo, bytes)
  return 'importado'
}

/**
 * Traz para `<appData>/midia` a mídia de `pasta` que falta lá. Idempotente:
 * abrir de novo não regrava nada. Só arquivo com nome de mídia é olhado — o
 * resto da pasta não é desta função.
 */
export async function importarMidiaDaPasta(pasta: string): Promise<MidiaTrazida> {
  const trazida: MidiaTrazida = { importados: [], recusados: [], pastaIlegivel: false }
  let nomes: string[]
  try {
    const entradas = await readDir(pasta)
    nomes = entradas.filter((entrada) => entrada.isFile && !entrada.isSymlink && ehIdDeMidia(entrada.name)).map((entrada) => entrada.name)
  } catch {
    // Sem pasta de mídia é o comum (mapa sem imagem, aventura de antes): só a que existe e não abre é problema.
    trazida.pastaIlegivel = await existeComoPasta(pasta)
    return trazida
  }
  if (nomes.length === 0) return trazida
  let destino: string
  try {
    destino = await pastaDaMidia()
    await mkdir(destino, { recursive: true })
  } catch {
    return { importados: [], recusados: nomes, pastaIlegivel: false }
  }
  const jaNoApp = await arquivosDaPasta(destino)
  for (const id of nomes) {
    try {
      const resultado = await importarUm(await join(pasta, id), await join(destino, id), id, jaNoApp.has(id))
      if (resultado === 'importado') trazida.importados.push(id)
      else if (resultado === 'recusado') trazida.recusados.push(id)
    } catch {
      trazida.recusados.push(id)
    }
  }
  return trazida
}

/** A pasta existe? `stat` de quem não existe lança — e aí não há o que avisar. */
async function existeComoPasta(pasta: string): Promise<boolean> {
  try {
    return (await stat(pasta)).isDirectory
  } catch {
    return false
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Salvar e abrir
// ───────────────────────────────────────────────────────────────────────────

function avisarMidiaQueFaltou(levada: MidiaLevada): void {
  const n = levada.faltaram.length
  if (n === 0) return
  const texto =
    n === 1
      ? '1 imagem não foi junto com o mapa: o arquivo dela não está neste computador (ou o disco recusou). Em outro computador ela não aparece.'
      : `${n} imagens não foram junto com o mapa: os arquivos delas não estão neste computador (ou o disco recusou). Em outro computador elas não aparecem.`
  useToastStore.getState().push('info', texto, AVISO_DE_MIDIA_MS, { chave: 'midia-faltou' })
}

function avisarMidiaRecusada(trazida: MidiaTrazida): void {
  const n = trazida.recusados.length
  let texto: string | null = null
  if (trazida.pastaIlegivel) texto = 'Não deu para ler a pasta de imagens do mapa: retratos e imagens de item podem não aparecer.'
  else if (n === 1) texto = '1 imagem da pasta do mapa foi ignorada: o conteúdo não confere com o nome (arquivo corrompido ou trocado).'
  else if (n > 1) texto = `${n} imagens da pasta do mapa foram ignoradas: o conteúdo não confere com o nome (arquivos corrompidos ou trocados).`
  if (texto !== null) useToastStore.getState().push('info', texto, AVISO_DE_MIDIA_MS, { chave: 'midia-recusada' })
}

/**
 * Leva a mídia de `uso` para a pasta que `pastaDaMidia` resolve. Nunca lança;
 * o que não foi vira aviso. A pasta é resolvida aqui dentro para que até a
 * montagem do caminho que falha vire "faltou", e não erro na gravação.
 */
async function levarPara(pastaDaMidia: () => Promise<string>, uso: UsoDaMidia): Promise<MidiaLevada> {
  const ids = idsDaMidiaUsada(uso)
  if (ids.length === 0) return { copiados: [], faltaram: [] }
  let levada: MidiaLevada
  try {
    levada = await copiarMidiaParaAPasta(await pastaDaMidia(), ids)
  } catch {
    levada = { copiados: [], faltaram: ids }
  }
  avisarMidiaQueFaltou(levada)
  return levada
}

/** Ao salvar a aventura: a mídia de fichas e mochilas vai para `<pasta>/midia`. Nunca lança; o que não foi vira aviso. */
export async function levarMidiaDaAventura(pastaDaAventura: string, uso: UsoDaMidia): Promise<MidiaLevada> {
  return levarPara(() => pastaDaMidiaDaAventura(pastaDaAventura), uso)
}

/** Ao salvar (ou exportar) o mapa solto: a mídia das mochilas vai para a pasta irmã do arquivo. Nunca lança. */
export async function levarMidiaDoMapaSolto(caminhoDoMapa: string, mapa: MapData): Promise<MidiaLevada> {
  return levarPara(() => pastaDaMidiaDoMapaSolto(caminhoDoMapa), { mapas: [mapa] })
}

/**
 * Ao salvar os personagens de uma PASTA DE MAPAS (`lib/pastasDeMapas.ts`): a
 * mídia das fichas vai para `pastaDaMidia`, que a pasta guarda como a aventura
 * guarda a dela. Nunca lança; o que não foi vira aviso.
 */
export async function levarMidiaParaAPasta(pastaDaMidia: string, uso: UsoDaMidia): Promise<MidiaLevada> {
  return levarPara(async () => pastaDaMidia, uso)
}

/** Traz a mídia de `pastaDaMidia` para `<appData>/midia`, como a abertura faz. Nunca lança; o recusado vira aviso. */
async function trazerDe(pastaDaMidia: () => Promise<string>): Promise<MidiaTrazida> {
  let trazida: MidiaTrazida
  try {
    trazida = await importarMidiaDaPasta(await pastaDaMidia())
  } catch {
    trazida = { importados: [], recusados: [], pastaIlegivel: false }
  }
  avisarMidiaRecusada(trazida)
  return trazida
}

/**
 * Ao abrir: a mídia da pasta da aventura (ou da pasta irmã do mapa solto)
 * volta para `<appData>/midia` ANTES de o editor mostrar qualquer ficha — o
 * `<img>` que pede um arquivo que ainda não chegou não tenta de novo. Nunca lança.
 */
export async function trazerMidiaAoAbrir(caminhoDoMapa: string, pastaDaAventura: string | null): Promise<MidiaTrazida> {
  return trazerDe(() => (pastaDaAventura === null ? pastaDaMidiaDoMapaSolto(caminhoDoMapa) : pastaDaMidiaDaAventura(pastaDaAventura)))
}

/** Ao abrir um mapa de uma PASTA DE MAPAS: a mídia dos personagens da pasta volta para `<appData>/midia`. Nunca lança. */
export async function trazerMidiaDaPasta(pastaDaMidia: string): Promise<MidiaTrazida> {
  return trazerDe(async () => pastaDaMidia)
}
