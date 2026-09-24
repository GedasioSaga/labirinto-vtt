/**
 * O que o TOQUE LONGO no mapa dispara quando o prazo vence, fora do Pixi para
 * ter teste. Com as ações no ponto montadas (`onLongPress`), o gesto é delas:
 * quem monta decide o que sai (o sinal só para o mestre e o menu
 * Sinalizar/Procurar/…), e o sinal para os colegas passa a ser escolha do
 * menu — senão Espiar e Revistar piscariam o ponto para todos. Sem menu, o
 * gesto continua sendo o sinal de sempre. As duas chaves são obrigatórias (o
 * valor pode faltar): quem monta o PlayerView não esquece de repassar uma
 * delas sem o compilador reclamar.
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
  if (handlers.onLongPress !== undefined) {
    handlers.onLongPress(world.x, world.y, screen.x, screen.y)
    return
  }
  handlers.onSignal?.(world.x, world.y)
}
