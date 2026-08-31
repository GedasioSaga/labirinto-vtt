// E2E da ferramenta Sala (Fase 4 do plano `refactored-mixing-kite.md`): criação
// canto-a-canto (região + 4 paredes vinculadas num só gesto), edição de vértice
// e ponto médio de aresta (com sincronização Região→Parede), mover corpo inteiro,
// delegação de "arrastar parede vinculada" para mover a sala toda, parede solta
// continuando independente, e cascata de undo/apagar.
//
// Mesmo harness de `task-eraser-tool.spec.ts`: import dinâmico da store dentro de
// `page.evaluate`, câmera fica em {0,0,scale:1} (sem pan/zoom antes de medir), então
// coordenada de mundo = offset do canvas.
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_room', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Sala' | 'Parede' | 'Região') {
  await page.getByRole('button', { name: label, exact: true }).click()
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

test('1. criação: arrasto canto-a-canto gera 1 região + 4 paredes vinculadas', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala')
  await drag(page, { x: box.x + 300, y: box.y + 300 }, { x: box.x + 600, y: box.y + 500 })

  const { walls, regions } = await getMapState(page)
  expect(regions).toHaveLength(1)
  const region = regions[0]
  expect(region.points).toEqual([
    { x: 300, y: 300 },
    { x: 600, y: 300 },
    { x: 600, y: 500 },
    { x: 300, y: 500 },
  ])

  const roomWalls = walls.filter((w) => w.regionId === region.id)
  expect(roomWalls).toHaveLength(4)
  const edgeIndexes = roomWalls.map((w) => w.regionEdgeIndex).sort()
  expect(edgeIndexes).toEqual([0, 1, 2, 3])

  expect(wallByEdge(walls, region.id, 0)).toMatchObject({ x1: 300, y1: 300, x2: 600, y2: 300 })
  expect(wallByEdge(walls, region.id, 1)).toMatchObject({ x1: 600, y1: 300, x2: 600, y2: 500 })
  expect(wallByEdge(walls, region.id, 2)).toMatchObject({ x1: 600, y1: 500, x2: 300, y2: 500 })
  expect(wallByEdge(walls, region.id, 3)).toMatchObject({ x1: 300, y1: 500, x2: 300, y2: 300 })
})

test('2. arrastar vértice: só aquele ponto muda, as 2 paredes adjacentes acompanham, as outras 2 ficam idênticas', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala')
  await drag(page, { x: box.x + 300, y: box.y + 300 }, { x: box.x + 600, y: box.y + 500 })
  const before = await getMapState(page)
  const region = before.regions[0]
  const edge2Before = wallByEdge(before.walls, region.id, 2)
  const edge3Before = wallByEdge(before.walls, region.id, 3)

  await selectTool(page, 'Selecionar')
  // clique no meio da sala seleciona a região.
  await page.mouse.click(box.x + 450, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'region', id: region.id })

  // vértice 1 = (600,300), canto superior direito.
  await drag(page, { x: box.x + 600, y: box.y + 300 }, { x: box.x + 700, y: box.y + 250 })

  const after = await getMapState(page)
  const afterRegion = after.regions.find((r) => r.id === region.id)
  expect(afterRegion).toBeTruthy()
  expect(afterRegion!.points[1]).toEqual({ x: 700, y: 250 })
  expect(afterRegion!.points[0]).toEqual({ x: 300, y: 300 })
  expect(afterRegion!.points[2]).toEqual({ x: 600, y: 500 })
  expect(afterRegion!.points[3]).toEqual({ x: 300, y: 500 })

  const edge0After = wallByEdge(after.walls, region.id, 0)
  const edge1After = wallByEdge(after.walls, region.id, 1)
  expect(edge0After).toMatchObject({ x1: 300, y1: 300, x2: 700, y2: 250 })
  expect(edge1After).toMatchObject({ x1: 700, y1: 250, x2: 600, y2: 500 })

  expect(wallByEdge(after.walls, region.id, 2)).toEqual(edge2Before)
  expect(wallByEdge(after.walls, region.id, 3)).toEqual(edge3Before)
})

