import { freeArea, type Bounds, type Camera, type Point, type Viewport } from '../pixi/world'
import { centeredCamera, type OwnDisc } from './playerCamera'

/**
 * A ficha arrastada até a borda rola o mapa, e a câmera acompanha quem anda
 * longe.
 *
 * Relato da Fabi (torre, lote 1, n. 47): num corredor de 530 casas, no
 * celular, cada 8-12 casas pediam soltar a ficha, rolar o mapa e pegar a ficha
 * de novo — uns 20 ciclos do Bloco B ao D. No arrasto só a ficha se movia.
 *
 * Tudo aqui é conta pura, em px do canvas; quem roda os quadros e aplica a
 * câmera é a `PlayerView`. Nada daqui sai pela rede: é só a câmera desta tela.
 */

/** Largura da faixa, junto de cada borda, onde a ficha arrastada rola o mapa. */
export const EDGE_SCROLL_ZONE_PX = 48

/**
 * Velocidade da câmera com o dedo encostado na borda, em px de tela por
 * segundo (12 px por quadro a 60 Hz). No começo da faixa é zero e cresce em
 * linha reta até aqui: quanto mais perto da borda, mais rápido.
 */
export const EDGE_SCROLL_MAX_SPEED = 720

/**
 * Maior tempo que um quadro conta. Aba em segundo plano, ou o celular que
 * engasgou, dão um quadro de segundos — sem o limite, a câmera saltaria.
 */
export const EDGE_SCROLL_MAX_FRAME_MS = 50

/** Soltou a ficha a menos desta fração da borda (da área livre): a câmera recentra nela. */
export const RECENTER_EDGE_FRACTION = 0.15

/** Duração do recentrar ao soltar. */
export const RECENTER_MS = 200

/** Quanto o dedo entrou na faixa de uma borda: 0 fora dela, 1 encostado ou além. */
function depthInZone(distanceToEdge: number): number {
  return Math.min(1, Math.max(0, (EDGE_SCROLL_ZONE_PX - distanceToEdge) / EDGE_SCROLL_ZONE_PX))
}

/** Velocidade com o dedo em `pointer`, medida a partir das bordas de `area` (px do canvas). */
function velocityInArea(pointer: Point, area: Bounds): Point {
  const x = depthInZone(pointer.x - area.minX) - depthInZone(area.maxX - pointer.x)
  const y = depthInZone(pointer.y - area.minY) - depthInZone(area.maxY - pointer.y)
  return { x: x * EDGE_SCROLL_MAX_SPEED, y: y * EDGE_SCROLL_MAX_SPEED }
}

/**
 * Velocidade da câmera (px de tela por segundo) com o dedo que arrasta a
 * ficha em `pointer`. Perto da direita, `x` negativo: o mundo anda para a
 * esquerda e revela o que está à direita. Tela menor que duas faixas: as duas
 * bordas puxam, e ganha a mais perto.
 *
 * A borda é a da área que o painel deixa livre (`obstacles`, px do canvas —
 * a mesma conta do recentrar): no notebook a coluna do painel cobre a
 * esquerda, e para quem olha o mapa começa onde ela termina. Dedo por baixo
 * do painel conta como encostado na borda.
 */
export function edgeScrollVelocity(pointer: Point, viewport: Viewport, obstacles: readonly Bounds[] = []): Point {
  return velocityInArea(pointer, freeArea(viewport, [...obstacles]))
}

/**
 * Um eixo da rolagem, parado na beira do mapa: a borda do mapa encosta no
 * começo da faixa (da área livre) e não passa, e a ficha na beira fica fora
 * da faixa. Quando a beira já está aquém disso (o mapa inteiro cabe, ou o
 * jogador rolou além), a rolagem naquele sentido não anda — e nunca puxa a
 * câmera de volta.
 */
function scrollAxis(position: number, velocity: number, seconds: number, mapMin: number, mapMax: number, areaMin: number, areaMax: number, scale: number): number {
  const next = position + velocity * seconds
  if (velocity < 0) {
    const limit = areaMax - EDGE_SCROLL_ZONE_PX - mapMax * scale
    return Math.max(next, Math.min(position, limit))
  }
  if (velocity > 0) {
    const limit = areaMin + EDGE_SCROLL_ZONE_PX - mapMin * scale
    return Math.min(next, Math.max(position, limit))
  }
  return position
}

/**
 * A câmera depois de um quadro de `elapsedMs` com o dedo em `pointer`.
 * `map` é o retângulo do mapa em px de mundo; `obstacles`, o que cobre o
 * canvas (ver `edgeScrollVelocity`). `null` = nada a mover (dedo longe da
 * borda, beira do mapa, quadro sem tempo).
 */
export function edgeScrollCamera(
  camera: Camera,
  pointer: Point,
  viewport: Viewport,
  map: Bounds,
  elapsedMs: number,
  obstacles: readonly Bounds[] = [],
): Camera | null {
  const seconds = Math.min(Math.max(elapsedMs, 0), EDGE_SCROLL_MAX_FRAME_MS) / 1000
  if (seconds === 0) return null
  const area = freeArea(viewport, [...obstacles])
  const velocity = velocityInArea(pointer, area)
  const x = scrollAxis(camera.x, velocity.x, seconds, map.minX, map.maxX, area.minX, area.maxX, camera.scale)
  const y = scrollAxis(camera.y, velocity.y, seconds, map.minY, map.maxY, area.minY, area.maxY, camera.scale)
  if (x === camera.x && y === camera.y) return null
  return { scale: camera.scale, x, y }
}

/**
 * Soltou a própria ficha: se ela ficou a menos de 15% da borda da área que o
 * painel deixa livre — ou debaixo do painel —, a câmera que a põe no centro
 * dessa área, no mesmo zoom. `null` = a ficha está no miolo, a câmera fica:
 * quem anda perto não tem a tela tirada do lugar.
 */
export function recenterTarget(camera: Camera, own: OwnDisc, viewport: Viewport, obstacles: readonly Bounds[]): Camera | null {
  const area = freeArea(viewport, [...obstacles])
  const x = own.x * camera.scale + camera.x
  const y = own.y * camera.scale + camera.y
  const marginX = (area.maxX - area.minX) * RECENTER_EDGE_FRACTION
  const marginY = (area.maxY - area.minY) * RECENTER_EDGE_FRACTION
  const inside = x >= area.minX + marginX && x <= area.maxX - marginX && y >= area.minY + marginY && y <= area.maxY - marginY
  if (inside) return null
  return centeredCamera(camera.scale, own, viewport, obstacles)
}

/** Recentrar em curso: de `from` a `to`, a partir de `startedAt` (`performance.now()`). */
export interface CameraGlide {
  from: Camera
  to: Camera
  startedAt: number
}

export function startCameraGlide(from: Camera, to: Camera, now: number): CameraGlide {
  return { from, to, startedAt: now }
}

/** Ease-out, como o degrau do + (`playerZoom.ts`): responde já e assenta no fim. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** A câmera do recentrar no instante `now`; `done` = chegou ao alvo exato. */
export function cameraGlideFrame(glide: CameraGlide, now: number): { camera: Camera; done: boolean } {
  const progress = Math.min(1, Math.max(0, (now - glide.startedAt) / RECENTER_MS))
  if (progress >= 1) return { camera: glide.to, done: true }
  const t = easeOutCubic(progress)
  const { from, to } = glide
  return {
    camera: { scale: from.scale + (to.scale - from.scale) * t, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
    done: false,
  }
}
