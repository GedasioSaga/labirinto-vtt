// Verificação automatizada do Step 5 da Task 4 (plano `2026-08-25-selecionar-apagar.md`).
// Roda contra `npm run dev` (Vite web) — mesmo código React/Pixi que o Tauri serve via
// `devUrl`, mas NÃO substitui literalmente `npm run tauri:dev` (o webview nativo em si não é
// automatizado por esta ferramenta). Ver docs/verification/2026-08-25-task4-verificacao-manual.md
// para o precedente deste padrão e o que ele cobre/não cobre.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Wall, Light, Region, Token, Prop } from '../src/types/map'

type MapState = {
  walls: Wall[]
  lights: Light[]
  regions: Region[]
  tokens: Token[]
  props: Prop[]
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
      props: state.map.props,
    }
  })
}

async function getSelection(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_select', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Parede' | 'Luz' | 'Região') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

function deleteButton(page: Page) {
  return page.getByRole('button', { name: /Apagar|Nada selecionado/ })
}

test.beforeEach(async ({ page }) => {
  // stub mínimo do bridge Tauri: fora do webview real, window.__TAURI_INTERNALS__ não existe,
  // e drawProps.ts chama convertFileSrc(prop.src) de forma síncrona ao desenhar qualquer peça
  // (mesmo com src fake) — sem o stub, isso derruba o page.evaluate inteiro do teste 5.
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await enterEditor(page)
  await resetMap(page)
})

test('1. selecionar parede: destaca, botão vira "Apagar parede...", Delete apaga', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()
  expect((await getMapState(page)).walls.length).toBe(1)

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 500, box.y + 400)

  const selection = await getSelection(page)
  expect(selection).toEqual({ kind: 'wall', id: expect.any(String) })
  await expect(deleteButton(page)).toHaveText('Apagar parede selecionada(o)')

  await page.keyboard.press('Delete')
  expect((await getMapState(page)).walls.length).toBe(0)
  expect(await getSelection(page)).toBeNull()
})

test('2. selecionar luz: anel de destaque, Delete apaga', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Luz')
  await page.mouse.click(box.x + 500, box.y + 500)
  expect((await getMapState(page)).lights.length).toBe(1)

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 500, box.y + 500)

  expect(await getSelection(page)).toEqual({ kind: 'light', id: expect.any(String) })
  await expect(deleteButton(page)).toHaveText('Apagar luz selecionada(o)')

  await page.keyboard.press('Delete')
  expect((await getMapState(page)).lights.length).toBe(0)
})

test('3. selecionar região: preenchimento de destaque, Delete apaga', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Região')
  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.mouse.click(box.x + 450, box.y + 500)
  await page.mouse.dblclick(box.x + 450, box.y + 500)
  expect((await getMapState(page)).regions.length).toBe(1)

  await selectTool(page, 'Selecionar')
  // clique dentro do triângulo (centroide aproximado)
  await page.mouse.click(box.x + 450, box.y + 435)

  expect(await getSelection(page)).toEqual({ kind: 'region', id: expect.any(String) })
  await expect(deleteButton(page)).toHaveText('Apagar região selecionada(o)')

  await page.keyboard.press('Delete')
  expect((await getMapState(page)).regions.length).toBe(0)
})

test('4. selecionar token: halo de destaque, Delete apaga (comportamento preexistente)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tokSel', characterId: null, name: 'Token', x: 400, y: 400, size: 1 })
  })
  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 400, box.y + 400)

  expect(await getSelection(page)).toEqual({ kind: 'token', id: 'tokSel' })
  await expect(deleteButton(page)).toHaveText('Apagar token selecionada(o)')

  await page.keyboard.press('Delete')
  expect((await getMapState(page)).tokens.length).toBe(0)
})

test('5. selecionar peça (prop): contorno de destaque, Delete apaga', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // ferramenta "Peça" dispara um file picker nativo (Tauri dialog), não automatizável aqui —
  // adiciona a peça direto na store, igual ao padrão já usado para token no teste 4b de
  // task4-drawing-tools.spec.ts.
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addProp({ id: 'propSel', src: 'fake.png', x: 400, y: 400, width: 64, height: 64, linkedMapPath: null })
  })
  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 400, box.y + 400)

  expect(await getSelection(page)).toEqual({ kind: 'prop', id: 'propSel' })
  await expect(deleteButton(page)).toHaveText('Apagar peça selecionada(o)')

  await page.keyboard.press('Delete')
  expect((await getMapState(page)).props.length).toBe(0)
})

test('6. clique em área vazia desseleciona: botão volta a "Nada selecionado" e fica desabilitado', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tokEmpty', characterId: null, name: 'Token', x: 400, y: 400, size: 1 })
  })
  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 400, box.y + 400)
  expect(await getSelection(page)).not.toBeNull()

  await page.mouse.click(box.x + 900, box.y + 700)

  expect(await getSelection(page)).toBeNull()
  await expect(deleteButton(page)).toHaveText('Nada selecionado')
  await expect(deleteButton(page)).toBeDisabled()
})

test('7. sem erro de console durante o fluxo completo de seleção+apagar', async ({ page }) => {
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

  await selectTool(page, 'Luz')
  await page.mouse.click(box.x + 700, box.y + 500)

  await selectTool(page, 'Região')
  await page.mouse.click(box.x + 400, box.y + 550)
  await page.mouse.click(box.x + 500, box.y + 550)
  await page.mouse.click(box.x + 450, box.y + 650)
  await page.mouse.dblclick(box.x + 450, box.y + 650)

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tokConsole', characterId: null, name: 'Token', x: 900, y: 400, size: 1 })
  })

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.keyboard.press('Delete')
  await page.mouse.click(box.x + 700, box.y + 500)
  await page.keyboard.press('Delete')
  await page.mouse.click(box.x + 450, box.y + 585)
  await page.keyboard.press('Delete')
  await page.mouse.click(box.x + 900, box.y + 400)
  await page.keyboard.press('Delete')

  const state = await getMapState(page)
  expect(state.walls.length).toBe(0)
  expect(state.lights.length).toBe(0)
  expect(state.regions.length).toBe(0)
  expect(state.tokens.length).toBe(0)
  expect(consoleErrors).toEqual([])
})
