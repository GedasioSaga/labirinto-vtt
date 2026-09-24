import type {
  MapData, Wall, Light, Region, Token, Prop, Drawing, DoorState, LayerId, GridSettings,
  Stair, StairDirection, DoorKind, MapScale, MeasurementMode, FloorPiece, FloorStyle, MapLine, MapMarker, MapFrame,
  ConcealZone, Pin, PinIcon, PinKind, RoomMeta, MovementRules, SceneFloor,
} from '../types/map'
import type { Point } from '../pixi/world'
import { syncLinkedWallsToPoints, remapForInsert, remapForRemove, translateLinkedWalls, previousEdgeIndex } from './roomLink'
import { simplifyPolygon, chaikinSmooth } from './regionSmoothing'
import { edgesCoveredByParent, findContainingRoom, insertIndexAfterSubtree, subtreeIds } from './roomNesting'
import { isAxisAlignedRect, rectCornerShift, resizeRoomCorner, resizeRoomDimensions as resizeRoomDimensionsPoints, type RoomCorner } from './roomOps'
import {
  normalizeRotation, roomCentroid, roomRotationOf, rotatePointAround, rotateVector, rotationTrig, withoutRotationNoise,
  type RotationTrig,
} from './roomRotation'
import { defaultMeasurementModeForShape } from './measurement'
import { moveBlocos, type Bloco } from './floorBlocks'
import { apagarBlocosDoChao } from './floorTool'
import { DEFAULT_FLOOR_STYLE } from './mapFile'
import { sameDestination, sameExits } from './pinTravel'
import { passageOf } from './pins'
import { carryAttachedPins, carryPinsByTokenSteps } from './pinAttach'
import { carrierIdOf, followStep } from './carry'
import {
  resizeRectDrawing, resizeEllipseDrawing, resizePolygonDrawing, resizePropBox, resizeCircleDrawingRadius,
  type Corner, type ResizeModifiers,
} from './objectTransform'

/**
 * Minimapa do Resident Evil: mapa novo nasce sem grade. Mapa salvo continua com
 * o `showGrid` dele (arquivo sem o campo abre com grade, mapFile.ts).
 *
 * Exportada porque a tela de criação (screens/NewDungeonMap.tsx) precisa do
 * MESMO valor para o interruptor "Mostrar grade" nascer no estado em que o mapa
 * nasce. Repetir o literal lá seria um segundo lugar onde a tela e o mapa podem
 * divergir sem ninguém perceber — foi exatamente assim que a prévia passou a
 * prometer uma grade que o editor não desenhava.
 */
export const NEW_MAP_SHOW_GRID = false

export function createEmptyMap(id: string, name: string, width: number, height: number, grid: number): MapData {
  return {
    id,
    name,
    width,
    height,
    grid,
    gridShape: 'square',
    showGrid: NEW_MAP_SHOW_GRID,
    // Grade do mapa novo quando o usuário ligar: preto translúcido aparece
    // sobre o chão marrom e sobre o fundo escuro (a grade de fora do piso usa
    // outra cor no PixiCanvas). Diverge DE PROPÓSITO do default que
    // deserializeMap (mapFile.ts) aplica a mapa antigo sem gridSettings.
    gridSettings: { color: '#000000', opacity: 0.25, lineWidth: 1, lineStyle: 'solid' },
    background: { type: 'color', src: '#2b2b2b' },
    walls: [],
    lights: [],
    regions: [],
    tokens: [],
    props: [],
    stairs: [],
    drawings: [],
    floor: [],
    floorStyle: { ...DEFAULT_FLOOR_STYLE },
    lines: [],
    markers: [],
    concealZones: [],
    pins: [],
    frame: null,
    fog: { mode: 'none', revealed: [] },
    hiddenLayers: [],
    lockedLayers: [],
    // Metros para mapa novo; mapa salvo sem scale continua em pés (mapFile.ts).
    scale: { unitsPerCell: 1.5, unit: 'm', precision: 1 },
    measurementMode: 'chessboard',
    ownerId: null,
    scenarioLink: null,
  }
}

export function addFloorPiece(map: MapData, piece: FloorPiece): MapData {
  return { ...map, floor: [...map.floor, piece] }
}

/** Várias peças de uma vez, na ordem dada — "Chão a partir da imagem" vira 1 undo, não N. */
export function addFloorPieces(map: MapData, pieces: FloorPiece[]): MapData {
  if (pieces.length === 0) return map
  return { ...map, floor: [...map.floor, ...pieces] }
}

export function updateFloorPiece(map: MapData, pieceId: string, patch: Partial<Omit<FloorPiece, 'id'>>): MapData {
  if (!map.floor.some((piece) => piece.id === pieceId)) return map
  return { ...map, floor: map.floor.map((piece) => (piece.id === pieceId ? { ...piece, ...patch } : piece)) }
}

export function removeFloorPiece(map: MapData, pieceId: string): MapData {
  if (!map.floor.some((piece) => piece.id === pieceId)) return map
  return { ...map, floor: map.floor.filter((piece) => piece.id !== pieceId) }
}

/** Move a peça `delta` posições na ordem de aplicação (negativo = mais cedo). */
export function reorderFloorPiece(map: MapData, pieceId: string, delta: number): MapData {
  const from = map.floor.findIndex((piece) => piece.id === pieceId)
  if (from < 0) return map
  const to = Math.max(0, Math.min(map.floor.length - 1, from + delta))
  if (to === from) return map
  const floor = [...map.floor]
  const [piece] = floor.splice(from, 1)
  floor.splice(to, 0, piece)
  return { ...map, floor }
}

export function moveFloorPiece(map: MapData, pieceId: string, dx: number, dy: number): MapData {
  const piece = map.floor.find((p) => p.id === pieceId)
  if (!piece) return map
  const { shape } = piece
  const moved: FloorPiece['shape'] =
    shape.kind === 'corridor'
      ? { ...shape, points: shape.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) }
      : shape.kind === 'poly'
        ? { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
        : // Blocos andam em célula inteira — sair da grade é perder a única
          // promessa da forma (ver `moveBlocos`).
          shape.kind === 'blocos'
          ? moveBlocos(shape, dx, dy)
          : { ...shape, cx: shape.cx + dx, cy: shape.cy + dy }
  return updateFloorPiece(map, pieceId, { shape: moved })
}

/**
 * Botão direito do pincel de blocos: apaga as células do chão numa entrada de
 * histórico só. Devolve o MESMO mapa quando o gesto não apagou nada — aí o
 * chamador não empurra um Ctrl+Z vazio (ver `apagarBlocosDoChao`).
 */
export function eraseFloorBlocks(map: MapData, blocos: readonly Bloco[], cell: number, novoId: () => string): MapData {
  const floor = apagarBlocosDoChao(map.floor, blocos, cell, novoId)
  return floor === null ? map : { ...map, floor }
}

export function setFloorStyle(map: MapData, patch: Partial<FloorStyle>): MapData {
  return { ...map, floorStyle: { ...map.floorStyle, ...patch } }
}

/** Traços e marcadores de uma vez — "Linhas e portas a partir da imagem" vira 1 undo. */
export function addMapDetails(map: MapData, lines: MapLine[], markers: MapMarker[]): MapData {
  if (lines.length === 0 && markers.length === 0) return map
  return { ...map, lines: [...map.lines, ...lines], markers: [...map.markers, ...markers] }
}

export function setMapFrame(map: MapData, frame: MapFrame | null): MapData {
  return { ...map, frame }
}

/** Resultado de "Recriar minimapa a partir da imagem" inteiro de uma vez: 1 undo. */
export function applyMinimapTrace(map: MapData, pieces: FloorPiece[], lines: MapLine[], markers: MapMarker[], style: Partial<FloorStyle>): MapData {
  return setFloorStyle(addMapDetails(addFloorPieces(map, pieces), lines, markers), style)
}

export function addWall(map: MapData, wall: Wall): MapData {
  return { ...map, walls: [...map.walls, wall] }
}

export function removeWall(map: MapData, wallId: string): MapData {
  return { ...map, walls: map.walls.filter((w) => w.id !== wallId) }
}

export function addLight(map: MapData, light: Light): MapData {
  return { ...map, lights: [...map.lights, light] }
}

export function removeLight(map: MapData, lightId: string): MapData {
  return { ...map, lights: map.lights.filter((l) => l.id !== lightId) }
}

export function addRegion(map: MapData, region: Region): MapData {
  return { ...map, regions: [...map.regions, region] }
}

/** Apaga a região e, se for Sala com sub-salas, a subárvore inteira com as paredes vinculadas. */
export function removeRegion(map: MapData, regionId: string): MapData {
  const ids = subtreeIds(map.regions, regionId)
  return {
    ...map,
    regions: map.regions.filter((r) => !ids.has(r.id)),
    walls: map.walls.filter((w) => w.regionId === undefined || !ids.has(w.regionId)),
  }
}

/** Sub-sala (`parentId` de uma sala existente) entra logo depois da subárvore da mãe: desenha por cima e ganha o clique. */
export function addRoom(map: MapData, region: Region, walls: Wall[]): MapData {
  const hasParent = region.parentId !== undefined && map.regions.some((r) => r.id === region.parentId)
  const index = hasParent && region.parentId !== undefined ? insertIndexAfterSubtree(map.regions, region.parentId) : map.regions.length
  const regions = [...map.regions.slice(0, index), region, ...map.regions.slice(index)]
  return { ...map, regions, walls: [...map.walls, ...walls] }
}

export function updateWallPoint(map: MapData, wallId: string, endpoint: 0 | 1, x: number, y: number): MapData {
  const wall = map.walls.find((w) => w.id === wallId)
  if (!wall || wall.regionId !== undefined) return map

  return {
    ...map,
    walls: map.walls.map((w) =>
      w.id === wallId ? (endpoint === 0 ? { ...w, x1: x, y1: y } : { ...w, x2: x, y2: y }) : w,
    ),
  }
}

export function moveWall(map: MapData, wallId: string, dx: number, dy: number): MapData {
  const wall = map.walls.find((w) => w.id === wallId)
  if (!wall) return map
  if (wall.regionId !== undefined) return moveRegion(map, wall.regionId, dx, dy)

  return {
    ...map,
    walls: map.walls.map((w) =>
      w.id === wallId ? { ...w, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy } : w,
    ),
  }
}

