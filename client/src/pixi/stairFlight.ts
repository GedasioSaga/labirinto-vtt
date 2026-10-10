import type { StairDirection, StairSegment } from '../types/map'
import { stairArcOf } from '../lib/stairCurve'
import { STROKE_WEIGHT } from './constants'
import { hairlinePhysicalWidth, pixelGrid, strokeWidthInWorld } from './pixelAlign'
import type { Point } from './world'

/**
 * Geometria do LANCE RETO de escada no desenho de minimapa (Resident Evil
 * clássico): placa chapada do tamanho da escada, moldura fina, degraus como
 * linhas finas paralelas de moldura a moldura e um patamar chapado no TOPO.
 * Aqui só se calcula; quem pinta é drawStairs.ts.
 *
 * Coordenadas do lance: `u` corre ao longo dele (0 no pé, `length` no topo) e
 * `v` o atravessa (-W/2 a W/2). Pé e topo seguem a convenção de
 * `computeStairPlan` (lib/stairs.ts): quem sobe começa em (x1, y1).
 *
 * O SENTIDO se lê sem seta, por duas pistas que dizem a mesma coisa:
 *   - o patamar chapado fica no topo: o lance "chega" num piso;
 *   - os degraus se apertam perto do pé e se abrem rumo ao topo, como uma
 *     escada vista de cima em perspectiva.
 * Nenhuma das duas é cunha ou ponta: o contorno continua um retângulo, e
 * retângulo não vira seta (queixa de 27/09/2026: "parece só uma seta").
 *
 * Lance horizontal ou vertical cai no pixel físico inteiro (pixelAlign.ts),
 * para a linha de 1 px não borrar em duas. De longe, em vez de fundir os
 * degraus num bloco, o lance perde degraus de 2 em 2 e mantém vão legível.
 */

/**
 * Passo médio do degrau, como fração do lado menor do lance (largura ou
 * comprimento). A espiral (drawStairs.ts) usa o mesmo passo na linha do meio
 * do degrau, para os dois desenhos terem o mesmo ritmo.
 */
export const TREAD_PITCH_RATIO = 0.14

/** Último vão (junto ao topo) dividido pelo primeiro (junto ao pé): a "perspectiva" do lance. */
export const STAIR_PERSPECTIVE_RATIO = 1.75

/** Vão mínimo, em px de TELA, entre dois degraus e entre degrau e moldura ou patamar. */
export const MIN_TREAD_GAP_SCREEN_PX = 3

/** Espessura do degrau em px de tela: 2 por unidade de zoom, entre 1 e 3. */
const TREAD_SCREEN_PX_PER_ZOOM = 2
const TREAD_SCREEN_PX_MIN = 1
const TREAD_SCREEN_PX_MAX = 3

/** O arredondamento ao pixel físico pode comer até 1 px de um vão; o espaçamento reserva essa folga. */
const SNAP_SLACK_PHYSICAL_PX = 1

/** Teto de vãos por lance: um lance enorme não vira milhares de traços. */
const MAX_TREAD_INTERVALS = 256

const EPSILON = 1e-9

/** Quatro cantos, na ordem (u0, v0), (u1, v0), (u1, v1), (u0, v1). */
export type Quad = [Point, Point, Point, Point]

export interface StairFlight {
  /** Retângulo inteiro do lance, pintado chapado por baixo de tudo. */
  plate: Quad
  /** Linha central da moldura: a placa recolhida meia espessura para dentro. */
  frame: Quad
  frameWidth: number
  /** Um traço por degrau, de moldura a moldura, perpendicular ao lance. */
  treads: [Point, Point][]
  treadWidth: number
  /** Piso chapado no topo, dentro da moldura; null quando o lance não tem miolo. */
  landing: Quad | null
  /** Unitário do pé para o topo. */
  along: Point
  /** Unitário atravessando o lance (`along` girado 90 graus). */
  across: Point
}

/** Profundidade do patamar: um degrau de largura, sem passar de um quarto do lance. */
export function landingDepth(length: number, stepWidth: number): number {
  return Math.min(stepWidth, length / 4)
}

/**
 * Posições (0 no pé, `run` no fim dos degraus) das bordas de `count` vãos que
 * crescem em progressão aritmética: o último vão é `ratio` vezes o primeiro e
 * a soma dá exatamente `run`. Devolve `count + 1` posições.
 */
