// Verificação e2e do padrão de hachura diagonal configurável de região
// (plano `2026-08-26-hachura-de-regiao.md`, Task 3). Mesmo padrão de
// task-region-color.spec.ts: passa pela tela inicial, prova estado (map.regions)
// via mapStore, interagindo com o toggle real do painel lateral.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Region } from '../src/types/map'

async function getRegions(page: Page): Promise<Region[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.regions
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_region_hatch', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Região') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

function regionHatchToggle(page: Page) {
  return page.getByRole('checkbox', { name: 'Hachurado' })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. região: ativar hachura ANTES de desenhar e fechar o polígono aplica o padrão', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Região')
  await expect(regionHatchToggle(page)).toBeVisible()
  // O checkbox real fica visualmente coberto pelo track decorativo do Toggle (span
  // com o desenho do interruptor) — force:true clica direto no input, igual o usuário
  // clicando em cima do interruptor visual faria.
  await regionHatchToggle(page).click({ force: true })

  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.mouse.click(box.x + 450, box.y + 500)
  await page.mouse.dblclick(box.x + 450, box.y + 500)

  const regions = await getRegions(page)
  expect(regions).toHaveLength(1)
  expect(regions[0].fillPattern).toBe('hatch')
})

test('2. região: selecionar região sólida existente e ativar hachura reflete em map.regions', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Região')
  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.mouse.click(box.x + 450, box.y + 500)
  await page.mouse.dblclick(box.x + 450, box.y + 500)

  const created = await getRegions(page)
  expect(created).toHaveLength(1)
  expect(created[0].fillPattern).toBe('solid')

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 450, box.y + 440)
  await expect
    .poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection[0]?.kind))
    .toBe('region')

  await expect(regionHatchToggle(page)).toBeVisible()
  await regionHatchToggle(page).click({ force: true })

  const regions = await getRegions(page)
  expect(regions).toHaveLength(1)
  expect(regions[0].fillPattern).toBe('hatch')
})
