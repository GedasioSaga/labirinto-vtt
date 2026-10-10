import type { Graphics } from 'pixi.js'
import type { Stair } from '../types/map'
import { SELECTION_COLOR, STAIR_COLOR, STAIR_PLATE_COLOR, STROKE_WEIGHT } from './constants'
import { hairlinePhysicalWidth, pixelGrid, strokeWidthInWorld } from './pixelAlign'
import { computeSpiralPlan, spiralPoint, type SpiralPlan } from '../lib/stairs'
import { stairCurveOf } from '../lib/stairCurve'
import {
  curvedFlightRing,
  MIN_TREAD_GAP_SCREEN_PX,
  planCurvedStairFlight,
  planStairFlight,
  type CurvedStairFlight,
  STAIR_PERSPECTIVE_RATIO,
  TREAD_PITCH_RATIO,
  treadScreenCss,
  treadStations,
  type Quad,
  type StairFlight,
} from './stairFlight'
import type { Point } from './world'
import { selectionOutlineWidth } from './drawWalls'

/** Degrau, moldura e contorno da espiral: logo abaixo da parede (que é alpha 1). É escada, não parede. */
export const STAIR_RAIL_ALPHA = 0.85

/**
 * PLACA: o próprio chão um tom mais escuro, não um furo nele. Opaca, a placa
 * virava um buraco preto no chão claro e chamava mais atenção que a parede
 * (queixa de 28/09/2026). Nesta opacidade, nos chãos de referência
 * (drawStairs.test.ts: terracota padrão, verde antigo e os cinzas das
 * recriações), a placa se separa do chão menos que a parede interna e o degrau
 * se separa da placa pelo menos tanto quanto a parede interna do chão. Em chão
 * pálido escolhido pelo mestre (#cdc3ae) a regra não fecha: lá a própria
 * parede interna some (1,09:1) e o degrau fica a 1,37:1 da placa. Subir isso
 * pede cor que dependa do chão, na parede e na escada juntas.
 */
export const STAIR_PLATE_ALPHA = 0.25

/** PATAMAR: `STAIR_COLOR` nesta opacidade por cima da placa, um tom entre a placa e o degrau em qualquer chão. */
export const STAIR_LANDING_ALPHA = 0.4

const EPSILON = 1e-9
/** O traço antialiasado pode comer até 1 px de um vão: a mesma folga do lance reto (stairFlight.ts). */
const GAP_SLACK_PHYSICAL_PX = 1
/** Perto do poste, onde os degraus da espiral se juntam, o vão entre dois deles só precisa ficar aberto. */
const POST_GAP_PHYSICAL_PX = 1
/** Flecha máxima, em px físicos, entre o arco do patamar da espiral e as cordas que o desenham. */
const ARC_SAGITTA_PHYSICAL_PX = 0.25
/** Teto de cordas por arco: um patamar enorme não vira milhares de pontos. */
const MAX_ARC_STEPS = 256

/**
 * Escada renderizada procedural (não é sprite), na gramática do minimapa de
 * Resident Evil: cor chapada, traço fino, nada de sombra nem gradiente.
 *
 * LANCE RETO (geometria em stairFlight.ts), pintado em quatro camadas:
 *   - PLACA: o retângulo da escada, `STAIR_PLATE_COLOR` a `STAIR_PLATE_ALPHA`:
 *     o próprio chão, chapado, um tom mais escuro. Em chão claro dá à linha
 *     clara do degrau o fundo de que ela precisa; em chão escuro quase some, e
 *     o degrau carrega o desenho sozinho.
 *   - PATAMAR: piso no TOPO do lance, `STAIR_COLOR` a `STAIR_LANDING_ALPHA`
 *     por cima da placa: mais claro que a placa, mais escuro que o degrau.
 *   - DEGRAUS: linhas finas paralelas de moldura a moldura, que se apertam
 *     perto do pé e se abrem rumo ao topo.
 *   - MOLDURA: o contorno do lance, 1 px de tela, como a parede.
 *
 * ESPIRAL (geometria em lib/stairs.ts, `computeSpiralPlan`): o mesmo lance
 * enrolado no poste, nas mesmas quatro camadas. A PLACA é o disco inteiro; o
 * PATAMAR é o último quarto da volta, que fecha o círculo até encostar na boca
 * pelo outro lado; os DEGRAUS são raios do poste ao aro, com a espessura, a
 * opacidade e o passo do degrau reto (o passo medido na linha do meio do
 * degrau), apertando no pé e abrindo rumo ao patamar e rareando de longe como
 * no reto; o CONTORNO é o aro e o poste, 1 px de tela. A espiral que desce é o
 * espelho da que sobe no eixo da boca: o patamar muda de lado.
 *
 * O sentido se lê pelo patamar e pelo ritmo dos degraus, as duas pistas
 * apontando para o mesmo lado; o contorno não tem cunha, então o desenho não
 * vira seta. Responde às queixas de 17/09/2026 ("como eu sei que essa escada
 * vai para cima ou para baixo?") e de 27/09/2026 ("parece só uma seta
 * apontando"). Nada disso muda colisão ou névoa: escada é só desenho.
 *
 * Mesmo esqueleto de drawWalls.ts: `graphics.clear()` e redesenha tudo a cada
 * chamada, sem cache de estado. A escada selecionada ganha, ANTES do resto, um
 * anel em `SELECTION_COLOR` de `SELECTION_OUTLINE_SCREEN_PX` por fora da placa
 * (retângulo no lance reto, círculo na espiral; mesma regra de drawWalls.ts);
 * `cameraScale` mantém o anel com espessura fixa na tela.
 *
 * `opacity` multiplica a opacidade de toda camada, realce incluso. É o que a
 * prévia do arrasto (drawDraft.ts) usa para mostrar ESTE MESMO desenho como
 * rascunho: ela divide o Graphics com as outras prévias, então não dá para
 * esmaecer o Graphics inteiro. Com `alpha` de container o Pixi também só
 * multiplica instrução por instrução, então o resultado na tela é o mesmo.
 */
