import type { TokenHealth } from '../types/map'

/**
 * Teto de pontos de vida. Nenhuma ficha de mesa chega perto (o maior monstro
 * de livro passa pouco de 600); o teto só impede que um número colado sem
 * querer vire uma barra que nunca se mexe.
 */
export const HEALTH_LIMIT = 99_999

/**
 * Os três estados da barra são os do ECG do Resident Evil — Fine, Caution,
 * Danger —, o mesmo mundo visual do minimapa. O comprimento da barra já diz
 * quanto falta; a cor só destaca, de longe, quem está perto de cair.
 */
export type HealthState = 'fine' | 'caution' | 'danger'

/** Metade da vida ou menos: cuidado. */
export const HEALTH_CAUTION_AT = 0.5
/** Um quarto da vida ou menos: perigo. */
export const HEALTH_DANGER_AT = 0.25

/**
 * O que a barra desenha: atual e máximo. No mestre vem da ficha do sistema
 * (`lib/vidaDaFicha.ts`, em pontos); na tela do jogador, a proporção que o
 * recorte mandou em `Token.health` (em centésimos).
 */
export type HealthAmount = Pick<TokenHealth, 'current' | 'max'>

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Número inteiro de verdade, ou `null` para qualquer outra coisa (texto, NaN, infinito). */
function wholeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value)
}

/**
 * A vida que chegou num token, ou `null` quando ela não tem barra.
 *
 * Desde a fatia 10, quem lê é a tela do JOGADOR: o recorte (`lib/fogFilter.ts`)
 * põe em `Token.health` a proporção da ficha do sistema. O mestre lê a ficha
 * (`lib/vidaDaFicha.ts`); a vida antiga gravada no token fica no arquivo sem uso.
 *
 * Aceita `unknown` porque o que chega pela rede (ou do disco) é cru. Devolve
 * SEMPRE um objeto novo só com os três campos conhecidos.
 */
export function readTokenHealth(value: unknown): TokenHealth | null {
  if (value === null || typeof value !== 'object') return null
  const raw = value as Record<string, unknown> // objeto não nulo checado acima; cada campo é validado abaixo
  const max = wholeNumber(raw.max)
  const current = wholeNumber(raw.current)
  if (max === null || current === null || max < 1) return null
  const cappedMax = Math.min(max, HEALTH_LIMIT)
  return { current: clamp(current, 0, cappedMax), max: cappedMax, shownToPlayers: raw.shownToPlayers === true }
}

/** Quanto da vida sobra, de 0 a 1. */
export function healthFraction(health: HealthAmount): number {
  return clamp(health.current / health.max, 0, 1)
}

/** O estado que pinta a barra. */
export function healthState(fraction: number): HealthState {
  if (fraction <= HEALTH_DANGER_AT) return 'danger'
  if (fraction <= HEALTH_CAUTION_AT) return 'caution'
  return 'fine'
}
