/**
 * Giro curto do bico da ficha na tela do jogador (`facingMarker.ts`): quando
 * o mestre vira o guarda, o bico gira até a frente nova em vez de saltar.
 * Salto de um triângulo pequeno passa despercebido; o giro chama o olho e
 * mostra para que lado a ficha virou. Mesma língua do deslize de posição
 * (`tokenGlide.ts`), de quem este módulo copia a forma.
 *
 * Lógica pura, sem Pixi: o render (PlayerView) pergunta "para onde aponto este
 * bico agora?" a cada redraw e a cada quadro do ticker. Os casos em que o bico
 * NÃO gira são decididos por quem chama (`animate: false`): troca de cena e
 * movimento reduzido; o bico que acabou de aparecer (`shown: null`) já nasce
 * na frente certa.
 */

/** Duração do giro: abaixo de 300 ms, para a virada se notar sem atrasar a leitura. */
export const TOKEN_TURN_MS = 200

/** Diferença menor que meio grau não anima: o bico já está lá. */
const MIN_TURN_RAD = Math.PI / 360

export interface TurnTrack {
  from: number
  to: number
  /** Instante de início, no mesmo relógio de `now` (performance.now()). */
  start: number
}

/** Bicos girando agora, por id da ficha. Bico parado não tem entrada. */
export type TokenTurns = Map<string, TurnTrack>

export function createTokenTurns(): TokenTurns {
  return new Map()
}

/**
 * Menor giro de `from` até `to`, em radianos, nunca mais que meia volta:
 * de 350° para 10° são 20° no sentido horário, e não 340° para trás.
 */
export function shortestTurn(from: number, to: number): number {
  const delta = to - from
  return Math.atan2(Math.sin(delta), Math.cos(delta))
}

/** Sai devagar e assenta devagar: é um giro no lugar, dentro da tela. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Para onde o bico aponta em `now`; `done` quando já chegou. */
function turnAngle(track: TurnTrack, now: number): { angle: number; done: boolean } {
  const elapsed = now - track.start
  if (elapsed >= TOKEN_TURN_MS) return { angle: track.to, done: true }
  const k = easeInOutCubic(Math.max(0, elapsed) / TOKEN_TURN_MS)
  return { angle: track.from + shortestTurn(track.from, track.to) * k, done: false }
}

export interface TurnSync {
  /** Ângulo desenhado agora; `null` se o bico não estava na tela. */
  shown: number | null
  /** Para onde o mapa diz que a ficha olha. */
  target: number
  now: number
  /** `false` = vai direto à frente nova (troca de cena, movimento reduzido). */
  animate: boolean
}

/**
 * Frente nova de uma ficha, vinda do mapa. Devolve o ângulo a desenhar agora.
 * A mesma frente chegando de novo não recomeça o giro; frente nova no meio do
 * caminho parte de onde o bico está desenhado, sem voltar.
 */
export function syncTurn(turns: TokenTurns, id: string, sync: TurnSync): number {
  const { shown, target, now, animate } = sync
  if (!animate || shown === null) {
    turns.delete(id)
    return target
  }
  const current = turns.get(id)
  if (current !== undefined && current.to === target) {
    const at = turnAngle(current, now)
    if (at.done) turns.delete(id)
    return at.angle
  }
  if (Math.abs(shortestTurn(shown, target)) < MIN_TURN_RAD) {
    turns.delete(id)
    return target
  }
  turns.set(id, { from: shown, to: target, start: now })
  return shown
}

/** Um quadro do ticker: o ângulo de cada bico girando. Os que chegaram saem do mapa já neste quadro. */
export function stepTurns(turns: TokenTurns, now: number): Array<{ id: string; angle: number }> {
  const turned: Array<{ id: string; angle: number }> = []
  for (const [id, track] of turns) {
    const at = turnAngle(track, now)
    if (at.done) turns.delete(id)
    turned.push({ id, angle: at.angle })
  }
  return turned
}
