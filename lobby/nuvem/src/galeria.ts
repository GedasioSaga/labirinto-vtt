import { ErroDoPedido, json, lerCorpo, naoExiste } from './http'
import { ErroDoBanco, numero, texto, type Linha } from './linhas'
import { lerBytesComTeto } from './midia'
import { KIB, MIB } from './pedidos'

/**
 * GALERIA DE CUTSCENES (14/11/2026, pedido do mestre): o vídeo que tocou na
 * mesa fica no site dos jogadores, aba Galeria, para rever depois.
 *
 * - Só o app do mestre sobe (o DO Campanha confere antes). O vídeo
 *   (`<sha256>.<mp4|webm>`, até 150 MiB) chega em PUTs de 4 MiB
 *   (`/video/:id/parte/:n?tamanho=<total>`): o Worker tem 128 MB de memória e
 *   nenhum pedido carrega o vídeo inteiro. Cada pedaço vira linhas de 512 KiB
 *   (`video_parte`, o mesmo tamanho da mídia de imagem). O pedaço 0 confere a
 *   assinatura dos bytes contra a extensão do endereço.
 * - `POST /video/:id/fechar` com `{titulo}` confere que todos os pedaços
 *   chegaram e o sha256 do conjunto (lido linha a linha num `DigestStream`)
 *   contra o hash do endereço; só então o vídeo aparece na Galeria.
 * - `GET /video/:id` serve com `Range` (206, no máximo 4 MiB por resposta);
 *   sem `Range`, o corpo sai em fluxo, uma linha por vez.
 * - Tirar da Galeria (só o mestre, pelo app ou pelo site) apaga os bytes e
 *   deixa lápide: a linha fica com o título e `tiradoEm`, no molde do mural.
 *   Subir o mesmo vídeo de novo depois reabre a linha.
 * - Teto da campanha: 600 MiB de vídeo (ver LIMITES.md da cutscene), fora os
 *   300 MB das imagens.
 */

export const VIDEO_MAX_BYTES = 150 * MIB
/** O pedaço de cada PUT. O app (nuvem.rs, `PEDACO_DO_VIDEO_NA_NUVEM`) usa o mesmo. */
export const PEDACO_DO_ENVIO = 4 * MIB
const LINHA_BYTES = 512 * KIB
const LINHAS_POR_PEDACO = PEDACO_DO_ENVIO / LINHA_BYTES
const VIDEO_MAX_POR_CAMPANHA = 600 * MIB
/** O máximo de bytes por resposta com `Range` (o player pede de novo o resto). */
const FAIXA_MAX_BYTES = 4 * MIB
const TITULO_MAX = 80
const CORPO_MAX_FECHAR = 4 * KIB
/** Primeiros bytes onde o webm diz o tipo dele (`DocType`). */
const CABECALHO_DO_WEBM = 64

type TipoDeVideo = 'mp4' | 'webm'
type EstadoNaGaleria = 'subindo' | 'pronto' | 'tirado'

const TIPO_DO_CONTEUDO: Record<TipoDeVideo, string> = { mp4: 'video/mp4', webm: 'video/webm' }

const CABECALHOS_DO_VIDEO: Readonly<Record<string, string>> = {
  'cache-control': 'private, max-age=31536000, immutable',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; sandbox",
  'accept-ranges': 'bytes',
}

interface IdDoVideo {
  hash: string
  tipo: TipoDeVideo
}

interface VideoGuardado {
  tipo: TipoDeVideo
  tamanho: number
  titulo: string
  estado: EstadoNaGaleria
  quando: number
}

export interface VideoDaGaleria {
  id: string
  titulo: string
  tamanho: number
  quando: number
}

const FORMA_DO_ID = /^([0-9a-f]{64})\.(mp4|webm)$/

/** O id da rota, de novo na forma exata (a rota já confere; aqui é a segunda parede). */
function lerIdDoVideo(videoId: string): IdDoVideo {
  const achado = FORMA_DO_ID.exec(videoId)
  if (achado === null) throw new ErroDoPedido(404, 'nao-existe', 'Não existe')
  return { hash: achado[1], tipo: achado[2] === 'webm' ? 'webm' : 'mp4' }
}

