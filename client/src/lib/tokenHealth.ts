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

/** O jogador recebe a proporção nesta escala (centésimos), nunca os pontos. */
const PLAYER_SCALE = 100

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Número inteiro de verdade, ou `null` para qualquer outra coisa (texto, NaN, infinito). */
function wholeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value)
}

/**
 * A vida da ficha como o app a usa, ou `null` quando ela não tem barra.
 *
 * Aceita `unknown` porque a entrada real não é só o que o type-checker vê:
 * mapa do disco chega cru (`lib/mapFile.ts` espalha o JSON) e mapa editado à
 * mão chega com o que estiver lá. Devolve SEMPRE um objeto novo só com os três
 * campos conhecidos — campo a mais que o arquivo trouxer morre aqui.
 */
export function readTokenHealth(value: unknown): TokenHealth | null {
  if (value === null || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const max = wholeNumber(raw.max)
  const current = wholeNumber(raw.current)
  if (max === null || current === null || max < 1) return null
  const cappedMax = Math.min(max, HEALTH_LIMIT)
  return { current: clamp(current, 0, cappedMax), max: cappedMax, shownToPlayers: raw.shownToPlayers === true }
}

/**
 * "Vida atual" digitada. Ficha ainda sem vida: o primeiro número vale para as
 * duas (a ficha nasce inteira). Com vida: a atual fica entre 0 e a máxima.
 */
export function withCurrentHealth(health: TokenHealth | null, current: number): TokenHealth {
  if (health === null) {
    // A máxima nunca desce de 1; a atual digitada vale como está (0 = caída).
    const max = clamp(Math.round(current), 1, HEALTH_LIMIT)
    return { current: clamp(Math.round(current), 0, max), max, shownToPlayers: false }
  }
  return { ...health, current: clamp(Math.round(current), 0, health.max) }
}

/**
 * "Vida máxima" digitada. Ficha ainda sem vida: nasce cheia, e SÓ PARA O
 * MESTRE — o padrão seguro: a barra de um monstro não vai à mesa antes de o
 * mestre decidir. Com vida: a atual nunca passa da máxima nova, e subir a
 * máxima não cura ninguém.
 */
export function withMaxHealth(health: TokenHealth | null, max: number): TokenHealth {
  const nextMax = clamp(Math.round(max), 1, HEALTH_LIMIT)
  if (health === null) return { current: nextMax, max: nextMax, shownToPlayers: false }
  return { ...health, max: nextMax, current: Math.min(health.current, nextMax) }
}

/** Mesma vida, mesmos números e mesma escolha de quem vê. */
export function sameHealth(a: TokenHealth | null, b: TokenHealth | null): boolean {
  if (a === null || b === null) return a === b
  return a.current === b.current && a.max === b.max && a.shownToPlayers === b.shownToPlayers
}

/** Quanto da vida sobra, de 0 a 1. */
export function healthFraction(health: TokenHealth): number {
  return clamp(health.current / health.max, 0, 1)
}

/** O estado que pinta a barra. */
export function healthState(fraction: number): HealthState {
  if (fraction <= HEALTH_DANGER_AT) return 'danger'
  if (fraction <= HEALTH_CAUTION_AT) return 'caution'
  return 'fine'
}

/**
 * A vida como o JOGADOR pode recebê-la, ou `null` quando nada dela sai.
 *
 * - Barra que o mestre deixou só para si (o padrão): nada — nem os números,
 *   nem o campo. É a regra da névoa: o jogador nunca recebe o que o mestre
 *   escondeu.
 * - Barra que os jogadores veem: a PROPORÇÃO, em centésimos. O mestre mostrou
 *   a barra, não a ficha técnica: 419 pontos de vida contariam que o ogro é um
 *   dragão. Vivo nunca chega como 0, ferido nunca chega como cheio.
 *
 * Lista do que VAI, montada aqui, e não cópia do que o mestre tem: campo que
 * o arquivo trouxer dentro da vida não chega ao jogador por descuido.
 */
export function healthForPlayer(value: unknown): TokenHealth | null {
  const health = readTokenHealth(value)
  if (health === null || !health.shownToPlayers) return null
  let share = Math.round(healthFraction(health) * PLAYER_SCALE)
  if (health.current > 0) share = Math.max(1, share)
  if (health.current < health.max) share = Math.min(PLAYER_SCALE - 1, share)
  return { current: share, max: PLAYER_SCALE, shownToPlayers: true }
}
