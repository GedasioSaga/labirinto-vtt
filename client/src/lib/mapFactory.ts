import type { MapData, Wall, Light, Region, Token, Prop, Drawing, DoorState } from '../types/map'
import { syncWallsToRegionPoint, remapForInsert, remapForRemove, translateLinkedWalls, previousEdgeIndex } from './roomLink'
import { simplifyPolygon, chaikinSmooth } from './regionSmoothing'

export function createEmptyMap(id: string, name: string, width: number, height: number, grid: number): MapData {
  return {
    id,
    name,
    width,
    height,
    grid,
    gridShape: 'square',
    showGrid: true,
    background: { type: 'color', src: '#2b2b2b' },
    walls: [],
    lights: [],
    regions: [],
    tokens: [],
    props: [],
    drawings: [],
    fog: { mode: 'none', revealed: [] },
    ownerId: null,
    scenarioLink: null,
  }
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

export function setShowGrid(map: MapData, showGrid: boolean): MapData {
  return { ...map, showGrid }
}

export function setBackground(map: MapData, background: MapData['background']): MapData {
  return { ...map, background }
}

export function setGridShape(map: MapData, gridShape: MapData['gridShape']): MapData {
  return { ...map, gridShape }
}

export function setWallDoor(map: MapData, wallId: string, door: DoorState | null): MapData {
  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId ? { ...w, door } : w)),
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
 * Parede inexistente ou de comprimento zero: devolve `map` pela mesma
 * referência (sem mudança).
 */
export function addDoorOnWall(map: MapData, wallId: string, point: { x: number; y: number }, doorLength: number): MapData {
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
  pieces.push(pieceAt(doorStart, doorEnd, { open: false, locked: false }))
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
        default:
          return d
      }
    }),
  }
}