export function drawStairs(
  graphics: Graphics,
  stairs: Stair[],
  selectedStairId: string | null = null,
  cameraScale = 1,
  rendererResolution = 1,
  opacity = 1,
): void {
  graphics.clear()
  const scale = cameraScale > 0 ? cameraScale : 1
  const ringWidth = selectionOutlineWidth(scale)
  const spirals = planSpirals(stairs)
  const planned = stairs.filter((stair) => stair.shape !== 'spiral').map((stair) => ({
    stair,
    flights: planFlights(stair, cameraScale, rendererResolution),
  }))

  // O realce vai por baixo de TODA escada, espiral ou reta.
  const selectedSpiral = spirals.find((entry) => entry.stair.id === selectedStairId)
  if (selectedSpiral) {
    const { center, radius } = selectedSpiral.plan
    graphics.circle(center.x, center.y, radius + ringWidth / 2)
    graphics.stroke({ width: ringWidth, color: SELECTION_COLOR, alpha: opacity })
  }
  const selected = planned.find((entry) => entry.stair.id === selectedStairId)
  if (selected) {
    for (const entry of selected.flights) {
      graphics.poly(entry.curved ? curvedFlightRing(entry.flight, ringWidth / 2) : ringQuad(entry.flight, ringWidth / 2), true)
      graphics.stroke({ width: ringWidth, color: SELECTION_COLOR, alpha: opacity, join: 'miter' })
    }
  }

  for (const entry of planned.flatMap((item) => item.flights)) paintFlight(graphics, entry.flight, opacity)
  for (const { plan } of spirals) paintSpiral(graphics, plan, cameraScale, rendererResolution, opacity)
}

type PlannedFlight = { curved: false; flight: StairFlight } | { curved: true; flight: CurvedStairFlight }

/**
 * Os lances de uma escada que não é espiral. A reta com `curva`
 * (`stairCurveOf`, já limitada) vira UM lance curvo; o resto é um lance reto
 * por segmento, como sempre foi.
 */
function planFlights(stair: Stair, cameraScale: number, rendererResolution: number): PlannedFlight[] {
  const curva = stairCurveOf(stair)
  const first = stair.segments[0]
  if (curva !== 0 && first !== undefined) {
    const flight = planCurvedStairFlight(first, stair.stepWidth, stair.direction, curva, cameraScale, rendererResolution)
    return flight === null ? [] : [{ curved: true, flight }]
  }
  return stair.segments.flatMap((segment): PlannedFlight[] => {
    const flight = planStairFlight(segment, stair.stepWidth, stair.direction, cameraScale, rendererResolution)
    return flight === null ? [] : [{ curved: false, flight }]
  })
}

/** O que `paintFlight` pinta: o lance reto (`Quad`) e o curvo (anel) têm as mesmas quatro camadas. */
type PaintableFlight = Pick<StairFlight | CurvedStairFlight, 'frameWidth' | 'treads' | 'treadWidth'> & {
  plate: Point[]
  frame: Point[]
  landing: Point[] | null
}

