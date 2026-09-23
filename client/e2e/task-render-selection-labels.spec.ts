// Consertos da auditoria de 14/09/2026 (render, rótulos, seleção):
// 1. grade redesenha ao mudar gridSettings, sem precisar de zoom/pan;
// 2. região selecionada mostra a cor e a hachura reais (contorno de seleção por fora);
// 3. parede fina e grossa ficam visivelmente diferentes a 100%;
// 4. botão Apagar da escada tem rótulo com gênero certo;
// 5. escolher ferramenta de criação limpa a seleção.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

type Rgb = [number, number, number]

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_render_labels', 'E2E Render', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
  await page.keyboard.press('Control+0')
  await expect(page.getByRole('button', { name: 'Zoom: 100%', exact: true })).toBeVisible()
}

/** Ponto de mundo → ponto de página (px CSS), pela câmera atual e a caixa do canvas. */
async function worldToPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const camera = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().camera
  })
  const box = await page.locator('canvas').first().boundingBox()
  if (!box) throw new Error('canvas sem caixa')
  return { x: box.x + camera.x + x * camera.scale, y: box.y + camera.y + y * camera.scale }
}

/** Pixels [r,g,b] de um recorte da página, em px físicos, linha a linha. */
async function clipPixels(page: Page, clip: { x: number; y: number; width: number; height: number }): Promise<Rgb[]> {
  const shot = await page.screenshot({ clip })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d ausente')
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.width, img.height).data
    const out: [number, number, number][] = []
    for (let i = 0; i < data.length; i += 4) out.push([data[i], data[i + 1], data[i + 2]])
    return out
  }, shot.toString('base64'))
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('grade redesenha na hora ao mudar a cor em gridSettings', async ({ page }) => {
  // Linha vertical da grade em x = 5 células; faixa horizontal curta atravessando-a.
  const at = await worldToPage(page, 64 * 5, 64 * 6 + 32)
  const clip = { x: at.x - 4, y: at.y, width: 9, height: 1 }
  const isRed = ([r, g, b]: Rgb) => r > 150 && g < 90 && b < 90
  // Mapa novo nasce sem grade (minimapa RE): liga antes de testar o redesenho da cor.
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setShowGrid(true)
  })
  expect((await clipPixels(page, clip)).some(isRed)).toBe(false)

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setGridSettings({ color: '#ff2020', opacity: 1, lineWidth: 3 })
  })

  await expect.poll(async () => (await clipPixels(page, clip)).some(isRed)).toBe(true)
})

test('região selecionada mantém a cor e a hachura reais', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const s = mod.useMapStore.getState()
    s.addRegion({
      id: 'r_e2e', tag: '', data: {}, fillColor: '#2a6fdb', fillPattern: 'hatch',
      points: [{ x: 640, y: 128 }, { x: 960, y: 128 }, { x: 960, y: 448 }, { x: 640, y: 448 }],
    })
    s.setSelection([{ kind: 'region', id: 'r_e2e' }])
  })
  const center = await worldToPage(page, 800, 288)
  const pixels = await clipPixels(page, { x: center.x - 30, y: center.y - 30, width: 60, height: 60 })
  const isBlue = ([r, , b]: Rgb) => b > 150 && r < 90
  const isYellow = ([r, g, b]: Rgb) => r > 180 && g > 150 && b < 110
  const isHatch = ([r, , b]: Rgb) => b > 60 && b < 150 && r < 60 // azul escurecido pela diagonal preta
  expect(pixels.filter(isBlue).length).toBeGreaterThan(pixels.length / 3)
  expect(pixels.filter(isYellow)).toHaveLength(0)
  expect(pixels.some(isHatch)).toBe(true)

  // O contorno de seleção fica POR FORA: logo além da borda direita (x=960) há amarelo.
  const outside = await worldToPage(page, 962, 288)
  const ring = await clipPixels(page, { x: outside.x, y: outside.y, width: 3, height: 1 })
  expect(ring.some(isYellow)).toBe(true)
})

test('parede fina, média e grossa ficam visivelmente diferentes a 100%', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const s = mod.useMapStore.getState()
    s.setShowGrid(false)
    const wall = (id: string, y: number, thickness: 'thin' | 'medium' | 'thick') =>
      ({ id, x1: 128, y1: y, x2: 512, y2: y, blocksLight: true, blocksMove: true, door: null, thickness })
    s.addWall(wall('w_thin', 256, 'thin'))
    s.addWall(wall('w_medium', 320, 'medium'))
    s.addWall(wall('w_thick', 384, 'thick'))
  })
  // Minimapa RE: parede é linha CLARA fina sobre o fundo escuro, com espessura
  // em px de tela. Mede a maior sequência contínua de pixels claros na coluna
  // que cruza a parede (grade desligada, nada claro em volta).
  const LIGHT_LUMA = 120
  const wallRun = async (y: number) => {
    const at = await worldToPage(page, 320, y)
    const column = await clipPixels(page, { x: at.x, y: at.y - 16, width: 1, height: 32 })
    let longest = 0
    let current = 0
    for (const [r, g, b] of column) {
      current = 0.299 * r + 0.587 * g + 0.114 * b > LIGHT_LUMA ? current + 1 : 0
      longest = Math.max(longest, current)
    }
    return longest
  }
  await expect.poll(() => wallRun(320)).toBeGreaterThan(0)
  const thin = await wallRun(256)
  const medium = await wallRun(320)
  const thick = await wallRun(384)
  expect(thin).toBeGreaterThan(0)
  expect(thin).toBeLessThan(medium)
  expect(medium).toBeLessThan(thick)
})

test('Apagar escada tem rótulo; escolher ferramenta de criação limpa a seleção', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setSelection([{ kind: 'stair', id: 'qualquer' }])
  })
  await expect(page.getByRole('button', { name: 'Apagar escada selecionada', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Luz', exact: true }).click()
  const selection = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection
  })
  expect(selection).toEqual([])
  await expect(page.getByRole('button', { name: 'Nada selecionado', exact: true })).toBeVisible()
})