export function updateRegionPoint(map: MapData, regionId: string, index: number, x: number, y: number): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  if (!region) return map

  const points = region.points.map((p, i) => (i === index ? { x, y } : p))

  return {
    ...map,
    regions: map.regions.map((r) => (r.id === regionId ? { ...r, points } : r)),
    walls: syncLinkedWallsToPoints(map.walls, regionId, region.points, points),
  }
}

export function insertRegionPoint(
  map: MapData,
  regionId: string,
  afterEdgeIndex: number,
  x: number,
  y: number,
  newWallId: string,
): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  if (!region) return map

  const { x: px, y: py } = insertPointOutsideDoor(map.walls, region, afterEdgeIndex, { x, y })
  const points = [
    ...region.points.slice(0, afterEdgeIndex + 1),
    { x: px, y: py },
    ...region.points.slice(afterEdgeIndex + 1),
  ]

  return {
    ...map,
    regions: map.regions.map((r) => (r.id === regionId ? { ...r, points } : r)),
    walls: remapForInsert(
      map.walls,
      regionId,
      afterEdgeIndex,
      newWallId,
      px,
      py,
      region.points[afterEdgeIndex],
      region.points[(afterEdgeIndex + 1) % region.points.length],
    ),
  }
}

/**
 * Vértice novo pedido dentro do vão de uma porta (o ponto do meio da aresta
 * cai no meio de porta centralizada) vai para a ponta mais próxima da porta:
 * a porta fica inteira numa das arestas novas. Porta que ocupa a aresta
 * inteira não tem ponta livre: o ponto fica onde foi pedido.
 */
function insertPointOutsideDoor(walls: readonly Wall[], region: Region, edge: number, point: Point): Point {
  const a = region.points[edge]
  const b = region.points[(edge + 1) % region.points.length]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return point
  const param = (p: Point) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  const t = param(point)
  for (const w of walls) {
    if (w.regionId !== region.id || w.regionEdgeIndex !== edge || w.door === null) continue
    const t1 = param({ x: w.x1, y: w.y1 })
    const t2 = param({ x: w.x2, y: w.y2 })
    const lo = Math.min(t1, t2)
    const hi = Math.max(t1, t2)
    if (t <= lo || t >= hi || (lo <= 0 && hi >= 1)) continue
    const end = t - lo <= hi - t ? lo : hi
    return { x: a.x + dx * end, y: a.y + dy * end }
  }
  return point
}

export function removeRegionPoint(map: MapData, regionId: string, index: number): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  if (!region) return map
  if (region.points.length <= 3) return map

  const n = region.points.length
  const prevPoint = region.points[previousEdgeIndex(index, n)]
  const nextPoint = region.points[(index + 1) % n]
  const points = region.points.filter((_, i) => i !== index)

  return {
    ...map,
    regions: map.regions.map((r) => (r.id === regionId ? { ...r, points } : r)),
    walls: remapForRemove(map.walls, regionId, index, n, prevPoint, nextPoint, region.points[index]),
  }
}

/**
 * Preenche os "buracos" no vínculo Região↔Parede: para cada aresta
 * `0..n-1` de `region.points` que ainda não tem nenhuma Wall com
 * `regionId`+`regionEdgeIndex` correspondentes, cria uma parede nova
 * traçando essa aresta. Parede já existente numa aresta não é tocada
 * (mesma referência) nem duplicada — a função só COMPLETA, nunca substitui.
 *
 * Se a região não existir, ou já tiver todas as arestas com parede,
 * devolve `map` pela mesma referência (sem mudança).
 */
export function linkRegionWalls(map: MapData, regionId: string): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  if (!region) return map

  const n = region.points.length
  const linkedEdgeIndexes = new Set(
    map.walls.filter((w) => w.regionId === regionId).map((w) => w.regionEdgeIndex),
  )

  const newWalls: Wall[] = []
  for (let edgeIndex = 0; edgeIndex < n; edgeIndex += 1) {
    if (linkedEdgeIndexes.has(edgeIndex)) continue
    const from = region.points[edgeIndex]
    const to = region.points[(edgeIndex + 1) % n]
    newWalls.push({
      id: crypto.randomUUID(),
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId,
      regionEdgeIndex: edgeIndex,
    })
  }

  if (newWalls.length === 0) return map

  return { ...map, walls: [...map.walls, ...newWalls] }
}

/**
 * Suaviza o contorno de uma Região: aplica `simplifyPolygon` (remove
 * ziguezague/serrilhado de pixel) e, em seguida, `chaikinSmooth` de 1
 * iteração (arredonda os cantos restantes) nos pontos atuais.
 *
 * Como a quantidade e a posição dos pontos mudam, qualquer parede já
 * vinculada a esta região (`wall.regionId === regionId`) perde sentido
 * geométrico — cada uma traçava uma aresta específica de `region.points`
 * que não existe mais do mesmo jeito. Por isso, SE a região tinha parede
 * vinculada, todas são removidas e um conjunto novo e completo nasce ao
 * redor do contorno suavizado, reaproveitando a mesma lógica de
 * `linkRegionWalls` (que preenche toda aresta sem parede) em vez de duplicar
 * a criação de Wall aqui. Se a região não tinha nenhuma parede vinculada, só
 * os pontos mudam — nenhuma parede é tocada.
 *
 * Região inexistente devolve `map` pela mesma referência.
 */
export function smoothRegion(map: MapData, regionId: string): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  if (!region) return map

  const smoothedPoints = chaikinSmooth(simplifyPolygon(region.points), 1)

  const mapWithSmoothedPoints: MapData = {
    ...map,
    regions: map.regions.map((r) => (r.id === regionId ? { ...r, points: smoothedPoints } : r)),
  }

  const hadLinkedWalls = map.walls.some((w) => w.regionId === regionId)
  if (!hadLinkedWalls) return mapWithSmoothedPoints

  const mapWithoutOldWalls: MapData = {
    ...mapWithSmoothedPoints,
    walls: mapWithSmoothedPoints.walls.filter((w) => w.regionId !== regionId),
  }

  // Portas não somem ao suavizar: voltam no ponto mais perto do contorno novo,
  // com o mesmo tamanho, tipo e estado.
  const doors = map.walls.filter((w) => w.regionId === regionId && w.door !== null)
  return doors.reduce((acc, doorWall) => restoreDoorOnRegion(acc, regionId, doorWall), linkRegionWalls(mapWithoutOldWalls, regionId))
}

function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function restoreDoorOnRegion(map: MapData, regionId: string, doorWall: Wall): MapData {
  const door = doorWall.door
  if (!door) return map
  const mid = { x: (doorWall.x1 + doorWall.x2) / 2, y: (doorWall.y1 + doorWall.y2) / 2 }
  const length = Math.hypot(doorWall.x2 - doorWall.x1, doorWall.y2 - doorWall.y1)
  let best: Wall | null = null
  let bestDistance = Infinity
  for (const w of map.walls) {
    if (w.regionId !== regionId || w.door !== null) continue
    const d = distancePointToSegment(mid, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })
    if (d < bestDistance) {
      best = w
      bestDistance = d
    }
  }
  if (!best) return map
  const before = new Set(map.walls.map((w) => w.id))
  const withDoor = addDoorOnWall(map, best.id, mid, length, door.kind)
  return {
    ...withDoor,
    walls: withDoor.walls.map((w) => (!before.has(w.id) && w.door !== null ? { ...w, door: { ...door } } : w)),
  }
}

/**
 * Recalcula a Sala de fora de `regionId` depois de mover: a sala mais funda
 * que contém a movida (fora da própria subárvore) vira mãe e a subárvore vai
 * para logo depois da subárvore dela no array; fora de todas vira sala de
 * topo, no mesmo lugar do array. Cor não muda. Sem mudança (ou região que não
 * é Sala) devolve `map` pela mesma referência.
 */
export function reparentRoom(map: MapData, regionId: string, before?: MapData, sourceId: string = regionId): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  if (!region || region.room === undefined) return map
  const subtree = subtreeIds(map.regions, regionId)
  const others = map.regions.filter((r) => !subtree.has(r.id))
  const parent = findContainingRoom(others, region.points)
  const currentParentId = region.parentId !== undefined && others.some((r) => r.id === region.parentId) ? region.parentId : undefined
  // `before` é o mapa de antes do gesto (mover, redimensionar, duplicar a partir de `sourceId`).
  const newWalls = before ? wallsForEdgesLeftByParent(before, sourceId, map.walls, region, parent ?? null) : []
  if (parent?.id === currentParentId) return newWalls.length === 0 ? map : { ...map, walls: [...map.walls, ...newWalls] }

  const { parentId: _previousParent, ...withoutParent } = region
  const updated: Region = parent ? { ...withoutParent, parentId: parent.id } : withoutParent
  const block = map.regions.filter((r) => subtree.has(r.id)).map((r) => (r.id === regionId ? updated : r))
  // O primeiro índice da subárvore já é a posição dela entre as outras (nada da subárvore vem antes).
  const at = parent ? insertIndexAfterSubtree(others, parent.id) : map.regions.findIndex((r) => subtree.has(r.id))
  return {
    ...map,
    regions: [...others.slice(0, at), ...block, ...others.slice(at)],
    walls: newWalls.length === 0 ? map.walls : [...map.walls, ...newWalls],
  }
}

/**
 * Sub-sala nasce sem parede nas arestas que estavam sobre a parede da mãe.
 * Depois de mover, redimensionar ou duplicar, a aresta que ESTAVA coberta pela
 * mãe antiga (sala `sourceId` em `before`) e não está coberta pela mãe nova
 * ganha parede vinculada — com ou sem troca de mãe. Buraco feito pelo usuário
 * (aresta sem parede que não estava sobre a mãe) continua buraco; aresta que
 * já tem parede (ou pedaço) não é tocada.
 */
