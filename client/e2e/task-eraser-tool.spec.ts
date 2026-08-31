// Verificação e2e da ferramenta Borracha (undo/redo + eraser).
// Mesmo padrão de task4-select-delete.spec.ts: passa pela tela inicial, usa a store direto
// pra montar o estado e prova o resultado lendo map.* depois da interação no canvas.
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

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_eraser', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Parede' | 'Região' | 'Borracha') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. borracha sobre uma wall existente remove ela do map.walls', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()
  expect((await getMapState(page)).walls.length).toBe(1)

  await selectTool(page, 'Borracha')
  await page.mouse.click(box.x + 500, box.y + 400)

  expect((await getMapState(page)).walls.length).toBe(0)
})

test('2. borracha sobre uma region remove ela do map.regions', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Região')
  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.mouse.click(box.x + 450, box.y + 500)
  await page.mouse.dblclick(box.x + 450, box.y + 500)
  expect((await getMapState(page)).regions.length).toBe(1)

  await selectTool(page, 'Borracha')
  await page.mouse.click(box.x + 450, box.y + 435)

  expect((await getMapState(page)).regions.length).toBe(0)
})

test('3. clicar com borracha em área vazia não quebra nada (não remove nada, sem erro)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  await selectTool(page, 'Borracha')
  await page.mouse.click(box.x + 900, box.y + 700)

  const state = await getMapState(page)
  expect(state.walls.length).toBe(1)
  expect(consoleErrors).toEqual([])
})

test('4. arrasto contínuo com borracha apaga várias paredes sob o cursor', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + 300, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 300, box.y + 340, { steps: 5 })
  await page.mouse.up()

  await page.mouse.move(box.x + 500, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 500, box.y + 340, { steps: 5 })
  await page.mouse.up()
  expect((await getMapState(page)).walls.length).toBe(2)

  await selectTool(page, 'Borracha')
  await page.mouse.move(box.x + 300, box.y + 320)
  await page.mouse.down()
  await page.mouse.move(box.x + 400, box.y + 320, { steps: 5 })
  await page.mouse.move(box.x + 500, box.y + 320, { steps: 5 })
  await page.mouse.up()

  expect((await getMapState(page)).walls.length).toBe(0)
})

test('5. undo depois de apagar com a borracha restaura o item apagado', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()
  expect((await getMapState(page)).walls.length).toBe(1)

  await selectTool(page, 'Borracha')
  await page.mouse.click(box.x + 500, box.y + 400)
  expect((await getMapState(page)).walls.length).toBe(0)

  await page.keyboard.press('Control+z')

  expect((await getMapState(page)).walls.length).toBe(1)
})