export function treadStations(run: number, count: number, ratio = STAIR_PERSPECTIVE_RATIO): number[] {
  const n = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1
  if (n === 1) return [0, run]
  const firstGap = (2 * run) / (n * (1 + ratio))
  const growth = (ratio - 1) / (2 * (n - 1))
  const stations = [0]
  for (let i = 1; i < n; i += 1) stations.push(firstGap * (i + growth * i * (i - 1)))
  stations.push(run)
  return stations
}

/** Espessura do degrau em px de tela (CSS) para o zoom da câmera. */
export function treadScreenCss(cameraScale: number): number {
  return Math.min(TREAD_SCREEN_PX_MAX, Math.max(TREAD_SCREEN_PX_MIN, TREAD_SCREEN_PX_PER_ZOOM * cameraScale))
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

interface FlightAxes {
  foot: Point
  along: Point
  across: Point
  length: number
}

function flightAxes(segment: StairSegment, direction: StairDirection): FlightAxes | null {
  // Mesma convenção de computeStairPlan (lib/stairs.ts): quem sobe começa em (x1, y1).
  const ascends = direction === 'up'
  const foot = ascends ? { x: segment.x1, y: segment.y1 } : { x: segment.x2, y: segment.y2 }
  const top = ascends ? { x: segment.x2, y: segment.y2 } : { x: segment.x1, y: segment.y1 }
  const length = Math.hypot(top.x - foot.x, top.y - foot.y)
  if (!(length > 0) || !Number.isFinite(length)) return null
  const along = { x: (top.x - foot.x) / length, y: (top.y - foot.y) / length }
  return { foot, along, across: { x: -along.y, y: along.x }, length }
}

type Snap = (value: number) => number

/**
 * Arredondadores de `u` e `v` que fazem a coordenada de MUNDO resultante cair
 * no pixel físico inteiro. Só existe eixo para casar em lance horizontal ou
 * vertical; na diagonal os valores passam direto.
 */
function pixelSnappers(segment: StairSegment, axes: FlightAxes, pxPerWorld: number): { snapU: Snap; snapV: Snap } {
  const snap: Snap = (value) => Math.round(value * pxPerWorld) / pxPerWorld
  const { foot, along } = axes
  if (segment.y1 === segment.y2) {
    const sign = Math.sign(along.x)
    return {
      snapU: (u) => sign * (snap(foot.x + sign * u) - foot.x),
      snapV: (v) => sign * (snap(foot.y + sign * v) - foot.y),
    }
  }
  if (segment.x1 === segment.x2) {
    const sign = Math.sign(along.y)
    return {
      snapU: (u) => sign * (snap(foot.y + sign * u) - foot.y),
      snapV: (v) => -sign * (snap(foot.x - sign * v) - foot.x),
    }
  }
  return { snapU: (u) => u, snapV: (v) => v }
}

/** Recolhe [lo, hi] meia espessura de cada lado; se não couber, colapsa no meio. */
function insetByHalf(lo: number, hi: number, width: number): [number, number] {
  if (hi - lo >= width) return [lo + width / 2, hi - width / 2]
  const middle = (lo + hi) / 2
  return [middle, middle]
}

interface TreadLayout {
  stations: readonly number[]
  treadWidth: number
  treadPhysical: number
  pxPerWorld: number
  resolution: number
  /** Borda de dentro da moldura, no pé. */
  low: number
  /** Onde os degraus acabam: começo do patamar, ou borda de dentro da moldura no topo. */
  high: number
  snapU: Snap
  /**
   * Só na escada CURVA: o vão do lado de dentro do arco dividido pelo da
   * linha do meio (raio de dentro / raio do meio). Lá os degraus radiais se
   * apertam; o passo também dobra até o vão de dentro não fechar, a mesma
   * regra do poste da espiral. Ausente = 1 (lance reto).
   */
  innerGapScale?: number
}

/** No lado de dentro da escada curva, o vão entre dois degraus só precisa ficar aberto: 1 px físico, como junto ao poste da espiral. */
const INNER_GAP_PHYSICAL_PX = 1

/**
 * Onde começa cada degrau (em `u`). Com zoom baixo o vão entre estações cai
 * abaixo de `MIN_TREAD_GAP_SCREEN_PX`; aí o passo dobra (1, 2, 4...) e o lance
 * mostra só uma estação a cada `stride`, sempre as mesmas do zoom alto. Todo
 * degrau guarda o vão mínimo até a moldura e até o patamar.
 */
function pickTreadStarts(layout: TreadLayout): number[] {
  const { stations, treadWidth, treadPhysical, pxPerWorld, resolution, low, high, snapU } = layout
  const count = stations.length - 1
  const needPhysical = MIN_TREAD_GAP_SCREEN_PX * resolution + SNAP_SLACK_PHYSICAL_PX
  const innerGapScale = layout.innerGapScale ?? 1
  const freeGap = (stride: number, gapScale: number): number => stride * stations[1] * gapScale * pxPerWorld - treadPhysical
  let stride = 1
  while (stride < count && (freeGap(stride, 1) < needPhysical || freeGap(stride, innerGapScale) < INNER_GAP_PHYSICAL_PX)) stride *= 2

  const minGap = (MIN_TREAD_GAP_SCREEN_PX * resolution) / pxPerWorld
  const fits = (start: number): boolean =>
    start - low >= minGap - EPSILON && high - (start + treadWidth) >= minGap - EPSILON

  const starts: number[] = []
  for (let i = stride; i < count; i += stride) {
    const start = snapU(stations[i])
    if (fits(start)) starts.push(start)
  }
  if (starts.length > 0 || count < 2) return starts

  // Reserva: nenhum degrau coube no passo largo. Fica o que cabe mais perto do
  // meio, para a escada de uma casa nunca virar um retângulo vazio de longe.
  const middle = (low + high) / 2
  const distance = (start: number): number => Math.abs(start + treadWidth / 2 - middle)
  let best: number | null = null
  for (let i = 1; i < count; i += 1) {
    const start = snapU(stations[i])
    if (fits(start) && (best === null || distance(start) < distance(best))) best = start
  }
  return best === null ? [] : [best]
}

/**
 * Plano de um lance reto. `cameraScale` e `rendererResolution` entram porque a
 * espessura dos traços e o vão mínimo são medidos em px de tela. Devolve null
 * para lance de comprimento zero.
 */
export function planStairFlight(
  segment: StairSegment,
  stepWidth: number,
  direction: StairDirection,
  cameraScale = 1,
  rendererResolution = 1,
): StairFlight | null {
  const axes = flightAxes(segment, direction)
  if (axes === null) return null
  const scale = positiveOr(cameraScale, 1)
  const resolution = positiveOr(rendererResolution, 1)
  const pxPerWorld = scale * resolution
  const width = Number.isFinite(stepWidth) ? Math.max(0, stepWidth) : 0
  const { foot, along, across, length } = axes
  const { snapU, snapV } = pixelSnappers(segment, axes, pxPerWorld)

  const at = (u: number, v: number): Point => ({
    x: foot.x + u * along.x + v * across.x,
    y: foot.y + u * along.y + v * across.y,
  })
  const quad = (u0: number, u1: number, v0: number, v1: number): Quad => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]

  const u0 = snapU(0)
  const u1 = snapU(length)
  const v0 = snapV(-width / 2)
  const v1 = snapV(width / 2)

  const frameWidth = strokeWidthInWorld(pixelGrid(scale, resolution, STROKE_WEIGHT.hairline))
  const [frameU0, frameU1] = insetByHalf(u0, u1, frameWidth)
  const [frameV0, frameV1] = insetByHalf(v0, v1, frameWidth)
  const treadPhysical = hairlinePhysicalWidth(treadScreenCss(scale), resolution)
  const treadWidth = treadPhysical / pxPerWorld
  const base = { plate: quad(u0, u1, v0, v1), frame: quad(frameU0, frameU1, frameV0, frameV1), frameWidth, treadWidth, along, across }

  // Miolo do lance, por dentro da moldura. Sem miolo (escada estreita demais,
  // ou largura zero) não há onde pôr degrau nem patamar; testar isto ANTES de
  // contar degraus evita dividir por largura zero.
  const innerU0 = u0 + frameWidth
  const innerU1 = u1 - frameWidth
  const innerV0 = v0 + frameWidth
  const innerV1 = v1 - frameWidth
  if (!(innerU1 > innerU0) || !(innerV1 > innerV0)) return { ...base, treads: [], landing: null }

  const run = length - landingDepth(length, width)
  const landingStart = Math.min(Math.max(snapU(run), innerU0), innerU1 - 1 / pxPerWorld)
  const landing = landingStart < innerU0 ? null : quad(landingStart, innerU1, innerV0, innerV1)

  const count = Math.min(MAX_TREAD_INTERVALS, Math.max(1, Math.round(run / (TREAD_PITCH_RATIO * Math.min(width, length)))))
  const starts = pickTreadStarts({
    stations: treadStations(run, count),
    treadWidth,
    treadPhysical,
    pxPerWorld,
    resolution,
    low: innerU0,
    high: landing === null ? innerU1 : landingStart,
    snapU,
  })
  const treads = starts.map((start): [Point, Point] => [at(start + treadWidth / 2, innerV0), at(start + treadWidth / 2, innerV1)])
  return { ...base, treads, landing }
}