/** Placa, patamar, degraus e moldura de um lance, reto ou curvo, nesta ordem. */
function paintFlight(graphics: Graphics, flight: PaintableFlight, opacity: number): void {
  graphics.poly(flight.plate, true)
  graphics.fill({ color: STAIR_PLATE_COLOR, alpha: STAIR_PLATE_ALPHA * opacity })

  if (flight.landing !== null) {
    graphics.poly(flight.landing, true)
    graphics.fill({ color: STAIR_COLOR, alpha: STAIR_LANDING_ALPHA * opacity })
  }

  // Todos os degraus num stroke só: nenhum se sobrepõe a outro, então o alpha
  // não dobra em lugar nenhum.
  const railAlpha = STAIR_RAIL_ALPHA * opacity
  if (flight.treads.length > 0) {
    for (const tread of flight.treads) tracePath(graphics, tread)
    graphics.stroke({ width: flight.treadWidth, color: STAIR_COLOR, alpha: railAlpha, cap: 'butt' })
  }

  graphics.poly(flight.frame, true)
  graphics.stroke({ width: flight.frameWidth, color: STAIR_COLOR, alpha: railAlpha, join: 'miter' })
}

/** A placa empurrada `offset` para fora em cada lado: a linha central do anel de seleção. */
function ringQuad(flight: StairFlight, offset: number): Quad {
  const push = (corner: Point, alongSign: number, acrossSign: number): Point => ({
    x: corner.x + (alongSign * flight.along.x + acrossSign * flight.across.x) * offset,
    y: corner.y + (alongSign * flight.along.y + acrossSign * flight.across.y) * offset,
  })
  const [a, b, c, d] = flight.plate
  return [push(a, -1, -1), push(b, 1, -1), push(c, 1, 1), push(d, -1, 1)]
}

/** As espirais que têm lance para desenhar, com a geometria de cada uma. */
function planSpirals(stairs: readonly Stair[]): { stair: Stair; plan: SpiralPlan }[] {
  return stairs.flatMap((stair) => {
    if (stair.shape !== 'spiral') return []
    const first = stair.segments[0]
    const plan = first === undefined ? null : computeSpiralPlan(first, stair.direction)
    return plan === null ? [] : [{ stair, plan }]
  })
}

/**
 * Placa, patamar, degraus e contorno de uma espiral, nesta ordem: as camadas do
 * lance reto enroladas no poste, com as mesmas cores, opacidades e espessuras.
 * `opacity` multiplica tudo, como em `drawStairs`.
 */
function paintSpiral(graphics: Graphics, plan: SpiralPlan, cameraScale: number, rendererResolution: number, opacity: number): void {
  const scale = positiveOr(cameraScale, 1)
  const resolution = positiveOr(rendererResolution, 1)
  const pxPerWorld = scale * resolution
  const lineWidth = strokeWidthInWorld(pixelGrid(scale, resolution, STROKE_WEIGHT.hairline))
  const { center, radius, postRadius } = plan

  graphics.circle(center.x, center.y, radius)
  graphics.fill({ color: STAIR_PLATE_COLOR, alpha: STAIR_PLATE_ALPHA * opacity })

  // Miolo entre o traço do poste e o do aro: onde vão o patamar e os degraus.
  const inner = postRadius + lineWidth
  const outer = radius - lineWidth
  const railAlpha = STAIR_RAIL_ALPHA * opacity
  if (outer > inner) {
    graphics.poly(landingSector(plan, inner, outer, pxPerWorld), true)
    graphics.fill({ color: STAIR_COLOR, alpha: STAIR_LANDING_ALPHA * opacity })

    const treadPhysical = hairlinePhysicalWidth(treadScreenCss(scale), resolution)
    const sweeps = pickSpiralTreads(plan, inner, outer, treadPhysical, pxPerWorld, resolution)
    if (sweeps.length > 0) {
      for (const sweep of sweeps) tracePath(graphics, [spiralPoint(plan, sweep, inner), spiralPoint(plan, sweep, outer)])
      graphics.stroke({ width: treadPhysical / pxPerWorld, color: STAIR_COLOR, alpha: railAlpha, cap: 'butt' })
    }
  }

  // O aro corre por dentro da borda do disco, como a moldura por dentro da
  // placa; o poste, por fora do miolo do poste.
  graphics.circle(center.x, center.y, radius - lineWidth / 2)
  graphics.circle(center.x, center.y, postRadius + lineWidth / 2)
  graphics.stroke({ width: lineWidth, color: STAIR_COLOR, alpha: railAlpha })
}

