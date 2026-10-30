import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { NOME_DA_EQUIPE_MAX } from '../lib/batalha/equipes'
import { AUTOR_NO_REGISTRO_MAX, REGISTRO_PARA_JOGADOR_MAX, REGISTRO_TEXTO_MAX, type LinhaParaJogador } from '../lib/batalha/registro'
import { lerRegrasDaBatalha, type RegrasDaBatalha } from '../lib/batalha/regrasDoCampo'
import type { DuracaoDaExtra } from '../lib/batalha/turnos'
import {
  CARTAS_PARA_JOGADOR_MAX,
  NOME_NA_CARTA_MAX,
  type CartaParaJogador,
  type EstadoParaJogador,
  type LadoNaCarta,
} from '../lib/batalha/vistaDoJogador'

/**
 * BATALHA ONE PIECE, F1 (seção 3 de docs/planos/batalha-one-piece-f1-plano.md):
 * as mensagens da ordem dos turnos entre o jogador e o host, e a validação de
 * fronteira de cada uma.
 *
 * Do jogador para o host — os ÚNICOS pedidos de batalha que passam pela rede
 * (tudo o mais é ação local do mestre na store):
 *  - `batalha.passar`: "Passar a vez", com a carta e a rodada que ele viu;
 *  - `batalha.desfazer`: Desfazer uma linha do registro.
 * O host confere o resto (é a vez dele? a linha é dele?) e responde só
 * `ok: false`, sem motivo: motivo ensinaria ids.
 *
 * Do host para o jogador:
 *  - `batalha.estado`: o recorte dele (`vistaParaJogador`), só quando muda;
 *    `null` uma vez ao sair da batalha ou da cena;
 *  - `batalha.aliados`: os personagens dos aliados (perfil e vida), sem `dono`;
 *  - `batalha.resultado`: a resposta a cada pedido, pelo `reqId`.
 *
 * Entrada é hostil dos dois lados: campo torto derruba a mensagem inteira. O
 * host já corta nomes e textos no teto (`vistaDoJogador.ts`, `registro.ts`),
 * então acima do teto aqui é mensagem forjada.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui: o ciclo entre os
 * dois deixaria um deles meio carregado conforme a ordem de import.
 */

/** Mesmo teto de `REQ_ID_MAX_LENGTH` (protocol.ts). */
const REQ_ID_MAX = 64
/** Ids de carta, linha e token no fio. */
export const ID_DA_BATALHA_MAX = 80
/** Id de personagem: o mesmo teto de `PERSONAGEM_ID_MAX` (protocoloDoPersonagem.ts). */
const PERSONAGEM_ID_MAX = 128
export const RODADA_MAX = 100_000
/** Pedidos de batalha por jogador dentro da janela; o resto morre calado. */
export const PEDIDOS_DE_BATALHA_POR_JANELA = 10
export const JANELA_DOS_PEDIDOS_DE_BATALHA_MS = 5_000
/** Personagens num `batalha.aliados`: uma mesa não chega perto. */
export const ALIADOS_MAX = 64
const COR_HEX = /^#[0-9a-f]{6}$/i

export interface BatalhaPassarMessage {
  type: 'batalha.passar'
  reqId: string
  cartaId: string
  rodada: number
}

export interface BatalhaDesfazerMessage {
  type: 'batalha.desfazer'
  reqId: string
  linhaId: string
}

/** Os pedidos de batalha do jogador (entram na união `PlayerMessage`). */
export type BatalhaPlayerMessage = BatalhaPassarMessage | BatalhaDesfazerMessage

export interface BatalhaEstadoMessage {
  type: 'batalha.estado'
  estado: EstadoParaJogador | null
}

export interface BatalhaAliadosMessage {
  type: 'batalha.aliados'
  personagens: Personagem[]
}

export interface BatalhaResultadoMessage {
  type: 'batalha.resultado'
  reqId: string
  ok: boolean
}

/** As mensagens de batalha do host (entram na união `HostMessage`). */
export type BatalhaHostMessage = BatalhaEstadoMessage | BatalhaAliadosMessage | BatalhaResultadoMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoAte(value: unknown, minimo: number, maximo: number): value is string {
  return typeof value === 'string' && value.length >= minimo && value.length <= maximo
}

function inteiroAte(value: unknown, minimo: number, maximo: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimo && value <= maximo
}

function idOuNulo(value: unknown): value is string | null {
  return value === null || textoAte(value, 1, ID_DA_BATALHA_MAX)
}

// ---- jogador → host ----

export function parseBatalhaPassar(value: unknown): BatalhaPassarMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.passar') return null
  const { reqId, cartaId, rodada } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || !textoAte(cartaId, 1, ID_DA_BATALHA_MAX) || !inteiroAte(rodada, 1, RODADA_MAX)) return null
  return { type: 'batalha.passar', reqId, cartaId, rodada }
}

export function parseBatalhaDesfazer(value: unknown): BatalhaDesfazerMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.desfazer') return null
  const { reqId, linhaId } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || !textoAte(linhaId, 1, ID_DA_BATALHA_MAX)) return null
  return { type: 'batalha.desfazer', reqId, linhaId }
}

// ---- host → jogador ----

function lerLado(value: unknown): LadoNaCarta | null {
  return value === 'eu' || value === 'aliado' || value === 'outro' ? value : null
}

