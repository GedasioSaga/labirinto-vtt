/**
 * Catálogo das transições especiais. Nova transição = uma entrada aqui e um
 * arquivo em `cenas/` registrado em `motor.ts`.
 *
 * Este arquivo não importa `three`: o editor, o disco e a rede validam ids e
 * leem nomes sem baixar a biblioteca 3D.
 */

export const TRANSICAO_IDS = ['porta', 'escada-pedra'] as const
export type TransicaoId = (typeof TRANSICAO_IDS)[number]

export interface TransicaoInfo {
  id: TransicaoId
  nome: string
  /** Duração da animação inteira, em segundos, quando o mestre não escolhe outra. */
  duracaoNaturalS: number
  /** Momento (em segundos da cena) usado como miniatura na galeria. */
  quadroDaMiniaturaS: number
}

export const TRANSICOES: readonly TransicaoInfo[] = [
  { id: 'porta', nome: 'Porta rangendo', duracaoNaturalS: 7.2, quadroDaMiniaturaS: 3.6 },
  { id: 'escada-pedra', nome: 'Escadaria de pedra', duracaoNaturalS: 11.7, quadroDaMiniaturaS: 4 },
]

/** Teto da duração escolhida pelo mestre: rápida demais vira piscada, longa demais prende o jogador. */
export const TRANSICAO_DURACAO_MIN_S = 2
export const TRANSICAO_DURACAO_MAX_S = 30

/** O que fica gravado no pino de viagem e na escada. */
export interface TransicaoEscolhida {
  id: TransicaoId
  /** Ausente = animação inteira, na duração natural. */
  duracaoS?: number
}

export function isTransicaoId(valor: unknown): valor is TransicaoId {
  return typeof valor === 'string' && (TRANSICAO_IDS as readonly string[]).includes(valor)
}

export function transicaoInfo(id: TransicaoId): TransicaoInfo {
  const info = TRANSICOES.find((t) => t.id === id)
  if (!info) throw new Error(`transição desconhecida: ${id}`)
  return info
}

export function isDuracaoValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= TRANSICAO_DURACAO_MIN_S && valor <= TRANSICAO_DURACAO_MAX_S
}

/**
 * Lê uma transição vinda do disco ou da rede. Id fora do catálogo = sem
 * transição; duração fora do teto cai e fica a natural.
 */
export function parseTransicao(valor: unknown): TransicaoEscolhida | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  const { id, duracaoS } = valor as { id?: unknown; duracaoS?: unknown }
  if (!isTransicaoId(id)) return undefined
  return isDuracaoValida(duracaoS) ? { id, duracaoS } : { id }
}

/** Duração que de fato toca, em segundos. */
export function duracaoEfetivaS(escolha: TransicaoEscolhida): number {
  return escolha.duracaoS ?? transicaoInfo(escolha.id).duracaoNaturalS
}
