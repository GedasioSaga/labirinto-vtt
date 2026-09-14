// Fase A, itens A1 e A2 (plano de 14/09/2026):
// A1 — paredes sumiam com zoom abaixo de 100%: parede exterior tem 1,5 px de
// mundo, o app Pixi do editor roda sem antialias, e a 50% ela virava 0,75 px
// de tela. Com a linha centrada num limite de pixel (y de tela inteiro) a
// faixa de 0,75 px não cobre nenhum centro de pixel e nada é pintado. Com o
// piso de 1 px de tela (drawWalls.ts, screenSafeWidth) a faixa sempre cobre
// uma linha de pixels.
// A2 — "Adicionar token" pede o nome; o nome aparece no painel do token. A
// lista de atribuir (RoomPanel) só existe no Tauri e é coberta por
// RoomPanel.test.tsx.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Token } from '../src/types/map'

// Parede horizontal em y=700 de mundo → y=350,0 de tela a 50%: limite exato de pixel.
const WALL_Y = 700
const PROBE_X = 400
const SCAN_TOP = 340
const SCAN_HEIGHT = 20
const MIN_CHANNEL_DIFF = 40

async function loadEmptyMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_wall_zoom', 'E2E Zoom', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
  await page.keyboard.press('Control+0')
  await expect(page.getByRole('button', { name: 'Zoom: 100%', exact: true })).toBeVisible()
}

async function getTokens(page: Page): Promise<Token[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.tokens
  })
}

/** Ctrl+roda com deltaY = ln(2)/0,001 dá exatamente 50% (zoomAt, world.ts), ancorado no canto (0,0). */
async function zoomToHalfAtOrigin(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) throw new Error('canvas ausente')
    const rect = canvas.getBoundingClientRect()
    canvas.dispatchEvent(
      new WheelEvent('wheel', { deltaY: Math.log(2) * 1000, ctrlKey: true, clientX: rect.left, clientY: rect.top, bubbles: true, cancelable: true }),
    )
  })
  await expect(page.getByRole('button', { name: 'Zoom: 50%', exact: true })).toBeVisible()
}

/** Cores [r,g,b] de uma coluna de 1 px de largura, de cima para baixo. */
async function columnPixels(page: Page, x: number, y: number, height: number): Promise<[number, number, number][]> {
  const shot = await page.screenshot({ clip: { x, y, width: 1, height } })
  const b64 = shot.toString('base64')
  return page.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = img.width
    cv.height = img.height
    const g = cv.getContext('2d')
    if (!g) throw new Error('sem contexto 2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, 1, img.height).data
    const rows: [number, number, number][] = []
    for (let i = 0; i < img.height; i += 1) rows.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]])
    return rows
  }, b64)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await loadEmptyMap(page)
})

test('1. zoom 50%: parede exterior continua com pixel diferente do fundo', async ({ page }) => {
  await page.evaluate(async (wallY) => {
    const mod = await import('/src/stores/mapStore.ts')
    const state = mod.useMapStore.getState()
    state.setShowGrid(false)
    state.addWall({ id: 'w_zoom', x1: 200, y1: wallY, x2: 1400, y2: wallY, blocksLight: true, blocksMove: true, door: null, wallKind: 'exterior' })
  }, WALL_Y)
  await zoomToHalfAtOrigin(page)

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await expect
    .poll(async () => {
      const rows = await columnPixels(page, box.x + PROBE_X, box.y + SCAN_TOP, SCAN_HEIGHT)
      // Fundo = primeira linha da coluna (10 px acima da parede, dentro do mapa).
      const [br, bg, bb] = rows[0]
      return rows.some(([r, g, b]) => Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb)) >= MIN_CHANNEL_DIFF)
    })
    .toBe(true)
})

test('2. adicionar token pedindo o nome: nasce no centro visível, selecionado, com o nome no painel', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  const nameInput = page.getByLabel('Nome do novo token')
  await expect(nameInput).toBeFocused()
  await expect(nameInput).toHaveValue('Token 1')
  await nameInput.fill('Ana Guerreira')
  await nameInput.press('Enter')

  await expect.poll(async () => (await getTokens(page)).map((t) => t.name)).toEqual(['Ana Guerreira'])
  await expect(page.locator('#lb-token-name')).toHaveValue('Ana Guerreira')

  const expectedCenter = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const host = document.querySelector<HTMLElement>('.lb-editor__canvas')
    if (!host) throw new Error('.lb-editor__canvas ausente')
    const { camera } = mod.useMapStore.getState()
    return { x: (host.clientWidth / 2 - camera.x) / camera.scale, y: (host.clientHeight / 2 - camera.y) / camera.scale }
  })
  const [created] = await getTokens(page)
  expect({ x: created.x, y: created.y }).toEqual(expectedCenter)
  expect(expectedCenter.x).toBeGreaterThan(0)

  // Renomear pelo painel atualiza o token.
  await page.locator('#lb-token-name').fill('Ana, a Guerreira')
  await expect.poll(async () => (await getTokens(page))[0].name).toBe('Ana, a Guerreira')
})

test('3. Enter sem digitar usa o nome sugerido e único; Esc cancela sem criar', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  await page.getByLabel('Nome do novo token').press('Enter')
  await expect.poll(async () => (await getTokens(page)).map((t) => t.name)).toEqual(['Token 1'])

  await page.getByRole('button', { name: 'Adicionar token' }).click()
  await expect(page.getByLabel('Nome do novo token')).toHaveValue('Token 2')
  await page.getByLabel('Nome do novo token').press('Escape')
  await expect(page.getByLabel('Nome do novo token')).toHaveCount(0)
  expect((await getTokens(page)).map((t) => t.name)).toEqual(['Token 1'])
})
