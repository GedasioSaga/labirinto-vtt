// E2E do snap por alvo (ROADMAP.md, F1 "Grid" — snap de objeto/token além do
// que já existia): Token gruda no CENTRO da célula (snapToGridCenter,
// pixi/tokenInteraction.ts); Parede gruda no VÉRTICE/aresta (snapToGrid,
// mesmo arquivo). `Alt` INVERTE o toggle só naquele gesto (applySnap,
// PixiCanvas.tsx) — liga se estava desligado, desliga se estava ligado.
// grid=64 (createEmptyMap abaixo) → metade de célula = 32; centro da célula k
// fica em k*64+32; vértice fica em múltiplos exatos de 64.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Wall, Token } from '../src/types/map'

async function getWalls(page: Page): Promise<Wall[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls
  })
}

async function getTokens(page: Page): Promise<Token[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.tokens
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_snap_targets', 'E2E Snap', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

async function setWallSnap(page: Page, on: boolean) {
  await page.evaluate(async (on) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setSnapTarget('wall', on)
  }, on)
}

async function setTokenSnap(page: Page, on: boolean) {
  await page.evaluate(async (on) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setSnapTarget('token', on)
  }, on)
}

async function selectTool(page: Page, label: 'Selecionar' | 'Parede') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. Token: arrastar com snap de token ligado gruda no CENTRO da célula, não no canto', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tokSnap', characterId: null, name: 'Token', x: 400, y: 400, size: 1, image: null })
  })
  await setTokenSnap(page, true)
  await selectTool(page, 'Selecionar')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  // (503,471): mais perto do centro da célula k=7 (7*64+32=480) que de
  // qualquer outro centro — não é múltiplo de 64 nem coincide com nenhum
  // vértice, então só faz sentido se o snap grudou no CENTRO.
  await page.mouse.move(box.x + 503, box.y + 471, { steps: 5 })
  await page.mouse.up()

  const tokens = await getTokens(page)
  const token = tokens.find((t) => t.id === 'tokSnap')
  expect(token).toBeTruthy()
  expect(token!.x).toBe(480)
  expect(token!.y).toBe(480)
})

test('2. Parede: arrasto com snap de parede ligado gruda os dois pontos no VÉRTICE da grade', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await setWallSnap(page, true)
  await selectTool(page, 'Parede')

  await page.mouse.move(box.x + 403, box.y + 398)
  await page.mouse.down()
  await page.mouse.move(box.x + 601, box.y + 602, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  // round(403/64)=6→384; round(398/64)=6→384; round(601/64)=9→576; round(602/64)=9→576.
  expect(walls[0]).toMatchObject({ x1: 384, y1: 384, x2: 576, y2: 576 })
})

test('3. Parede: com snap LIGADO, segurar Alt durante o arrasto inteiro DESLIGA o snap nesse gesto', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await setWallSnap(page, true)
  await selectTool(page, 'Parede')

  await page.mouse.move(box.x + 403, box.y + 398)
  await page.keyboard.down('Alt')
  await page.mouse.down()
  await page.mouse.move(box.x + 601, box.y + 602, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Alt')

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  // Alt inverteu: snap ligado vira efetivamente desligado — pontos brutos, sem arredondar.
  expect(walls[0]).toMatchObject({ x1: 403, y1: 398, x2: 601, y2: 602 })
})

test('4. Parede: com snap DESLIGADO, segurar Alt durante o arrasto inteiro LIGA o snap nesse gesto', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await setWallSnap(page, false)
  await selectTool(page, 'Parede')

  await page.mouse.move(box.x + 403, box.y + 398)
  await page.keyboard.down('Alt')
  await page.mouse.down()
  await page.mouse.move(box.x + 601, box.y + 602, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Alt')

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  // Alt inverteu: snap desligado vira efetivamente ligado — mesmo resultado do teste 2.
  expect(walls[0]).toMatchObject({ x1: 384, y1: 384, x2: 576, y2: 576 })
})