function wallsForEdgesLeftByParent(before: MapData, sourceId: string, walls: readonly Wall[], region: Region, parent: Region | null): Wall[] {
  const old = before.regions.find((r) => r.id === sourceId)
  if (!old || old.parentId === undefined || old.points.length !== region.points.length) return []
  const oldParentId = old.parentId
  const oldParent = before.regions.find((r) => r.id === oldParentId && r.room !== undefined)
  if (!oldParent) return []
  const wasCovered = edgesCoveredByParent(old.points, before.walls, oldParent)
  if (wasCovered.size === 0) return []
  const covered = parent ? edgesCoveredByParent(region.points, walls, parent) : new Set<number>()
  const linked = new Set(walls.filter((w) => w.regionId === region.id).map((w) => w.regionEdgeIndex))
  const n = region.points.length
  const out: Wall[] = []
  for (let edge = 0; edge < n; edge += 1) {
    if (!wasCovered.has(edge) || linked.has(edge) || covered.has(edge)) continue
    const from = region.points[edge]
    const to = region.points[(edge + 1) % n]
    out.push({ id: crypto.randomUUID(), x1: from.x, y1: from.y, x2: to.x, y2: to.y, blocksLight: true, blocksMove: true, door: null, regionId: region.id, regionEdgeIndex: edge })
  }
  return out
}

/** Move a região e as sub-salas dela (subárvore inteira), com as paredes vinculadas. */
export function moveRegion(map: MapData, regionId: string, dx: number, dy: number): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  if (!region) return map

  const ids = subtreeIds(map.regions, regionId)
  let walls = map.walls
  for (const id of ids) walls = translateLinkedWalls(walls, id, dx, dy)
  return {
    ...map,
    regions: map.regions.map((r) =>
      ids.has(r.id) ? { ...r, points: r.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : r,
    ),
    walls,
  }
}

/**
 * Gira a região e as sub-salas dela (subárvore inteira) `degrees` graus —
 * positivo = sentido horário na tela — em torno do centróide de área da
 * região girada, com as paredes vinculadas. O alcance é o de `moveRegion`:
 * sala, sub-salas, paredes e portas (a porta mora na parede) vão juntas; o
 * que está DENTRO (ficha, móvel, pino, luz, escada, desenho) fica onde está.
 *
 * O pivô é UM só para a subárvore inteira: a sub-sala gira em volta do centro
 * da mãe, não do dela, senão o quarto giraria dentro da casa em vez de ir
 * junto com ela. Cada parede vinculada é reposicionada pela posição relativa
 * na aresta (`syncLinkedWallsToPoints`, a mesma conta de arrastar vértice e de
 * redimensionar), então a porta continua no mesmo ponto do lado dela. Parede
 * com vínculo mas sem aresta (arquivo antigo) gira inteira, do mesmo jeito que
 * `moveRegion` a desloca inteira.
 *
 * Nas Salas giradas, `room.rotation` acumula o giro e `room.labelOffset` gira
 * junto: o nome fica no mesmo lugar em relação à sala, e sempre em pé (o texto
 * não gira, só o ponto onde ele mora).
 *
 * NÃO recalcula a sala de fora (`reparentRoom`) nem a ordem dos cantos da sala
 * retangular (`normalizeRectRoomOrder`): os dois precisam do mapa de antes do
 * gesto e, no arrasto, rodam uma vez só, ao soltar — o mesmo contrato de
 * `moveRegion`. Giro nulo (0°, 360°) ou região inexistente devolve `map` pela
 * mesma referência, para `commitDragHistory` não gravar entrada vazia.
 */
export function rotateRegion(map: MapData, regionId: string, degrees: number): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  const turn = normalizeRotation(degrees)
  if (!region || turn === 0 || region.points.length === 0) return map

  const trig = rotationTrig(turn)
  const pivot = roomCentroid(region.points)
  const ids = subtreeIds(map.regions, regionId)
  const vertexCount = new Map<string, number>()
  let walls = map.walls
  const regions = map.regions.map((r) => {
    if (!ids.has(r.id)) return r
    const points = r.points.map((p) => rotatePointAround(p, pivot, trig))
    vertexCount.set(r.id, points.length)
    walls = syncLinkedWallsToPoints(walls, r.id, r.points, points)
    return r.room ? { ...r, points, room: rotateRoomMeta(r.room, turn, trig) } : { ...r, points }
  })
  return {
    ...map,
    regions,
    walls: walls.map((wall) => {
      if (wall.regionId === undefined || !ids.has(wall.regionId)) return wall
      const edge = wall.regionEdgeIndex
      // Na aresta: `syncLinkedWallsToPoints` já a pôs no lugar — só sai o ruído de conta.
      if (edge !== undefined && edge < (vertexCount.get(wall.regionId) ?? 0)) return wallWithoutRotationNoise(wall)
      return rotateWallAround(wall, pivot, trig)
    }),
  }
}

/** Ângulo acumulado e rótulo da Sala depois de girar `turn` graus. */
function rotateRoomMeta(room: RoomMeta, turn: number, trig: RotationTrig): RoomMeta {
  const { rotation: _anterior, ...semAngulo } = room
  const rotation = normalizeRotation(roomRotationOf(room) + turn)
  // De volta a 0°, o campo sai: a sala fica igual à que nunca girou — ida e
  // volta exato, e o arquivo salvo não ganha `"rotation": 0` à toa.
  const next: RoomMeta = rotation === 0 ? semAngulo : { ...semAngulo, rotation }
  return room.labelOffset ? { ...next, labelOffset: rotateVector(room.labelOffset, trig) } : next
}

function wallWithoutRotationNoise(wall: Wall): Wall {
  const x1 = withoutRotationNoise(wall.x1)
  const y1 = withoutRotationNoise(wall.y1)
  const x2 = withoutRotationNoise(wall.x2)
  const y2 = withoutRotationNoise(wall.y2)
  if (x1 === wall.x1 && y1 === wall.y1 && x2 === wall.x2 && y2 === wall.y2) return wall
  return { ...wall, x1, y1, x2, y2 }
}

function rotateWallAround(wall: Wall, pivot: { x: number; y: number }, trig: RotationTrig): Wall {
  const a = rotatePointAround({ x: wall.x1, y: wall.y1 }, pivot, trig)
  const b = rotatePointAround({ x: wall.x2, y: wall.y2 }, pivot, trig)
  return { ...wall, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
}

/**
 * Devolve às Salas retangulares RETAS de `ids` a ordem de vértices da
 * convenção `RoomCorner` (0 = canto de cima à esquerda, sentido horário),
 * remapeando junto o índice de aresta das paredes vinculadas. Girar 90° uma
 * sala em pé deixa o vértice 0 em cima à direita: sem isto, o próximo arrasto
 * de canto puxaria o canto errado e `rectFromCorners` (que devolve a ordem
 * padrão) trocaria as paredes de lado. Roda DEPOIS de `reparentRoom`, que
 * compara as arestas de antes e de depois do gesto pelo índice. Sala torta ou
 * já na ordem: nada muda, e sem mudança nenhuma volta `map` pela mesma referência.
 */
export function normalizeRectRoomOrder(map: MapData, ids: ReadonlySet<string>): MapData {
  let walls = map.walls
  let mudou = false
  const regions = map.regions.map((r) => {
    if (!ids.has(r.id) || r.room?.shape !== 'rect') return r
    const shift = rectCornerShift(r.points)
    if (shift === null || shift === 0) return r
    mudou = true
    // Aresta nova j = aresta velha (j + shift): a velha i vira (i − shift).
    walls = walls.map((w) =>
      w.regionId === r.id && w.regionEdgeIndex !== undefined && w.regionEdgeIndex < 4
        ? { ...w, regionEdgeIndex: (w.regionEdgeIndex - shift + 4) % 4 }
        : w,
    )
    return { ...r, points: r.points.map((_, i) => r.points[(i + shift) % 4]) }
  })
  return mudou ? { ...map, regions, walls } : map
}

export function addToken(map: MapData, token: Token): MapData {
  return { ...map, tokens: [...map.tokens, token] }
}

export function removeToken(map: MapData, tokenId: string): MapData {
  return { ...map, tokens: map.tokens.filter((t) => t.id !== tokenId) }
}

/**
 * Posição da ficha. Todo caminho que move UMA ficha passa por aqui (arrasto,
 * seta, pedido do jogador, cena de fundo, reunir o grupo), e por isso é aqui
 * que o pino PRESO a ela anda junto (`lib/pinAttach.ts`).
 *
 * LEVAR FICHA JUNTO: as fichas que ela leva (`lib/carry.ts`) andam o MESMO
 * deslocamento, então o ferido acompanha em todos esses caminhos sem cada um
 * lembrar dele. Cada ficha levada tem o PRÓPRIO trajeto checado
 * (`followStep`): parede no caminho dela a deixa para trás, mesmo que quem
 * leva tenha passado.
 */
export function setTokenPosition(map: MapData, tokenId: string, x: number, y: number): MapData {
  const moving = map.tokens.find((t) => t.id === tokenId)
  const dx = moving === undefined ? 0 : x - moving.x
  const dy = moving === undefined ? 0 : y - moving.y
  const follows = (t: Token): boolean => (dx !== 0 || dy !== 0) && t.id !== tokenId && carrierIdOf(t) === tokenId
  const moved: MapData = {
    ...map,
    tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : follows(t) ? followStep(map, t, dx, dy) : t)),
  }
  if (moving === undefined) return moved
  // O pino preso à ficha LEVADA anda o passo real dela (zero se a parede a barrou).
  const followerIds = new Set(map.tokens.filter(follows).map((t) => t.id))
  return carryPinsByTokenSteps(carryAttachedPins(moved, tokenId, dx, dy), map.tokens, followerIds)
}

/** Renomeia só o token alvo. Id inexistente devolve o mapa pela mesma referência. */
export function renameToken(map: MapData, tokenId: string, name: string): MapData {
  if (!map.tokens.some((t) => t.id === tokenId)) return map
  return {
    ...map,
    tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, name } : t)),
  }
}

const DEFAULT_TOKEN_NAME_PATTERN = /^Token (\d+)$/

/**
 * Nome sugerido ao adicionar token: "Token N" com o menor N ≥ 1 ainda livre.
 * Antes todo token nascia "Token" e a lista de atribuir jogador mostrava
 * vários itens idênticos, sem como saber qual era qual.
 */
export function nextTokenName(tokens: readonly Pick<Token, 'name'>[]): string {
  const used = new Set<number>()
  for (const token of tokens) {
    const match = DEFAULT_TOKEN_NAME_PATTERN.exec(token.name)
    if (match) used.add(Number(match[1]))
  }
  let n = 1
  while (used.has(n)) n += 1
  return `Token ${n}`
}

