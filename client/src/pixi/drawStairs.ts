import type { Graphics } from 'pixi.js'
import type { Stair, StairSegment } from '../types/map'
import { SELECTION_COLOR, STAIR_COLOR, STROKE_WEIGHT } from './constants'
import { alignToPixel, pixelGrid, strokeWidthInWorld, type PixelGrid } from './pixelAlign'
import { computeSpiralPlan, computeStairPlan, type SpiralPlan, type StairPlan, type StairTread } from '../lib/stairs'
import type { Point } from './world'
import { selectionOutlineWidth } from './drawWalls'

/** Tom do degrau no pé do lance — o degrau de baixo afunda na sombra, o de cima pega a luz. */
export const STAIR_TREAD_ALPHA_AT_FOOT = 0.55
export const STAIR_TREAD_ALPHA_AT_TOP = 1

/** Viga lateral logo abaixo da parede (que é alpha 1) — é borda de escada, não parede. */
export const STAIR_RAIL_ALPHA = 0.85

/** Piso do degrau em px de TELA: de longe o lance vira um borrão, mas nunca some. */
const MIN_TREAD_SCREEN_PX = 1

/** `climb` (0 no pé do lance, 1 no topo) em opacidade de degrau. */
export function treadAlpha(climb: number): number {
  return STAIR_TREAD_ALPHA_AT_FOOT + (STAIR_TREAD_ALPHA_AT_TOP - STAIR_TREAD_ALPHA_AT_FOOT) * climb
}

/**
 * Escada RETA renderizada procedural (não é sprite), na gramática do minimapa
 * de Resident Evil: traço fino sobre chão chapado, uma cor só, nada de massa.
 *
 *   - VIGA LATERAL: os dois lados do lance como traço de 1 px de TELA, como a
 *     parede. É o que delimita o lance e faz o resto se ler como degrau.
 *   - DEGRAU: galão (V) apontando ladeira acima, geometria de `lib/stairs.ts`.
 *     Engorda (largura vem do plano) e clareia (`treadAlpha` aqui) rumo ao topo.
 *
 * As três pistas dizem a mesma coisa, então subir e descer viram desenhos
 * espelhados em vez de "a mesma escada com a setinha do outro lado" (queixa de
 * 17/09/2026: "como eu sei que essa escada vai para cima ou para baixo?").
 * Nenhuma delas muda colisão ou névoa: escada continua sendo só desenho.
 *
 * Mesmo esqueleto de drawWalls.ts — `graphics.clear()` e redesenha tudo a cada
 * chamada, sem cache de estado. A escada selecionada tem o lance inteiro traçado
 * POR BAIXO em `SELECTION_COLOR` (`SELECTION_OUTLINE_SCREEN_PX` de cada lado,
 * mesma regra de drawWalls.ts): a cor real da escada continua visível por cima,
 * e `cameraScale` mantém o contorno com espessura fixa na tela.
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
    plans: stair.segments
      .map((segment) => {
        const plan = computeStairPlan(segment, stair.stepWidth, stair.direction)
        return plan === null ? null : { plan, rails: alignRails(plan.rails, segment, pixel) }
      })
      .filter((entry): entry is PlannedSegment => entry !== null),
  }))

  const selected = planned.find((entry) => entry.stair.id === selectedStairId)
  if (selected) {
    // Cada traço ganha a MESMA sobra (drawWalls.ts: `style.width + 2 * outline`),
    // então o realce acompanha o lance em vez de engrossar tudo até virar bloco.
    for (const { plan, rails } of selected.plans) {
      for (const rail of rails) tracePath(graphics, rail)
      graphics.stroke({ width: strokeWidthInWorld(pixel) + sobra, color: SELECTION_COLOR, cap: 'round' })
      for (const tread of plan.treads) {
        tracePath(graphics, tread.points)
        graphics.stroke({ width: treadWidth(tread, scale) + sobra, color: SELECTION_COLOR, join: 'round', cap: 'round' })
      }
    }
  }

  for (const { plan, rails } of planned.flatMap((entry) => entry.plans)) {
    for (const rail of rails) tracePath(graphics, rail)
    graphics.stroke({ width: strokeWidthInWorld(pixel), color: STAIR_COLOR, alpha: STAIR_RAIL_ALPHA, cap: 'butt' })

    for (const tread of plan.treads) {
      tracePath(graphics, tread.points)
      graphics.stroke({ width: treadWidth(tread, scale), color: STAIR_COLOR, alpha: treadAlpha(tread.climb), join: 'round', cap: 'round' })
    }
  }

  for (const { plan } of spirals) strokeSpiral(graphics, plan, hairline, 'escada')
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

interface PlannedSegment {
  plan: StairPlan
  rails: [Point, Point][]
}

/** Espessura do degrau em px de mundo, com piso de 1 px de tela. */
function treadWidth(tread: StairTread, cameraScale: number): number {
  return Math.max(tread.width, MIN_TREAD_SCREEN_PX / cameraScale)
}

function tracePath(graphics: Graphics, points: readonly Point[]): void {
  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
}

/**
 * Lance horizontal/vertical com as vigas laterais no pixel físico inteiro
 * (pixelAlign.ts; exige `world.position` alinhado) — é o tratamento que a linha
 * central do desenho antigo recebia, agora na borda, que é o traço fino que
 * sobrou. Lance na diagonal fica como está: não há eixo para casar.
 */
function alignRails(rails: StairPlan['rails'], segment: StairSegment, pixel: PixelGrid): [Point, Point][] {
  if (segment.y1 === segment.y2) return rails.map((rail) => rail.map((p) => ({ x: p.x, y: alignToPixel(p.y, pixel) })) as [Point, Point])
  if (segment.x1 === segment.x2) return rails.map((rail) => rail.map((p) => ({ x: alignToPixel(p.x, pixel), y: p.y })) as [Point, Point])
  return rails.map((rail) => [...rail] as [Point, Point])
}