/** Flecha máxima, em px físicos, entre o arco da escada curva e as cordas que o desenham. */
const ARC_SAGITTA_PHYSICAL_PX = 0.25
/** Teto de cordas por arco: uma escada curva enorme não vira milhares de pontos. */
const MAX_ARC_STEPS = 256

/**
 * Lance CURVO (pedido de 10/10/2026, "curvar a escada depois de feita"): o
 * mesmo lance reto dobrado no arco de `Stair.curva` (`lib/stairCurve.ts`). As
 * quatro camadas são as do reto — placa chapada, patamar no topo, degraus de
 * moldura a moldura e a moldura fina —, com `u` agora correndo NO ARCO (o
 * comprimento da linha do meio) e `v` atravessando-o na direção do raio. Os
 * degraus viram radiais e seguem o ritmo do reto: apertados no pé, abrindo
 * rumo ao topo, rareando de longe; no lado de dentro, onde se apertam,
 * o passo também dobra até o vão não fechar. Sem prender ao pixel: nada no
 * arco é deitado ou em pé.
 */
export interface CurvedStairFlight {
  /** A placa inteira: o anel do arco, borda de fora na ida e de dentro na volta. */
  plate: Point[]
  frame: Point[]
  frameWidth: number
  /** Um traço radial por degrau, de moldura a moldura. */
  treads: [Point, Point][]
  treadWidth: number
  landing: Point[] | null
  center: Point
  /** Raio da linha do meio. */
  radius: number
  halfWidth: number
  /** Ângulo do pé, visto do centro. */
  footAngle: number
  /** Ângulo andado do pé ao topo, com sinal. */
  climbSweep: number
  pxPerWorld: number
}

