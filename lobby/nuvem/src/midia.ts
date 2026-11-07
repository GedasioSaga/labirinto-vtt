import { ErroDoPedido, json, naoExiste } from './http'
import { ErroDoBanco, numero, texto, type Linha } from './linhas'
import { hashHex, MIDIA_MAX_BYTES, tipoDosBytes, type TipoDeMidia } from './nucleo'
import { KIB, MIB } from './pedidos'

/**
 * MÍDIA DA CAMPANHA (plano §6.6, fatia W3): a imagem que a ficha cita como
 * `midia:<sha256>.<ext>` mora no DO Campanha, endereçada pelo próprio hash.
 *
 * - PUT confere o tamanho (≤ 2 MiB, lendo o corpo com teto, sem confiar no
 *   `content-length`), o tipo pela ASSINATURA dos bytes contra a extensão do
 *   endereço (`tipoDosBytes`, a mesma regra do app e do Rust; nunca SVG) e o
 *   sha256 contra o hash do endereço. Grava em pedaços de 512 KiB (o teto de
 *   linha/BLOB do SQLite do DO não foi confirmado, §7) e confere o teto de
 *   300 MB da campanha, tudo num `transactionSync` só.
 * - O mesmo id de novo não relê nem regrava nada: o conteúdo já conferido é
 *   o mesmo, porque o endereço é o hash dele.
 * - GET devolve a imagem com cache imutável e privado, `nosniff` e uma CSP
 *   que não deixa o arquivo virar página, mesmo aberto direto na aba.
 *
 * Quem pode fazer o quê (na v1 só o app do mestre sobe; todo membro baixa)
 * é conferido pelo DO Campanha antes de chamar este arquivo. A exceção é a
 * foto de perfil (`fotoDePerfil.ts`): cada membro sobe a PRÓPRIA, por uma
 * rota só dela, com teto e ritmo próprios, e grava aqui com `enviadoPor` =
 * `perfil:<contaId>`. Só essa mídia é apagada quando a foto troca; se o
 * mestre sobe os mesmos bytes para uma ficha, ela passa a ser dele e fica.
 */

const PEDACO_BYTES = 512 * KIB
const MIDIA_MAX_POR_CAMPANHA = 300 * MIB

const TIPO_DO_CONTEUDO: Record<TipoDeMidia, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
}

const CABECALHOS_DA_IMAGEM: Readonly<Record<string, string>> = {
  'cache-control': 'private, max-age=31536000, immutable',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; sandbox",
}

export interface IdDaMidia {
  hash: string
  tipo: TipoDeMidia
}

interface MetaDaMidia {
  tipo: string
  tamanho: number
  partes: number
  enviadoPor: string
}

/** O `enviadoPor` da mídia que é foto de perfil: só ela some quando a foto troca. */
export const PREFIXO_DO_PERFIL = 'perfil:'

const FORMA_DO_ID = /^([0-9a-f]{64})\.(webp|png|jpg|gif)$/

function tipoDaExtensao(extensao: string): TipoDeMidia | null {
  switch (extensao) {
    case 'webp':
    case 'png':
    case 'jpg':
    case 'gif':
      return extensao
    default:
      return null
  }
}

/** O id da rota, de novo na forma exata (a rota já confere; aqui é a segunda parede). Fora dela = "não existe". */
function lerIdDaMidia(midiaId: string): IdDaMidia {
  const achado = FORMA_DO_ID.exec(midiaId)
  const tipo = achado === null ? null : tipoDaExtensao(achado[2])
  if (achado === null || tipo === null) throw new ErroDoPedido(404, 'nao-existe', 'Não existe')
  return { hash: achado[1], tipo }
}

export function metaDaMidia(sql: SqlStorage, hash: string): MetaDaMidia | undefined {
  for (const linha of sql.exec('SELECT tipo, tamanho, partes, enviadoPor FROM midia_meta WHERE hash = ?', hash)) {
    return { tipo: texto(linha, 'tipo'), tamanho: numero(linha, 'tamanho'), partes: numero(linha, 'partes'), enviadoPor: texto(linha, 'enviadoPor') }
  }
  return undefined
}

/** A mídia que era só foto de perfil passa a ser de quem subiu os mesmos bytes por outro caminho: não some mais com a foto. */
function adotarSeForFoto(sql: SqlStorage, hash: string, enviadoPor: string): void {
  const meta = metaDaMidia(sql, hash)
  if (meta === undefined || !meta.enviadoPor.startsWith(PREFIXO_DO_PERFIL) || enviadoPor.startsWith(PREFIXO_DO_PERFIL)) return
  sql.exec('UPDATE midia_meta SET enviadoPor = ? WHERE hash = ?', enviadoPor, hash)
}

/** Apaga a mídia inteira (pedaços e meta). Chamar dentro de `transactionSync`. */
export function apagarMidia(sql: SqlStorage, hash: string): void {
  sql.exec('DELETE FROM midia WHERE hash = ?', hash)
  sql.exec('DELETE FROM midia_meta WHERE hash = ?', hash)
}

function bytesDaCampanha(sql: SqlStorage): number {
  for (const linha of sql.exec('SELECT COALESCE(SUM(tamanho), 0) AS total FROM midia_meta')) return numero(linha, 'total')
  return 0
}

function blob(linha: Linha, coluna: string): ArrayBuffer {
  const valor = linha[coluna]
  if (!(valor instanceof ArrayBuffer)) throw new ErroDoBanco(`coluna ${coluna} sem bytes`)
  return valor
}

