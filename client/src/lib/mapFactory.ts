import type {
  MapData, Wall, Light, Region, Token, Prop, Drawing, DoorState, LayerId, GridSettings,
  Stair, StairDirection, DoorKind, MapScale, MeasurementMode, FloorPiece, FloorStyle, MapLine, MapMarker, MapFrame,
  ConcealZone,
} from '../types/map'
import type { Point } from '../pixi/world'
import { syncWallsToRegionPoint, remapForInsert, remapForRemove, translateLinkedWalls, previousEdgeIndex } from './roomLink'
import { simplifyPolygon, chaikinSmooth } from './regionSmoothing'
import { resizeRoomCorner, resizeRoomDimensions as resizeRoomDimensionsPoints, type RoomCorner } from './roomOps'
import { defaultMeasurementModeForShape } from './measurement'
import { DEFAULT_FLOOR_STYLE } from './mapFile'
import {
  resizeRectDrawing, resizeEllipseDrawing, resizePolygonDrawing, resizePropBox, resizeCircleDrawingRadius,
  type Corner, type ResizeModifiers,
} from './objectTransform'

export function createEmptyMap(id: string, name: string, width: number, height: number, grid: number): MapData {
  return {
    id,
    name,
    width,
    height,
    grid,
    gridShape: 'square',
    showGrid: true,
    // Grade discreta do mapa novo (passo 3, F1). Diverge DE PROPÓSITO do
    // default que deserializeMap (mapFile.ts) aplica a mapa antigo sem
    // gridSettings: mapa salvo continua abrindo com a grade de antes.
    gridSettings: { color: '#1f1b16', opacity: 0.18, lineWidth: 1, lineStyle: 'solid' },
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
        : { ...shape, cx: shape.cx + dx, cy: shape.cy + dy }
  return updateFloorPiece(map, pieceId, { shape: moved })
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

export function removeRegion(map: MapData, regionId: string): MapData {
  return {
    ...map,
    regions: map.regions.filter((r) => r.id !== regionId),
    walls: map.walls.filter((w) => w.regionId !== regionId),
  }
}

export function addRoom(map: MapData, region: Region, walls: Wall[]): MapData {
  return { ...map, regions: [...map.regions, region], walls: [...map.walls, ...walls] }
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

  const n = region.points.length

  return {
    ...map,
    regions: map.regions.map((r) =>
      r.id === regionId ? { ...r, points: r.points.map((p, i) => (i === index ? { x, y } : p)) } : r,
    ),
    walls: syncWallsToRegionPoint(map.walls, regionId, index, x, y, n),
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

  const points = [
    ...region.points.slice(0, afterEdgeIndex + 1),
    { x, y },
    ...region.points.slice(afterEdgeIndex + 1),
  ]

  return {
    ...map,
    regions: map.regions.map((r) => (r.id === regionId ? { ...r, points } : r)),
    walls: remapForInsert(map.walls, regionId, afterEdgeIndex, newWallId, x, y),
  }
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
    walls: remapForRemove(map.walls, regionId, index, n, prevPoint, nextPoint),
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

  return linkRegionWalls(mapWithoutOldWalls, regionId)
}

export function moveRegion(map: MapData, regionId: string, dx: number, dy: number): MapData {
  const region = map.regions.find((r) => r.id === regionId)
  if (!region) return map

  return {
    ...map,
    regions: map.regions.map((r) =>
      r.id === regionId ? { ...r, points: r.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : r,
    ),
    walls: translateLinkedWalls(map.walls, regionId, dx, dy),
  }
}

export function addToken(map: MapData, token: Token): MapData {
  return { ...map, tokens: [...map.tokens, token] }
}

export function removeToken(map: MapData, tokenId: string): MapData {
  return { ...map, tokens: map.tokens.filter((t) => t.id !== tokenId) }
}

export function setTokenPosition(map: MapData, tokenId: string, x: number, y: number): MapData {
  return {
    ...map,
    tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)),
  }
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

export function setTokenImage(map: MapData, tokenId: string, image: string | null): MapData {
  return {
    ...map,
    tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, image } : t)),
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

export function setWallDoor(map: MapData, wallId: string, door: DoorState | null): MapData {
  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId ? { ...w, door } : w)),
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
 * Troca o `DoorKind` de uma porta JÁ EXISTENTE (parede com `door !== null`) e
 * REDIMENSIONA o vão pra `doorLength` (= `DOOR_LENGTH_BY_KIND[kind]`,
 * calculado pelo chamador em mapStore.ts), centrado no meio do vão ATUAL —
 * troca de tipo não desloca a porta, só estica/encolhe pros dois lados do
 * mesmo centro. Direção herdada do vetor unitário da própria `Wall`, nunca
 * recalculada como horizontal/vertical (mesma convenção de `addDoorOnWall`).
 *
 * Parede inexistente, sem porta (`door === null`), ou de comprimento zero
 * (não deveria existir uma porta assim, mas defensivo): devolve `map` pela
 * mesma referência.
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

  const midX = (wall.x1 + wall.x2) / 2
  const midY = (wall.y1 + wall.y2) / 2
  const ux = dx / length
  const uy = dy / length
  const half = doorLength / 2

  const updatedWall: Wall = {
    ...wall,
    x1: midX - ux * half,
    y1: midY - uy * half,
    x2: midX + ux * half,
    y2: midY + uy * half,
    door: { ...door, kind },
  }

  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId ? updatedWall : w)),
  }
}

