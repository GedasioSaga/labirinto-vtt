import type { Point } from '../pixi/world'

/**
 * O que fazer quando o jogador solta a ficha que estava segurando:
 * - `openPin`: foi um TOQUE (o dedo não andou) em cima de um pino — abre o cartão, a ficha fica onde estava;
 * - `move`: a ficha foi arrastada — pede ao mestre para ir para `x`/`y`;
 * - `stay`: nada muda — a ficha volta para onde o mapa diz que ela está.
 */
export type TokenRelease = { kind: 'openPin'; pinId: string } | { kind: 'move'; x: number; y: number } | { kind: 'stay' }

export interface TokenGesture {
  /** Onde o dedo apertou e onde soltou, em px de TELA. */
  startScreen: Point
  endScreen: Point
  /** Onde a ficha arrastada estava ao soltar, em px de mundo. */
  drop: Point
}

/**
 * @param token Posição da ficha no mapa recebido; `null` se ela sumiu no meio do gesto (viagem, recorte).
 * @param pinAtStart Pino sob o ponto onde o dedo apertou (já só os que o jogador pode ver).
 * @param tapTolerancePx Quanto o dedo pode tremer, em px de tela, e ainda contar como toque.
 */
export function resolveTokenRelease(
  gesture: TokenGesture,
  token: Point | null,
  pinAtStart: string | null,
  tapTolerancePx: number,
): TokenRelease {
  // O pino ganha do toque na ficha parada: com a ficha encostada nele, o dedo
  // cai na ficha primeiro, e sem esta prioridade o cartão nunca abria. Arrastar
  // de verdade (dedo andou além da folga) continua sendo mover a ficha.
  const moved = Math.hypot(gesture.endScreen.x - gesture.startScreen.x, gesture.endScreen.y - gesture.startScreen.y)
  if (pinAtStart !== null && moved <= tapTolerancePx) return { kind: 'openPin', pinId: pinAtStart }
  const x = Math.round(gesture.drop.x)
  const y = Math.round(gesture.drop.y)
  if (token === null || (token.x === x && token.y === y)) return { kind: 'stay' }
  return { kind: 'move', x, y }
}
