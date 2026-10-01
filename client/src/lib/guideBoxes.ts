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
 *
 * Objeto e escada medem o DESENHO, não a geometria da seleção por área: o
 * objeto girado e o lance com a largura do degrau. Guia que encaixa numa
 * borda onde não há nada é o desalinhamento que o pedido quer acabar. O
 * objeto e a escada ARRASTADOS medem igual (`guideBoxOfProp`,
 * `guideBoxOfStair`): borda com borda só fecha se as duas forem a que se vê.
 *
 * O arrasto de PONTO (fatia 2) soma às caixas os pontos que elas não cobrem
 * (`guidePointsForDrag`): a ponta de cada parede, o vértice de cada sala, o
 * centro de cada ficha.
 */
import type { MapData, Prop, Stair } from '../types/map'
import { boundsOfDrawing, boundsOfRegion, boundsOfWall, type AreaBounds, type AreaSelection } from './areaSelection'
import { visibleDrawings, visibleProps, visibleRegions, visibleStairs, visibleTokens, visibleWalls } from './layers'
import { ehMovelRedondo } from './mobilia'
import { mapaDoPiso } from './pisos'
import { subtreeIds } from './roomNesting'
import { rotationTrig } from './roomRotation'
import { pointBox } from './smartGuides'
import { stairSpiralCircle } from './stairs'
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
   * delas, que andam com ela (`mapFactory.moveRegion`); parede de sala
   * excluída leva a sala, porque mover a parede move a sala inteira
   * (`mapFactory.moveWall`).
   */
  exclude: AreaSelection
  viewport: GuideViewport
  /** Folga em volta da tela, px de mundo: durante o gesto a peça pode passar um pouco da borda. */
  margin: number
}

function isFiniteBox(box: AreaBounds): boolean {
  return Number.isFinite(box.minX) && Number.isFinite(box.minY) && Number.isFinite(box.maxX) && Number.isFinite(box.maxY)
}

function unionBox(a: AreaBounds, b: AreaBounds): AreaBounds {
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }
}

/**
 * O objeto como aparece: o sprite e a silhueta da mobília giram em volta do
 * centro (`pixi/drawProps.ts`, `pixi/drawPropSilhouettes.ts`). Sem o giro, um
 * objeto de 100 x 50 em pé ganhava a caixa deitada. `rotationTrig` é exato nos
 * quartos de volta: com `Math.cos(π/2)` (6e-17) a caixa do objeto em pé
 * ficaria a um fio da borda. O barril desenha a elipse inscrita, e fora dos
 * quartos de volta a caixa dela é menor que a do retângulo girado.
 */
export function guideBoxOfProp(prop: Prop): AreaBounds {
  const { sin, cos } = rotationTrig(prop.rotation ?? 0)
  const halfWidth = prop.width / 2
  const halfHeight = prop.height / 2
  const round = ehMovelRedondo(prop.mobilia)
  const reachX = round ? Math.hypot(halfWidth * cos, halfHeight * sin) : Math.abs(halfWidth * cos) + Math.abs(halfHeight * sin)
  const reachY = round ? Math.hypot(halfWidth * sin, halfHeight * cos) : Math.abs(halfWidth * sin) + Math.abs(halfHeight * cos)
  return { minX: prop.x - reachX, minY: prop.y - reachY, maxX: prop.x + reachX, maxY: prop.y + reachY }
}

/**
 * A escada como aparece. Espiral: o círculo desenhado (`stairSpiralCircle`).
 * Reta, em L ou dupla: a união das placas dos lances (`planStairFlight`,
 * `pixi/stairFlight.ts`), cada uma com o lance de linha do meio e `stepWidth`
 * de largura. Só a linha do meio punha a borda da sala no meio da escada. A
 * placa pintada ainda encosta no pixel físico, a menos de 1 px de tela desta
 * conta. `null` = nada desenhado (lance de comprimento zero).
 */
export function guideBoxOfStair(stair: Stair): AreaBounds | null {
  if (stair.shape === 'spiral') {
    const circle = stairSpiralCircle(stair)
    if (circle === null) return null
    const { center, radius } = circle
    return { minX: center.x - radius, minY: center.y - radius, maxX: center.x + radius, maxY: center.y + radius }
  }
  // Mesma regra de `planStairFlight`: largura que não forma lance pinta só a moldura, na linha do meio.
  const halfWidth = (Number.isFinite(stair.stepWidth) ? Math.max(0, stair.stepWidth) : 0) / 2
  let box: AreaBounds | null = null
  for (const { x1, y1, x2, y2 } of stair.segments) {
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (!(length > 0) || !Number.isFinite(length)) continue
    // A placa vai meia largura para cada lado na perpendicular do lance: em x
    // isso pesa o quanto o lance corre em y, e vice-versa.
    const reachX = (halfWidth * Math.abs(y2 - y1)) / length
    const reachY = (halfWidth * Math.abs(x2 - x1)) / length
    const flight: AreaBounds = {
      minX: Math.min(x1, x2) - reachX,
      minY: Math.min(y1, y2) - reachY,
      maxX: Math.max(x1, x2) + reachX,
      maxY: Math.max(y1, y2) + reachY,
    }
    box = box === null ? flight : unionBox(box, flight)
  }
  return box
}