function ehEstado(valor: string): valor is EstadoNaGaleria {
  return valor === 'subindo' || valor === 'pronto' || valor === 'tirado'
}

function videoGuardado(sql: SqlStorage, hash: string): VideoGuardado | undefined {
  for (const linha of sql.exec('SELECT tipo, tamanho, titulo, estado, quando FROM galeria WHERE hash = ?', hash)) {
    const estado = texto(linha, 'estado')
    if (!ehEstado(estado)) throw new ErroDoBanco(`vídeo ${hash} com estado fora do formato`)
    return { tipo: texto(linha, 'tipo') === 'webm' ? 'webm' : 'mp4', tamanho: numero(linha, 'tamanho'), titulo: texto(linha, 'titulo'), estado, quando: numero(linha, 'quando') }
  }
  return undefined
}

function blob(linha: Linha, coluna: string): ArrayBuffer {
  const valor = linha[coluna]
  if (!(valor instanceof ArrayBuffer)) throw new ErroDoBanco(`coluna ${coluna} sem bytes`)
  return valor
}

function linhaDoVideo(sql: SqlStorage, hash: string, indice: number): Uint8Array {
  for (const linha of sql.exec('SELECT bytes FROM video_parte WHERE hash = ? AND parte = ?', hash, indice)) return new Uint8Array(blob(linha, 'bytes'))
  throw new ErroDoBanco(`vídeo ${hash} sem a linha ${indice}`)
}

/** Os bytes de vídeo da campanha que contam no teto (o que subiu ou sobe, menos o próprio `hash`). */
function bytesDeVideoDaCampanha(sql: SqlStorage, semOHash: string): number {
  for (const linha of sql.exec("SELECT COALESCE(SUM(tamanho), 0) AS total FROM galeria WHERE estado != 'tirado' AND hash != ?", semOHash)) return numero(linha, 'total')
  return 0
}

/** A mesma regra do Rust (`TipoDeVideo::dos_bytes`): `ftyp` no byte 4, ou EBML com o DocType "webm". */
function tipoDoVideoNosBytes(bytes: Uint8Array): TipoDeVideo | null {
  const ftyp = bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  if (ftyp) return 'mp4'
  const ebml = bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  if (!ebml) return null
  const cabeca = new TextDecoder('latin1').decode(bytes.subarray(0, CABECALHO_DO_WEBM))
  return cabeca.includes('webm') ? 'webm' : null
}

function lerTamanhoTotal(url: URL): number {
  const valor = url.searchParams.get('tamanho')
  const tamanho = valor !== null && /^\d{1,10}$/.test(valor) ? Number(valor) : Number.NaN
  if (!Number.isSafeInteger(tamanho) || tamanho <= 0) throw new ErroDoPedido(400, 'tamanho', 'Falta o tamanho do vídeo')
  if (tamanho > VIDEO_MAX_BYTES) throw new ErroDoPedido(413, 'video-grande', `O vídeo passa de ${VIDEO_MAX_BYTES / MIB} MB`)
  return tamanho
}

/** O tamanho que o pedaço `parte` tem de ter num vídeo de `total` bytes; `null` = esse pedaço não existe. */
function tamanhoDoPedaco(parte: number, total: number): number | null {
  const pedacos = Math.ceil(total / PEDACO_DO_ENVIO)
  if (parte >= pedacos) return null
  return parte < pedacos - 1 ? PEDACO_DO_ENVIO : total - parte * PEDACO_DO_ENVIO
}