/** Quantas cordas o arco de ângulo `sweep` e raio `r` pede para a flecha ficar abaixo de ARC_SAGITTA_PHYSICAL_PX. */
function arcSteps(sweep: number, r: number, pxPerWorld: number): number {
  // Flecha da corda de ângulo θ num raio r: r·(1 − cos(θ/2)) ≈ r·θ²/8.
  const maxAngle = Math.sqrt((8 * ARC_SAGITTA_PHYSICAL_PX) / Math.max(r * pxPerWorld, EPSILON))
  return Math.min(MAX_ARC_STEPS, Math.max(2, Math.ceil(Math.abs(sweep) / maxAngle)))
}

/** Faixa do anel entre os ângulos `from` e `to` e os raios `inner` e `outer`: arco de fora na ida, de dentro na volta. */
function annulusBand(center: Point, from: number, to: number, inner: number, outer: number, pxPerWorld: number): Point[] {
  const at = (angle: number, r: number): Point => ({ x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r })
  const steps = arcSteps(to - from, Math.max(outer, inner), pxPerWorld)
  const points: Point[] = []
  for (let i = 0; i <= steps; i += 1) points.push(at(from + ((to - from) * i) / steps, outer))
  for (let i = steps; i >= 0; i -= 1) points.push(at(from + ((to - from) * i) / steps, inner))
  return points
}

/**
 * Plano de um lance curvo de flecha `curva` (já limitada por quem chama, ver
 * `stairCurveOf`). Mesmas espessuras, cores e passo do reto. Devolve null para
 * curva zero ou lance de comprimento zero.
 */