/**
 * Foto do token: o arquivo no disco do mestre (`image`) e a cópia embutida que
 * viaja até o jogador (`imageData`) andam JUNTAS, sempre. Separá-las em duas
 * chamadas deixaria o mapa passar por um estado em que a foto na tela do
 * mestre e a foto na tela do jogador são de pessoas diferentes — e daria duas
 * entradas de desfazer para um gesto só. `imageData` omitido limpa a cópia, que
 * é o certo tanto para "Remover imagem" quanto para uma foto nova sem cópia.
 */
export function setTokenImage(map: MapData, tokenId: string, image: string | null, imageData: string | null = null): MapData {
  return {
    ...map,
    tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, image, imageData } : t)),
  }
}

export function addProp(map: MapData, prop: Prop): MapData {
  return { ...map, props: [...map.props, prop] }
}

export function removeProp(map: MapData, propId: string): MapData {
  return { ...map, props: map.props.filter((p) => p.id !== propId) }
}

export function setPropPosition(map: MapData, propId: string, x: number, y: number): MapData {
  return {
    ...map,
    props: map.props.map((p) => (p.id === propId ? { ...p, x, y } : p)),
  }
}

export function setPropLayer(map: MapData, propId: string, layer: Prop['layer']): MapData {
  return {
    ...map,
    props: map.props.map((p) => (p.id === propId ? { ...p, layer } : p)),
  }
}

export function setShowGrid(map: MapData, showGrid: boolean): MapData {
  return { ...map, showGrid }
}

export function setBackground(map: MapData, background: MapData['background']): MapData {
  return { ...map, background }
}

/**
 * Muda o formato da grade E reseta `measurementMode` pro default daquele
 * formato (`defaultMeasurementModeForShape`, lib/measurement.ts) — sem isso,
 * um mapa quadrado em `'manhattan'` que vira hex fica com um modo que não
 * existe lá (`measurementModesForShape('hex')` não inclui `'manhattan'`).
 */
export function setGridShape(map: MapData, gridShape: MapData['gridShape']): MapData {
  return { ...map, gridShape, measurementMode: defaultMeasurementModeForShape(gridShape) }
}

export function setGridSettings(map: MapData, patch: Partial<GridSettings>): MapData {
  return { ...map, gridSettings: { ...map.gridSettings, ...patch } }
}

/**
 * Muda `MapData.gridOffset` inteiro (F3, "alinhar grade à imagem" — contrato
 * do agente C5, `lib/gridAlign.ts`). Substitui o objeto inteiro em vez de
 * fazer patch parcial — mesma convenção de `setMapScale`/`setBackground`
 * abaixo, porque `{x,y}` é sempre editado como par (não há campo "só x").
 */
export function setGridOffset(map: MapData, offset: Point): MapData {
  return { ...map, gridOffset: offset }
}

/**
 * Muda `MapData.grid` (tamanho de célula em px de mundo) — hoje só definido
 * na criação do mapa (`createEmptyMap`), sem setter próprio até este
 * contrato (C5) precisar de um pro botão "Aplicar" de `GridAlignControls`.
 * Nome `setGridCellSize`, não `setGrid`, pra não colidir por leitura com
 * `setGridShape`/`setGridSettings`/`setGridOffset` (todos editam campo
 * DIFERENTE de `MapData`, não o mesmo `grid`).
 */
export function setGridCellSize(map: MapData, cellSize: number): MapData {
  return { ...map, grid: cellSize }
}

/**
 * Esconde/mostra uma LayerId inteira em `map.hiddenLayers` — toggle simples
 * de presença no array. A limpeza de seleção quando o item selecionado fica
 * invisível é responsabilidade do STORE (mapStore.ts), não desta função
 * pura: aqui não há acesso a `selection`.
 */
export function toggleLayerVisibility(map: MapData, layerId: LayerId): MapData {
  const hidden = map.hiddenLayers.includes(layerId)
  return {
    ...map,
    hiddenLayers: hidden ? map.hiddenLayers.filter((l) => l !== layerId) : [...map.hiddenLayers, layerId],
  }
}

/**
 * Trava/destrava uma LayerId inteira em `map.lockedLayers` — mesmo toggle
 * simples de presença no array de `toggleLayerVisibility` acima (Onda 4,
 * Frente D — CONTRATO pede espelho exato). Item na camada travada continua
 * visível (independente de hiddenLayers), só não pode ser selecionado/movido
 * — ver `lib/layers.ts` (isLayerLocked/canInteractInLayer). Limpeza de
 * seleção quando o item selecionado fica travado é responsabilidade do
 * STORE, não desta função pura — mesma separação de toggleLayerVisibility.
 */
export function toggleLayerLock(map: MapData, layerId: LayerId): MapData {
  const locked = map.lockedLayers.includes(layerId)
  return {
    ...map,
    lockedLayers: locked ? map.lockedLayers.filter((l) => l !== layerId) : [...map.lockedLayers, layerId],
  }
}

/**
 * Troca o `DoorState` da parede inteira (ou volta a parede sólida com `null`).
 * O botão "Virar porta" do painel NÃO usa mais isto: ele cria porta de tamanho
 * padrão no meio da parede (`mapStore.turnWallIntoDoor` → `addDoorOnWall`),
 * porque virar o lado inteiro da sala em porta era o bug P10.
 *
 * Invariante "aberta+trancada não existe" (decisão 15/09/2026): abrir uma
 * porta trancada DESTRANCA — é o caminho óbvio para o mestre que liga
 * "Aberta" numa porta trancada. Trancar fecha (ver `setDoorLocked`).
 */
export function setWallDoor(map: MapData, wallId: string, door: DoorState | null): MapData {
  const normalized = door !== null && door.open && door.locked ? { ...door, locked: false } : door
  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId ? { ...w, door: normalized } : w)),
  }
}

export function setWallKindForWall(map: MapData, wallId: string, wallKind: Wall['wallKind']): MapData {
  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId ? { ...w, wallKind } : w)),
  }
}

/** Espelho exato de `setWallKindForWall`, para `Wall.thickness` (Fase 6,
 *  pedido "poligono finos ou medios ou gordos" aplicado a Parede). */
export function setWallThicknessForWall(map: MapData, wallId: string, thickness: Wall['thickness']): MapData {
  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId ? { ...w, thickness } : w)),
  }
}

/** Espelho exato de `setWallKindForWall`, para `Wall.lineStyle` (Fase 6,
 *  pedido "ponta reta ou redonda"). */
export function setWallLineStyleForWall(map: MapData, wallId: string, lineStyle: Wall['lineStyle']): MapData {
  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId ? { ...w, lineStyle } : w)),
  }
}

/**
 * Folga, em px de mundo, para decidir "este pedaço está na MESMA RETA do vão" e
 * "estes dois pedaços se ENCOSTAM". Os pedaços de uma aresta nascem do mesmo
 * vetor unitário (`addDoorOnWall`), então o erro real aqui é de arredondamento
 * de ponto flutuante — inclusive depois de um `syncLinkedWallsToPoints`. 1e-4 é
 * 320.000x menor que o menor vão de porta (32px), então nunca confunde pedaço
 * vizinho com pedaço distante.
 */
const EDGE_PIECE_EPSILON = 1e-4

/** Reta orientada de uma aresta: origem `(ox, oy)` e vetor unitário `(ux, uy)`. */
interface EdgeAxis {
  ox: number
  oy: number
  ux: number
  uy: number
}

/** Distância ao longo do eixo (negativa antes da origem). */
function axisParam(axis: EdgeAxis, x: number, y: number): number {
  return (x - axis.ox) * axis.ux + (y - axis.oy) * axis.uy
}

/** Distância PERPENDICULAR ao eixo — é o que mede "está na mesma reta". */
function axisOffset(axis: EdgeAxis, x: number, y: number): number {
  return Math.abs((x - axis.ox) * -axis.uy + (y - axis.oy) * axis.ux)
}

/** Trecho `[from, to]` que um pedaço ocupa no eixo, já ordenado. */
interface EdgePieceSpan {
  wall: Wall
  from: number
  to: number
}

/** Trecho de `wall` no eixo, ou `null` quando `wall` não está na mesma reta. */
function spanOnAxis(axis: EdgeAxis, wall: Wall): EdgePieceSpan | null {
  if (axisOffset(axis, wall.x1, wall.y1) > EDGE_PIECE_EPSILON) return null
  if (axisOffset(axis, wall.x2, wall.y2) > EDGE_PIECE_EPSILON) return null
  const a = axisParam(axis, wall.x1, wall.y1)
  const b = axisParam(axis, wall.x2, wall.y2)
  return { wall, from: Math.min(a, b), to: Math.max(a, b) }
}

/**
 * `other` é irmão de `piece` na MESMA aresta? Parede vinculada a Sala tem
 * identidade explícita (`regionId` + `regionEdgeIndex`, ver `lib/roomLink.ts`):
 * sem ela, duas Salas encostadas — que têm paredes colineares e sobrepostas —
 * seriam tratadas como a mesma aresta e uma comeria a outra.
 *
 * Parede SOLTA não tem esse vínculo, então a identidade é a origem comum: os
 * pedaços que `addDoorOnWall` cria são clones do mesmo original e carregam os
 * mesmos atributos. Exigir todos evita juntar duas paredes desenhadas
 * separadamente que só por acaso ficaram colineares e encostadas.
 */
function sameEdgeIdentity(piece: Wall, other: Wall): boolean {
  if (piece.regionId !== undefined || other.regionId !== undefined) {
    return piece.regionId === other.regionId && piece.regionEdgeIndex === other.regionEdgeIndex
  }
  return (
    piece.wallKind === other.wallKind &&
    piece.thickness === other.thickness &&
    piece.lineStyle === other.lineStyle &&
    piece.blocksLight === other.blocksLight &&
    piece.blocksMove === other.blocksMove
  )
}

/**
 * Limites da aresta da Sala a que `wall` pertence, projetados no eixo — é o que
 * impede uma porta perto do canto de crescer PARA FORA da sala. `null` para
 * parede solta (sem aresta que a limite: o vão cresce livre, como antes).
 */