/** PUT `/api/c/:id/video/:videoId/parte/:n?tamanho=<total>`: um pedaço de 4 MiB, gravado em linhas de 512 KiB. */
export async function receberParteDoVideo(request: Request, url: URL, storage: DurableObjectStorage, videoId: string, parte: number, agora: number): Promise<Response> {
  const id = lerIdDoVideo(videoId)
  const total = lerTamanhoTotal(url)
  const esperado = tamanhoDoPedaco(parte, total)
  if (esperado === null) throw new ErroDoPedido(400, 'parte', 'Esse pedaço não existe nesse tamanho de vídeo')
  const guardado = videoGuardado(storage.sql, id.hash)
  if (guardado?.estado === 'pronto') return json({ id: videoId, parte, novo: false })
  const bytes = await lerBytesComTeto(request, PEDACO_DO_ENVIO, () => new ErroDoPedido(413, 'pedaco-grande', `O pedaço passa de ${PEDACO_DO_ENVIO / MIB} MiB`))
  if (bytes.byteLength !== esperado) throw new ErroDoPedido(400, 'pedaco-incompleto', 'O pedaço chegou com o tamanho errado')
  if (parte === 0 && tipoDoVideoNosBytes(bytes) !== id.tipo) throw new ErroDoPedido(400, 'tipo-errado', `O conteúdo não é um vídeo ${id.tipo} (aceitos: mp4, webm)`)
  storage.transactionSync(() => {
    const atual = videoGuardado(storage.sql, id.hash)
    if (atual?.estado === 'pronto') return
    if (bytesDeVideoDaCampanha(storage.sql, id.hash) + total > VIDEO_MAX_POR_CAMPANHA) {
      throw new ErroDoPedido(413, 'campanha-cheia', `Os vídeos da Galeria passariam de ${VIDEO_MAX_POR_CAMPANHA / MIB} MB: tire algum antes`)
    }
    // Outro tamanho total (o app recomeçou com outro arquivo do mesmo hash, ou lápide reaberta): começa de novo.
    if (atual === undefined || atual.estado === 'tirado' || atual.tamanho !== total) {
      storage.sql.exec('DELETE FROM video_parte WHERE hash = ?', id.hash)
      storage.sql.exec(
        `INSERT INTO galeria (hash, tipo, tamanho, titulo, estado, quando, tiradoEm) VALUES (?, ?, ?, '', 'subindo', ?, NULL)
         ON CONFLICT (hash) DO UPDATE SET tipo = excluded.tipo, tamanho = excluded.tamanho, estado = 'subindo', quando = excluded.quando, tiradoEm = NULL`,
        id.hash,
        id.tipo,
        total,
        agora,
      )
    }
    for (let sub = 0; sub * LINHA_BYTES < bytes.byteLength; sub += 1) {
      // `slice` copia a linha num ArrayBuffer só dela, do tamanho exato.
      const pedaco = bytes.slice(sub * LINHA_BYTES, (sub + 1) * LINHA_BYTES)
      storage.sql.exec('INSERT OR REPLACE INTO video_parte (hash, parte, bytes) VALUES (?, ?, ?)', id.hash, parte * LINHAS_POR_PEDACO + sub, pedaco.buffer)
    }
  })
  return json({ id: videoId, parte, novo: true })
}

function lerTitulo(corpo: unknown): string {
  const titulo = typeof corpo === 'object' && corpo !== null && 'titulo' in corpo ? corpo.titulo : undefined
  if (typeof titulo !== 'string') throw new ErroDoPedido(400, 'titulo', 'Falta o título do vídeo')
  const limpo = titulo.trim()
  // Sem caractere de controle: o título vai para a tela dos jogadores.
  if (limpo === '' || [...limpo].length > TITULO_MAX || /\p{Cc}/u.test(limpo)) throw new ErroDoPedido(400, 'titulo', `O título tem de ter de 1 a ${TITULO_MAX} letras`)
  return limpo
}

