/**
 * Alinhar e distribuir a seleção (item 19 de docs/features-candidatas-2026-09-21.md:
 * "cinco pilares 'quase' alinhados deixam o mapa torto"). Módulo PURO — sem
 * PixiJS nem store; a store embrulha o resultado em UMA entrada de histórico.
 *
 * Nada de geometria nova: a caixa de cada item vem de `areaSelectionBounds` e o
 * deslocamento de `moveAreaSelection` (lib/areaSelection.ts), os mesmos que o
 * arrasto do grupo e o nudge por seta já usam — então os 7 tipos, o vínculo
 * Sala↔Parede e o filtro de item travado se comportam igual aqui.
 *
 * Convenção de Figma/PowerPoint: esquerda/direita/topo/base alinham pela borda
 * EXTREMA do conjunto (o item da ponta não sai do lugar); centro (eixo
 * horizontal) e meio (eixo vertical) alinham no centro da caixa do conjunto.
 * Distribuir deixa o ESPAÇO entre vizinhos igual, com as duas pontas paradas.
 */
import type { MapData } from '../types/map'
import type { SelectionItem } from './selectionModel'
import { selectionToAreaSelection } from './selectionModel'
import { areaSelectionBounds, moveAreaSelection, EMPTY_AREA_SELECTION, type AreaBounds, type AreaSelection } from './areaSelection'
import { ancestorsOf, subtreeIds } from './roomNesting'

export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'

/** Menor deslocamento que conta como "andou": abaixo disso o item já está no lugar. */
const MOVE_EPSILON = 1e-6

/** Um bloco que anda inteiro: um item, ou uma Sala com as paredes dela. */
interface AlignUnit {
  /** O que `moveAreaSelection` recebe para mover o bloco. */
  move: AreaSelection
  bounds: AreaBounds
}

/**
 * Parte a seleção em blocos que andam inteiros. Parede de Sala é só um pedaço
 * da Sala (`moveWall` delega para `moveRegion`, que leva a sala toda): as
 * paredes da mesma Sala viram UM bloco com a caixa da Sala, e somem de vez se a
 * própria Sala (ou uma sala de fora dela) também está selecionada. Sub-sala
 * cuja sala de fora está na seleção anda com ela e não conta à parte.
 */
function unitsOf(map: MapData, items: readonly SelectionItem[]): AlignUnit[] {
  const area = selectionToAreaSelection(items)
  const selectedRegions = new Set(area.regions)
  const coveredRegions = new Set<string>()
  for (const id of area.regions) for (const sub of subtreeIds(map.regions, id)) coveredRegions.add(sub)

  const units: AlignUnit[] = []
  const push = (move: AreaSelection, boundsOf: AreaSelection = move) => {
    const bounds = areaSelectionBounds(map, boundsOf)
    if (bounds) units.push({ move, bounds })
  }

  for (const id of area.regions) {
    if (ancestorsOf(map.regions, id).some((a) => selectedRegions.has(a.id))) continue
    push({ ...EMPTY_AREA_SELECTION, regions: [id] })
  }

  const wallsByRoom = new Map<string, string[]>()
  for (const id of area.walls) {
    const regionId = map.walls.find((w) => w.id === id)?.regionId
    if (regionId === undefined) {
      push({ ...EMPTY_AREA_SELECTION, walls: [id] })
      continue
    }
    if (coveredRegions.has(regionId)) continue
    wallsByRoom.set(regionId, [...(wallsByRoom.get(regionId) ?? []), id])
  }
  for (const [regionId, walls] of wallsByRoom) {
    push({ ...EMPTY_AREA_SELECTION, walls }, { ...EMPTY_AREA_SELECTION, regions: [regionId], walls })
  }

  for (const id of area.lights) push({ ...EMPTY_AREA_SELECTION, lights: [id] })
  for (const id of area.tokens) push({ ...EMPTY_AREA_SELECTION, tokens: [id] })
  for (const id of area.props) push({ ...EMPTY_AREA_SELECTION, props: [id] })
  for (const id of area.stairs) push({ ...EMPTY_AREA_SELECTION, stairs: [id] })
  for (const id of area.drawings) push({ ...EMPTY_AREA_SELECTION, drawings: [id] })
  return units
}

