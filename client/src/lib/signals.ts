/**
 * Regras do sinal de mapa (ping do jogador), compartilhadas por mestre e
 * jogador. Tempos em ms e distâncias em px de tela.
 */

/** Quanto tempo um sinal fica desenhado, no mestre e no jogador. */
export const SIGNAL_TTL_MS = 3000
/** Intervalo mínimo entre dois sinais aceitos do mesmo jogador. */
export const SIGNAL_MIN_INTERVAL_MS = 1000
/** Segurar o ponteiro parado por esse tempo dispara o sinal no jogador. */
export const SIGNAL_LONG_PRESS_MS = 500
/** Movimento acima disto cancela o "segurar parado" (vira arrasto de câmera). */
export const SIGNAL_LONG_PRESS_TOLERANCE_PX = 6
/** Teto de sinais simultâneos na tela: o limite por jogador já segura o fluxo, isto só protege a memória. */
export const MAX_ACTIVE_SIGNALS = 32

/** Mesmos tons da lista de atribuir (legíveis no tema escuro), aqui por jogador. */
export const SIGNAL_COLORS: readonly string[] = ['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8', '#4dd0e1', '#ff8a65', '#a1887f']

/** Cor estável por jogador (hash do id): o mesmo jogador sinaliza sempre com a mesma cor. */
export function signalColor(playerId: string): string {
  let hash = 0
  for (let i = 0; i < playerId.length; i += 1) hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0
  return SIGNAL_COLORS[hash % SIGNAL_COLORS.length]
}

export const SIGNAL_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/** Sinal pronto para desenhar: posição em px de mundo e instante em que chegou (`Date.now`). */
export interface SignalMark {
  id: string
  x: number
  y: number
  name: string
  color: string
  createdAt: number
}
