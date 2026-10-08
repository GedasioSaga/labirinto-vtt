import { catalogosDoArquivo, livroDoArquivo, type CapituloDoLivro, type CatalogosDoSistema, type SistemaDeRpg } from '../lib/sistemaDeRpg'

/**
 * LIVRO DE REGRAS NA MESA (entrega 3 dos sistemas de RPG): como o livro do
 * sistema chega à tela do jogador.
 *
 * Por que à parte e só sob pedido: o sistema vai inteiro em `rpg.sistema` a
 * cada conexão (entrega 2), e o `rpg.sistema` do One Piece sem livro tem ~3 KB
 * de JSON. Com o livro e os catálogos são ~127 KB (74 mil caracteres de regra,
 * 140 itens de catálogo): junto, cada conexão de cada jogador levaria 40 vezes
 * mais, quase sempre para nada — e uma mensagem só passaria do teto de 64 KiB que o
 * servidor da mesa usa para a mensagem do jogador. Então `rpg.sistema` leva o
 * sistema SEM livro e um resumo (`ResumoDoLivro`), e o livro vai quando o
 * jogador abre o "Livro" ou o "Escolher do livro": em partes de até
 * `LIVRO_PARTE_BYTES` (48 KiB) — 3 mensagens para o One Piece.
 *
 *  - jogador → host: `livro.pedir` (o sistema que ele tem, pelo id);
 *  - host → jogador: `livro.parte` × total (pedaços do mesmo texto JSON, em
 *    ordem ou não), ou `livro.recusa` (a mesma para todo motivo).
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */

/** Teto do texto de cada parte, em bytes UTF-8 já dentro da string JSON: a mensagem inteira fica bem abaixo de 64 KiB. */
export const LIVRO_PARTE_BYTES = 48 * 1024
/**
 * Partes de um livro. 64 × 48 KiB = 3 MiB, folgado para os tetos do formato
 * (`LIVRO_TEXTO_TOTAL_MAX` + `CATALOGOS_TEXTO_TOTAL_MAX`); livro maior que
 * isso o host recusa, em vez de encher a fila de saída do jogador.
 */
export const LIVRO_PARTES_MAX = 64
/** Mesmo teto de `REQ_ID_MAX_LENGTH` (protocol.ts) para o id do pedido; o do sistema é o de `idValido` (64). */
const ID_MAX = 64

export interface LivroPedirMessage {
  type: 'livro.pedir'
  reqId: string
  /** O sistema que a tela do jogador tem: pedido de um sistema que já mudou é recusado. */
  sistemaId: string
}

export interface LivroParteMessage {
  type: 'livro.parte'
  reqId: string
  indice: number
  total: number
  texto: string
}

export interface LivroRecusaMessage {
  type: 'livro.recusa'
  reqId: string
}

