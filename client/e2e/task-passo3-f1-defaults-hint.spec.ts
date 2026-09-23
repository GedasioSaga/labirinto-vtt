// Passo 3, F1: padrões do mapa novo (chão marrom, 1,5 m por célula com
// vírgula, grade discreta, luz de 4 células) e a dica da ferramenta que some do
// canvas depois do primeiro uso. Mapa novo é criado pelo fluxo real do menu.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

async function readNewMap(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    const measurement = await import('/src/lib/measurement.ts')
    const oneCell = measurement.measureDistance({ x: 0, y: 0 }, { x: map.grid, y: 0 }, map.grid, map.gridShape, map.measurementMode, map.scale)
    return { scale: map.scale, floorStyle: map.floorStyle, gridSettings: map.gridSettings, grid: map.grid, oneCellLabel: oneCell.label }
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('1. mapa novo nasce com chão marrom, 1,5 m por célula e grade desligada', async ({ page }) => {
  const map = await readNewMap(page)
  expect(map.floorStyle.fillColor).toBe('#a8776a')
  expect(map.scale).toEqual({ unitsPerCell: 1.5, unit: 'm', precision: 1 })
  expect(map.oneCellLabel).toBe('1,5 m')
  expect(map.gridSettings).toEqual({ color: '#000000', opacity: 0.25, lineWidth: 1, lineStyle: 'solid' })
})

test('2. clique simples com a ferramenta Luz cria luz de 4 células', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await page.getByRole('button', { name: 'Luz', exact: true }).click()
  await page.mouse.click(box.x + 700, box.y + 500)
  const lights = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    return { radii: map.lights.map((l) => l.radius), grid: map.grid }
  })
  expect(lights.radii).toEqual([4 * lights.grid])
})

test('3. a dica some depois do primeiro uso no canvas e volta ao trocar de ferramenta', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  const hint = page.locator('.lb-hint')

  await page.getByRole('button', { name: 'Parede', exact: true }).click()
  await expect(hint).toBeVisible()

  // Botão do meio é pan, não uso da ferramenta: a dica fica.
  await page.mouse.click(box.x + 700, box.y + 500, { button: 'middle' })
  await expect(hint).toBeVisible()

  await page.mouse.move(box.x + 700, box.y + 500)
  await page.mouse.down()
  await expect(hint).toHaveCount(0)
  await page.mouse.move(box.x + 900, box.y + 500, { steps: 4 })
  await page.mouse.up()
  await expect(hint).toHaveCount(0)

  await page.getByRole('button', { name: 'Luz', exact: true }).click()
  await expect(hint).toBeVisible()

  // Troca por atalho também reexibe (a ferramenta muda fora do Toolbar).
  await page.mouse.click(box.x + 700, box.y + 300)
  await expect(hint).toHaveCount(0)
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setActiveTool('select')
  })
  await expect(hint).toBeVisible()
})
