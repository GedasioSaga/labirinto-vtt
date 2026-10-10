import type { GridShape, MapScale, Stair } from '../types/map'
import type { Point } from '../pixi/world'
import { dimensionLabel } from './dimensionText'
import {
  clampStairCurve,
  clampStairLength,
  clampStairWidth,
  curvaForTurnDegrees,
  stairCanCurve,
  stairChord,
  stairCurveOf,
  stairLength,
  stairMidpoint,
  stairTurnDegrees,
  withStairLength,
} from './stairCurve'

/**
 * ALÇAS DA ESCADA SELECIONADA (pedido de 10/10/2026). Conta pura: o desenho
 * (`pixi/drawEditHandles.ts`), o clique e o cursor (`lib/handleHitArea.ts`,
 * `lib/hoverHitTest.ts`) e o gesto (`pixi/stairHandleGesture.ts`) leem daqui.
 *
 *  - PONTAS ('start' em (x1, y1), 'end' no fim do último lance): mudam o
 *    comprimento, na mesma reta; a ponta oposta fica parada.
 *  - LATERAIS ('side-left' do lado da curva positiva, 'side-right' do outro),
 *    no meio da escada: mudam a largura, simétrica — a linha do meio fica.
 *  - MEIO ('curve'): curva a escada em arco. Só na reta de um lance.
 *
 * A espiral só tem as pontas: o lance é o diâmetro do círculo, e a largura
 * não aparece no desenho dela (`StairControls` também esconde o campo).
 */

export type StairHandleKind = 'start' | 'end' | 'side-left' | 'side-right' | 'curve'

export interface StairHandle {
  kind: StairHandleKind
  point: Point
}

/** Passo da grade no comprimento e na largura: meia casa (as larguras de Pequena, Média e Grande caem nele). */
const SIZE_SNAP_CELLS = 0.5
/** Passo da grade na curva, em graus de volta. */
const TURN_SNAP_DEGREES = 15

/** O meio da escada e a direção que a atravessa ali: o meio do arco na curva, o meio do primeiro lance nas outras. */
function stairMiddle(stair: Stair): { point: Point; normal: Point } | null {
  const first = stair.segments[0]
  const chord = first === undefined ? null : stairChord(first)
  const point = stairMidpoint(stair)
  if (chord === null || point === null) return null
  // O arco é simétrico na corda: no meio dele, quem atravessa a escada anda na normal da corda.
  return { point, normal: chord.normal }
}

export function stairHandles(stair: Stair): StairHandle[] {
  const first = stair.segments[0]
  const last = stair.segments[stair.segments.length - 1]
  const middle = stairMiddle(stair)
  if (first === undefined || last === undefined || middle === null) return []
  const ends: StairHandle[] = [
    { kind: 'start', point: { x: first.x1, y: first.y1 } },
    { kind: 'end', point: { x: last.x2, y: last.y2 } },
  ]
  if (stair.shape === 'spiral') return ends
  const half = (Number.isFinite(stair.stepWidth) ? Math.max(0, stair.stepWidth) : 0) / 2
  const { point, normal } = middle
  const sides: StairHandle[] = [
    { kind: 'side-left', point: { x: point.x + normal.x * half, y: point.y + normal.y * half } },
    { kind: 'side-right', point: { x: point.x - normal.x * half, y: point.y - normal.y * half } },
  ]
  return stairCanCurve(stair) ? [...ends, ...sides, { kind: 'curve', point }] : [...ends, ...sides]
}

export interface StairHandleDrag {
  /** A escada como estava no COMEÇO do gesto: cada quadro parte dela, sem acumular erro. */
  stair: Stair
  handle: StairHandleKind
  pointer: Point
  grid: number
  /** Grade ligada para este gesto (Alt já invertido por quem chama). */
  snap: boolean
}

function snapTo(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value
}

