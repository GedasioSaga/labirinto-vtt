/**
 * Quem vira GUIA num arrasto (pedido 3, `lib/smartGuides.ts`): a caixa de
 * cada peça que o mestre vê no piso em edição, perto da tela. Montado UMA vez
 * no começo do gesto: o pointermove só varre a lista pronta, sem tocar no
 * mapa nem no redesenho dele.
 *
 * Entram salas e regiões, paredes soltas, desenhos, objetos e escadas. Ficha
 * fica de fora: alinhar sala com ficha é ruído para quem desenha a planta.
 * Peça travada entra (ela não anda, mas está ali e serve de referência); peça
 * de camada oculta não entra, porque não se vê.
 */
import type { MapData } from '../types/map'
import {
  boundsOfDrawing,
  boundsOfProp,
  boundsOfRegion,
  boundsOfStair,
  boundsOfWall,
  type AreaBounds,
  type AreaSelection,
} from './areaSelection'
import { visibleDrawings, visibleProps, visibleRegions, visibleStairs, visibleWalls } from './layers'
import { mapaDoPiso } from './pisos'
import { subtreeIds } from './roomNesting'
import { isDegenerateRegion } from '../pixi/shapes'

/** Retângulo visível em px de mundo (o `computeViewport` do canvas). */
export interface GuideViewport {
  left: number
  top: number
  right: number
  bottom: number
}

export interface GuideBoxesOptions {
  /** Piso em edição: o que está em outro piso não se vê e não alinha. */
  piso: number
  /**
   * O que anda no gesto e tudo o que está selecionado (decisão a de
   * `smartGuides.ts`). Sala excluída leva junto as sub-salas e as paredes
   * delas, que andam com ela (`mapFactory.moveRegion`).
   */
  exclude: AreaSelection
  viewport: GuideViewport
  /** Folga em volta da tela, px de mundo: durante o gesto a peça pode passar um pouco da borda. */
  margin: number
}

function isFiniteBox(box: AreaBounds): boolean {
  return Number.isFinite(box.minX) && Number.isFinite(box.minY) && Number.isFinite(box.maxX) && Number.isFinite(box.maxY)
}

export function guideBoxesForDrag(map: MapData, options: GuideBoxesOptions): AreaBounds[] {
  const doPiso = mapaDoPiso(map, options.piso)
  const hidden = doPiso.hiddenLayers
  const { viewport, margin } = options
  const reach = {
    minX: viewport.left - margin,
    minY: viewport.top - margin,
    maxX: viewport.right + margin,
    maxY: viewport.bottom + margin,
  }
  const boxes: AreaBounds[] = []
  const add = (box: AreaBounds): void => {
    const near = box.minX <= reach.maxX && box.maxX >= reach.minX && box.minY <= reach.maxY && box.maxY >= reach.minY
    if (near && isFiniteBox(box)) boxes.push(box)
  }

  const movingRegions = new Set<string>()
  for (const id of options.exclude.regions) {
    for (const inner of subtreeIds(doPiso.regions, id)) movingRegions.add(inner)
  }
  // Salas que já têm a própria caixa: a parede delas repetiria a mesma guia.
  const roomsWithBox = new Set<string>()
  for (const region of visibleRegions(doPiso.regions, hidden)) {
    if (movingRegions.has(region.id) || isDegenerateRegion(region.points)) continue
    roomsWithBox.add(region.id)
    add(boundsOfRegion(region))
  }

  const excludedWalls = new Set(options.exclude.walls)
  for (const wall of visibleWalls(doPiso.walls, hidden)) {
    if (excludedWalls.has(wall.id)) continue
    if (wall.regionId !== undefined && (movingRegions.has(wall.regionId) || roomsWithBox.has(wall.regionId))) continue
    add(boundsOfWall(wall))
  }

  const excludedDrawings = new Set(options.exclude.drawings)
  for (const drawing of visibleDrawings(doPiso.drawings, hidden)) {
    if (!excludedDrawings.has(drawing.id)) add(boundsOfDrawing(drawing))
  }

  const excludedProps = new Set(options.exclude.props)
  for (const prop of visibleProps(doPiso.props, hidden)) {
    if (!excludedProps.has(prop.id)) add(boundsOfProp(prop))
  }

  const excludedStairs = new Set(options.exclude.stairs)
  for (const stair of visibleStairs(doPiso.stairs, hidden)) {
    if (!excludedStairs.has(stair.id)) add(boundsOfStair(stair))
  }

  return boxes
}
