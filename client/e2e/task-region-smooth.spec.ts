// E2E do botão "Suavizar contorno" (RegionStyleControls): cria uma Sala
// (região + 4 paredes vinculadas), seleciona, clica o botão e confirma que o
// contorno ganhou mais pontos (efeito do Chaikin, ver regionSmoothing.ts) e
// que TODA aresta nova tem parede vinculada (nenhum buraco) — mesmo harness
// de task-room-tool.spec.ts.
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

// Onda 4, item 24 — `selection` do store virou SelectionSet (array). `[0] ??
// null` adapta pro formato de item único que os specs já esperavam.
async function getSelection(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection[0] ?? null
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_smooth', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Sala') {
  await page.getByRole('button', { name: label, exact: true }).click()
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

test('Sala selecionada: botão "Suavizar contorno" arredonda o contorno e retraça todas as paredes sem buraco', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Sala')
  await drag(page, { x: box.x + 300, y: box.y + 300 }, { x: box.x + 600, y: box.y + 500 })

  const created = await getMapState(page)
  expect(created.regions).toHaveLength(1)
  const region = created.regions[0]
  const oldWallIds = created.walls.filter((w) => w.regionId === region.id).map((w) => w.id)
  expect(oldWallIds).toHaveLength(4)

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 450, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'region', id: region.id })

  // "Suavizar contorno" mora no Avançado (fatia 3), que nasce fechado: o botão
  // não aparece até abrir a seção pelo cabeçalho.
  const inspector = page.locator('.lb-inspector')
  const smooth = page.getByRole('button', { name: 'Suavizar contorno', exact: true })
  const advanced = inspector.getByRole('button', { name: 'Avançado', exact: true })
  await expect(smooth).toHaveCount(0)
  await expect(advanced).toHaveAttribute('aria-expanded', 'false')
  await advanced.click()
  await expect(advanced).toHaveAttribute('aria-expanded', 'true')
  await expect(inspector.getByText('Simplifica e arredonda o contorno inteiro de uma vez; Ctrl+Z desfaz.')).toBeVisible()
  await smooth.click()

  const after = await getMapState(page)
  const smoothedRegion = after.regions.find((r) => r.id === region.id)
  if (!smoothedRegion) throw new Error('região suavizada não encontrada')

  // Chaikin dobra a contagem de pontos de um retângulo exato (4 -> 8).
  expect(smoothedRegion.points.length).toBeGreaterThan(region.points.length)

  // As 4 paredes antigas não fazem mais sentido geométrico e não sobrevivem.
  for (const oldId of oldWallIds) {
    expect(after.walls.find((w) => w.id === oldId)).toBeUndefined()
  }

  // Nenhum buraco: toda aresta do contorno novo tem parede traçando exatamente
  // aquele par de pontos.
  const linked = after.walls.filter((w) => w.regionId === region.id)
  expect(linked).toHaveLength(smoothedRegion.points.length)
  const n = smoothedRegion.points.length
  for (let i = 0; i < n; i += 1) {
    const from = smoothedRegion.points[i]
    const to = smoothedRegion.points[(i + 1) % n]
    const wall = linked.find((w) => w.regionEdgeIndex === i)
    expect(wall).toBeDefined()
    expect(wall).toMatchObject({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })
  }
})