function regionEdgeBoundsOnAxis(map: MapData, wall: Wall, axis: EdgeAxis): { low: number; high: number } | null {
  const { regionId, regionEdgeIndex } = wall
  if (regionId === undefined || regionEdgeIndex === undefined) return null
  const region = map.regions.find((r) => r.id === regionId)
  if (!region) return null
  const n = region.points.length
  if (n === 0 || regionEdgeIndex >= n) return null
  const from = region.points[regionEdgeIndex]
  const to = region.points[(regionEdgeIndex + 1) % n]
  const a = axisParam(axis, from.x, from.y)
  const b = axisParam(axis, to.x, to.y)
  return { low: Math.min(a, b), high: Math.max(a, b) }
}

/**
 * Troca o `DoorKind` de uma porta JÁ EXISTENTE (parede com `door !== null`) e
 * REDIMENSIONA o vão pra `doorLength` (= `DOOR_LENGTH_BY_KIND[kind]`,
 * calculado pelo chamador em mapStore.ts), centrado no meio do vão ATUAL —
 * troca de tipo não desloca a porta, só estica/encolhe pros dois lados do
 * mesmo centro. Direção herdada do vetor unitário da própria `Wall`, nunca
 * recalculada como horizontal/vertical (mesma convenção de `addDoorOnWall`).
 *
 * A ARESTA CONTINUA INTEIRA (conserto de 17/09/2026). Antes esta função mexia
 * SÓ no pedaço-porta e deixava os pedaços sólidos irmãos onde estavam
 * (`addDoorOnWall` parte a parede em até 3), o que dava:
 *  - vão que ENCOLHE (Portão 96 → Normal 32): duas faixas de 32px da aresta sem
 *    parede nenhuma — buraco invisível por onde o token atravessava e a luz
 *    vazava, mesmo com a porta trancada;
 *  - vão que CRESCE (Normal 32 → Portão 96): a porta desenhada por cima dos
 *    sólidos, abrindo 96px na tela e só 32px na colisão;
 *  - vão sem limite de aresta: porta perto do canto saindo para fora da sala.
 *
 * Agora o vizinho sólido de cada lado é REDIMENSIONADO junto (mantendo id,
 * estilo e vínculo), some quando o vão o cobre inteiro, e nasce um pedaço novo
 * quando o vão encolhe e não havia vizinho daquele lado. O vão fica preso ao
 * trecho que a porta pode ocupar: até a ponta do vizinho sólido, e nunca além
 * da aresta da Sala. Vizinho que é OUTRA porta bloqueia o crescimento — uma
 * porta nunca engole a outra.
 *
 * Parede inexistente, sem porta (`door === null`), de comprimento zero, ou cujo
 * trecho disponível é degenerado (não deveria existir, mas defensivo): devolve
 * `map` pela mesma referência.
 */
export function setWallDoorKind(map: MapData, wallId: string, kind: DoorKind, doorLength: number): MapData {
  const wall = map.walls.find((w) => w.id === wallId)
  if (!wall || !wall.door) return map
  const door = wall.door // narrowed não-nulo aqui; capturado antes do .map porque o
  // callback abaixo itera sobre `w` (outra referência), que o TS não re-narrowa.

  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const length = Math.hypot(dx, dy)
  if (length === 0) return map

  // Eixo com origem no início do vão atual: o vão ocupa 0..length nesse eixo, e
  // pedaço antes da porta tem parâmetro negativo.
  const axis: EdgeAxis = { ox: wall.x1, oy: wall.y1, ux: dx / length, uy: dy / length }
  const center = length / 2
  const half = doorLength / 2

  const siblings: EdgePieceSpan[] = []
  for (const other of map.walls) {
    if (other.id === wall.id) continue
    if (!sameEdgeIdentity(wall, other)) continue
    const span = spanOnAxis(axis, other)
    if (span) siblings.push(span)
  }

  const encostaEm = (a: number, b: number): boolean => Math.abs(a - b) <= EDGE_PIECE_EPSILON
  const leftSolid = siblings.find((s) => s.wall.door === null && encostaEm(s.to, 0))
  const rightSolid = siblings.find((s) => s.wall.door === null && encostaEm(s.from, length))
  const bounds = regionEdgeBoundsOnAxis(map, wall, axis)

  // Até onde o vão pode crescer para cada lado: a ponta de fora do vizinho
  // sólido; se o vizinho é outra porta, não cresce nada; sem vizinho nenhum, o
  // limite é a aresta da Sala (parede solta: livre, como era antes).
  const lowLimit =
    leftSolid !== undefined ? leftSolid.from
    : siblings.some((s) => encostaEm(s.to, 0)) ? 0
    : bounds !== null ? bounds.low
    : Number.NEGATIVE_INFINITY
  const highLimit =
    rightSolid !== undefined ? rightSolid.to
    : siblings.some((s) => encostaEm(s.from, length)) ? length
    : bounds !== null ? bounds.high
    : Number.POSITIVE_INFINITY
  const low = bounds !== null ? Math.max(lowLimit, bounds.low) : lowLimit
  const high = bounds !== null ? Math.min(highLimit, bounds.high) : highLimit

  const newFrom = Math.max(center - half, low)
  const newTo = Math.min(center + half, high)
  if (newTo - newFrom <= EDGE_PIECE_EPSILON) return map

  const pieceAt = (template: Wall, id: string, from: number, to: number): Wall => ({
    ...template,
    id,
    x1: axis.ox + axis.ux * from,
    y1: axis.oy + axis.uy * from,
    x2: axis.ox + axis.ux * to,
    y2: axis.oy + axis.uy * to,
    door: null,
  })

  const replacements = new Map<string, Wall>()
  const removed = new Set<string>()
  const created: Wall[] = []

  // Trecho que cada lado precisa manter coberto: o vizinho sólido inteiro, ou —
  // quando não há vizinho — o pedaço do vão antigo que deixou de ser porta.
  const leftCoverFrom = leftSolid !== undefined ? leftSolid.from : 0
  if (newFrom - leftCoverFrom > EDGE_PIECE_EPSILON) {
    const template = leftSolid !== undefined ? leftSolid.wall : wall
    const id = leftSolid !== undefined ? leftSolid.wall.id : crypto.randomUUID()
    const piece = pieceAt(template, id, leftCoverFrom, newFrom)
    if (leftSolid !== undefined) replacements.set(id, piece)
    else created.push(piece)
  } else if (leftSolid !== undefined) {
    removed.add(leftSolid.wall.id) // o vão novo cobre o vizinho inteiro
  }

  const rightCoverTo = rightSolid !== undefined ? rightSolid.to : length
  if (rightCoverTo - newTo > EDGE_PIECE_EPSILON) {
    const template = rightSolid !== undefined ? rightSolid.wall : wall
    const id = rightSolid !== undefined ? rightSolid.wall.id : crypto.randomUUID()
    const piece = pieceAt(template, id, newTo, rightCoverTo)
    if (rightSolid !== undefined) replacements.set(id, piece)
    else created.push(piece)
  } else if (rightSolid !== undefined) {
    removed.add(rightSolid.wall.id)
  }

  replacements.set(wall.id, {
    ...wall,
    x1: axis.ox + axis.ux * newFrom,
    y1: axis.oy + axis.uy * newFrom,
    x2: axis.ox + axis.ux * newTo,
    y2: axis.oy + axis.uy * newTo,
    door: { ...door, kind },
  })

  const walls = map.walls.filter((w) => !removed.has(w.id)).map((w) => replacements.get(w.id) ?? w)

  return { ...map, walls: [...walls, ...created] }
}

/**
 * Alterna `DoorState.locked` de uma porta já existente. Campo no schema desde
 * sempre (types/map.ts), sem UI até a fase F2. Parede inexistente ou sem
 * porta: devolve `map` pela mesma referência.
 *
 * TRANCAR FECHA a porta (decisão 15/09/2026): porta trancada sempre barra
 * movimento e visão (`lib/collision.ts`), então "aberta e trancada" não é um
 * estado que o mestre possa ver na tela. Destrancar não abre.
 */
export function setDoorLocked(map: MapData, wallId: string, locked: boolean): MapData {
  const wall = map.walls.find((w) => w.id === wallId)
  if (!wall || !wall.door) return map

  return {
    ...map,
    walls: map.walls.map((w) =>
      w.id === wallId && w.door ? { ...w, door: { ...w.door, locked, open: locked ? false : w.door.open } } : w,
    ),
  }
}

/**
 * Cria uma porta EM CIMA de uma parede já existente, no ponto clicado — usado
 * pela ferramenta dedicada "Porta" (distinta de `setWallDoor`, que vira a
 * parede INTEIRA em porta via botão no painel, e continua existindo à parte).
 *
 * `point` (o clique bruto) nunca é usado como coordenada final: ele só serve
 * pra achar o parâmetro `t` (0 a 1) do ponto mais próximo NA PRÓPRIA LINHA da
 * parede (projeção escalar, mesma conta de `distanceToSegment` em
 * selectionHitTest.ts). A porta nasce a partir desse ponto projetado, nunca do
 * clique bruto — é isso que garante alinhamento perfeito por construção,
 * mesmo com um clique um pouco fora da linha.
 *
 * A janela da porta (metade de `doorLength` pra cada lado do ponto projetado)
 * é clampada pra caber dentro do segmento original: se a parede for mais
 * curta que `doorLength`, a porta ocupa a parede inteira (só 1 pedaço nasce,
 * nenhum "antes"/"depois"). Perto de uma ponta, só o pedaço do outro lado
 * sobra. No total nascem de 1 a 3 Wall novas, todas com o MESMO vetor unitário
 * (mesmo ângulo) da parede original — herdado por construção, nunca recalculado
 * como horizontal/vertical.
 *
 * Se a parede original estava vinculada a uma Sala (`regionId`/
 * `regionEdgeIndex`), TODOS os pedaços herdam o vínculo e a mesma aresta: uma
 * aresta pode ter vários pedaços colineares (`lib/roomLink.ts`). Assim mover,
 * redimensionar, duplicar e apagar a Sala levam a porta junto. Antes os
 * pedaços viravam paredes soltas e ficavam para trás ao mover a Sala.
 *
 * `kind` (F2) é o tipo estrutural da porta a nascer (`normal | double | gate`
 * — preferência de ferramenta `doorKind`, lida pelo store no momento do
 * clique). `doorLength` já vem pronto do chamador como
 * `DOOR_LENGTH_BY_KIND[kind]` (mapStore.ts) — esta função não conhece a
 * tabela, só usa o número que recebeu, mesma separação de responsabilidade
 * de `addWall`/`buildWallFromDraft` com `wallKind`.
 *
 * Parede inexistente ou de comprimento zero: devolve `map` pela mesma
 * referência (sem mudança).
 */