test('3. inserir + remover (ida e volta): topologia volta ao estado original', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala')
  await drag(page, { x: box.x + 300, y: box.y + 300 }, { x: box.x + 600, y: box.y + 500 })
  const before = await getMapState(page)
  const region = before.regions[0]

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 450, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'region', id: region.id })

  // Ponto médio da aresta 0 (topo): (450,300). Arrastar pra cima insere e já arrasta.
  await drag(page, { x: box.x + 450, y: box.y + 300 }, { x: box.x + 450, y: box.y + 250 })

  const midInserted = await getMapState(page)
  const regionAfterInsert = midInserted.regions.find((r) => r.id === region.id)
  expect(regionAfterInsert).toBeTruthy()
  expect(regionAfterInsert!.points).toHaveLength(5)
  expect(midInserted.walls.filter((w) => w.regionId === region.id)).toHaveLength(5)
  expect(regionAfterInsert!.points[1]).toEqual({ x: 450, y: 250 })

  // Duplo-clique no ponto novo (mesma posição em que ficou depois do arrasto) remove.
  await page.mouse.dblclick(box.x + 450, box.y + 250)

  const after = await getMapState(page)
  const regionAfter = after.regions.find((r) => r.id === region.id)
  expect(regionAfter).toBeTruthy()
  expect(regionAfter!.points).toEqual(before.regions[0].points)

  const wallsAfter = after.walls.filter((w) => w.regionId === region.id)
  expect(wallsAfter).toHaveLength(4)
  expect(wallsAfter).toEqual(before.walls.filter((w) => w.regionId === region.id))
})

test('4. mover corpo da região: todos os pontos e ambos extremos das 4 paredes deslocam pelo mesmo delta', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala')
  await drag(page, { x: box.x + 300, y: box.y + 300 }, { x: box.x + 600, y: box.y + 500 })
  const before = await getMapState(page)
  const region = before.regions[0]
  const wallsBefore = before.walls.filter((w) => w.regionId === region.id)

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 450, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'region', id: region.id })

  // Ponto interior longe de qualquer vértice/meio de aresta (nenhum deles fica perto de 400,400).
  const dx = 50
  const dy = 40
  await drag(page, { x: box.x + 400, y: box.y + 400 }, { x: box.x + 400 + dx, y: box.y + 400 + dy })

  const after = await getMapState(page)
  const regionAfter = after.regions.find((r) => r.id === region.id)
  expect(regionAfter).toBeTruthy()
  for (let i = 0; i < 4; i += 1) {
    expect(regionAfter!.points[i]).toEqual({ x: region.points[i].x + dx, y: region.points[i].y + dy })
  }

  for (const wallBefore of wallsBefore) {
    const wallAfter = after.walls.find((w) => w.id === wallBefore.id)
    expect(wallAfter).toBeTruthy()
    expect(wallAfter).toMatchObject({
      x1: wallBefore.x1 + dx,
      y1: wallBefore.y1 + dy,
      x2: wallBefore.x2 + dx,
      y2: wallBefore.y2 + dy,
    })
  }
})

test('5. arrastar a borda (parede vinculada) move a sala inteira, não só aquela parede', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala')
  await drag(page, { x: box.x + 300, y: box.y + 300 }, { x: box.x + 600, y: box.y + 500 })
  const before = await getMapState(page)
  const region = before.regions[0]
  const wallsBefore = before.walls.filter((w) => w.regionId === region.id)

  await selectTool(page, 'Selecionar')

  const dx = 30
  const dy = 20
  // Ponto sobre a aresta 0 (topo), longe do vértice e do meio, sem nenhuma seleção prévia:
  // o hit-test de "Selecionar" acha a PAREDE primeiro (prioridade wall > region).
  await drag(page, { x: box.x + 400, y: box.y + 300 }, { x: box.x + 400 + dx, y: box.y + 300 + dy })

  const selection = await getSelection(page)
  expect(selection?.kind).toBe('wall')

  const after = await getMapState(page)
  const regionAfter = after.regions.find((r) => r.id === region.id)
  expect(regionAfter).toBeTruthy()
  for (let i = 0; i < 4; i += 1) {
    expect(regionAfter!.points[i]).toEqual({ x: region.points[i].x + dx, y: region.points[i].y + dy })
  }
  // TODAS as 4 paredes acompanharam, não só a que foi clicada.
  for (const wallBefore of wallsBefore) {
    const wallAfter = after.walls.find((w) => w.id === wallBefore.id)
    expect(wallAfter).toMatchObject({
      x1: wallBefore.x1 + dx,
      y1: wallBefore.y1 + dy,
      x2: wallBefore.x2 + dx,
      y2: wallBefore.y2 + dy,
    })
  }
})

