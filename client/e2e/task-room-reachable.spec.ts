// E2E de regressão da dívida D1 (ROADMAP.md): antes da correção,
// `buildRoomFromDraft` nunca setava `region.room` — toda Sala nascia como
// Região comum e o painel `RoomControls` (nome + resize) nunca aparecia. A
// feature existia e estava testada, mas era INALCANÇÁVEL pela barra.
// task-room-tool.spec.ts já prova a geometria via ESTADO (region.room.shape
// === 'rect'); este spec fecha o gap que faltava — o PAINEL de verdade
// aparece na tela quando uma Sala criada pela ferramenta "Sala" é
// selecionada, não só o campo no objeto.
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_room_reachable', 'E2E Sala', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Sala') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. criar Sala pela barra: região nasce com room.shape "rect" e o painel "Sala" aparece de verdade ao selecionar', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // Antes de criar qualquer coisa, o painel de Sala não existe no DOM — prova
  // que ele é condicional (selectedRegion?.room), não um texto sempre presente.
  await expect(page.getByRole('heading', { name: 'Sala', level: 2 })).toHaveCount(0)

  await selectTool(page, 'Sala')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 500, { steps: 5 })
  await page.mouse.up()

  const regions = await getRegions(page)
  expect(regions).toHaveLength(1)
  // A própria correção de D1: sem isto, RoomControls nunca renderiza.
  expect(regions[0].room).toMatchObject({ shape: 'rect' })

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 500, box.y + 450) // ponto interior da sala

  const heading = page.getByRole('heading', { name: 'Sala', level: 2 })
  await expect(heading).toBeVisible()
  // shape 'rect' também mostra os campos numéricos de largura/altura
  // (RoomControls.tsx) — sem isso o painel apareceu, mas incompleto.
  await expect(page.getByLabel('Largura')).toBeVisible()
  await expect(page.getByLabel('Altura')).toBeVisible()
})