function lerDuracao(value: unknown): DuracaoDaExtra | null {
  return value === 'rodada' || value === 'sempre' ? value : null
}

function lerCarta(value: unknown): CartaParaJogador | null {
  if (!isRecord(value)) return null
  const { id, tokenId, nome, lado, equipe, personagemId, extra, caiu } = value
  const ladoLido = lerLado(lado)
  if (!textoAte(id, 1, ID_DA_BATALHA_MAX) || !textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(nome, 0, NOME_NA_CARTA_MAX) || ladoLido === null) return null
  const carta: CartaParaJogador = { id, tokenId, nome, lado: ladoLido }
  if (equipe !== undefined) {
    if (!isRecord(equipe) || !textoAte(equipe.nome, 1, NOME_DA_EQUIPE_MAX) || typeof equipe.cor !== 'string' || !COR_HEX.test(equipe.cor)) return null
    carta.equipe = { nome: equipe.nome, cor: equipe.cor }
  }
  // Perfil e queda só nas cartas dele e dos aliados: na de "outro", é mensagem forjada.
  if (personagemId !== undefined) {
    if (ladoLido === 'outro' || !textoAte(personagemId, 1, PERSONAGEM_ID_MAX)) return null
    carta.personagemId = personagemId
  }
  if (extra !== undefined) {
    const duracao = lerDuracao(extra)
    if (duracao === null) return null
    carta.extra = duracao
  }
  if (caiu !== undefined) {
    if (caiu !== true || ladoLido === 'outro') return null
    carta.caiu = true
  }
  return carta
}

function lerLinha(value: unknown): LinhaParaJogador | null {
  if (!isRecord(value)) return null
  const { id, rodada, autor, texto, desfeita, podeDesfazer } = value
  if (!textoAte(id, 1, ID_DA_BATALHA_MAX) || !inteiroAte(rodada, 1, RODADA_MAX)) return null
  if (!textoAte(autor, 1, AUTOR_NO_REGISTRO_MAX) || !textoAte(texto, 0, REGISTRO_TEXTO_MAX) || typeof podeDesfazer !== 'boolean') return null
  const linha: LinhaParaJogador = { id, rodada, autor, texto, podeDesfazer }
  if (desfeita !== undefined) {
    if (!isRecord(desfeita) || !textoAte(desfeita.por, 1, AUTOR_NO_REGISTRO_MAX)) return null
    linha.desfeita = { por: desfeita.por }
  }
  return linha
}

/** Lista do fio, item a item; um item torto ou lista acima do teto recusa tudo. */
function lerLista<T>(value: unknown, maximo: number, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > maximo) return null
  const lidos: T[] = []
  for (const item of value) {
    const lido = ler(item)
    if (lido === null) return null
    lidos.push(lido)
  }
  return lidos
}

/** O recorte inteiro. A vez e a próxima, quando há, têm de ser cartas da lista. */
export function lerEstadoParaJogador(value: unknown): EstadoParaJogador | null {
  if (!isRecord(value)) return null
  const { rodada, turno, vez, proxima, minhaVez, vezForaDaVista, cartas, registro, regras } = value
  if (!inteiroAte(rodada, 1, RODADA_MAX) || !isRecord(turno)) return null
  const { n, m } = turno
  if (!inteiroAte(m, 0, CARTAS_PARA_JOGADOR_MAX) || !inteiroAte(n, 0, m)) return null
  if (!idOuNulo(vez) || !idOuNulo(proxima) || typeof minhaVez !== 'boolean' || typeof vezForaDaVista !== 'boolean') return null
  const cartasLidas = lerLista(cartas, CARTAS_PARA_JOGADOR_MAX, lerCarta)
  const linhas = lerLista(registro, REGISTRO_PARA_JOGADOR_MAX, lerLinha)
  if (cartasLidas === null || linhas === null) return null
  const ids = new Set(cartasLidas.map((carta) => carta.id))
  if ((vez !== null && !ids.has(vez)) || (proxima !== null && !ids.has(proxima))) return null
  let regrasLidas: RegrasDaBatalha | null = null
  if (regras !== null) {
    regrasLidas = lerRegrasDaBatalha(regras)
    if (regrasLidas === null) return null
  }
  return { rodada, turno: { n, m }, vez, proxima, minhaVez, vezForaDaVista, cartas: cartasLidas, registro: linhas, regras: regrasLidas }
}

export function parseBatalhaEstado(value: unknown): BatalhaEstadoMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.estado' || !('estado' in value)) return null
  if (value.estado === null) return { type: 'batalha.estado', estado: null }
  const estado = lerEstadoParaJogador(value.estado)
  return estado === null ? null : { type: 'batalha.estado', estado }
}

/** Personagem torto sai sozinho (como no `personagens`); a lista que não é lista, ou acima do teto, recusa. */
export function parseBatalhaAliados(value: unknown): BatalhaAliadosMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.aliados') return null
  if (!Array.isArray(value.personagens) || value.personagens.length > ALIADOS_MAX) return null
  const personagens = value.personagens.map(personagemDoArquivo).filter((p): p is Personagem => p !== null)
  return { type: 'batalha.aliados', personagens }
}

export function parseBatalhaResultado(value: unknown): BatalhaResultadoMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.resultado') return null
  const { reqId, ok } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || typeof ok !== 'boolean') return null
  return { type: 'batalha.resultado', reqId, ok }
}
