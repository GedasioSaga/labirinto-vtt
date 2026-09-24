/**
 * Zoom do jogador no celular: a pinça de dois dedos e os botões + e −.
 *
 * No celular não existe roda de mouse, e o zoom do próprio navegador está
 * desligado sobre o mapa (`touch-action: none`, sem ele o arrasto de um dedo
 * rolaria a página). Sem pinça nem botões o jogador ficava preso no
 * enquadramento inicial: o mapa inteiro, minúsculo, numa tela de 360 px.
 *
 * Tudo aqui é conta pura, sem Pixi nem DOM: o `PlayerView` guarda o estado na
 * cena e aplica a câmera que sai daqui. A geometria (escala em volta de um
 * ponto, pinça) mora em `pixi/world.ts`, ao lado da roda do mouse.
 */
import { MAX_SCALE, MIN_SCALE, clampScale, pinchCamera, pinchStart, zoomToScale } from '../pixi/world'
import type { Camera, PinchStart, Point } from '../pixi/world'
import { theme } from '../theme'

/** `1` = aproximar (+), `-1` = afastar (−). */
export type ZoomDirection = 1 | -1

/**
 * Um toque no + multiplica a escala por √2, e no − divide: dois toques dobram
 * (ou reduzem à metade) o tamanho do mapa na tela. Um degrau inteiro (2×)
 * pulava demais numa faixa de zoom que vai de 10% a 400%; √2 é o meio-degrau
 * de sempre dos visualizadores de imagem.
 */
export const ZOOM_STEP_FACTOR = Math.SQRT2

/**
 * Duração do degrau animado: o `motion.base` do tema (170 ms). Curta o
 * bastante para dois toques seguidos não esperarem um pelo outro; longa o
 * bastante para o olho ver o mapa crescer em volta do centro, e não trocar de
 * quadro num salto.
 */
export const ZOOM_STEP_MS = Number.parseFloat(theme.motion.base)

/** Folga de ponto flutuante no limite (a mesma do `ZoomHud` do editor). */
const LIMIT_EPSILON = 1e-6

export function steppedScale(scale: number, direction: ZoomDirection): number {
  return clampScale(direction === 1 ? scale * ZOOM_STEP_FACTOR : scale / ZOOM_STEP_FACTOR)
}

/** O que os botões ainda podem fazer: no limite, o botão daquele lado fica indisponível. */
export interface ZoomLimits {
  canZoomIn: boolean
  canZoomOut: boolean
}

export function zoomLimits(scale: number): ZoomLimits {
  return { canZoomIn: scale < MAX_SCALE - LIMIT_EPSILON, canZoomOut: scale > MIN_SCALE + LIMIT_EPSILON }
}

/** Pedido de um degrau vindo dos botões. `seq` muda a cada toque: o mesmo sentido repetido é outro pedido. */
export interface ZoomStepRequest {
  direction: ZoomDirection
  /** Falso quando veio do teclado: ação de teclado não espera animação. */
  animate: boolean
  seq: number
}

export const NO_ZOOM_STEP: ZoomStepRequest = { direction: 1, animate: false, seq: 0 }

/** Degrau de zoom andando: o ponto de tela `anchor` fica parado e a escala vai de `from` a `to`. */
export interface ZoomAnimation {
  anchor: Point
  /** Ponto do MUNDO sob `anchor`, o mesmo do começo ao fim: o centro não escorrega. */
  world: Point
  from: number
  to: number
  startedAt: number
}

/**
 * Escala alvo de um toque. Parte do alvo do degrau que ainda anda: dois
 * toques rápidos dão dois degraus inteiros, e não um e meio. `null` = já está
 * no limite daquele lado, não há o que fazer.
 */
function stepTarget(camera: Camera, running: ZoomAnimation | null, direction: ZoomDirection): number | null {
  const base = running?.to ?? camera.scale
  const to = steppedScale(base, direction)
  return Math.abs(to - base) < LIMIT_EPSILON ? null : to
}

/**
 * Um toque no + ou no −, animado em volta de `anchor` (o centro da tela). A
 * animação parte da câmera de agora — mesmo no meio de outro degrau —, sem
 * salto. `null` = no limite.
 */
export function zoomStepAnimation(
  camera: Camera,
  running: ZoomAnimation | null,
  anchor: Point,
  direction: ZoomDirection,
  now: number,
): ZoomAnimation | null {
  const to = stepTarget(camera, running, direction)
  if (to === null) return null
  return {
    anchor,
    world: { x: (anchor.x - camera.x) / camera.scale, y: (anchor.y - camera.y) / camera.scale },
    from: camera.scale,
    to,
    startedAt: now,
  }
}

/**
 * Ease-out: o mapa responde no mesmo quadro do toque e assenta no fim. Não é
 * ease-in-out de propósito — começar devagar numa resposta a toque lê como
 * atraso.
 */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** A câmera do degrau no instante `now`; `done` = chegou ao alvo exato. */
export function zoomAnimationFrame(animation: ZoomAnimation, now: number): { camera: Camera; done: boolean } {
  const progress = Math.min(1, Math.max(0, (now - animation.startedAt) / ZOOM_STEP_MS))
  // Escala em progressão geométrica: de 1 a √2 anda no mesmo ritmo que de √2 a 2.
  const scale = progress >= 1 ? animation.to : animation.from * (animation.to / animation.from) ** easeOutCubic(progress)
  const { anchor, world } = animation
  return { camera: { scale, x: anchor.x - world.x * scale, y: anchor.y - world.y * scale }, done: progress >= 1 }
}

