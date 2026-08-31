// E2E das ferramentas "Sala Circular" e "Polígono Regular" — poligono regular
// inscrito num círculo, mesma factory (buildRegularPolygonRoomFromDraft) que
// unifica sala redonda (segments=24 fixo) e forma geométrica (segments
// configurável). Mesmo harness de task-room-tool.spec.ts: import dinâmico da
// store dentro de page.evaluate, câmera em {0,0,scale:1}, coordenada de mundo
// = offset do canvas.
//
// O ponto central deste arquivo é o teste 3: prova que a edição de vértice já
// existente pra Sala retangular (arrastar um ponto do polígono, sincronizando
// as 2 paredes vinculadas adjacentes) funciona de graça na Sala Circular — a
// evidência de que reusar regionId/regionEdgeIndex (roomLink.ts) dá acesso
// gratuito a toda a edição já construída, sem tocar em PixiCanvas.tsx além da
// criação.
//
// Testes 4 e 5 espelham 2 e 3, mas para a ferramenta "Polígono Regular" com
// sides=8 (valor fora de {3,6} já cobertos em unit test e no teste 2, e fora
// do sides=24 fixo da Sala Circular) — prova que (i) o número de lados vem da
// store, não está hardcoded, e (ii) a edição de vértice também funciona de
// graça pra região criada por esta ferramenta especificamente, não só pela
// Sala Circular.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Wall, Region } from '../src/types/map'

type MapState = {
  walls: Wall[]
  regions: Region[]
}

async function getMapState(page: Page): Promise<MapState> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const state = mod.useMapStore.getState()
    return { walls: state.map.walls, regions: state.map.regions }
  })
}

async function getSelection(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_room_circle_polygon', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Sala Circular' | 'Polígono Regular') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

async function setPolygonSides(page: Page, sides: number) {
  await page.evaluate(async (n) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setPolygonSides(n)
  }, sides)
}

function wallByEdge(walls: Wall[], regionId: string, edgeIndex: number): Wall {
  const wall = walls.find((w) => w.regionId === regionId && w.regionEdgeIndex === edgeIndex)
  if (!wall) throw new Error(`nenhuma parede com regionEdgeIndex=${edgeIndex} para regionId=${regionId}`)
  return wall
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 5) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. Sala Circular: arrasto centro-borda gera 1 região de 24 pontos + 24 paredes vinculadas', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala Circular')
  // centro em (500,400), arrasta até (700,400) -> raio 200, primeiro vértice sob o cursor.
  await drag(page, { x: box.x + 500, y: box.y + 400 }, { x: box.x + 700, y: box.y + 400 })

  const { walls, regions } = await getMapState(page)
  expect(regions).toHaveLength(1)
  const region = regions[0]
  expect(region.points).toHaveLength(24)
  expect(region.points[0].x).toBeCloseTo(700, 5)
  expect(region.points[0].y).toBeCloseTo(400, 5)

  const roomWalls = walls.filter((w) => w.regionId === region.id)
  expect(roomWalls).toHaveLength(24)
  const edgeIndexes = roomWalls.map((w) => w.regionEdgeIndex).sort((a, b) => (a ?? 0) - (b ?? 0))
  expect(edgeIndexes).toEqual(Array.from({ length: 24 }, (_, i) => i))
  for (const wall of roomWalls) {
    expect(wall.blocksLight).toBe(true)
    expect(wall.blocksMove).toBe(true)
    expect(wall.door).toBeNull()
  }
})

test('2. Polígono Regular: respeita o número de lados configurado na store (triângulo, sides=3)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await setPolygonSides(page, 3)
  await selectTool(page, 'Polígono Regular')
  await drag(page, { x: box.x + 500, y: box.y + 400 }, { x: box.x + 700, y: box.y + 400 })

  const { walls, regions } = await getMapState(page)
  expect(regions).toHaveLength(1)
  const region = regions[0]
  expect(region.points).toHaveLength(3)

  const roomWalls = walls.filter((w) => w.regionId === region.id)
  expect(roomWalls).toHaveLength(3)
  expect(roomWalls.map((w) => w.regionEdgeIndex).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 1, 2])
})