/** Quantos blocos independentes a seleção tem (Sala + paredes dela = 1). */
export function alignableUnitCount(map: MapData, items: readonly SelectionItem[]): number {
  return unitsOf(map, items).length
}

function moveUnit(map: MapData, unit: AlignUnit, dx: number, dy: number): MapData {
  if (Math.abs(dx) < MOVE_EPSILON && Math.abs(dy) < MOVE_EPSILON) return map
  return moveAreaSelection(map, unit.move, dx, dy)
}

const centerX = (b: AreaBounds) => (b.minX + b.maxX) / 2
const centerY = (b: AreaBounds) => (b.minY + b.maxY) / 2

/** Deslocamento de cada bloco para a borda/centro pedido, dado o conjunto. */
function alignDelta(edge: AlignEdge, all: AreaBounds, b: AreaBounds): { dx: number; dy: number } {
  switch (edge) {
    case 'left':
      return { dx: all.minX - b.minX, dy: 0 }
    case 'center':
      return { dx: centerX(all) - centerX(b), dy: 0 }
    case 'right':
      return { dx: all.maxX - b.maxX, dy: 0 }
    case 'top':
      return { dx: 0, dy: all.minY - b.minY }
    case 'middle':
      return { dx: 0, dy: centerY(all) - centerY(b) }
    case 'bottom':
      return { dx: 0, dy: all.maxY - b.maxY }
  }
}

function unionBounds(units: readonly AlignUnit[]): AreaBounds {
  return {
    minX: Math.min(...units.map((u) => u.bounds.minX)),
    minY: Math.min(...units.map((u) => u.bounds.minY)),
    maxX: Math.max(...units.map((u) => u.bounds.maxX)),
    maxY: Math.max(...units.map((u) => u.bounds.maxY)),
  }
}

/**
 * Alinha os itens selecionados. Devolve o MESMO `map` quando há menos de 2
 * blocos ou quando nada precisou andar — a store usa isso para não empilhar
 * um passo vazio no desfazer.
 */
export function alignSelectionItems(map: MapData, items: readonly SelectionItem[], edge: AlignEdge): MapData {
  const units = unitsOf(map, items)
  if (units.length < 2) return map
  const all = unionBounds(units)
  let next = map
  for (const unit of units) {
    const { dx, dy } = alignDelta(edge, all, unit.bounds)
    next = moveUnit(next, unit, dx, dy)
  }
  return next
}

/**
 * Distribui os itens selecionados: ordena pela posição no eixo (centro, e a
 * borda de início no empate), mantém o primeiro e o último parados e põe os do
 * meio a espaço igual entre vizinhos. Menos de 3 blocos: devolve o mesmo `map`.
 */
export function distributeSelectionItems(map: MapData, items: readonly SelectionItem[], axis: DistributeAxis): MapData {
  const units = unitsOf(map, items)
  if (units.length < 3) return map
  const start = (b: AreaBounds) => (axis === 'horizontal' ? b.minX : b.minY)
  const end = (b: AreaBounds) => (axis === 'horizontal' ? b.maxX : b.maxY)
  const middle = (b: AreaBounds) => (start(b) + end(b)) / 2
  const sorted = [...units].sort((a, b) => middle(a.bounds) - middle(b.bounds) || start(a.bounds) - start(b.bounds))

  const first = sorted[0].bounds
  const last = sorted[sorted.length - 1].bounds
  const occupied = sorted.reduce((sum, u) => sum + (end(u.bounds) - start(u.bounds)), 0)
  const gap = (end(last) - start(first) - occupied) / (sorted.length - 1)

  let next = map
  let cursor = end(first) + gap
  for (const unit of sorted.slice(1, -1)) {
    const delta = cursor - start(unit.bounds)
    next = axis === 'horizontal' ? moveUnit(next, unit, delta, 0) : moveUnit(next, unit, 0, delta)
    cursor += end(unit.bounds) - start(unit.bounds) + gap
  }
  return next
}