export function planCurvedStairFlight(
  segment: StairSegment,
  stepWidth: number,
  direction: StairDirection,
  curva: number,
  cameraScale = 1,
  rendererResolution = 1,
): CurvedStairFlight | null {
  const arc = stairArcOf(segment, curva)
  if (arc === null) return null
  const scale = positiveOr(cameraScale, 1)
  const resolution = positiveOr(rendererResolution, 1)
  const pxPerWorld = scale * resolution
  const width = Number.isFinite(stepWidth) ? Math.max(0, stepWidth) : 0
  const { center, radius } = arc
  // Mesma convenção do reto: quem sobe começa em (x1, y1).
  const ascends = direction === 'up'
  const footAngle = ascends ? arc.startAngle : arc.startAngle + arc.sweep
  const climbSweep = ascends ? arc.sweep : -arc.sweep
  const turn = Math.sign(climbSweep)
  const length = radius * Math.abs(climbSweep)

  // `u` no arco da linha do meio; `v` positivo é o `across` do reto (a
  // esquerda de quem sobe), que no arco cai para o centro quando a volta é
  // positiva e para fora quando é negativa.
  const angleAt = (u: number): number => footAngle + (turn * u) / radius
  const radiusAt = (v: number): number => radius - turn * v
  const at = (u: number, v: number): Point => {
    const angle = angleAt(u)
    const r = radiusAt(v)
    return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r }
  }
  const band = (u0: number, u1: number, v0: number, v1: number): Point[] => {
    const r0 = radiusAt(v0)
    const r1 = radiusAt(v1)
    return annulusBand(center, angleAt(u0), angleAt(u1), Math.min(r0, r1), Math.max(r0, r1), pxPerWorld)
  }

  const halfWidth = width / 2
  const frameWidth = strokeWidthInWorld(pixelGrid(scale, resolution, STROKE_WEIGHT.hairline))
  const [frameU0, frameU1] = insetByHalf(0, length, frameWidth)
  const [frameV0, frameV1] = insetByHalf(-halfWidth, halfWidth, frameWidth)
  const treadPhysical = hairlinePhysicalWidth(treadScreenCss(scale), resolution)
  const treadWidth = treadPhysical / pxPerWorld
  const base = {
    plate: band(0, length, -halfWidth, halfWidth),
    frame: band(frameU0, frameU1, frameV0, frameV1),
    frameWidth,
    treadWidth,
    center,
    radius,
    halfWidth,
    footAngle,
    climbSweep,
    pxPerWorld,
  }

  const innerU0 = frameWidth
  const innerU1 = length - frameWidth
  const innerV0 = -halfWidth + frameWidth
  const innerV1 = halfWidth - frameWidth
  if (!(innerU1 > innerU0) || !(innerV1 > innerV0)) return { ...base, treads: [], landing: null }

  const run = length - landingDepth(length, width)
  const landingStart = Math.min(Math.max(run, innerU0), innerU1 - 1 / pxPerWorld)
  const landing = landingStart < innerU0 ? null : band(landingStart, innerU1, innerV0, innerV1)

  const count = Math.min(MAX_TREAD_INTERVALS, Math.max(1, Math.round(run / (TREAD_PITCH_RATIO * Math.min(width, length)))))
  const starts = pickTreadStarts({
    stations: treadStations(run, count),
    treadWidth,
    treadPhysical,
    pxPerWorld,
    resolution,
    low: innerU0,
    high: landing === null ? innerU1 : landingStart,
    snapU: (u) => u,
    innerGapScale: Math.max(0, radius - halfWidth) / radius,
  })
  const treads = starts.map((start): [Point, Point] => [at(start + treadWidth / 2, innerV0), at(start + treadWidth / 2, innerV1)])
  return { ...base, treads, landing }
}

/**
 * O anel de seleção da escada curva: a placa empurrada `offset` para fora em
 * todo lado. Nas pontas o empurrão é o mesmo em px em qualquer raio, então o
 * ângulo a mais é maior no lado de dentro.
 */
export function curvedFlightRing(flight: CurvedStairFlight, offset: number): Point[] {
  const outer = flight.radius + flight.halfWidth + offset
  const inner = Math.max(EPSILON, flight.radius - flight.halfWidth - offset)
  const turn = Math.sign(flight.climbSweep)
  const span = (r: number): [number, number] => {
    const extra = Math.min(Math.PI / 2, offset / r)
    return [flight.footAngle - turn * extra, flight.footAngle + flight.climbSweep + turn * extra]
  }
  const at = (angle: number, r: number): Point => ({ x: flight.center.x + Math.cos(angle) * r, y: flight.center.y + Math.sin(angle) * r })
  const [outerFrom, outerTo] = span(outer)
  const [innerFrom, innerTo] = span(inner)
  const outerSteps = arcSteps(outerTo - outerFrom, outer, flight.pxPerWorld)
  const innerSteps = arcSteps(innerTo - innerFrom, inner, flight.pxPerWorld)
  const points: Point[] = []
  for (let i = 0; i <= outerSteps; i += 1) points.push(at(outerFrom + ((outerTo - outerFrom) * i) / outerSteps, outer))
  for (let i = innerSteps; i >= 0; i -= 1) points.push(at(innerFrom + ((innerTo - innerFrom) * i) / innerSteps, inner))
  return points
}
