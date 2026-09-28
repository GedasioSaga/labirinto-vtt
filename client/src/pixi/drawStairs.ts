import type { Graphics } from 'pixi.js'
import type { Stair } from '../types/map'
import { SELECTION_COLOR, STAIR_COLOR, STAIR_LANDING_COLOR, STAIR_PLATE_COLOR, STROKE_WEIGHT } from './constants'
import { pixelGrid, strokeWidthInWorld } from './pixelAlign'
import { computeSpiralPlan, type SpiralPlan } from '../lib/stairs'
import { planStairFlight, type Quad, type StairFlight } from './stairFlight'
import type { Point } from './world'
import { selectionOutlineWidth } from './drawWalls'

/** Tom do raio da ESPIRAL no pé do lance: o raio de baixo afunda na sombra, o de cima pega a luz. */
export const STAIR_TREAD_ALPHA_AT_FOOT = 0.55
export const STAIR_TREAD_ALPHA_AT_TOP = 1

/** Degrau, moldura e contorno da espiral: logo abaixo da parede (que é alpha 1). É escada, não parede. */
export const STAIR_RAIL_ALPHA = 0.85

/** `climb` (0 no pé do lance, 1 no topo) em opacidade de raio da espiral. */
export function treadAlpha(climb: number): number {
  return STAIR_TREAD_ALPHA_AT_FOOT + (STAIR_TREAD_ALPHA_AT_TOP - STAIR_TREAD_ALPHA_AT_FOOT) * climb
}

/**
 * Escada renderizada procedural (não é sprite), na gramática do minimapa de
 * Resident Evil: cor chapada, traço fino, nada de sombra nem gradiente.
 *
 * LANCE RETO (geometria em stairFlight.ts), pintado em quatro camadas:
 *   - PLACA: o retângulo da escada, chapado em `STAIR_PLATE_COLOR`. Dá à linha
 *     clara do degrau o mesmo contraste em chão claro e em chão escuro.
 *   - PATAMAR: piso chapado no TOPO do lance, em `STAIR_LANDING_COLOR`.
 *   - DEGRAUS: linhas finas paralelas de moldura a moldura, que se apertam
 *     perto do pé e se abrem rumo ao topo.
 *   - MOLDURA: o contorno do lance, 1 px de tela, como a parede.
 *
 * O sentido se lê pelo patamar e pelo ritmo dos degraus, as duas pistas
 * apontando para o mesmo lado; o contorno é um retângulo sem cunha, então o
 * desenho não vira seta. Responde às queixas de 17/09/2026 ("como eu sei que
 * essa escada vai para cima ou para baixo?") e de 27/09/2026 ("parece só uma
 * seta apontando"). Nada disso muda colisão ou névoa: escada é só desenho.
 *
 * Mesmo esqueleto de drawWalls.ts: `graphics.clear()` e redesenha tudo a cada
 * chamada, sem cache de estado. A escada selecionada ganha, ANTES do resto, um
 * anel em `SELECTION_COLOR` de `SELECTION_OUTLINE_SCREEN_PX` por fora da placa
 * (mesma regra de drawWalls.ts); `cameraScale` mantém o anel com espessura
 * fixa na tela.
 */
export function drawStairs(
  graphics: Graphics,
  stairs: Stair[],
  selectedStairId: string | null = null,
  cameraScale = 1,
  rendererResolution = 1,
): void {
  graphics.clear()
  const pixel = pixelGrid(cameraScale, rendererResolution, STROKE_WEIGHT.hairline)
  const scale = cameraScale > 0 ? cameraScale : 1

  const hairline = strokeWidthInWorld(pixel)
  const sobra = 2 * selectionOutlineWidth(cameraScale)
  const spirals = planSpirals(stairs)

  // O realce vai por baixo de TODA escada, espiral ou reta.
  const selectedSpiral = spirals.find((entry) => entry.stair.id === selectedStairId)
  if (selectedSpiral) strokeSpiral(graphics, selectedSpiral.plan, hairline + sobra, 'realce')

  const planned = stairs.filter((stair) => stair.shape !== 'spiral').map((stair) => ({
    stair,
    flights: stair.segments
      .map((segment) => planStairFlight(segment, stair.stepWidth, stair.direction, cameraScale, rendererResolution))
      .filter((flight): flight is StairFlight => flight !== null),
  }))

  const selected = planned.find((entry) => entry.stair.id === selectedStairId)
  if (selected) {
    const ringWidth = selectionOutlineWidth(scale)
    for (const flight of selected.flights) {
      graphics.poly(ringQuad(flight, ringWidth / 2), true)
      graphics.stroke({ width: ringWidth, color: SELECTION_COLOR, join: 'miter' })
    }
  }

  for (const flight of planned.flatMap((entry) => entry.flights)) paintFlight(graphics, flight)

  for (const { plan } of spirals) strokeSpiral(graphics, plan, hairline, 'escada')
}

/** Placa, patamar, degraus e moldura de um lance reto, nesta ordem. */
function paintFlight(graphics: Graphics, flight: StairFlight): void {
  graphics.poly(flight.plate, true)
  graphics.fill({ color: STAIR_PLATE_COLOR })

  if (flight.landing !== null) {
    graphics.poly(flight.landing, true)
    graphics.fill({ color: STAIR_LANDING_COLOR })
  }

  // Todos os degraus num stroke só: nenhum se sobrepõe a outro, então o alpha
  // não dobra em lugar nenhum.
  if (flight.treads.length > 0) {
    for (const tread of flight.treads) tracePath(graphics, tread)
    graphics.stroke({ width: flight.treadWidth, color: STAIR_COLOR, alpha: STAIR_RAIL_ALPHA, cap: 'butt' })
  }

  graphics.poly(flight.frame, true)
  graphics.stroke({ width: flight.frameWidth, color: STAIR_COLOR, alpha: STAIR_RAIL_ALPHA, join: 'miter' })
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
 * ESCADA EM ESPIRAL (`computeSpiralPlan`): o círculo e o poste num traço só,
 * e um raio por degrau. Todo traço tem a MESMA espessura (`width`) —
 * "raios finos", sem galão que engorda. Na cor da escada, o contorno leva o
 * tom da viga e o raio clareia rumo ao alto; no realce, tudo sai na cor dele.
 */
function strokeSpiral(graphics: Graphics, plan: SpiralPlan, width: number, pen: 'escada' | 'realce'): void {
  graphics.circle(plan.center.x, plan.center.y, plan.radius)
  graphics.circle(plan.center.x, plan.center.y, plan.postRadius)
  graphics.stroke(pen === 'escada' ? { width, color: STAIR_COLOR, alpha: STAIR_RAIL_ALPHA } : { width, color: SELECTION_COLOR })
  for (const spoke of plan.spokes) {
    tracePath(graphics, [spoke.from, spoke.to])
    graphics.stroke(
      pen === 'escada'
        ? { width, color: STAIR_COLOR, alpha: treadAlpha(spoke.climb), cap: 'butt' }
        : { width, color: SELECTION_COLOR, cap: 'round' },
    )
  }
}

function tracePath(graphics: Graphics, points: readonly Point[]): void {
  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
}
