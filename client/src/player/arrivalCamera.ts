import { clampScale, fitCamera, MIN_SCALE, type Camera, type Point, type Viewport } from '../pixi/world'
import type { MapData, Token } from '../types/map'

/**
 * Zoom da chegada quando o andar não cabe na tela: tamanho natural do mapa.
 * No enquadramento travado em MIN_SCALE (10%) a ficha vira um ponto no escuro.
 */
export const ARRIVAL_SCALE = 1

/** A primeira ficha própria, na ordem de `ownTokens`, que está neste andar. */
function ownTokenOnMap(map: MapData, ownTokens: readonly string[]): Token | null {
  for (const id of ownTokens) {
    const found = map.tokens.find((t) => t.id === id)
    if (found) return found
  }
  return null
}

/** A ficha inteira (disco de raio `radius`) dentro da tela, descontada a margem. */
function isFullyOnScreen(camera: Camera, center: Point, radius: number, viewport: Viewport, margin: number): boolean {
  const x = center.x * camera.scale + camera.x
  const y = center.y * camera.scale + camera.y
  const r = radius * camera.scale
  return x - r >= margin && y - r >= margin && x + r <= viewport.width - margin && y + r <= viewport.height - margin
}

function centeredOn(center: Point, scale: number, viewport: Viewport): Camera {
  return { scale, x: viewport.width / 2 - center.x * scale, y: viewport.height / 2 - center.y * scale }
}

/**
 * Câmera de quem acaba de chegar num andar: enquadra o andar inteiro, como
 * sempre, a não ser que isso esconda a própria ficha. Andar grande demais
 * (o enquadramento trava em MIN_SCALE) ou ficha fora do enquadramento →
 * centraliza na ficha. Sem ficha própria neste andar, só enquadra.
 */
export function arrivalCamera(map: MapData, ownTokens: readonly string[], viewport: Viewport, margin: number): Camera {
  const bounds = { minX: 0, minY: 0, maxX: map.width * map.grid, maxY: map.height * map.grid }
  const fit = fitCamera(bounds, viewport, margin)
  const own = ownTokenOnMap(map, ownTokens)
  if (own === null) return fit

  const floorTooBig = fit.scale <= MIN_SCALE
  const radius = (map.grid / 2) * own.size
  if (!floorTooBig && isFullyOnScreen(fit, own, radius, viewport, margin)) return fit

  const scale = floorTooBig ? clampScale(ARRIVAL_SCALE) : fit.scale
  return centeredOn(own, scale, viewport)
}