export function addDoorOnWall(map: MapData, wallId: string, point: { x: number; y: number }, doorLength: number, kind: DoorKind): MapData {
  const wall = map.walls.find((w) => w.id === wallId)
  if (!wall) return map
  const split = splitWallAround(wall, point, doorLength)
  if (split === null) return map

  const door: Wall = { ...split.middle, door: { open: false, locked: false, kind } }
  return replaceWallWithPieces(map, wallId, [split.before, door, split.after])
}

/** Os até 3 pedaços colineares em que uma parede se parte em volta de um trecho. */
interface WallSplit {
  /** Antes do trecho, ou `null` quando o trecho começa na ponta da parede. */
  before: Wall | null
  /** O trecho em si: vira porta em `addDoorOnWall`, some em `addOpeningOnWall`. */
  middle: Wall
  /** Depois do trecho, ou `null` quando o trecho termina na ponta da parede. */
  after: Wall | null
}

/**
 * Geometria compartilhada por `addDoorOnWall` e `addOpeningOnWall`: parte
 * `wall` num trecho de `length` px centrado no ponto do clique PROJETADO na
 * linha da parede. Todos os pedaços nascem com o mesmo vetor unitário da
 * original (herdado por construção, nunca recalculado como horizontal/
 * vertical) e com `door: null` — quem quiser porta sobrescreve o `middle`.
 *
 * `null` quando a parede tem comprimento zero (não dá para projetar nada
 * numa linha que não existe).
 */
function splitWallAround(wall: Wall, point: { x: number; y: number }, length: number): WallSplit | null {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const total = Math.hypot(dx, dy)
  if (total === 0) return null

  const ux = dx / total
  const uy = dy / total

  // Parâmetro t (0..1) do ponto mais próximo do clique NA PRÓPRIA LINHA da
  // parede — mesma projeção escalar de distanceToSegment (selectionHitTest.ts).
  const t = Math.max(0, Math.min(1, ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / (total * total)))
  const projectedDistance = t * total

  const half = length / 2
  const start = Math.max(0, projectedDistance - half)
  const end = Math.min(total, projectedDistance + half)

  const pieceAt = (fromDistance: number, toDistance: number): Wall => ({
    ...wall,
    id: crypto.randomUUID(),
    x1: wall.x1 + ux * fromDistance,
    y1: wall.y1 + uy * fromDistance,
    x2: wall.x1 + ux * toDistance,
    y2: wall.y1 + uy * toDistance,
    door: null,
  })

  return {
    before: start > 0 ? pieceAt(0, start) : null,
    middle: pieceAt(start, end),
    after: end < total ? pieceAt(end, total) : null,
  }
}

/** Troca a parede `wallId` pelos pedaços dados, descartando os ausentes. */
function replaceWallWithPieces(map: MapData, wallId: string, pieces: ReadonlyArray<Wall | null>): MapData {
  const kept = pieces.filter((piece): piece is Wall => piece !== null)
  return { ...map, walls: [...map.walls.filter((w) => w.id !== wallId), ...kept] }
}

/**
 * VÃO ABERTO — a abertura livre na parede: nem parede, nem porta. É o buraco
 * de corredor/arco por onde se entra e se sai sem nada no caminho.
 *
 * Parte a parede exatamente como `addDoorOnWall` (mesma projeção do clique,
 * mesmos pedaços colineares, mesmo vínculo `regionId`/`regionEdgeIndex`
 * herdado por todos eles) e simplesmente NÃO devolve o pedaço do meio: o vão
 * é AUSÊNCIA de parede naquele trecho, nunca uma entidade nova desenhada por
 * cima. É por isso que ele não precisa de campo novo no schema nem de linha
 * em renderer nenhum — onde não há `Wall`, nada é desenhado, nada bloqueia
 * movimento (`lib/collision.ts`) e nada corta a visão (`lib/visibility.ts`),
 * no editor e na tela do jogador pelo mesmo caminho.
 *
 * O trecho vizinho continua parede: abrir o vão num ponto NÃO fura a aresta
 * inteira da Sala. `types/map.ts` (`Wall.regionId`) já previa essa aresta com
 * buraco — "uma parede vinculada continua apagável individualmente, deixando
 * um buraco (aresta sem parede) nesse conjunto".
 *
 * Casos de borda, todos com comportamento definido:
 *  - clique perto de uma ponta: só sobra o pedaço do outro lado;
 *  - `openingLength` ≥ comprimento da parede: a parede inteira vira vão e
 *    desaparece (o lado todo ficou aberto);
 *  - clique num pedaço que JÁ é porta: a porta é substituída pelo vão — o
 *    mestre trocou o objeto pelo buraco;
 *  - parede inexistente ou de comprimento zero: devolve `map` pela mesma
 *    referência (sem mudança), igual a `addDoorOnWall`.
 */
export function addOpeningOnWall(map: MapData, wallId: string, point: { x: number; y: number }, openingLength: number): MapData {
  const wall = map.walls.find((w) => w.id === wallId)
  if (!wall) return map
  const split = splitWallAround(wall, point, openingLength)
  if (split === null) return map

  return replaceWallWithPieces(map, wallId, [split.before, split.after])
}

export function setScenarioLink(map: MapData, scenarioLink: string | null): MapData {
  return { ...map, scenarioLink }
}

export function addDrawing(map: MapData, drawing: Drawing): MapData {
  return { ...map, drawings: [...map.drawings, drawing] }
}

export function removeDrawing(map: MapData, drawingId: string): MapData {
  return { ...map, drawings: map.drawings.filter((d) => d.id !== drawingId) }
}

/**
 * Substitui 1 Drawing por N (0, 1 ou vários) — resultado de `eraseFromDrawing`
 * (lib/eraseGeometry.ts, agente D, F4 N1 "borracha: apagar parte"). Sem
 * precedente 1-pra-N em mapFactory.ts até este contrato (tudo aqui era
 * 1-pra-1 ou N-fixo); nasce ao lado de addDrawing/removeDrawing porque é a
 * mesma mutação de fundo (`map.drawings`), só com aridade diferente.
 */
export function replaceDrawingWithMany(map: MapData, drawingId: string, replacements: Drawing[]): MapData {
  return { ...map, drawings: [...map.drawings.filter((d) => d.id !== drawingId), ...replacements] }
}

export function updateLinePoint(map: MapData, drawingId: string, endpoint: 0 | 1, x: number, y: number): MapData {
  const drawing = map.drawings.find((d) => d.id === drawingId)
  if (!drawing || drawing.kind !== 'line') return map

  return {
    ...map,
    drawings: map.drawings.map((d) =>
      d.id === drawingId && d.kind === 'line' ? (endpoint === 0 ? { ...d, x1: x, y1: y } : { ...d, x2: x, y2: y }) : d,
    ),
  }
}

/**
 * Insere um ponto novo em `(x, y)` logo depois do índice `afterIndex` do
 * array `points` de uma Curva — mesma ideia de `insertRegionPoint`, mas sem
 * parede vinculada pra remapear (Curva é só um array de pontos solto).
 */
export function insertCurvePoint(map: MapData, drawingId: string, afterIndex: number, x: number, y: number): MapData {
  const drawing = map.drawings.find((d) => d.id === drawingId)
  if (!drawing || drawing.kind !== 'curve') return map

  return {
    ...map,
    drawings: map.drawings.map((d) => {
      if (d.id !== drawingId || d.kind !== 'curve') return d
      const points = [...d.points.slice(0, afterIndex + 1), { x, y }, ...d.points.slice(afterIndex + 1)]
      return { ...d, points }
    }),
  }
}

/**
 * Remove o ponto `index` de uma Curva. GUARDA: uma curva precisa de pelo
 * menos 2 pontos pra existir, então recusa (devolve `map` pela mesma
 * referência) quando `points.length <= 2`.
 */
export function removeCurvePoint(map: MapData, drawingId: string, index: number): MapData {
  const drawing = map.drawings.find((d) => d.id === drawingId)
  if (!drawing || drawing.kind !== 'curve') return map
  if (drawing.points.length <= 2) return map

  return {
    ...map,
    drawings: map.drawings.map((d) =>
      d.id === drawingId && d.kind === 'curve' ? { ...d, points: d.points.filter((_, i) => i !== index) } : d,
    ),
  }
}

/**
 * Move o corpo inteiro de uma Curva por delta (dx, dy), sem mudar formato —
 * desloca todos os pontos igualmente. Equivalente a `moveDrawing` restrito
 * ao kind 'curve', mas como função própria porque o corpo/handle de Curva no
 * PixiCanvas tem seu próprio mecanismo de arrasto, separado do genérico.
 */
