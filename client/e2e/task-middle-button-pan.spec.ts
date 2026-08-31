// Verificação e2e: segurar o botão do meio do mouse (scroll wheel) e arrastar
// sempre faz pan da câmera, independente da ferramenta ativa ou do que estiver
// sob o cursor. Mesmo padrão de task-eraser-tool.spec.ts (reset via mapFactory,
// prova lida direto da store).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Camera } from '../src/pixi/world'

async function getCamera(page: Page): Promise<Camera> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().camera
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_middle_pan', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Parede') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

// Simula pointerdown/pointermove nativos com button:1 (botão do meio), já que
// page.mouse não expõe drag com botão do meio — dispatchEvent replica o que o
// SO/browser mandaria pro canvas nesse gesto.
async function middleDragOnCanvas(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.evaluate(
    ({ from, to }) => {
      const canvas = document.querySelector('canvas')
      if (!canvas) throw new Error('canvas não encontrado')
      const rect = canvas.getBoundingClientRect()
      const fromClient = { x: rect.left + from.x, y: rect.top + from.y }
      const toClient = { x: rect.left + to.x, y: rect.top + to.y }

      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 1,
          buttons: 4,
          clientX: fromClient.x,
          clientY: fromClient.y,
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      )
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          button: 1,
          buttons: 4,
          clientX: toClient.x,
          clientY: toClient.y,
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      )
      canvas.dispatchEvent(
        new PointerEvent('pointerup', {
          button: 1,
          buttons: 0,
          clientX: toClient.x,
          clientY: toClient.y,
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      )
    },
    { from, to },
  )
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. botão do meio arrasta e move a câmera mesmo com ferramenta Selecionar ativa', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Selecionar')
  const before = await getCamera(page)

  await middleDragOnCanvas(page, { x: box.width / 2, y: box.height / 2 }, { x: box.width / 2 + 120, y: box.height / 2 + 80 })

  const after = await getCamera(page)
  expect(after.x).not.toBe(before.x)
  expect(after.y).not.toBe(before.y)
})

test('2. botão do meio arrasta e move a câmera mesmo com ferramenta Parede ativa (não desenha parede)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  const before = await getCamera(page)

  await middleDragOnCanvas(page, { x: box.width / 2, y: box.height / 2 }, { x: box.width / 2 + 150, y: box.height / 2 + 50 })

  const after = await getCamera(page)
  expect(after.x).not.toBe(before.x)
  expect(after.y).not.toBe(before.y)

  const state = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls
  })
  expect(state.length).toBe(0)
})

test('3. botão do meio sobre uma wall existente faz pan em vez de selecionar/mover a wall', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // Desenha uma wall passando pelo centro do canvas, exatamente onde o drag do
  // botão do meio vai começar — antes do fix, clique esquerdo aqui acertaria a
  // wall e cairia em 'dragging-wall-body'; o botão do meio precisa ignorar isso.
  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  const wallsBefore = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls
  })
  expect(wallsBefore.length).toBe(1)
  const wallBefore = wallsBefore[0]

  await selectTool(page, 'Selecionar')
  const before = await getCamera(page)

  await middleDragOnCanvas(page, { x: box.width / 2, y: box.height / 2 }, { x: box.width / 2 + 130, y: box.height / 2 + 90 })

  const after = await getCamera(page)
  expect(after.x).not.toBe(before.x)
  expect(after.y).not.toBe(before.y)

  const { walls: wallsAfter, selection } = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const state = mod.useMapStore.getState()
    return { walls: state.map.walls, selection: state.selection }
  })
  expect(wallsAfter[0]).toEqual(wallBefore)
  expect(selection).toBeNull()
})