/** A tela com a folga do gesto, em px de mundo: o que fica fora não vira guia. */
function reachOf({ viewport, margin }: GuideBoxesOptions): AreaBounds {
  return { minX: viewport.left - margin, minY: viewport.top - margin, maxX: viewport.right + margin, maxY: viewport.bottom + margin }
}

/**
 * As salas que andam no gesto: as excluídas, as donas de parede excluída
 * (`moveWall` leva a sala) e as sub-salas de todas elas (`moveRegion` leva a
 * subárvore). Nenhuma delas pode ser guia: com o delta total do gesto, a
 * caixa de partida prenderia a peça onde ela estava.
 */
function movingRegionIds(doPiso: MapData, exclude: AreaSelection): Set<string> {
  const roots = new Set(exclude.regions)
  const excludedWalls = new Set(exclude.walls)
  for (const wall of doPiso.walls) {
    if (wall.regionId !== undefined && excludedWalls.has(wall.id)) roots.add(wall.regionId)
  }
  const moving = new Set<string>()
  for (const id of roots) {
    for (const inner of subtreeIds(doPiso.regions, id)) moving.add(inner)
  }
  return moving
}

export function guideBoxesForDrag(map: MapData, options: GuideBoxesOptions): AreaBounds[] {
  const doPiso = mapaDoPiso(map, options.piso)
  const hidden = doPiso.hiddenLayers
  const reach = reachOf(options)
  const boxes: AreaBounds[] = []
  const add = (box: AreaBounds): void => {
    const near = box.minX <= reach.maxX && box.maxX >= reach.minX && box.minY <= reach.maxY && box.maxY >= reach.minY
    if (near && isFiniteBox(box)) boxes.push(box)
  }

  const movingRegions = movingRegionIds(doPiso, options.exclude)
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
    if (!excludedProps.has(prop.id)) add(guideBoxOfProp(prop))
  }

  const excludedStairs = new Set(options.exclude.stairs)
  for (const stair of visibleStairs(doPiso.stairs, hidden)) {
    if (excludedStairs.has(stair.id)) continue
    const box = guideBoxOfStair(stair)
    if (box !== null) add(box)
  }

  return boxes
}

/**
 * Pontos soltos que viram guia no arrasto de ponto (`dragPointWithGuides`):
 *  - 'wall-ends': a ponta de cada parede, solta ou de sala (é ela que fecha o
 *    canto com a ponta arrastada);
 *  - 'room-vertices': o vértice de cada sala e região;
 *  - 'token-centers': o centro de cada ficha. A ficha só alinha com ficha
 *    (é peça de jogo, não de planta), e por isso não leva caixa nenhuma.
 */
export type GuidePointKind = 'wall-ends' | 'room-vertices' | 'token-centers'

/**
 * Os pontos de um tipo como caixas sem tamanho (`pointBox`), com as mesmas
 * regras das caixas: só o piso em edição, nada de camada oculta, nada do que
 * anda no gesto, só perto da tela. Montado uma vez, no pointerdown.
 */
export function guidePointsForDrag(map: MapData, kind: GuidePointKind, options: GuideBoxesOptions): AreaBounds[] {
  const doPiso = mapaDoPiso(map, options.piso)
  const hidden = doPiso.hiddenLayers
  const reach = reachOf(options)
  const points: AreaBounds[] = []
  const add = (x: number, y: number): void => {
    const near = x >= reach.minX && x <= reach.maxX && y >= reach.minY && y <= reach.maxY
    if (near && Number.isFinite(x) && Number.isFinite(y)) points.push(pointBox({ x, y }))
  }

  if (kind === 'token-centers') {
    const excludedTokens = new Set(options.exclude.tokens)
    for (const token of visibleTokens(doPiso.tokens, hidden)) {
      if (!excludedTokens.has(token.id)) add(token.x, token.y)
    }
    return points
  }

  const movingRegions = movingRegionIds(doPiso, options.exclude)
  if (kind === 'room-vertices') {
    for (const region of visibleRegions(doPiso.regions, hidden)) {
      if (movingRegions.has(region.id) || isDegenerateRegion(region.points)) continue
      for (const point of region.points) add(point.x, point.y)
    }
    return points
  }

  const excludedWalls = new Set(options.exclude.walls)
  for (const wall of visibleWalls(doPiso.walls, hidden)) {
    if (excludedWalls.has(wall.id) || (wall.regionId !== undefined && movingRegions.has(wall.regionId))) continue
    add(wall.x1, wall.y1)
    add(wall.x2, wall.y2)
  }
  return points
}