export type LivroPlayerMessage = LivroPedirMessage
export type LivroHostMessage = LivroParteMessage | LivroRecusaMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoEntre(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

export function parseLivroPedir(obj: Record<string, unknown>): LivroPedirMessage | null {
  const { reqId, sistemaId } = obj
  if (!textoEntre(reqId, 1, ID_MAX) || !textoEntre(sistemaId, 1, ID_MAX)) return null
  return { type: 'livro.pedir', reqId, sistemaId }
}

/** No jogador: parte com índice fora do total, total acima do teto ou texto maior que a parte cabe é recusada. */
export function parseLivroParte(value: unknown): LivroParteMessage | null {
  if (!isRecord(value) || value.type !== 'livro.parte') return null
  const { reqId, indice, total, texto } = value
  if (!textoEntre(reqId, 1, ID_MAX) || typeof indice !== 'number' || typeof total !== 'number') return null
  if (!Number.isSafeInteger(total) || total < 1 || total > LIVRO_PARTES_MAX) return null
  if (!Number.isSafeInteger(indice) || indice < 0 || indice >= total) return null
  // Cada caractere ocupa ao menos 1 byte: mais caracteres que o teto de bytes não é parte que o host mandaria.
  if (!textoEntre(texto, 0, LIVRO_PARTE_BYTES)) return null
  return { type: 'livro.parte', reqId, indice, total, texto }
}

export function parseLivroRecusa(value: unknown): LivroRecusaMessage | null {
  if (!isRecord(value) || value.type !== 'livro.recusa' || !textoEntre(value.reqId, 1, ID_MAX)) return null
  return { type: 'livro.recusa', reqId: value.reqId }
}

/**
 * Bytes que o caractere (um code point, como o `for…of` entrega) ocupa
 * dentro de uma string JSON em UTF-8: par substituto inteiro são 4; aspas e
 * barra ganham escape (2); controle vira `\n` (2) ou `\u00XX` (6); metade
 * solta de par substituto vira `\udXXX` (6); o resto é o UTF-8 dele.
 */
function bytesNoJson(caractere: string): number {
  if (caractere.length === 2) return 4
  const codigo = caractere.charCodeAt(0)
  if (codigo === 0x22 || codigo === 0x5c) return 2
  if (codigo === 0x08 || codigo === 0x09 || codigo === 0x0a || codigo === 0x0c || codigo === 0x0d) return 2
  if (codigo < 0x20) return 6
  if (codigo < 0x80) return 1
  if (codigo < 0x800) return 2
  if (codigo >= 0xd800 && codigo <= 0xdfff) return 6
  return 3
}

/**
 * Parte o texto em pedaços que, cada um como string JSON, ocupam no máximo
 * `limiteBytes`. Anda por caractere (code point), então nunca parte um emoji
 * ao meio. Juntar os pedaços devolve o texto.
 */
export function partirEmPartes(texto: string, limiteBytes = LIVRO_PARTE_BYTES): string[] {
  const partes: string[] = []
  let inicio = 0
  let bytes = 0
  let indice = 0
  for (const caractere of texto) {
    const custo = bytesNoJson(caractere)
    if (bytes + custo > limiteBytes && indice > inicio) {
      partes.push(texto.slice(inicio, indice))
      inicio = indice
      bytes = 0
    }
    bytes += custo
    indice += caractere.length
  }
  partes.push(texto.slice(inicio))
  return partes
}

/** O que viaja nas partes, como JSON: o livro e os catálogos de um sistema. */
interface PacoteDoLivro {
  sistemaId: string
  livro: CapituloDoLivro[]
  catalogos: CatalogosDoSistema | null
}

/** As partes do livro do sistema, no host; `null` = passa de `LIVRO_PARTES_MAX` (o host recusa). */
export function partesDoLivro(sistema: SistemaDeRpg): string[] | null {
  const pacote: PacoteDoLivro = { sistemaId: sistema.id, livro: sistema.livro ?? [], catalogos: sistema.catalogos ?? null }
  const partes = partirEmPartes(JSON.stringify(pacote))
  return partes.length > LIVRO_PARTES_MAX ? null : partes
}

/** As partes que já chegaram de um pedido. `total` só se sabe na primeira. */
export interface ChegadaDoLivro {
  reqId: string
  total: number | null
  partes: readonly (string | undefined)[]
}

export type PassoDaChegada = { tipo: 'faltando'; chegada: ChegadaDoLivro } | { tipo: 'completo'; texto: string } | { tipo: 'torto' } | { tipo: 'alheia' }

/**
 * Mais uma parte: de outro pedido é `alheia` (ignorar); com total diferente
 * do das outras é `torto` (o pedido falhou); a que já chegou repetida não
 * conta duas vezes. Com todas, o texto junto.
 */
export function receberParte(chegada: ChegadaDoLivro, msg: LivroParteMessage): PassoDaChegada {
  if (msg.reqId !== chegada.reqId) return { tipo: 'alheia' }
  if (chegada.total !== null && chegada.total !== msg.total) return { tipo: 'torto' }
  const partes = chegada.total === null ? Array.from<string | undefined>({ length: msg.total }) : [...chegada.partes]
  partes[msg.indice] = msg.texto
  if (partes.every((parte) => parte !== undefined)) return { tipo: 'completo', texto: partes.join('') }
  return { tipo: 'faltando', chegada: { reqId: chegada.reqId, total: msg.total, partes } }
}

/**
 * O livro que chegou, lido pelos MESMOS leitores do arquivo de sistema (tetos
 * e tudo): o host é de confiança, mas o texto do livro veio de um arquivo que
 * qualquer um escreveu. `null` = JSON quebrado ou livro de outro sistema.
 */
export function lerPacoteDoLivro(texto: string, sistema: SistemaDeRpg): { livro: CapituloDoLivro[]; catalogos: CatalogosDoSistema | undefined } | null {
  let lido: unknown
  try {
    lido = JSON.parse(texto)
  } catch {
    return null
  }
  if (!isRecord(lido) || lido.sistemaId !== sistema.id) return null
  return {
    livro: livroDoArquivo(lido.livro) ?? [],
    catalogos: catalogosDoArquivo(lido.catalogos, new Set(sistema.atributos.map((atributo) => atributo.id))),
  }
}
