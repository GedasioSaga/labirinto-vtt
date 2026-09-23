/**
 * O que o TOQUE LONGO no mapa dispara quando o prazo vence, fora do Pixi para
 * ter teste: o sinal (como sempre) e, com o mesmo ponto, o menu das ações no
 * ponto. As duas chaves são obrigatórias (o valor pode faltar): quem monta o
 * PlayerView não esquece de repassar uma delas sem o compilador reclamar.
 */
export interface LongPressHandlers {
  onSignal: ((x: number, y: number) => void) | undefined
  onLongPress: ((x: number, y: number, screenX: number, screenY: number) => void) | undefined
}

interface Point {
  x: number
  y: number
}

/** `world`: px do mapa; `screen`: onde o dedo está, para o menu abrir ali. */
export function fireLongPress(world: Point, screen: Point, handlers: LongPressHandlers): void {
  handlers.onSignal?.(world.x, world.y)
  handlers.onLongPress?.(world.x, world.y, screen.x, screen.y)
}
