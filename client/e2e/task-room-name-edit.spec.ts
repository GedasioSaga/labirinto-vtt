// E2E de A3+A4 (plano valiant-enchanting-patterson.md): nome da Sala fácil de
// editar e de arrastar.
//  1. desenhar a Sala deixa o Nome focado no TOPO do painel — digitar já renomeia;
//  2. duplo clique na Sala abre um campo sobre o canvas (Enter grava, Esc cancela);
//  3. arrastar o nome move só o rótulo (RoomMeta.labelOffset), com uma entrada
//     de histórico, e o recorte enviado ao jogador leva o mesmo offset.
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_room_name', 'E2E Nome da Sala', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Sala') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/** Desenha uma Sala arrastando na tela e devolve a caixa do canvas. */
async function drawRoom(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Sala')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 500, { steps: 5 })
  await page.mouse.up()
  return box
}

/** Posição do rótulo na tela (relativa ao canvas), pela mesma função que o desenha. */
async function labelScreenPoint(page: Page, regionId: string): Promise<{ x: number; y: number }> {
  return page.evaluate(async (id) => {
    const mod = await import('/src/stores/mapStore.ts')
    const names = await import('/src/pixi/drawRoomNames.ts')
    const { map, camera } = mod.useMapStore.getState()
    const region = map.regions.find((r) => r.id === id)
    if (!region) throw new Error('região sumiu')
    const p = names.roomLabelPosition(region)
    return { x: p.x * camera.scale + camera.x, y: p.y * camera.scale + camera.y }
  }, regionId)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. desenhar Sala: Nome focado no topo do painel e digitar renomeia', async ({ page }) => {
  await drawRoom(page)

  const nameInput = page.locator('#lb-room-name')
  await expect(nameInput).toBeFocused()
  // Topo do painel: o primeiro campo do corpo do inspetor é o Nome da Sala.
  await expect(page.locator('.lb-inspector__body input').first()).toHaveAttribute('id', 'lb-room-name')

  await page.keyboard.type('Cripta')

  await expect.poll(async () => (await getRegions(page))[0]?.room?.name).toBe('Cripta')
})

test('2. duplo clique na Sala abre o campo sobre o canvas: Enter grava, Esc cancela', async ({ page }) => {
  const box = await drawRoom(page)
  await selectTool(page, 'Selecionar')

  const overlay = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(overlay).toHaveCount(0)

  // Canto interno da sala, longe do nome: o duplo clique vale na Sala inteira.
  await page.mouse.dblclick(box.x + 430, box.y + 420)
  await expect(overlay).toBeVisible()
  await expect(overlay).toBeFocused()
  await overlay.fill('Salão')
  await overlay.press('Enter')
  await expect(overlay).toHaveCount(0)
  expect((await getRegions(page))[0].room?.name).toBe('Salão')

  // Duplo clique em cima do próprio nome também abre; Esc descarta o que foi digitado.
  const label = await labelScreenPoint(page, (await getRegions(page))[0].id)
  await page.mouse.dblclick(box.x + label.x, box.y + label.y)
  await expect(overlay).toBeVisible()
  await overlay.fill('Errado')
  await overlay.press('Escape')
  await expect(overlay).toHaveCount(0)
  expect((await getRegions(page))[0].room?.name).toBe('Salão')
})

test('3. arrastar o nome move só o rótulo, com um Ctrl+Z, e o jogador recebe o offset', async ({ page }) => {
  const box = await drawRoom(page)
  await selectTool(page, 'Selecionar')

  const [before] = await getRegions(page)
  expect(before.room?.labelOffset).toBeUndefined()
  const pastBefore = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().past.length)
  const scale = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera.scale)

  const label = await labelScreenPoint(page, before.id)
  await page.mouse.move(box.x + label.x, box.y + label.y)
  await page.mouse.down()
  await page.mouse.move(box.x + label.x + 80, box.y + label.y + 40, { steps: 8 })
  await page.mouse.up()

  const [after] = await getRegions(page)
  // A sala não saiu do lugar; só o rótulo.
  expect(after.points).toEqual(before.points)
  expect(after.room?.labelOffset?.x).toBeCloseTo(80 / scale, 0)
  expect(after.room?.labelOffset?.y).toBeCloseTo(40 / scale, 0)
  const pastAfter = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().past.length)
  expect(pastAfter).toBe(pastBefore + 1)

  // O recorte do jogador (filterMapForPlayer, o mesmo do hostSession) leva o offset.
  const sentOffset = await page.evaluate(async (regionId) => {
    const mod = await import('/src/stores/mapStore.ts')
    const fog = await import('/src/lib/fogFilter.ts')
    const { map } = mod.useMapStore.getState()
    const region = map.regions.find((r) => r.id === regionId)
    if (!region) throw new Error('região sumiu')
    const xs = region.points.map((p) => p.x)
    const ys = region.points.map((p) => p.y)
    const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
    const hero = { id: 'heroi', characterId: null, name: 'Herói', x: center.x, y: center.y, size: 1, image: null }
    const view = fog.filterMapForPlayer({ ...map, tokens: [hero] }, 'p1', { p1: ['heroi'] }, 2000)
    const payload = JSON.parse(JSON.stringify(view.map)) as typeof map
    return payload.regions.find((r) => r.id === regionId)?.room?.labelOffset ?? null
  }, before.id)
  expect(sentOffset).toEqual(after.room?.labelOffset)
})
