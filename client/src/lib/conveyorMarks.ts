import type { ConveyorDirection, MapData, RegionPoint } from '../types/map'
import { cabinOf } from './cabins'
import { conveyorsOf } from './conveyors'
import { pointInRing } from './floorContour'

/**
 * O MOVIMENTO IMPOSTO no mapa do MESTRE — geometria pura, sem Pixi. O que o
 * canvas desenha (`pixi/drawConveyors.ts`), estilo minimapa: traço fino e
 * claro, nada de faixa listrada nem textura.
 *
 * - Sala-esteira: setas finas (chevrons) no chão, uma a cada
 *   `CHEVRON_SPACING_CELLS` casas, apontando para onde a esteira empurra.
 * - Cabine entre pinos da cena: uma linha fina do pino à próxima parada.
 * - Cabine ao par (pino de viagem): um anel fino em volta do pino — o par mora
 *   em outra cena, então não há para onde puxar a linha.
 *
 * Só o mestre recebe isto: o jogador nunca recebe `conveyors` nem `cabine`
 * (`lib/fogFilter.ts`).
 */

/** Casas entre uma seta e a próxima, nos dois eixos. */
export const CHEVRON_SPACING_CELLS = 2
/** Meia largura da seta, em fração da casa. */
export const CHEVRON_HALF_CELLS = 0.22
/** Teto de setas por sala: sala gigante não vira milhares de traços. */
export const MAX_CHEVRONS_PER_ROOM = 400
/** Raio do anel da cabine ao par, em fração da casa. */
export const PAR_CABIN_RING_CELLS = 0.45

const DIRECTION_VECTOR: Record<ConveyorDirection, RegionPoint> = {
  norte: { x: 0, y: -1 },
  sul: { x: 0, y: 1 },
  leste: { x: 1, y: 0 },
  oeste: { x: -1, y: 0 },
}

/** Uma seta fina: a ponta e as duas pernas. */
export interface ConveyorChevron {
  tip: RegionPoint
  left: RegionPoint
  right: RegionPoint
}

/** A cabine de um pino ao próximo, na mesma cena. */
export interface CabinLink {
  from: RegionPoint
  to: RegionPoint
}

export interface ConveyorMarks {
  chevrons: ConveyorChevron[]
  links: CabinLink[]
  /** O centro do anel de cada pino de viagem com cabine ao par, e o raio em px. */
  parRings: { center: RegionPoint; radius: number }[]
}

export const NO_CONVEYOR_MARKS: ConveyorMarks = { chevrons: [], links: [], parRings: [] }

function chevronAt(center: RegionPoint, direction: ConveyorDirection, grid: number): ConveyorChevron {
  const d = DIRECTION_VECTOR[direction]
  const s = grid * CHEVRON_HALF_CELLS
  const back = { x: center.x - d.x * s, y: center.y - d.y * s }
  // Perpendicular à direção: as duas pernas abrem para trás da ponta.
  const p = { x: -d.y, y: d.x }
  return {
    tip: { x: center.x + d.x * s, y: center.y + d.y * s },
    left: { x: back.x + p.x * s, y: back.y + p.y * s },
    right: { x: back.x - p.x * s, y: back.y - p.y * s },
  }
}

/** As setas de uma sala: no centro das casas de passo `CHEVRON_SPACING_CELLS` que caem dentro do polígono. */
function roomChevrons(ring: RegionPoint[], direction: ConveyorDirection, grid: number): ConveyorChevron[] {
  const xs = ring.map((p) => p.x)
  const ys = ring.map((p) => p.y)
  const firstCol = Math.floor(Math.min(...xs) / grid)
  const lastCol = Math.ceil(Math.max(...xs) / grid)
  const firstRow = Math.floor(Math.min(...ys) / grid)
  const lastRow = Math.ceil(Math.max(...ys) / grid)
  const out: ConveyorChevron[] = []
  for (let row = firstRow; row < lastRow; row += CHEVRON_SPACING_CELLS) {
    for (let col = firstCol; col < lastCol; col += CHEVRON_SPACING_CELLS) {
      const center = { x: (col + 0.5) * grid, y: (row + 0.5) * grid }
      if (!pointInRing(center, ring)) continue
      out.push(chevronAt(center, direction, grid))
      if (out.length >= MAX_CHEVRONS_PER_ROOM) return out
    }
  }
  return out
}

/** O que o canvas do mestre desenha para as esteiras e cabines do mapa. */
export function conveyorMarks(map: MapData): ConveyorMarks {
  if (!(map.grid > 0)) return NO_CONVEYOR_MARKS
  const chevrons = conveyorsOf(map).flatMap((conveyor) => {
    const room = map.regions.find((r) => r.id === conveyor.roomId)
    if (room === undefined || room.room === undefined || room.points.length < 3) return []
    return roomChevrons(room.points, conveyor.direction, map.grid)
  })
  const links: CabinLink[] = []
  const parRings: ConveyorMarks['parRings'] = []
  for (const pin of map.pins) {
    const next = cabinOf(map, pin.id)
    if (next === null) continue
    if (pin.kind === 'viagem') {
      parRings.push({ center: { x: pin.x, y: pin.y }, radius: map.grid * PAR_CABIN_RING_CELLS })
      continue
    }
    const target = map.pins.find((p) => p.id === next)
    if (target !== undefined) links.push({ from: { x: pin.x, y: pin.y }, to: { x: target.x, y: target.y } })
  }
  if (chevrons.length === 0 && links.length === 0 && parRings.length === 0) return NO_CONVEYOR_MARKS
  return { chevrons, links, parRings }
}
