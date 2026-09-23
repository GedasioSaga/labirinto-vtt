/**
 * Régua do JOGADOR — a mesma conta da ferramenta Medir do mestre, só local.
 *
 * Dor que isto resolve: o jogador não sabia se alcançava o inimigo e
 * perguntava ao mestre a cada turno. A medida nunca sai da máquina dele: não
 * há mensagem nova no protocolo, e a tela do mestre não sabe que ela existe.
 *
 * Tudo aqui é puro (sem Pixi, sem DOM): `PlayerView.tsx` decide QUANDO chamar
 * (pointerdown/move/up com o modo ligado) e desenha o resultado.
 */
import type { MapData } from '../types/map'
import type { Camera, Point } from '../pixi/world'
import { snapPointForTarget } from '../pixi/tokenInteraction'
import { measureDistance } from '../lib/measurement'

/** Uma medida na tela: `dragging` = o dedo ainda está apertado. */
export interface PlayerMeasure {
  start: Point
  end: Point
  dragging: boolean
}

/** Estado do modo Medir: o botão ligado e a medida atual (se houver). */
export interface PlayerMeasureState {
  armed: boolean
  measure: PlayerMeasure | null
}

export type PlayerMeasureEvent =
  | { type: 'press'; at: Point }
  | { type: 'move'; at: Point }
  | { type: 'release' }

export const MEASURE_OFF: PlayerMeasureState = { armed: false, measure: null }

/**
 * O botão "Medir" mora no painel (fora do canvas), então quem manda em
 * ligado/desligado é a tela de cima; aqui só se aplica a decisão. Desligar
 * (botão de novo ou Escape) apaga a medida: ela ficaria na tela sem botão
 * apertado que explicasse de onde veio.
 */
export function withMeasureArmed(state: PlayerMeasureState, armed: boolean): PlayerMeasureState {
  if (!armed) return MEASURE_OFF
  return state.armed ? state : { armed: true, measure: null }
}

/**
 * Escape desliga o modo Medir — menos quando o foco está num campo de texto:
 * lá o Escape é da edição (desfazer o que se digita), não do mapa.
 */
export function escapeDisarmsMeasure(key: string, target: EventTarget | null): boolean {
  if (key !== 'Escape') return false
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return true
  if (target.isContentEditable) return false
  const tag = target.tagName
  return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT'
}

/**
 * Transições do gesto com o modo ligado.
 *
 * - `press` só mede com o modo ligado e SEMPRE começa medida nova: a medida
 *   solta fica "até o próximo toque".
 * - `move`/`release` só valem durante o arrasto; fora dele não mexem em nada
 *   (um pointermove solto do mouse não pode esticar a medida já solta).
 */
export function playerMeasureReducer(state: PlayerMeasureState, event: PlayerMeasureEvent): PlayerMeasureState {
  switch (event.type) {
    case 'press':
      if (!state.armed) return state
      return { armed: true, measure: { start: event.at, end: event.at, dragging: true } }
    case 'move':
      if (!state.measure?.dragging) return state
      return { ...state, measure: { ...state.measure, end: event.at } }
    case 'release':
      if (!state.measure?.dragging) return state
      return { ...state, measure: { ...state.measure, dragging: false } }
  }
}

/**
 * Ponto de TELA do gesto → ponto de MUNDO da régua, grudado no vértice da
 * grade como o mestre faz (`applySnap(..., 'wall', altKey)` em
 * `pixi/PixiCanvas.tsx`): com isso "3 quadrados" do jogador dão o mesmo
 * número que os do mestre. Alt inverte o grude, igual no editor. O jogador
 * não tem o seletor de grude do mestre; o padrão do editor (ligado) vale.
 */
export function measurePointFromScreen(camera: Camera, screen: Point, map: Pick<MapData, 'grid' | 'gridShape'>, altKey: boolean): Point {
  const world = { x: (screen.x - camera.x) / camera.scale, y: (screen.y - camera.y) / camera.scale }
  if (altKey) return world
  return snapPointForTarget('wall', map.gridShape, world.x, world.y, map.grid)
}

/** Ponto de mundo → ponto de tela com esta câmera (o caminho de volta de `measurePointFromScreen`, sem o grude). */
export function measureWorldToScreen(camera: Camera, world: Point): Point {
  return { x: world.x * camera.scale + camera.x, y: world.y * camera.scale + camera.y }
}

/** Rótulo da medida no MESMO formato do mestre (`measureDistance(...).label`). */
export function playerMeasureLabel(map: Pick<MapData, 'grid' | 'gridShape' | 'measurementMode' | 'scale'>, measure: PlayerMeasure): string {
  return measureDistance(measure.start, measure.end, map.grid, map.gridShape, map.measurementMode, map.scale).label
}
