// Verificação automatizada do Step 4 da Task 4 (plano `plano1b-ferramentas-desenho.md`).
// Roda contra `npm run dev` (Vite web) — NÃO substitui a verificação pedida pelo plano em
// `npm run tauri:dev` (app Tauri real). Ver docs/verification/2026-08-25-task4-verificacao-manual.md
// para o que este teste cobre e o que continua não coberto (o binário/webview Tauri em si).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Wall, Light, Region, Token } from '../src/types/map'

type MapState = {
  walls: Wall[]
  lights: Light[]
  regions: Region[]
  tokens: Token[]
}

async function getMapState(page: Page): Promise<MapState> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const state = mod.useMapStore.getState()
    return {
      walls: state.map.walls,
      lights: state.map.lights,
      regions: state.map.regions,
      tokens: state.map.tokens,
    }
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    // loadMap não mexe em snapEnabled — reseta aqui pra evitar que um teste que
    // ligue "Travar na grade" vaze esse estado pro próximo teste do arquivo.
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Parede' | 'Luz' | 'Região') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. ferramenta Parede: arrasto cria parede permanente', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Parede')

  // x/y >= 300 para não cair sobre o painel de ferramentas (canto superior esquerdo)
  const start = { x: box.x + 400, y: box.y + 400 }
  const end = { x: box.x + 600, y: box.y + 400 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 100, start.y, { steps: 5 })
  await page.mouse.move(end.x, end.y, { steps: 5 })
  await page.mouse.up()

  const state = await getMapState(page)
  expect(state.walls.length).toBe(1)
  expect(state.walls[0].x1).not.toBe(state.walls[0].x2)
})

test('2. ferramenta Luz: um clique cria luz sem precisar arrastar', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Luz')

  await page.mouse.click(box.x + 300, box.y + 300)

  const state = await getMapState(page)
  expect(state.lights.length).toBe(1)
})

test('2b. ferramenta Luz: arrasto longo cria luz com raio arrastado (maior que o padrão)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Luz')

  // grid=64 (ver resetMap) * LIGHT_RADIUS_IN_CELLS=8 = raio padrão de 512 (buildLightAt).
  const defaultRadius = 512
  const dragDistance = 700
  const center = { x: box.x + 400, y: box.y + 400 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + dragDistance, center.y, { steps: 10 })
  await page.mouse.up()

  const state = await getMapState(page)
  expect(state.lights.length).toBe(1)
  const light = state.lights[0]
  expect(light.radius).toBeGreaterThan(defaultRadius)
  expect(light.radius).toBeGreaterThan(dragDistance * 0.9)
  expect(light.radius).toBeLessThan(dragDistance * 1.1)
})

test('2c. ferramenta Luz: arrasto curto cria luz com raio menor que o padrão', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Luz')

  const defaultRadius = 512
  const dragDistance = 100
  const center = { x: box.x + 400, y: box.y + 400 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + dragDistance, center.y, { steps: 10 })
  await page.mouse.up()

  const state = await getMapState(page)
  expect(state.lights.length).toBe(1)
  const light = state.lights[0]
  expect(light.radius).toBeLessThan(defaultRadius)
  expect(light.radius).toBeGreaterThan(dragDistance * 0.8)
  expect(light.radius).toBeLessThan(dragDistance * 1.2)
})

test('2d. ferramenta Luz: clique simples com "Travar na grade" ativo ainda usa raio padrão', async ({ page }) => {
  // Regressão: com snapEnabled=true, lightDraftCenter (pointerdown) é snapado mas
  // o worldPoint do pointerup não era — um clique simples fora de uma interseção
  // de grade inflava dragDistance pelo próprio offset de snap e criava luz com
  // raio minúsculo em vez do raio padrão. Ver PixiCanvas.tsx (lightDraftRawStart).
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setSnapEnabled(true)
  })
  await selectTool(page, 'Luz')

  const defaultRadius = 512
  // 300 não é múltiplo de 64 (grid do resetMap) — garante offset de snap real.
  await page.mouse.click(box.x + 300, box.y + 300)

  const state = await getMapState(page)
  expect(state.lights.length).toBe(1)
  expect(state.lights[0].radius).toBe(defaultRadius)
})

