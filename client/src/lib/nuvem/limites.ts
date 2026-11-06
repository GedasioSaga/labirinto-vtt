import { CHAT_SEND_BURST, CHAT_SEND_MIN_INTERVAL_MS, takeChatTurn } from '../chat'
import { TETOS_DO_CAMINHO, type NomeDaRegra } from './caminho'
import { CONTA_DO_MESTRE } from './tipos'

/**
 * LIMITES (docs/planos/lobby-jogadores-2026-11-05.md §6.5), aplicados pelo
 * DO. Números iniciais, ajustáveis só aqui. Cota estourada e ritmo ADIAM a op
 * (`adiado`, a fila reenvia sozinha com o mesmo `opId`): nunca a negam e
 * nunca contam como violação.
 *
 * O dia da cota é o dia UTC (o DO roda em UTC): numa sessão que passa das
 * 21 h de Brasília, a conta recomeça no meio — a favor da mesa.
 */

const KIB = 1024
const MIB = 1024 * KIB
const DIA_MS = 86_400_000

export const LIMITES = {
  /** Por conta de jogador, por dia. O mestre (e o Service Token, que é ele) não tem teto por conta. */
  opsPorDiaDaConta: 2000,
  bytesPorDiaDaConta: 5 * MIB,
  /** Por campanha, por dia: ~1,8× a estimativa da §7 (12 contas); no teto, ~62.500 das 100.000 linhas gravadas do dia. Vale também para o mestre. */
  opsPorDiaDaCampanha: 10_000,
  frameBytes: 64 * KIB,
  opsPorLote: 50,
  /** Teto da op no fio, sempre abaixo do frame; o caminho de teto maior (ficha, cartão) ganha o dele + o envelope. */
  opBytes: 24 * KIB,
  envelopeBytes: 2 * KIB,
  socketsPorConta: 3,
  /** 3 por conta × 12 contas (1 mestre + 11 jogadores, §7). */
  socketsPorCampanha: 36,
  /** Violação = frame malformado ou op negada por regra; nunca `adiado`. */
  violacoesAteFechar: 20,
  bloqueioDepoisDasViolacoesMs: 5 * 60_000,
} as const

/** Contadores de uma chave de `cotas` (§4.5). `paceAt` = relógio do ritmo (GCRA), persistido para sobreviver à hibernação. */
export interface Cota {
  ops: number
  bytes: number
  negadas: number
  paceAt?: number
}

const COTA_VAZIA: Cota = { ops: 0, bytes: 0, negadas: 0 }

/** 'AAAA-MM-DD' do dia UTC. */
export function diaDaCota(quando: number): string {
  return new Date(quando).toISOString().slice(0, 10)
}

export function chaveDaCotaDaConta(contaId: string, quando: number): string {
  return `conta:${contaId}:${diaDaCota(quando)}`
}

export function chaveDaCotaDaCampanha(quando: number): string {
  return `campanha:${diaDaCota(quando)}`
}

/** Quando a cota do dia volta: o começo do dia UTC seguinte. */
export function inicioDoDiaSeguinte(quando: number): number {
  return (Math.floor(quando / DIA_MS) + 1) * DIA_MS
}

export function temTetoPorConta(contaId: string): boolean {
  return contaId !== CONTA_DO_MESTRE
}

export type ConferenciaDaCota = { ok: true } | { ok: false; motivo: 'cota'; tentarDepoisDe: number }

/** Cabe mais uma op de `bytes` hoje? Conta de jogador: ops e bytes do dia; campanha: ops do dia. */
export function cabeNaCota(daConta: Cota | undefined, daCampanha: Cota | undefined, contaId: string, bytes: number, agora: number): ConferenciaDaCota {
  const conta = daConta ?? COTA_VAZIA
  const campanha = daCampanha ?? COTA_VAZIA
  const contaCheia = temTetoPorConta(contaId) && (conta.ops + 1 > LIMITES.opsPorDiaDaConta || conta.bytes + bytes > LIMITES.bytesPorDiaDaConta)
  if (contaCheia || campanha.ops + 1 > LIMITES.opsPorDiaDaCampanha) return { ok: false, motivo: 'cota', tentarDepoisDe: inicioDoDiaSeguinte(agora) }
  return { ok: true }
}

export function comOpContada(cota: Cota | undefined, bytes: number): Cota {
  const atual = cota ?? COTA_VAZIA
  return { ...atual, ops: atual.ops + 1, bytes: atual.bytes + bytes }
}

/** Op negada vira só contador, sem payload (§4.5): não dá escrita grátis a quem não tem permissão. */
export function comNegadaContada(cota: Cota | undefined): Cota {
  const atual = cota ?? COTA_VAZIA
  return { ...atual, negadas: atual.negadas + 1 }
}

export type ConferenciaDoRitmo = { ok: true; paceAt: number } | { ok: false; motivo: 'ritmo'; tentarDepoisDe: number }

/**
 * Ritmo por conta, em TODO frame (não só envio de op), pelo GCRA do chat
 * (`takeChatTurn`). Frame de ops recusado vira `adiado` em cada op.
 */
export function conferirRitmo(paceAt: number | undefined, agora: number): ConferenciaDoRitmo {
  const novo = takeChatTurn(paceAt, agora)
  if (novo !== null) return { ok: true, paceAt: novo }
  // `takeChatTurn` só recusa com o relógio à frente de `agora`, então aqui ele existe.
  const relogio = paceAt === undefined ? agora : paceAt
  return { ok: false, motivo: 'ritmo', tentarDepoisDe: relogio - (CHAT_SEND_BURST - 1) * CHAT_SEND_MIN_INTERVAL_MS }
}

/** O teto do valor no caminho, quando passa do teto da op (§4.7): a ficha inteira, o cartão e o bloco Dragon Ball. */
function tetoDoValor(regra: NomeDaRegra): number {
  switch (regra) {
    case 'ficha':
    case 'dbt':
    case 'npcDoDbt':
      return TETOS_DO_CAMINHO.docBytes
    case 'cartao':
    case 'campoDoCartao':
      return TETOS_DO_CAMINHO.cartaoBytes
    default:
      return 0
  }
}

/** O maior tamanho da op inteira no fio (JSON), para o caminho dela. */
export function tetoDaOpEmBytes(regra: NomeDaRegra): number {
  return Math.max(LIMITES.opBytes, tetoDoValor(regra) + LIMITES.envelopeBytes)
}