export function moveCurve(map: MapData, drawingId: string, dx: number, dy: number): MapData {
  const drawing = map.drawings.find((d) => d.id === drawingId)
  if (!drawing || drawing.kind !== 'curve') return map

  return {
    ...map,
    drawings: map.drawings.map((d) =>
      d.id === drawingId && d.kind === 'curve' ? { ...d, points: d.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : d,
    ),
  }
}

/**
 * Move o corpo inteiro de um Drawing por delta (dx, dy) — genérica sobre
 * `kind` porque toda variante de Drawing é só uma coleção de pontos ou de um
 * ponto+propriedades, então "mover" é sempre "somar o delta em cada
 * coordenada". Cobre os 5 kinds hoje existentes; `default` fica como rede de
 * segurança caso um kind novo apareça sem entrar aqui.
 */
export function moveDrawing(map: MapData, drawingId: string, dx: number, dy: number): MapData {
  const drawing = map.drawings.find((d) => d.id === drawingId)
  if (!drawing) return map

  return {
    ...map,
    drawings: map.drawings.map((d) => {
      if (d.id !== drawingId) return d
      switch (d.kind) {
        case 'freehand':
        case 'curve':
          return { ...d, points: d.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
        case 'line':
          return { ...d, x1: d.x1 + dx, y1: d.y1 + dy, x2: d.x2 + dx, y2: d.y2 + dy }
        case 'circle':
          return { ...d, cx: d.cx + dx, cy: d.cy + dy }
        case 'text':
          return { ...d, x: d.x + dx, y: d.y + dy }
        // rect/ellipse/polygon (Fase 1) caíam no `default` abaixo e não se
        // moviam — bug real B3 (dossiê F4, contrato do agente B3): hit-test
        // desses 3 kinds só passou a existir nesta fase, então até aqui
        // ninguém tinha reparado que moveDrawing também os ignorava.
        case 'rect':
          return { ...d, x: d.x + dx, y: d.y + dy }
        case 'ellipse':
          return { ...d, cx: d.cx + dx, cy: d.cy + dy }
        case 'polygon':
        // `path` entra junto pelo mesmo motivo do comentário acima: ele JÁ
        // nasce clicável (`selectionHitTest.findDrawingAt`), então cair no
        // `default` faria a pessoa arrastar o caminho selecionado e nada se
        // mexer, em silêncio.
        case 'path':
          return { ...d, points: d.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
        default:
          return d
      }
    }),
  }
}

/**
 * Variante "live" de resize por canto de Drawing rect/ellipse/polygon — SEM
 * histórico, pensada pro pointermove do arrasto (par de `commitDragHistory`
 * no pointerup, mesmo padrão de `resizeRoomCornerLive`). Delega a geometria
 * pura para `objectTransform.ts` (agente B3) — esta função só localiza o
 * Drawing no map e substitui pelo resultado. Drawing inexistente, ou de um
 * kind sem resize por canto (freehand/line/circle/curve/text): devolve `map`
 * pela mesma referência.
 *
 * `modifiers` (Onda 3, item 17, Frente B): Shift preserva a proporção
 * original, Alt redimensiona a partir do centro — repassado direto pra
 * `resizeXxxDrawing`, que já tem o default `{shift:false,alt:false}` pra
 * quem não passa nada.
 */
export function resizeDrawingCornerLive(map: MapData, drawingId: string, corner: Corner, x: number, y: number, modifiers: ResizeModifiers): MapData {
  const drawing = map.drawings.find((d) => d.id === drawingId)
  if (!drawing) return map

  let updated: Drawing
  if (drawing.kind === 'rect') updated = resizeRectDrawing(drawing, corner, x, y, modifiers)
  else if (drawing.kind === 'ellipse') updated = resizeEllipseDrawing(drawing, corner, x, y, modifiers)
  else if (drawing.kind === 'polygon') updated = resizePolygonDrawing(drawing, corner, x, y, modifiers)
  else return map

  return { ...map, drawings: map.drawings.map((d) => (d.id === drawingId ? updated : d)) }
}

/** Mesmo padrão de `resizeDrawingCornerLive`, para Prop — `resizePropBox`
 *  (objectTransform.ts) devolve o novo x/y/width/height já no formato que
 *  `Prop` usa (centro + dimensões). Prop inexistente: `map` sem mudança.
 *  `modifiers` (Onda 3, item 17): mesma regra de `resizeDrawingCornerLive`. */
export function resizePropCornerLive(map: MapData, propId: string, corner: Corner, x: number, y: number, modifiers: ResizeModifiers): MapData {
  const prop = map.props.find((p) => p.id === propId)
  if (!prop) return map
  const box = resizePropBox(prop, corner, x, y, modifiers)
  return { ...map, props: map.props.map((p) => (p.id === propId ? { ...p, ...box } : p)) }
}

/**
 * Onda 3, item 18 (Frente B) — variante "live" do raio de um Drawing
 * 'circle', par de `resizeDrawingCornerLive` acima: mesmo padrão SEM
 * histórico (pointerup fecha com `commitDragHistory`). Drawing inexistente
 * ou de outro kind: `map` sem mudança.
 */
export function resizeCircleDrawingRadiusLive(map: MapData, drawingId: string, x: number, y: number): MapData {
  const drawing = map.drawings.find((d) => d.id === drawingId)
  if (!drawing || drawing.kind !== 'circle') return map
  return { ...map, drawings: map.drawings.map((d) => (d.id === drawingId ? { ...drawing, radius: resizeCircleDrawingRadius(drawing, x, y) } : d)) }
}

// ─────────────────────────────────────────────────────────────
// STAIR (F2) — espelhos puros de addWall/removeWall/moveWall/updateWallPoint,
// com `segmentIndex` a mais porque `Stair.segments` é array (shape
// 'straight' desta fase usa sempre segmentIndex 0; 'l'/'double' futuros usam
// índices >0 sem precisar mudar a assinatura). Contrato do agente B2.
// ─────────────────────────────────────────────────────────────
export function addStair(map: MapData, stair: Stair): MapData {
  return { ...map, stairs: [...map.stairs, stair] }
}

export function removeStair(map: MapData, stairId: string): MapData {
  return { ...map, stairs: map.stairs.filter((s) => s.id !== stairId) }
}

export function moveStair(map: MapData, stairId: string, dx: number, dy: number): MapData {
  return {
    ...map,
    stairs: map.stairs.map((s) =>
      s.id === stairId
        ? { ...s, segments: s.segments.map((seg) => ({ x1: seg.x1 + dx, y1: seg.y1 + dy, x2: seg.x2 + dx, y2: seg.y2 + dy })) }
        : s,
    ),
  }
}

export function updateStairPoint(map: MapData, stairId: string, segmentIndex: number, endpoint: 0 | 1, x: number, y: number): MapData {
  return {
    ...map,
    stairs: map.stairs.map((s) => {
      if (s.id !== stairId) return s
      return {
        ...s,
        segments: s.segments.map((seg, i) =>
          i === segmentIndex ? (endpoint === 0 ? { ...seg, x1: x, y1: y } : { ...seg, x2: x, y2: y }) : seg,
        ),
      }
    }),
  }
}

export function setStairDirection(map: MapData, stairId: string, direction: StairDirection): MapData {
  return { ...map, stairs: map.stairs.map((s) => (s.id === stairId ? { ...s, direction } : s)) }
}

/** Troca `stepWidth` (largura do lance) de uma escada JÁ CRIADA — mesmo
 *  espelho de `setStairDirection` (F4, N1 "escada pequena/média/grande").
 *  Escada inexistente: `map` sem mudança (o `.map` abaixo é no-op). */
export function setStairStepWidth(map: MapData, stairId: string, stepWidth: number): MapData {
  return { ...map, stairs: map.stairs.map((s) => (s.id === stairId ? { ...s, stepWidth } : s)) }
}

// ─────────────────────────────────────────────────────────────
// SALA: identidade + resize (F2) — contrato do agente B3. `resizeRoomDimensions`
// e `resizeRoomCornerLive` sincronizam as paredes vinculadas via `regionId`
// (ferramenta Sala cria as 4 paredes do contorno já vinculadas, ver
// buildRoomFromDraft/drawingFactory.ts), reusando `syncLinkedWallsToPoints`
// (lib/roomLink.ts) — mesma função que `updateRegionPoint` já usa; porta e
// pedaços da aresta ficam na mesma posição relativa. Sem essa
// sincronização a Sala "redimensiona" visualmente mas as paredes ficam para
// trás, desalinhadas do contorno novo.
// ─────────────────────────────────────────────────────────────

/** Renomeia a Sala (`region.room.name`). Sem efeito se a região não existir
 *  ou não for uma Sala (`room` ausente) — devolve `map` pela mesma referência. */
export function setRoomName(map: MapData, id: string, name: string): MapData {
  const region = map.regions.find((r) => r.id === id)
  if (!region || !region.room) return map

  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id && r.room ? { ...r, room: { ...r.room, name } } : r)),
  }
}

/** Posição do rótulo da Sala relativa à âncora (`RoomMeta.labelOffset`).
 * Região comum ou id inexistente devolve o mesmo `map`, para
 * `commitDragHistory` não gravar entrada vazia. */
export function setRoomLabelOffset(map: MapData, id: string, offset: { x: number; y: number }): MapData {
  const region = map.regions.find((r) => r.id === id)
  if (!region || !region.room) return map
  // Sem offset é o mesmo que (0,0): um clique parado no nome não vira Ctrl+Z vazio.
  const current = region.room.labelOffset ?? { x: 0, y: 0 }
  if (current.x === offset.x && current.y === offset.y) return map

  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id && r.room ? { ...r, room: { ...r.room, labelOffset: { x: offset.x, y: offset.y } } } : r)),
  }
}

/** A5 — "Jogadores veem o nome". Região comum, id inexistente ou valor igual
 * devolve o mesmo `map` (sem entrada de histórico vazia). */
export function setRoomNameHiddenFromPlayers(map: MapData, id: string, hidden: boolean): MapData {
  const region = map.regions.find((r) => r.id === id)
  if (!region || !region.room || !!region.room.nameHiddenFromPlayers === hidden) return map
  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id && r.room ? { ...r, room: { ...r.room, nameHiddenFromPlayers: hidden } } : r)),
  }
}

/** TETO DE CONSTRUÇÃO — "Teto fechado para jogadores" (`RoomMeta.roof`).
 * Mesmo contrato de `setRoomNameHiddenFromPlayers`: região comum, id
 * inexistente ou valor igual devolve o mesmo `map`, para não gravar entrada de
 * histórico vazia (Ctrl+Z tem de desfazer um clique, não um não-clique). */
export function setRoomRoof(map: MapData, id: string, roof: boolean): MapData {
  const region = map.regions.find((r) => r.id === id)
  if (!region || !region.room || !!region.room.roof === roof) return map
  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id && r.room ? { ...r, room: { ...r.room, roof } } : r)),
  }
}

/** Entidades que aceitam "Oculto para jogadores" (`PlayerSecret` em types/map.ts). */
export type SecretKind = 'token' | 'region' | 'prop' | 'stair' | 'drawing' | 'pin'

function withSecret<T extends { id: string; secret?: boolean }>(items: T[], id: string, secret: boolean): T[] | null {
  const item = items.find((i) => i.id === id)
  if (!item || !!item.secret === secret) return null
  return items.map((i) => (i.id === id ? { ...i, secret } : i))
}

