// Verificação e2e das ferramentas Pincel/Linha/Círculo (plano `2026-08-25-desenho-livre.md`).
// Mesmo padrão de task4-select-delete.spec.ts / task4-selection-pixel-diff.spec.ts: passa pela
// tela inicial, prova estado (drawings/selection) E pixel (redraw do destaque acontece de verdade).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'
import type { Drawing } from '../src/types/map'

async function getDrawings(page: Page): Promise<Drawing[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.drawings
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_drawing', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

// Pincel/Linha/Círculo moram no botão Desenho: `pickTool` abre a setinha e escolhe o rádio.
async function selectTool(page: Page, label: 'Selecionar' | 'Pincel' | 'Linha' | 'Círculo') {
  await pickTool(page, label)
}

function deleteButton(page: Page) {
  return page.getByRole('button', { name: /Apagar|Nada selecionado/ })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. pincel: arrasto com múltiplos pontos cria freehand, seleciona e apaga', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Pincel')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 420, { steps: 5 })
  await page.mouse.move(box.x + 500, box.y + 400, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  expect(drawings[0].kind).toBe('freehand')
  if (drawings[0].kind === 'freehand') expect(drawings[0].points.length).toBeGreaterThanOrEqual(3)

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 450, box.y + 420)
  expect(await getSelection(page)).toEqual({ kind: 'drawing', id: expect.any(String) })
  await expect(deleteButton(page)).toHaveText('Apagar desenho selecionado')

  await page.keyboard.press('Delete')
  expect(await getDrawings(page)).toEqual([])
})

test('2. linha: arrasto reto cria line, seleciona e apaga', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Linha')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  expect(drawings[0].kind).toBe('line')

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 500, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'drawing', id: expect.any(String) })

  await page.keyboard.press('Delete')
  expect(await getDrawings(page)).toEqual([])
})

test('3. círculo: arrasto radial cria circle, seleciona e apaga', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Círculo')
  await page.mouse.move(box.x + 500, box.y + 500)
  await page.mouse.down()
  await page.mouse.move(box.x + 550, box.y + 500, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  expect(drawings[0].kind).toBe('circle')
  if (drawings[0].kind === 'circle') expect(drawings[0].radius).toBeGreaterThan(0)

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 550, box.y + 500)
  expect(await getSelection(page)).toEqual({ kind: 'drawing', id: expect.any(String) })

  await page.keyboard.press('Delete')
  expect(await getDrawings(page)).toEqual([])
})

test('4. cor e espessura escolhidas na barra vão pro desenho criado', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Linha')
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setDrawColor('#ff0000')
    mod.useMapStore.getState().setDrawWidth(9)
  })

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings[0].color).toBe('#ff0000')
  if (drawings[0].kind !== 'text') expect(drawings[0].width).toBe(9)
})

test('5. círculo preenchido: clique dentro do raio seleciona (não só na borda)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Círculo')
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setDrawFilled(true)
  })
  await page.mouse.move(box.x + 500, box.y + 500)
  await page.mouse.down()
  await page.mouse.move(box.x + 560, box.y + 500, { steps: 5 })
  await page.mouse.up()

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 500, box.y + 500)
  expect(await getSelection(page)).toEqual({ kind: 'drawing', id: expect.any(String) })
})

test('6. pixel: selecionar um desenho muda o pixel da região (destaque desenha de verdade)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Linha')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  await selectTool(page, 'Selecionar')
  const clip = { x: box.x + 380, y: box.y + 380, width: 240, height: 40 }
  const before = await page.screenshot({ clip })

  await page.mouse.click(box.x + 500, box.y + 400)
  await expect
    .poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection[0]?.kind))
    .toBe('drawing')

  const after = await page.screenshot({ clip })
  expect(before.equals(after)).toBe(false)
})