async function hashDoVideo(sql: SqlStorage, hash: string, linhas: number): Promise<string> {
  // O `crypto` do runtime da Cloudflare tem `DigestStream`; a lib DOM do tsconfig esconde esse tipo.
  const { DigestStream: Digestor } = crypto as unknown as { DigestStream: typeof DigestStream }
  const digestor = new Digestor('SHA-256')
  const escritor = digestor.getWriter()
  for (let indice = 0; indice < linhas; indice += 1) await escritor.write(linhaDoVideo(sql, hash, indice))
  await escritor.close()
  return [...new Uint8Array(await digestor.digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** POST `/api/c/:id/video/:videoId/fechar` com `{titulo}`: confere pedaços e sha256; o vídeo entra na Galeria. */
export async function fecharVideo(request: Request, storage: DurableObjectStorage, videoId: string, agora: number): Promise<Response> {
  const id = lerIdDoVideo(videoId)
  const titulo = lerTitulo(await lerCorpo(request, CORPO_MAX_FECHAR))
  const guardado = videoGuardado(storage.sql, id.hash)
  if (guardado === undefined || guardado.estado === 'tirado') throw new ErroDoPedido(409, 'sem-pedacos', 'Nenhum pedaço deste vídeo chegou')
  if (guardado.estado === 'pronto') {
    storage.transactionSync(() => storage.sql.exec('UPDATE galeria SET titulo = ? WHERE hash = ?', titulo, id.hash))
    return json({ id: videoId, titulo, tamanho: guardado.tamanho, novo: false })
  }
  const linhas = Math.ceil(guardado.tamanho / LINHA_BYTES)
  let gravados = 0
  for (const linha of storage.sql.exec('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(bytes)), 0) AS bytes FROM video_parte WHERE hash = ?', id.hash)) {
    if (numero(linha, 'n') !== linhas) throw new ErroDoPedido(409, 'faltam-pedacos', 'Ainda faltam pedaços do vídeo')
    gravados = numero(linha, 'bytes')
  }
  if (gravados !== guardado.tamanho) throw new ErroDoPedido(409, 'faltam-pedacos', 'Ainda faltam pedaços do vídeo')
  if ((await hashDoVideo(storage.sql, id.hash, linhas)) !== id.hash) {
    storage.transactionSync(() => {
      storage.sql.exec('DELETE FROM video_parte WHERE hash = ?', id.hash)
      storage.sql.exec('DELETE FROM galeria WHERE hash = ? AND estado = ?', id.hash, 'subindo')
    })
    throw new ErroDoPedido(400, 'hash-errado', 'O vídeo não confere com o hash do endereço: suba de novo')
  }
  storage.transactionSync(() => storage.sql.exec("UPDATE galeria SET titulo = ?, estado = 'pronto', quando = ? WHERE hash = ?", titulo, agora, id.hash))
  return json({ id: videoId, titulo, tamanho: guardado.tamanho, novo: true })
}

/** GET `/api/c/:id/galeria`: os vídeos prontos, do mais novo ao mais velho (as lápides ficam de fora). */
export function listarGaleria(sql: SqlStorage): Response {
  const videos: VideoDaGaleria[] = []
  for (const linha of sql.exec("SELECT hash, tipo, titulo, tamanho, quando FROM galeria WHERE estado = 'pronto' ORDER BY quando DESC")) {
    videos.push({ id: `${texto(linha, 'hash')}.${texto(linha, 'tipo')}`, titulo: texto(linha, 'titulo'), tamanho: numero(linha, 'tamanho'), quando: numero(linha, 'quando') })
  }
  return json({ videos })
}

/** POST `/api/c/:id/galeria/:videoId/tirar` (só o mestre): apaga os bytes e deixa lápide. Já tirado = mesma resposta. */
export function tirarDaGaleria(storage: DurableObjectStorage, videoId: string, agora: number): Response {
  const id = lerIdDoVideo(videoId)
  const guardado = videoGuardado(storage.sql, id.hash)
  if (guardado === undefined) return naoExiste()
  if (guardado.estado !== 'tirado') {
    storage.transactionSync(() => {
      storage.sql.exec('DELETE FROM video_parte WHERE hash = ?', id.hash)
      storage.sql.exec("UPDATE galeria SET estado = 'tirado', tiradoEm = ? WHERE hash = ?", agora, id.hash)
    })
  }
  return json({ id: videoId, tirado: true })
}

type Faixa = { tipo: 'inteiro' } | { tipo: 'parte'; inicio: number; fim: number } | { tipo: 'fora' }

/**
 * O `Range` de um pedido (RFC 9110 §14): só `bytes=a-b`, `bytes=a-` e
 * `bytes=-n`, uma faixa só. Torto ou com várias faixas = o arquivo inteiro.
 * A faixa servida tem no máximo `FAIXA_MAX_BYTES` (o player pede o resto).
 */
function faixaPedida(cabecalho: string | null, tamanho: number): Faixa {
  const achado = cabecalho === null ? null : /^bytes=(\d*)-(\d*)$/.exec(cabecalho.trim())
  if (achado === null) return { tipo: 'inteiro' }
  const [, deTexto, ateTexto] = achado
  if (deTexto === '' && ateTexto === '') return { tipo: 'inteiro' }
  if (deTexto === '') {
    const ultimos = Number(ateTexto)
    if (ultimos === 0) return { tipo: 'fora' }
    const inicio = Math.max(0, tamanho - ultimos)
    return { tipo: 'parte', inicio, fim: Math.min(tamanho - 1, inicio + FAIXA_MAX_BYTES - 1) }
  }
  const inicio = Number(deTexto)
  if (inicio >= tamanho) return { tipo: 'fora' }
  const fimPedido = ateTexto === '' ? tamanho - 1 : Math.min(tamanho - 1, Number(ateTexto))
  if (fimPedido < inicio) return { tipo: 'inteiro' }
  return { tipo: 'parte', inicio, fim: Math.min(fimPedido, inicio + FAIXA_MAX_BYTES - 1) }
}

/** Os bytes de `inicio` a `fim` (inclusive), lidos só das linhas que a faixa cobre. */
function bytesDaFaixa(sql: SqlStorage, hash: string, inicio: number, fim: number): Uint8Array {
  const saida = new Uint8Array(fim - inicio + 1)
  for (let indice = Math.floor(inicio / LINHA_BYTES); indice * LINHA_BYTES <= fim; indice += 1) {
    const linha = linhaDoVideo(sql, hash, indice)
    const comeco = indice * LINHA_BYTES
    const de = Math.max(inicio, comeco) - comeco
    const ate = Math.min(fim, comeco + linha.byteLength - 1) - comeco
    saida.set(linha.subarray(de, ate + 1), comeco + de - inicio)
  }
  return saida
}

/** GET `/api/c/:id/video/:videoId`: com `Range`, 206 de até 4 MiB; sem, o vídeo em fluxo, uma linha por vez. */
export function servirVideo(sql: SqlStorage, videoId: string, cabecalhoRange: string | null): Response {
  const id = lerIdDoVideo(videoId)
  const guardado = videoGuardado(sql, id.hash)
  if (guardado?.estado !== 'pronto' || guardado.tipo !== id.tipo) return naoExiste()
  const { tamanho } = guardado
  const tipo = TIPO_DO_CONTEUDO[id.tipo]
  const faixa = faixaPedida(cabecalhoRange, tamanho)
  if (faixa.tipo === 'fora') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${tamanho}`, ...CABECALHOS_DO_VIDEO } })
  if (faixa.tipo === 'parte') {
    const bytes = bytesDaFaixa(sql, id.hash, faixa.inicio, faixa.fim)
    return new Response(bytes, {
      status: 206,
      headers: { 'content-type': tipo, 'content-length': String(bytes.byteLength), 'content-range': `bytes ${faixa.inicio}-${faixa.fim}/${tamanho}`, ...CABECALHOS_DO_VIDEO },
    })
  }
  const linhas = Math.ceil(tamanho / LINHA_BYTES)
  let proxima = 0
  const corpo = new ReadableStream<Uint8Array>({
    pull(controle) {
      if (proxima >= linhas) {
        controle.close()
        return
      }
      controle.enqueue(linhaDoVideo(sql, id.hash, proxima))
      proxima += 1
    },
  })
  return new Response(corpo, { headers: { 'content-type': tipo, 'content-length': String(tamanho), ...CABECALHOS_DO_VIDEO } })
}
