export interface Camera {
  x: number
  y: number
  scale: number
}

export interface Point {
  x: number
  y: number
}

export const MIN_SCALE = 0.1
export const MAX_SCALE = 4

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function zoomAt(camera: Camera, pointer: Point, wheelDeltaY: number): Camera {
  const zoomFactor = Math.exp(-wheelDeltaY * 0.001)
  const newScale = clampScale(camera.scale * zoomFactor)

  const worldX = (pointer.x - camera.x) / camera.scale
  const worldY = (pointer.y - camera.y) / camera.scale

  return {
    scale: newScale,
    x: pointer.x - worldX * newScale,
    y: pointer.y - worldY * newScale,
  }
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

// Trava o segmento start->end no múltiplo de `stepDegrees` mais próximo do
// ângulo livre atual (default 45: produz 0/45/90/135/180/225/270/315).
// Calcula o ângulo livre via atan2(dy,dx), arredonda pro múltiplo mais
// próximo de stepDegrees e recalcula o ponto final na MESMA distância de
// `start` — só a DIREÇÃO muda, o comprimento do arrasto é preservado.
//
// Generaliza a versão anterior (constrainToRightAngle, removida), que zerava
// o eixo não-dominante em vez de girar em torno de `start`: com stepDegrees=90
// os números batem só quando o ângulo livre já cai exatamente num eixo (dx=0
// ou dy=0) — fora disso o comprimento final passa a ser preservado (era
// truncado antes). stepDegrees=90 continua sendo um caso particular válido
// desta função (só 4 direções, sem 45/135/225/315).
export function constrainToAngleStep(start: Point, end: Point, stepDegrees = 45): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)
  const freeAngle = Math.atan2(dy, dx)
  const stepRadians = (stepDegrees * Math.PI) / 180
  const snappedAngle = Math.round(freeAngle / stepRadians) * stepRadians
  return {
    x: start.x + distance * Math.cos(snappedAngle),
    y: start.y + distance * Math.sin(snappedAngle),
  }
}

// Ângulo do segmento start->end em graus, normalizado pra [0, 360). Y cresce
// pra baixo no canvas (convenção Pixi), então isso já é o sentido horário na
// tela sem ajuste extra — usado pelo indicador visual de ângulo durante o
// arrasto de Parede/Linha (ver PixiCanvas.tsx).
export function angleDegrees(start: Point, end: Point): number {
  const rad = Math.atan2(end.y - start.y, end.x - start.x)
  const deg = (rad * 180) / Math.PI
  return deg < 0 ? deg + 360 : deg
}