const grandeDemais = (): ErroDoPedido => new ErroDoPedido(413, 'midia-grande', `A imagem passa de ${MIDIA_MAX_BYTES / MIB} MiB`)

/** O corpo inteiro, parando assim que passa do teto (o `content-length` pode mentir ou faltar). `grandeDemais` = o erro de quem passou. */
export async function lerBytesComTeto(request: Request, teto: number, grandeDemais: () => ErroDoPedido): Promise<Uint8Array> {
  const declarado = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > teto) throw grandeDemais()
  if (request.body === null) return new Uint8Array(0)
  const leitor = request.body.getReader()
  const pedacos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    if (!(value instanceof Uint8Array)) {
      await leitor.cancel()
      throw new ErroDoPedido(400, 'corpo-invalido', 'Corpo do pedido fora do formato')
    }
    total += value.byteLength
    if (total > teto) {
      await leitor.cancel()
      throw grandeDemais()
    }
    pedacos.push(value)
  }
  const bytes = new Uint8Array(total)
  let posicao = 0
  for (const pedaco of pedacos) {
    bytes.set(pedaco, posicao)
    posicao += pedaco.byteLength
  }
  return bytes
}

/** Grava a imagem já conferida. Chamar dentro de `transactionSync`: o teto estourado no meio desfaz tudo. `false` = já existia. */
export function gravarMidia(sql: SqlStorage, id: IdDaMidia, bytes: Uint8Array, enviadoPor: string, agora: number): boolean {
  // Outro PUT do mesmo id pode ter gravado enquanto este lia o corpo.
  if (metaDaMidia(sql, id.hash) !== undefined) {
    adotarSeForFoto(sql, id.hash, enviadoPor)
    return false
  }
  if (bytesDaCampanha(sql) + bytes.byteLength > MIDIA_MAX_POR_CAMPANHA) {
    throw new ErroDoPedido(413, 'campanha-cheia', `As imagens desta campanha passariam de ${MIDIA_MAX_POR_CAMPANHA / MIB} MB`)
  }
  const partes = Math.ceil(bytes.byteLength / PEDACO_BYTES)
  for (let parte = 0; parte < partes; parte += 1) {
    // `slice` copia o pedaço num ArrayBuffer só dele, do tamanho exato (o BLOB do SQLite do DO é um ArrayBuffer).
    const pedaco = bytes.slice(parte * PEDACO_BYTES, (parte + 1) * PEDACO_BYTES)
    sql.exec('INSERT INTO midia (hash, parte, bytes) VALUES (?, ?, ?)', id.hash, parte, pedaco.buffer)
  }
  sql.exec(
    'INSERT INTO midia_meta (hash, tipo, tamanho, partes, enviadoPor, quando) VALUES (?, ?, ?, ?, ?, ?)',
    id.hash,
    id.tipo,
    bytes.byteLength,
    partes,
    enviadoPor,
    agora,
  )
  return true
}

/** PUT `/api/c/:id/midia/:midiaId`: confere tamanho, tipo pelos bytes e sha256, e grava em pedaços. */
export async function receberMidia(request: Request, storage: DurableObjectStorage, midiaId: string, enviadoPor: string): Promise<Response> {
  const id = lerIdDaMidia(midiaId)
  // Já gravada com este id: nada a ler. O mesmo hash com outra extensão segue e cai no tipo pelos bytes.
  if (metaDaMidia(storage.sql, id.hash)?.tipo === id.tipo) {
    storage.transactionSync(() => adotarSeForFoto(storage.sql, id.hash, enviadoPor))
    return json({ id: midiaId, novo: false })
  }
  const bytes = await lerBytesComTeto(request, MIDIA_MAX_BYTES, grandeDemais)
  if (tipoDosBytes(bytes) !== id.tipo) {
    throw new ErroDoPedido(400, 'tipo-errado', `O conteúdo não é uma imagem ${id.tipo} (aceitas: webp, png, jpg, gif)`)
  }
  if ((await hashHex(bytes)) !== id.hash) throw new ErroDoPedido(400, 'hash-errado', 'O conteúdo não confere com o hash do endereço')
  const novo = storage.transactionSync(() => gravarMidia(storage.sql, id, bytes, enviadoPor, Date.now()))
  return json({ id: midiaId, tamanho: bytes.byteLength, novo })
}

/** GET `/api/c/:id/midia/:midiaId`: a imagem remontada dos pedaços, com os cabeçalhos da §6.6. */
export function servirMidia(sql: SqlStorage, midiaId: string): Response {
  const id = lerIdDaMidia(midiaId)
  const meta = metaDaMidia(sql, id.hash)
  if (meta === undefined || meta.tipo !== id.tipo) return naoExiste()
  const bytes = new Uint8Array(meta.tamanho)
  let posicao = 0
  let lidas = 0
  for (const linha of sql.exec('SELECT bytes FROM midia WHERE hash = ? ORDER BY parte', id.hash)) {
    const pedaco = new Uint8Array(blob(linha, 'bytes'))
    if (posicao + pedaco.byteLength > meta.tamanho) throw new ErroDoBanco(`mídia ${id.hash} maior que o tamanho gravado`)
    bytes.set(pedaco, posicao)
    posicao += pedaco.byteLength
    lidas += 1
  }
  if (posicao !== meta.tamanho || lidas !== meta.partes) throw new ErroDoBanco(`mídia ${id.hash} com pedaço faltando`)
  return new Response(bytes, { headers: { 'content-type': TIPO_DO_CONTEUDO[id.tipo], ...CABECALHOS_DA_IMAGEM } })
}