/** O degrau inteiro de uma vez (teclado, ou movimento reduzido no sistema). `null` = no limite. */
export function zoomStepNow(camera: Camera, running: ZoomAnimation | null, anchor: Point, direction: ZoomDirection): Camera | null {
  const to = stepTarget(camera, running, direction)
  return to === null ? null : zoomToScale(camera, anchor, to)
}

// ─────────────────────────────────────────────────────────────────────────
// Dedos na tela
// ─────────────────────────────────────────────────────────────────────────

/** Pinça em andamento: os dois dedos que mandam nela e onde ela começou. */
export interface Pinch {
  ids: readonly [number, number]
  start: PinchStart
}

/** Dedos na tela (px de tela, por `pointerId`, na ordem em que encostaram) e a pinça, se houver. */
export interface TouchState {
  fingers: ReadonlyMap<number, Point>
  pinch: Pinch | null
}

export const NO_TOUCH: TouchState = { fingers: new Map(), pinch: null }

/**
 * O que o dedo que encostou vira:
 * - `single`: é o único — segue o gesto de um dedo de sempre (ficha, câmera,
 *   sinal, toque em porta e pino);
 * - `pinch`: é o segundo — começa a pinça, e o gesto do primeiro dedo acaba
 *   sem efeito (a ficha não anda, o sinal não sai);
 * - `extra`: terceiro dedo em diante — ignorado.
 */
export type FingerRole = 'single' | 'pinch' | 'extra'

/** Pinça dos dois primeiros dedos da conta, partindo de `camera`. */
function pinchOfFirstTwo(fingers: ReadonlyMap<number, Point>, camera: Camera): Pinch | null {
  const [first, second] = fingers.entries()
  if (first === undefined || second === undefined) return null
  return { ids: [first[0], second[0]], start: pinchStart(camera, first[1], second[1]) }
}

export function fingerDown(state: TouchState, id: number, at: Point, isPrimary: boolean, camera: Camera): { state: TouchState; role: FingerRole } {
  // Dedo primário = nenhum outro encostado agora. O que ainda estiver na conta
  // é de um toque que o navegador cancelou sem avisar: sem esquecer, o próximo
  // dedo sozinho viraria "segundo dedo" e uma pinça fantasma.
  const base = isPrimary ? NO_TOUCH : state
  const fingers = new Map(base.fingers).set(id, at)
  if (base.pinch !== null) return { state: { fingers, pinch: base.pinch }, role: 'extra' }
  if (fingers.size === 1) return { state: { fingers, pinch: null }, role: 'single' }
  return { state: { fingers, pinch: pinchOfFirstTwo(fingers, camera) }, role: 'pinch' }
}

/** Dedo andou. `camera` só vem quando ele é um dos dois da pinça: é a câmera nova. */
export function fingerMove(state: TouchState, id: number, at: Point): { state: TouchState; camera: Camera | null } {
  if (!state.fingers.has(id)) return { state, camera: null }
  const fingers = new Map(state.fingers).set(id, at)
  const next: TouchState = { fingers, pinch: state.pinch }
  const pinch = state.pinch
  if (pinch === null || !pinch.ids.includes(id)) return { state: next, camera: null }
  const a = fingers.get(pinch.ids[0])
  const b = fingers.get(pinch.ids[1])
  if (a === undefined || b === undefined) return { state: next, camera: null }
  return { state: next, camera: pinchCamera(pinch.start, a, b) }
}

export interface FingerUp {
  state: TouchState
  /** A pinça acabou agora: saiu um dos dois dedos dela e não sobraram dois para continuar. */
  pinchEnded: boolean
  /** Dedo que ficou na tela depois da pinça: segue arrastando a câmera, e soltá-lo não é toque. */
  carry: { id: number; at: Point } | null
}

/**
 * Dedo saiu (soltou ou o sistema cancelou). Se era da pinça e ainda há dois
 * dedos, ela continua com eles a partir de `camera` (a de agora), sem salto.
 */
export function fingerUp(state: TouchState, id: number, camera: Camera): FingerUp {
  if (!state.fingers.has(id)) return { state, pinchEnded: false, carry: null }
  const fingers = new Map(state.fingers)
  fingers.delete(id)
  const pinch = state.pinch
  if (pinch === null || !pinch.ids.includes(id)) return { state: { fingers, pinch }, pinchEnded: false, carry: null }
  if (fingers.size >= 2) return { state: { fingers, pinch: pinchOfFirstTwo(fingers, camera) }, pinchEnded: false, carry: null }
  const [rest] = fingers.entries()
  return { state: { fingers, pinch: null }, pinchEnded: true, carry: rest === undefined ? null : { id: rest[0], at: rest[1] } }
}

/**
 * A câmera mudou por fora no meio da pinça (mapa novo numa viagem, "Centralizar
 * no meu personagem"): a pinça recomeça da câmera nova com os mesmos dedos, em
 * vez de puxar o mapa de volta para a conta velha no próximo passo do dedo.
 */
export function rebasePinch(state: TouchState, camera: Camera): TouchState {
  const pinch = state.pinch
  if (pinch === null) return state
  const a = state.fingers.get(pinch.ids[0])
  const b = state.fingers.get(pinch.ids[1])
  if (a === undefined || b === undefined) return state
  return { fingers: state.fingers, pinch: { ids: pinch.ids, start: pinchStart(camera, a, b) } }
}