test('3a. ferramenta Região: 3+ cliques + duplo clique fecha o polígono', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Região')

  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.mouse.click(box.x + 450, box.y + 500)
  await page.mouse.dblclick(box.x + 450, box.y + 500)

  const state = await getMapState(page)
  expect(state.regions.length).toBe(1)
  expect(state.regions[0].points.length).toBeGreaterThanOrEqual(3)
})

test('3b. ferramenta Região: Esc cancela o rascunho sem criar região', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Região')

  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.keyboard.press('Escape')
  // um clique a mais não deveria reaproveitar os pontos anteriores após o cancelamento
  await page.mouse.dblclick(box.x + 450, box.y + 500)

  const state = await getMapState(page)
  expect(state.regions.length).toBe(0)
})

test('4. ferramenta Selecionar: pan de área vazia move a câmera', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Selecionar')

  const cameraBefore = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().camera
  })

  await page.mouse.move(box.x + 500, box.y + 500)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 450, { steps: 5 })
  await page.mouse.up()

  const cameraAfter = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().camera
  })

  expect(cameraAfter.x).not.toBe(cameraBefore.x)
  expect(cameraAfter.y).not.toBe(cameraBefore.y)
})

test('4b. ferramenta Selecionar: arrasto de token muda sua posição', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tok1', characterId: null, name: 'Token', x: 400, y: 500, size: 1 })
  })
  await selectTool(page, 'Selecionar')

  await page.mouse.move(box.x + 400, box.y + 500)
  await page.mouse.down()
  await page.mouse.move(box.x + 550, box.y + 500, { steps: 5 })
  await page.mouse.move(box.x + 700, box.y + 500, { steps: 5 })
  await page.mouse.up()

  const state = await getMapState(page)
  const token = state.tokens.find((t) => t.id === 'tok1')
  expect(token).toBeTruthy()
  expect(token!.x).not.toBe(400)
})

test('5. colisão: token não atravessa parede recém-criada', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // parede vertical em x=550, de y=200 a y=400 + token em (400,300) à esquerda dela
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addWall({ id: 'wall1', x1: 550, y1: 200, x2: 550, y2: 400, blocksLight: true, blocksMove: true, door: null })
    mod.useMapStore.getState().addToken({ id: 'tok2', characterId: null, name: 'Token', x: 400, y: 300, size: 1 })
  })
  await selectTool(page, 'Selecionar')

  await page.mouse.move(box.x + 400, box.y + 300)
  await page.mouse.down()
  for (let x = 420; x <= 700; x += 20) {
    await page.mouse.move(box.x + x, box.y + 300)
  }
  await page.mouse.up()

  const state = await getMapState(page)
  const token = state.tokens.find((t) => t.id === 'tok2')
  expect(token).toBeTruthy()
  expect(token!.x).toBeLessThan(550)

  // controle: mesma distância de arrasto, sem parede no caminho, deve mover livremente
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tok3', characterId: null, name: 'Token', x: 400, y: 700, size: 1 })
  })
  await page.mouse.move(box.x + 400, box.y + 700)
  await page.mouse.down()
  for (let x = 420; x <= 700; x += 20) {
    await page.mouse.move(box.x + x, box.y + 700)
  }
  await page.mouse.up()

  const stateControl = await getMapState(page)
  const control = stateControl.tokens.find((t) => t.id === 'tok3')
  expect(control).toBeTruthy()
  expect(control!.x).toBeGreaterThan(600)
})

test('6. evidência visual: parede + luz + região desenhadas permanecem no canvas', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  await selectTool(page, 'Luz')
  await page.mouse.click(box.x + 700, box.y + 500)

  await selectTool(page, 'Região')
  await page.mouse.click(box.x + 400, box.y + 550)
  await page.mouse.click(box.x + 500, box.y + 550)
  await page.mouse.click(box.x + 450, box.y + 650)
  await page.mouse.dblclick(box.x + 450, box.y + 650)

  const state = await getMapState(page)
  expect(state.walls.length).toBe(1)
  expect(state.lights.length).toBe(1)
  expect(state.regions.length).toBe(1)

  await page.screenshot({ path: '../docs/verification/task4-e2e-evidencia.png' })
})