/** A5 — liga/desliga "Oculto para jogadores". Id inexistente ou valor igual devolve o mesmo `map`. */
export function setItemSecret(map: MapData, kind: SecretKind, id: string, secret: boolean): MapData {
  switch (kind) {
    case 'token': {
      const tokens = withSecret(map.tokens, id, secret)
      return tokens ? { ...map, tokens } : map
    }
    case 'region': {
      const regions = withSecret(map.regions, id, secret)
      return regions ? { ...map, regions } : map
    }
    case 'prop': {
      const props = withSecret(map.props, id, secret)
      return props ? { ...map, props } : map
    }
    case 'stair': {
      const stairs = withSecret(map.stairs, id, secret)
      return stairs ? { ...map, stairs } : map
    }
    case 'drawing': {
      const drawings = withSecret(map.drawings, id, secret)
      return drawings ? { ...map, drawings } : map
    }
    case 'pin': {
      const pins = withSecret(map.pins, id, secret)
      return pins ? { ...map, pins } : map
    }
  }
}

/**
 * Pino novo no ponto clicado, sem descrição e sem imagem — o painel completa
 * depois. `icon` é opcional e o padrão é a AUSÊNCIA: quem não escolhe símbolo
 * crava o pino de hoje, com o glifo de `kind`.
 */
export function buildPin(id: string, point: Point, kind: PinKind, icon?: PinIcon): Pin {
  const pin: Pin = { id, x: point.x, y: point.y, kind, description: '', image: null }
  return icon === undefined ? pin : { ...pin, icon }
}

export function addPin(map: MapData, pin: Pin): MapData {
  return { ...map, pins: [...map.pins, pin] }
}

/**
 * Tipo, símbolo, descrição, imagem, trava e destino (pino de viagem) do pino.
 * Id inexistente ou nada mudando devolve o mesmo `map`.
 */
export function updatePin(
  map: MapData,
  id: string,
  patch: Partial<Pick<Pin, 'kind' | 'icon' | 'description' | 'image' | 'locked' | 'destino' | 'passagem' | 'rotulo' | 'saidas' | 'item' | 'presoA' | 'portaLigada'>>,
): MapData {
  const pin = map.pins.find((p) => p.id === id)
  if (!pin) return map
  const next = { ...pin, ...patch }
  // ITEM PEGÁVEL: ligar, renomear ou trocar "pega sem pedir" é mudança;
  // desligar um item que nunca existiu não é.
  const sameItem = next.item?.nome === pin.item?.nome && next.item?.livre === pin.item?.livre
  // `locked` por veracidade, não por igualdade estrita: `undefined` === false é
  // o contrato de compatibilidade do schema (types/map.ts), e `false !== undefined`
  // faria destravar um pino nunca travado empurrar uma entrada de undo vazia.
  if (
    next.kind === pin.kind &&
    // `icon` também é opcional: `undefined` é "sem símbolo", e tirar o símbolo
    // de um pino que nunca teve não pode empurrar entrada vazia no histórico.
    next.icon === pin.icon &&
    next.description === pin.description &&
    next.image === pin.image &&
    !!next.locked === !!pin.locked &&
    // Mesma regra: desligar um pino que nunca foi ligado não é mudança.
    sameDestination(next.destino, pin.destino) &&
    // Encruzilhada: acrescentar, desligar ou renomear uma saída é mudança;
    // escrever de novo o mesmo nome não é.
    sameExits(next, pin) &&
    // E aqui também: `undefined` === 'pede'. Escolher "Pede ao mestre" num
    // pino que nunca teve modo não empurra entrada vazia no histórico.
    passageOf(next) === passageOf(pin) &&
    // Preso à ficha: soltar um pino que nunca foi preso não é mudança.
    next.presoA === pin.presoA &&
    // Alavanca: desligar uma alavanca que nunca foi ligada não é mudança.
    next.portaLigada === pin.portaLigada &&
    sameItem
  ) {
    return map
  }
  return { ...map, pins: map.pins.map((p) => (p.id === id ? next : p)) }
}

/**
 * Posição do pino durante o arrasto do mestre. Sem snap de propósito: o pino é
 * anotação e fica ONDE o mestre soltou, a mesma regra de `buildPin`.
 *
 * Não checa `locked` aqui — quem decide se o gesto começa é o `pointerdown` de
 * `pixi/PixiCanvas.tsx`, do mesmo jeito que o arrasto de Token faz com
 * `canInteract`. Id inexistente ou posição igual devolve o mesmo `map`, para o
 * `set` da store nem acontecer (dezenas de pointermove por gesto).
 */
export function setPinPosition(map: MapData, id: string, x: number, y: number): MapData {
  const pin = map.pins.find((p) => p.id === id)
  if (!pin || (pin.x === x && pin.y === y)) return map
  return { ...map, pins: map.pins.map((p) => (p.id === id ? { ...p, x, y } : p)) }
}

export function removePin(map: MapData, id: string): MapData {
  if (!map.pins.some((p) => p.id === id)) return map
  return { ...map, pins: map.pins.filter((p) => p.id !== id) }
}

/** Nome padrão da zona nova. */
export const DEFAULT_CONCEAL_ZONE_NAME = 'Zona oculta'

/** Zona retangular a partir de dois cantos quaisquer do arrasto (ordem horária a partir do canto de cima à esquerda). */
export function buildConcealZoneFromDraft(id: string, start: Point, end: Point, name: string = DEFAULT_CONCEAL_ZONE_NAME): ConcealZone {
  const minX = Math.min(start.x, end.x)
  const maxX = Math.max(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const maxY = Math.max(start.y, end.y)
  return {
    id,
    name,
    revealed: false,
    points: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  }
}

export function addConcealZone(map: MapData, zone: ConcealZone): MapData {
  return { ...map, concealZones: [...map.concealZones, zone] }
}

/** Nome e "Revelar para jogadores". Id inexistente ou nada mudando devolve o mesmo `map`. */
export function updateConcealZone(map: MapData, id: string, patch: Partial<Pick<ConcealZone, 'name' | 'revealed'>>): MapData {
  const zone = map.concealZones.find((z) => z.id === id)
  if (!zone) return map
  const next = { ...zone, ...patch }
  if (next.name === zone.name && next.revealed === zone.revealed) return map
  return { ...map, concealZones: map.concealZones.map((z) => (z.id === id ? next : z)) }
}

export function removeConcealZone(map: MapData, id: string): MapData {
  if (!map.concealZones.some((z) => z.id === id)) return map
  return { ...map, concealZones: map.concealZones.filter((z) => z.id !== id) }
}

/**
 * Redimensiona uma Sala RETANGULAR (`room.shape === 'rect'`) por
 * largura/altura numérica — âncora em `points[0]`, ver `roomOps.resizeRoomDimensions`.
 * COM histórico (chamado a partir do campo numérico do painel, não de um
 * arrasto contínuo). Sala Circular/Polígono ou região sem `room`: `map` sem
 * mudança. Sala retangular TORTA (girada fora de 0/90/180/−90°) também: a
 * conta reconstrói um retângulo reto e desmontaria a sala (`isAxisAlignedRect`).
 */
export function resizeRoomDimensions(map: MapData, id: string, wPx: number, hPx: number): MapData {
  const region = map.regions.find((r) => r.id === id)
  if (!region || region.room?.shape !== 'rect' || !isAxisAlignedRect(region.points)) return map

  const points = resizeRoomDimensionsPoints(region.points, wPx, hPx)
  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id ? { ...r, points } : r)),
    walls: syncLinkedWallsToPoints(map.walls, id, region.points, points),
  }
}

/**
 * Variante "live" de `resizeRoomDimensions`/mover-canto, restrita ao arrasto
 * de UM canto: aplica no `map` direto, SEM histórico — pensada pro pointermove
 * do arrasto da alça de canto (drawRoomHandles.ts). Par de `commitDragHistory`
 * no pointerup, mesmo padrão de `updateLightRadiusLive`/`updateCurvePointLive`
 * (mapStore.ts). Sala Circular/Polígono ou região sem `room`: `map` sem mudança.
 * Sala retangular torta também, pelo mesmo motivo de `resizeRoomDimensions`.
 */
export function resizeRoomCornerLive(map: MapData, id: string, corner: RoomCorner, x: number, y: number): MapData {
  const region = map.regions.find((r) => r.id === id)
  if (!region || region.room?.shape !== 'rect' || !isAxisAlignedRect(region.points)) return map

  const points = resizeRoomCorner(region.points, corner, x, y)
  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id ? { ...r, points } : r)),
    walls: syncLinkedWallsToPoints(map.walls, id, region.points, points),
  }
}

// ─────────────────────────────────────────────────────────────
// MEDIÇÃO + ESCALA (F2) — contrato do agente B4. `scale`/`measurementMode`
// são campos simples de MapData, mesma classe de setShowGrid/setGridSettings.
// ─────────────────────────────────────────────────────────────
export function setMapScale(map: MapData, scale: MapScale): MapData {
  return { ...map, scale }
}

export function setMeasurementMode(map: MapData, measurementMode: MeasurementMode): MapData {
  return { ...map, measurementMode }
}

/** Regras de movimento da cena. `undefined` tira o campo: a cena volta a ser livre, igual a mapa antigo. */
export function setMovementRules(map: MapData, movement: MovementRules | undefined): MapData {
  if (movement === undefined) {
    const { movement: _livre, ...rest } = map
    return rest
  }
  return { ...map, movement }
}

/** MAPA-MUNDI (`lib/caravan.ts`): desligar tira o campo, e a cena volta a ser comum, igual a mapa antigo. */
export function setWorldMap(map: MapData, worldMap: boolean): MapData {
  if (worldMap) return map.worldMap === true ? map : { ...map, worldMap: true }
  if (map.worldMap === undefined) return map
  const { worldMap: _comum, ...rest } = map
  return rest
}

/** MAPA POR ANDARES (`lib/buildingFloors.ts`): `undefined` tira o campo, e a cena volta a ser comum. */
export function setSceneFloor(map: MapData, andar: SceneFloor | undefined): MapData {
  if (andar !== undefined) return { ...map, andar }
  if (map.andar === undefined) return map
  const { andar: _comum, ...rest } = map
  return rest
}