function dragEnd(drag: StairHandleDrag): Stair {
  const { stair, handle, pointer, grid, snap } = drag
  const first = stair.segments[0]
  const last = stair.segments[stair.segments.length - 1]
  const moving = handle === 'start' ? { x: first.x1, y: first.y1 } : { x: last.x2, y: last.y2 }
  const pivot = handle === 'start' ? { x: last.x2, y: last.y2 } : { x: first.x1, y: first.y1 }
  const distance = Math.hypot(moving.x - pivot.x, moving.y - pivot.y)
  const total = stairLength(stair)
  if (!(distance > 0) || !(total > 0)) return stair
  // Só conta o quanto o ponteiro anda NA reta da ponta parada à que se puxa: o desvio de lado não gira a escada.
  const along = ((pointer.x - pivot.x) * (moving.x - pivot.x) + (pointer.y - pivot.y) * (moving.y - pivot.y)) / distance
  const wanted = (total * along) / distance
  const length = clampStairLength(snap ? snapTo(wanted, grid * SIZE_SNAP_CELLS) : wanted, grid)
  return withStairLength(stair, length, handle === 'start' ? 'end' : 'start')
}

function dragSide(drag: StairHandleDrag): Stair {
  const { stair, pointer, grid, snap } = drag
  const middle = stairMiddle(stair)
  if (middle === null) return stair
  const across = (pointer.x - middle.point.x) * middle.normal.x + (pointer.y - middle.point.y) * middle.normal.y
  const wanted = 2 * Math.abs(across)
  const stepWidth = clampStairWidth(snap ? snapTo(wanted, grid * SIZE_SNAP_CELLS) : wanted, grid)
  return stepWidth === stair.stepWidth ? stair : { ...stair, stepWidth }
}

function dragCurve(drag: StairHandleDrag): Stair {
  const { stair, pointer, snap } = drag
  const first = stair.segments[0]
  const chord = !stairCanCurve(stair) || first === undefined ? null : stairChord(first)
  if (chord === null) return stair
  // A flecha é o quanto o ponteiro se afasta da corda, na normal: puxar para um lado curva para ele.
  const sagitta = (pointer.x - chord.middle.x) * chord.normal.x + (pointer.y - chord.middle.y) * chord.normal.y
  let curva = clampStairCurve(sagitta, chord.length, stair.stepWidth)
  if (snap) {
    const degrees = (4 * Math.atan((2 * curva) / chord.length) * 180) / Math.PI
    curva = clampStairCurve(curvaForTurnDegrees(snapTo(degrees, TURN_SNAP_DEGREES), chord.length), chord.length, stair.stepWidth)
  }
  const { curva: _antiga, ...reta } = stair
  if (stairCurveOf({ ...stair, curva }) === 0) return stair.curva === undefined ? stair : reta
  return curva === stair.curva ? stair : { ...stair, curva }
}

/** A escada depois de puxar a alça `handle` até `pointer`. Mesma referência quando nada muda. */
export function dragStairHandle(drag: StairHandleDrag): Stair {
  if (drag.stair.segments.length === 0) return drag.stair
  switch (drag.handle) {
    case 'start':
    case 'end':
      return dragEnd(drag)
    case 'side-left':
    case 'side-right':
      return dragSide(drag)
    case 'curve':
      return dragCurve(drag)
  }
}

/**
 * O número junto do ponteiro durante o arrasto, na régua do mapa — a mesma
 * do arrasto de criação da escada (`dimensionLabel`): o comprimento de ponta
 * a ponta, a largura, ou a volta em graus ("reta" no zero).
 */
export function stairHandleLabel(stair: Stair, handle: StairHandleKind, grid: number, gridShape: GridShape, scale: MapScale): string {
  if (handle === 'curve') {
    const degrees = Math.round(Math.abs(stairTurnDegrees(stair)))
    return degrees === 0 ? 'reta' : `curva ${degrees}°`
  }
  const middle = stairMiddle(stair)
  const first = stair.segments[0]
  const last = stair.segments[stair.segments.length - 1]
  if (middle === null || first === undefined || last === undefined) return ''
  if (handle === 'start' || handle === 'end') {
    return dimensionLabel({ tool: 'stair', start: { x: first.x1, y: first.y1 }, end: { x: last.x2, y: last.y2 } }, grid, gridShape, scale)
  }
  const half = stair.stepWidth / 2
  const a = { x: middle.point.x + middle.normal.x * half, y: middle.point.y + middle.normal.y * half }
  const b = { x: middle.point.x - middle.normal.x * half, y: middle.point.y - middle.normal.y * half }
  return `largura ${dimensionLabel({ tool: 'line', start: a, end: b }, grid, gridShape, scale)}`
}