/** O setor do patamar entre os raios `inner` e `outer`: arco de fora na ida, arco de dentro na volta. */
function landingSector(plan: SpiralPlan, inner: number, outer: number, pxPerWorld: number): Point[] {
  const start = plan.climbSweep
  const sweep = plan.landingSweep
  const outerSteps = arcSteps(sweep, outer, pxPerWorld)
  const innerSteps = arcSteps(sweep, inner, pxPerWorld)
  const points: Point[] = []
  for (let i = 0; i <= outerSteps; i += 1) points.push(spiralPoint(plan, start + (sweep * i) / outerSteps, outer))
  for (let i = innerSteps; i >= 0; i -= 1) points.push(spiralPoint(plan, start + (sweep * i) / innerSteps, inner))
  return points
}

/** Quantas cordas o arco de ângulo `sweep` e raio `r` pede para a flecha ficar abaixo de ARC_SAGITTA_PHYSICAL_PX. */
function arcSteps(sweep: number, r: number, pxPerWorld: number): number {
  // Flecha da corda de ângulo θ num raio r: r·(1 − cos(θ/2)) ≈ r·θ²/8.
  const maxAngle = Math.sqrt((8 * ARC_SAGITTA_PHYSICAL_PX) / Math.max(r * pxPerWorld, EPSILON))
  return Math.min(MAX_ARC_STEPS, Math.max(2, Math.ceil(Math.abs(sweep) / maxAngle)))
}

/**
 * Vãos da subida da espiral, pela conta do lance reto: passo de
 * `TREAD_PITCH_RATIO` da largura do degrau (do poste ao aro), medido na linha
 * do meio do degrau. Largura e subida crescem com o raio, então toda espiral
 * dá o mesmo número de vãos (hoje 24): a grande não vira roda de carroça. Quem
 * tira degrau de longe é `pickSpiralTreads`. A conta usa o raio do desenho,
 * não o recolhido pelo traço, para as estações não mudarem com o zoom.
 */
function spiralTreadIntervals(plan: SpiralPlan): number {
  const width = plan.radius - plan.postRadius
  const run = plan.climbSweep * ((plan.radius + plan.postRadius) / 2)
  return Math.max(1, Math.round(run / (TREAD_PITCH_RATIO * Math.min(width, run))))
}

/**
 * Onde vai cada degrau da espiral, como ângulo andado desde a boca: as
 * estações de `treadStations` com a regra do lance reto (passo que dobra de
 * longe, vão mínimo até a boca e até o patamar, reserva de um degrau só). O
 * vão é medido no raio do meio; perto do poste, onde os raios se juntam, ele
 * só precisa não fechar.
 */
function pickSpiralTreads(
  plan: SpiralPlan,
  inner: number,
  outer: number,
  treadPhysical: number,
  pxPerWorld: number,
  resolution: number,
): number[] {
  const stations = treadStations(plan.climbSweep, spiralTreadIntervals(plan), STAIR_PERSPECTIVE_RATIO)
  const count = stations.length - 1
  const middle = (inner + outer) / 2
  const treadWidth = treadPhysical / pxPerWorld
  const needPhysical = MIN_TREAD_GAP_SCREEN_PX * resolution + GAP_SLACK_PHYSICAL_PX
  const freeGap = (stride: number, r: number): number => stride * stations[1] * r * pxPerWorld - treadPhysical
  let stride = 1
  while (stride < count && (freeGap(stride, middle) < needPhysical || freeGap(stride, inner) < POST_GAP_PHYSICAL_PX)) stride *= 2

  const minGap = (MIN_TREAD_GAP_SCREEN_PX * resolution) / pxPerWorld
  const fits = (sweep: number): boolean =>
    sweep * middle - treadWidth / 2 >= minGap - EPSILON &&
    (plan.climbSweep - sweep) * middle - treadWidth / 2 >= minGap - EPSILON

  const sweeps: number[] = []
  for (let i = stride; i < count; i += stride) if (fits(stations[i])) sweeps.push(stations[i])
  if (sweeps.length > 0 || count < 2) return sweeps

  // Reserva: nenhum degrau coube no passo largo. Fica o que cabe mais perto do
  // meio da subida, para a espiral pequena nunca virar um disco vazio de longe.
  const halfway = plan.climbSweep / 2
  let best: number | null = null
  for (let i = 1; i < count; i += 1) {
    const sweep = stations[i]
    if (fits(sweep) && (best === null || Math.abs(sweep - halfway) < Math.abs(best - halfway))) best = sweep
  }
  return best === null ? [] : [best]
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function tracePath(graphics: Graphics, points: readonly Point[]): void {
  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
}