/**
 * Alterna `DoorState.locked` de uma porta já existente. Campo no schema desde
 * sempre (types/map.ts), sem UI até esta fase (F2). Parede inexistente ou sem
 * porta: devolve `map` pela mesma referência.
 */
export function setDoorLocked(map: MapData, wallId: string, locked: boolean): MapData {
  const wall = map.walls.find((w) => w.id === wallId)
  if (!wall || !wall.door) return map

  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId && w.door ? { ...w, door: { ...w.door, locked } } : w)),
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
 * Se a parede original estava vinculada a uma Região (`regionId`/
 * `regionEdgeIndex`), os pedaços novos NÃO herdam esse vínculo — colocar uma
 * porta no meio quebra a premissa de "1 parede = 1 aresta inteira", então a
 * parede vinculada vira paredes soltas normais a partir daqui. Intencional,
 * não é bug.
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

  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const length = Math.hypot(dx, dy)
  if (length === 0) return map

  const ux = dx / length
  const uy = dy / length

  // Parâmetro t (0..1) do ponto mais próximo do clique NA PRÓPRIA LINHA da
  // parede — mesma projeção escalar de distanceToSegment (selectionHitTest.ts).
  const t = Math.max(0, Math.min(1, ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / (length * length)))
  const projectedDistance = t * length

  const half = doorLength / 2
  const doorStart = Math.max(0, projectedDistance - half)
  const doorEnd = Math.min(length, projectedDistance + half)

  const pieceAt = (fromDistance: number, toDistance: number, door: DoorState | null): Wall => ({
    ...wall,
    id: crypto.randomUUID(),
    x1: wall.x1 + ux * fromDistance,
    y1: wall.y1 + uy * fromDistance,
    x2: wall.x1 + ux * toDistance,
    y2: wall.y1 + uy * toDistance,
    door,
    regionId: undefined,
    regionEdgeIndex: undefined,
  })

  const pieces: Wall[] = []
  if (doorStart > 0) pieces.push(pieceAt(0, doorStart, null))
  pieces.push(pieceAt(doorStart, doorEnd, { open: false, locked: false, kind }))
  if (doorEnd < length) pieces.push(pieceAt(doorEnd, length, null))

  return {
    ...map,
    walls: [...map.walls.filter((w) => w.id !== wallId), ...pieces],
  }
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
// buildRoomFromDraft/drawingFactory.ts), reusando `syncWallsToRegionPoint`
// (lib/roomLink.ts) — mesma função que `updateRegionPoint` já usa. Sem essa
// sincronização a Sala "redimensiona" visualmente mas as paredes ficam para
// trás, desalinhadas do contorno novo.
// ─────────────────────────────────────────────────────────────

/** Aplica `syncWallsToRegionPoint` a TODOS os vértices de `points` em sequência
 *  — usado depois de recalcular os 4 cantos de uma Sala inteira de uma vez
 *  (resize), diferente de `updateRegionPoint`, que move só 1 vértice. */
function syncAllRoomPoints(walls: Wall[], regionId: string, points: Region['points']): Wall[] {
  const n = points.length
  return points.reduce((acc, p, i) => syncWallsToRegionPoint(acc, regionId, i, p.x, p.y, n), walls)
}

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

/** Entidades que aceitam "Oculto para jogadores" (`PlayerSecret` em types/map.ts). */
export type SecretKind = 'token' | 'region' | 'prop' | 'stair' | 'drawing'

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
  }
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
 * mudança.
 */
export function resizeRoomDimensions(map: MapData, id: string, wPx: number, hPx: number): MapData {
  const region = map.regions.find((r) => r.id === id)
  if (!region || region.room?.shape !== 'rect') return map

  const points = resizeRoomDimensionsPoints(region.points, wPx, hPx)
  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id ? { ...r, points } : r)),
    walls: syncAllRoomPoints(map.walls, id, points),
  }
}

/**
 * Variante "live" de `resizeRoomDimensions`/mover-canto, restrita ao arrasto
 * de UM canto: aplica no `map` direto, SEM histórico — pensada pro pointermove
 * do arrasto da alça de canto (drawRoomHandles.ts). Par de `commitDragHistory`
 * no pointerup, mesmo padrão de `updateLightRadiusLive`/`updateCurvePointLive`
 * (mapStore.ts). Sala Circular/Polígono ou região sem `room`: `map` sem mudança.
 */
export function resizeRoomCornerLive(map: MapData, id: string, corner: RoomCorner, x: number, y: number): MapData {
  const region = map.regions.find((r) => r.id === id)
  if (!region || region.room?.shape !== 'rect') return map

  const points = resizeRoomCorner(region.points, corner, x, y)
  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id ? { ...r, points } : r)),
    walls: syncAllRoomPoints(map.walls, id, points),
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
