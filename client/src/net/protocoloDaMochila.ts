import { ITEM_QUANTIDADE_MAX } from '../lib/leituraDoItem'

/**
 * A MOCHILA DO JOGADOR NA LAN (sistema de itens refeito, docs/design/itens-rework/PLANO.md, etapa E5):
 * o contrato entre a tela do jogador (E5a, `player/PlayerInventory.tsx`) e o host (E5b,
 * `net/hostSession.ts`). O jogador pede; o host confere tudo contra a ficha DELE e o Acervo (ficha
 * que é do jogador, vaga que está na mochila, o limite "Armas por batalha", a capacidade do pente,
 * a bala que a arma aceita, o colega encostado) e responde `mochila.resultado` só a quem pediu.
 * Deu certo: a mochila nova chega no recorte seguinte, como em todo pedido de item.
 *
 * - `mochila.equipar`: `equipado: true` equipa, `false` guarda (decisão 5; a roupa não conta no limite).
 * - `mochila.recarregar`: fora da batalha, na hora (decisão 2). Só as duas vagas: QUANTAS entram o
 *   host calcula pela capacidade do Acervo (`recarregarForaDaBatalha`, lib/mochila/armaNaMochila.ts);
 *   o jogador não sabe a capacidade quando a vaga não traz a regra. Bala de outro tipo no pente volta
 *   antes à mochila.
 * - `mochila.dar`: `quantidade` da vaga à ficha `paraTokenId` (colega encostado, ou NPC aliado). A
 *   arma vai vazia e guardada (A8).
 * - `mochila.largar`: `quantidade` da vaga no chão, ao lado da ficha. A arma vai vazia (A8).
 *
 * Aditivas: host antigo responde `error invalid_message` e a tela espera o teto
 * (`PEDIDO_DA_MOCHILA_ESPERA_MS`); jogador antigo nunca as envia. Entrada do jogador é hostil: este
 * parser confere só a forma e os tetos. Não importa `protocol.ts` (que pode importar daqui).
 */

export interface MochilaEquiparMessage {
  type: 'mochila.equipar'
  reqId: string
  /** A ficha (token) DELE dona da mochila. */
  tokenId: string
  vagaId: string
  /** `true` equipa; `false` guarda. */
  equipado: boolean
}

export interface MochilaRecarregarMessage {
  type: 'mochila.recarregar'
  reqId: string
  tokenId: string
  /** A vaga da arma (De fogo ou Híbrida). */
  armaVagaId: string
  /** A vaga da munição que entra no pente. */
  balaVagaId: string
}

export interface MochilaDarMessage {
  type: 'mochila.dar'
  reqId: string
  tokenId: string
  vagaId: string
  /** De 1 até o que a vaga tem. */
  quantidade: number
  paraTokenId: string
}

export interface MochilaLargarMessage {
  type: 'mochila.largar'
  reqId: string
  tokenId: string
  vagaId: string
  quantidade: number
}

export type MochilaPlayerMessage = MochilaEquiparMessage | MochilaRecarregarMessage | MochilaDarMessage | MochilaLargarMessage

/** O pedido como a tela o monta: a mensagem sem o `reqId`, que a conexão põe ao enviar. */
export type PedidoDaMochila =
  | Omit<MochilaEquiparMessage, 'reqId'>
  | Omit<MochilaRecarregarMessage, 'reqId'>
  | Omit<MochilaDarMessage, 'reqId'>
  | Omit<MochilaLargarMessage, 'reqId'>

/** A resposta a um pedido da mochila, só a quem pediu. `motivo` só na recusa: a frase que o jogador lê. */
export interface MochilaResultadoMessage {
  type: 'mochila.resultado'
  reqId: string
  ok: boolean
  motivo?: string
}

/** Quanto a tela espera o `mochila.resultado` antes de dizer que o mestre não respondeu. */
export const PEDIDO_DA_MOCHILA_ESPERA_MS = 10_000

/** Teto do `motivo` da recusa (a mesma régua do `item.usar.result`). */
export const MOCHILA_MOTIVO_MAX = 240

/** Teto dos ids que o jogador manda (vaga, ficha, pedido). */
const ID_MAX = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ehId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_MAX
}

function ehQuantidade(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= ITEM_QUANTIDADE_MAX
}

/** O pedido do jogador, campo a campo; qualquer campo torto recusa a mensagem inteira. */
export function parseMochilaPlayerMessage(value: unknown): MochilaPlayerMessage | null {
  if (!isRecord(value) || !ehId(value.reqId) || !ehId(value.tokenId)) return null
  const { reqId, tokenId } = value
  switch (value.type) {
    case 'mochila.equipar':
      return ehId(value.vagaId) && typeof value.equipado === 'boolean' ? { type: 'mochila.equipar', reqId, tokenId, vagaId: value.vagaId, equipado: value.equipado } : null
    case 'mochila.recarregar':
      return ehId(value.armaVagaId) && ehId(value.balaVagaId) && value.armaVagaId !== value.balaVagaId
        ? { type: 'mochila.recarregar', reqId, tokenId, armaVagaId: value.armaVagaId, balaVagaId: value.balaVagaId }
        : null
    case 'mochila.dar':
      return ehId(value.vagaId) && ehQuantidade(value.quantidade) && ehId(value.paraTokenId) && value.paraTokenId !== tokenId
        ? { type: 'mochila.dar', reqId, tokenId, vagaId: value.vagaId, quantidade: value.quantidade, paraTokenId: value.paraTokenId }
        : null
    case 'mochila.largar':
      return ehId(value.vagaId) && ehQuantidade(value.quantidade) ? { type: 'mochila.largar', reqId, tokenId, vagaId: value.vagaId, quantidade: value.quantidade } : null
    default:
      return null
  }
}

/** A resposta do host como o jogador a lê; fora de forma, `null` (a espera segue até o teto). O motivo sai aparado e cortado. */
export function parseMochilaResultado(value: unknown): MochilaResultadoMessage | null {
  if (!isRecord(value) || value.type !== 'mochila.resultado' || !ehId(value.reqId) || typeof value.ok !== 'boolean') return null
  if (value.ok) return { type: 'mochila.resultado', reqId: value.reqId, ok: true }
  const motivo = typeof value.motivo === 'string' ? value.motivo.trim().slice(0, MOCHILA_MOTIVO_MAX) : ''
  return { type: 'mochila.resultado', reqId: value.reqId, ok: false, ...(motivo !== '' ? { motivo } : {}) }
}