test('3. edição de vértice na Sala Circular: arrastar 1 ponto move só ele e resincroniza as 2 paredes adjacentes (reuso do vínculo Região↔Parede da Sala retangular)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala Circular')
  await drag(page, { x: box.x + 500, y: box.y + 400 }, { x: box.x + 700, y: box.y + 400 })

  const before = await getMapState(page)
  const region = before.regions[0]
  expect(region.points).toHaveLength(24)
  const vertex0Before = region.points[0]
  expect(vertex0Before.x).toBeCloseTo(700, 5)
  expect(vertex0Before.y).toBeCloseTo(400, 5)

  const edge23Before = wallByEdge(before.walls, region.id, 23)
  const otherPointsBefore = region.points.slice(1)

  await selectTool(page, 'Selecionar')
  // clique no interior da sala circular seleciona a região.
  await page.mouse.click(box.x + 500, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'region', id: region.id })

  // vértice 0 = (700,400) — arrasta pra uma posição nova e verificável.
  const dx = 50
  const dy = -30
  await drag(page, { x: box.x + 700, y: box.y + 400 }, { x: box.x + 700 + dx, y: box.y + 400 + dy })

  const after = await getMapState(page)
  const regionAfter = after.regions.find((r) => r.id === region.id)
  expect(regionAfter).toBeTruthy()

  // só o vértice 0 mudou — todos os outros 23 pontos ficaram idênticos.
  expect(regionAfter!.points[0]).toEqual({ x: 700 + dx, y: 400 + dy })
  expect(regionAfter!.points.slice(1)).toEqual(otherPointsBefore)

  // aresta 0 (começa no vértice 0) e aresta 23 (termina no vértice 0)
  // resincronizam; as outras 22 paredes ficam com a mesma referência.
  const edge0After = wallByEdge(after.walls, region.id, 0)
  const edge23After = wallByEdge(after.walls, region.id, 23)
  expect(edge0After).toMatchObject({ x1: 700 + dx, y1: 400 + dy })
  expect(edge23After).toMatchObject({ x2: 700 + dx, y2: 400 + dy })
  expect(edge23After).toMatchObject({ x1: edge23Before.x1, y1: edge23Before.y1 })

  const untouchedEdges = after.walls.filter(
    (w) => w.regionId === region.id && w.regionEdgeIndex !== 0 && w.regionEdgeIndex !== 23,
  )
  expect(untouchedEdges).toHaveLength(22)
})

test('4. Polígono Regular: respeita lados diferente de 3/6 (sides=8), sem hardcode', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await setPolygonSides(page, 8)
  await selectTool(page, 'Polígono Regular')
  await drag(page, { x: box.x + 500, y: box.y + 400 }, { x: box.x + 700, y: box.y + 400 })

  const { walls, regions } = await getMapState(page)
  expect(regions).toHaveLength(1)
  const region = regions[0]
  expect(region.points).toHaveLength(8)

  const roomWalls = walls.filter((w) => w.regionId === region.id)
  expect(roomWalls).toHaveLength(8)
  expect(roomWalls.map((w) => w.regionEdgeIndex).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
    Array.from({ length: 8 }, (_, i) => i),
  )
})

test('5. edição de vértice no Polígono Regular (sides=8): arrastar 1 ponto move só ele e resincroniza as 2 paredes adjacentes', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await setPolygonSides(page, 8)
  await selectTool(page, 'Polígono Regular')
  await drag(page, { x: box.x + 500, y: box.y + 400 }, { x: box.x + 700, y: box.y + 400 })

  const before = await getMapState(page)
  const region = before.regions[0]
  expect(region.points).toHaveLength(8)
  const vertex0Before = region.points[0]
  expect(vertex0Before.x).toBeCloseTo(700, 5)
  expect(vertex0Before.y).toBeCloseTo(400, 5)

  const lastEdgeIndex = 7
  const edgeLastBefore = wallByEdge(before.walls, region.id, lastEdgeIndex)
  const otherPointsBefore = region.points.slice(1)

  await selectTool(page, 'Selecionar')
  // clique no interior do polígono seleciona a região.
  await page.mouse.click(box.x + 500, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'region', id: region.id })

  // vértice 0 = (700,400) — arrasta pra uma posição nova e verificável.
  const dx = 50
  const dy = -30
  await drag(page, { x: box.x + 700, y: box.y + 400 }, { x: box.x + 700 + dx, y: box.y + 400 + dy })

  const after = await getMapState(page)
  const regionAfter = after.regions.find((r) => r.id === region.id)
  expect(regionAfter).toBeTruthy()

  // só o vértice 0 mudou — todos os outros 7 pontos ficaram idênticos.
  expect(regionAfter!.points[0]).toEqual({ x: 700 + dx, y: 400 + dy })
  expect(regionAfter!.points.slice(1)).toEqual(otherPointsBefore)

  // aresta 0 (começa no vértice 0) e aresta 7 (termina no vértice 0)
  // resincronizam; as outras 6 paredes ficam com a mesma referência.
  const edge0After = wallByEdge(after.walls, region.id, 0)
  const edgeLastAfter = wallByEdge(after.walls, region.id, lastEdgeIndex)
  expect(edge0After).toMatchObject({ x1: 700 + dx, y1: 400 + dy })
  expect(edgeLastAfter).toMatchObject({ x2: 700 + dx, y2: 400 + dy })
  expect(edgeLastAfter).toMatchObject({ x1: edgeLastBefore.x1, y1: edgeLastBefore.y1 })

  const untouchedEdges = after.walls.filter(
    (w) => w.regionId === region.id && w.regionEdgeIndex !== 0 && w.regionEdgeIndex !== lastEdgeIndex,
  )
  expect(untouchedEdges).toHaveLength(6)
})