test('6. parede solta: corpo e vértice continuam independentes (sem vínculo de região)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  await drag(page, { x: box.x + 800, y: box.y + 300 }, { x: box.x + 900, y: box.y + 300 })
  const created = await getMapState(page)
  expect(created.walls).toHaveLength(1)
  expect(created.walls[0].regionId).toBeUndefined()

  await selectTool(page, 'Selecionar')

  // Corpo: arrastar um ponto do meio da parede (não uma ponta) desloca as 2 pontas igual.
  const dx = 40
  const dy = 15
  await drag(page, { x: box.x + 850, y: box.y + 300 }, { x: box.x + 850 + dx, y: box.y + 300 + dy })

  const afterBodyDrag = await getMapState(page)
  const wallAfterBody = afterBodyDrag.walls[0]
  expect(wallAfterBody).toMatchObject({
    x1: created.walls[0].x1 + dx,
    y1: created.walls[0].y1 + dy,
    x2: created.walls[0].x2 + dx,
    y2: created.walls[0].y2 + dy,
  })

  // Vértice: arrastar só a ponta 1 (x2,y2) — a ponta 0 (x1,y1) fica idêntica.
  const vertexDx = 25
  const vertexDy = -10
  await drag(
    page,
    { x: box.x + wallAfterBody.x2, y: box.y + wallAfterBody.y2 },
    { x: box.x + wallAfterBody.x2 + vertexDx, y: box.y + wallAfterBody.y2 + vertexDy },
  )

  const afterVertexDrag = await getMapState(page)
  const wallAfterVertex = afterVertexDrag.walls[0]
  expect(wallAfterVertex.x1).toBe(wallAfterBody.x1)
  expect(wallAfterVertex.y1).toBe(wallAfterBody.y1)
  expect(wallAfterVertex.x2).toBe(wallAfterBody.x2 + vertexDx)
  expect(wallAfterVertex.y2).toBe(wallAfterBody.y2 + vertexDy)
})

test('7. Ctrl+Z logo depois de criar a sala remove a região e as 4 paredes num único passo', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala')
  await drag(page, { x: box.x + 300, y: box.y + 300 }, { x: box.x + 600, y: box.y + 500 })

  const created = await getMapState(page)
  expect(created.regions).toHaveLength(1)
  expect(created.walls).toHaveLength(4)

  await page.keyboard.press('Control+z')

  const after = await getMapState(page)
  expect(after.regions).toHaveLength(0)
  expect(after.walls).toHaveLength(0)
})

test('8. Região solta (sem parede): botão "Criar parede na borda" cria as N paredes vinculadas', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Região')
  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  // Fecha no 3º vértice com dblclick direto (sem clique simples antes no
  // mesmo ponto) — assim os 2 pointerdown do próprio duplo-clique geram só
  // 1 duplicata, que a lógica de fechamento em PixiCanvas.tsx remove,
  // deixando exatamente 3 pontos. Clicar 1x + dblclick no mesmo lugar (como
  // em task-region-color.spec.ts) deixa uma duplicata residual — inofensivo
  // lá porque aquele teste não checa contagem de vértice/aresta, mas quebraria
  // as asserções de regionEdgeIndex abaixo.
  await page.mouse.dblclick(box.x + 450, box.y + 500)

  const created = await getMapState(page)
  expect(created.regions).toHaveLength(1)
  const region = created.regions[0]
  expect(created.walls.filter((w) => w.regionId === region.id)).toHaveLength(0)

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 450, box.y + 440)
  expect(await getSelection(page)).toEqual({ kind: 'region', id: region.id })

  await page.getByRole('button', { name: 'Criar parede na borda', exact: true }).click()

  const after = await getMapState(page)
  const linked = after.walls.filter((w) => w.regionId === region.id)
  expect(linked).toHaveLength(3)
  expect(linked.map((w) => w.regionEdgeIndex).sort()).toEqual([0, 1, 2])
  expect(wallByEdge(after.walls, region.id, 0)).toMatchObject({ x1: 400, y1: 400, x2: 500, y2: 400 })
  expect(wallByEdge(after.walls, region.id, 1)).toMatchObject({ x1: 500, y1: 400, x2: 450, y2: 500 })
  expect(wallByEdge(after.walls, region.id, 2)).toMatchObject({ x1: 450, y1: 500, x2: 400, y2: 400 })
})
