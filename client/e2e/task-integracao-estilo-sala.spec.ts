// Integração dos consertos de 15/09/2026:
// 1. retângulo já desenhado e selecionado: o painel edita a cor/espessura DELE;
// 2. Sala nova nasce marrom (roomFillColor), Região continua com a cor dela;
// 3. contorno de seleção tem espessura fixa na tela (não engorda com o zoom);
// 4. porta trancada e escada selecionadas mantêm a cor real sob o contorno amarelo;
// 5. objeto "Oculto no editor" aparece como fantasma e continua clicável.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

type Rgb = [number, number, number]

const isYellow = ([r, g, b]: Rgb) => r > 220 && g > 190 && b < 140

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_integracao', 'E2E Integração', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
  await page.keyboard.press('Control+0')
  await expect(page.getByRole('button', { name: 'Zoom: 100%', exact: true })).toBeVisible()
}

async function storeValue<T>(page: Page, pick: string): Promise<T> {
  return page.evaluate(async (path) => {
    const mod = await import('/src/stores/mapStore.ts')
    let value: unknown = mod.useMapStore.getState()
    for (const key of path.split('.')) value = (value as Record<string, unknown>)[key]
    return value as T
  }, pick)
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

async function selectionKind(page: Page): Promise<string | undefined> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection[0]?.kind)
}

test.beforeEach(async ({ page }) => {
  // Stub mínimo do bridge Tauri: drawProps.ts chama convertFileSrc(prop.src) ao
  // desenhar o objeto do último teste (mesmo padrão de task4-select-delete.spec.ts).
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await enterEditor(page)
  await resetMap(page)
})

test('retângulo selecionado: mudar cor e espessura no painel muda o retângulo, não a preferência do próximo', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addDrawing({
      id: 'rect_e2e', kind: 'rect', x: 320, y: 256, w: 320, h: 192, color: '#ff0000', width: 6, filled: false, fillAlpha: 0.3,
    })
  })
  const drawColorBefore = await storeValue<string>(page, 'drawColor')
  const drawWidthBefore = await storeValue<number>(page, 'drawWidth')

  const edge = await worldToPage(page, 320, 352)
  await page.mouse.click(edge.x, edge.y)
  await expect.poll(() => selectionKind(page)).toBe('drawing')

  await expect(page.getByRole('heading', { name: 'Estilo do desenho selecionado' })).toBeVisible()
  await expect(page.locator('#lb-draw-color')).toHaveValue('#ff0000')
  await expect(page.locator('#lb-draw-width')).toHaveValue('6')

  await page.locator('#lb-draw-color').fill('#00c000')
  await expect.poll(() => storeValue<{ id: string; color: string }[]>(page, 'map.drawings').then((d) => d.find((x) => x.id === 'rect_e2e')?.color)).toBe('#00c000')
  const clip = { x: edge.x - 1, y: edge.y - 1, width: 3, height: 3 }
  await expect.poll(async () => (await clipPixels(page, clip)).some(([r, g, b]) => g > 150 && r < 90 && b < 90)).toBe(true)

  await page.locator('#lb-draw-width').fill('12')
  await expect.poll(() => storeValue<{ id: string; width: number }[]>(page, 'map.drawings').then((d) => d.find((x) => x.id === 'rect_e2e')?.width)).toBe(12)

  // A preferência do PRÓXIMO desenho não mudou.
  expect(await storeValue<string>(page, 'drawColor')).toBe(drawColorBefore)
  expect(await storeValue<number>(page, 'drawWidth')).toBe(drawWidthBefore)
})

test('Sala nova nasce marrom; a cor escolhida com a ferramenta Sala vale só para Sala', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  await expect(page.locator('#lb-region-color')).toHaveValue('#a8776a')

  await page.mouse.move(box.x + 300, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 500, { steps: 5 })
  await page.mouse.up()

  let regions = await storeValue<{ fillColor: string; room?: unknown }[]>(page, 'map.regions')
  expect(regions).toHaveLength(1)
  expect(regions[0].room).toBeTruthy()
  expect(regions[0].fillColor).toBe('#a8776a')

  // Sem nada selecionado, com a ferramenta Sala: o swatch edita roomFillColor.
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setSelection([])
  })
  await expect(page.locator('#lb-region-color')).toHaveValue('#a8776a')
  await page.locator('#lb-region-color').fill('#aa5500')
  expect(await storeValue<string>(page, 'roomFillColor')).toBe('#aa5500')
  expect(await storeValue<string>(page, 'regionFillColor')).toBe('#3a7ad0')

  await page.mouse.move(box.x + 700, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 900, box.y + 450, { steps: 5 })
  await page.mouse.up()
  regions = await storeValue<{ fillColor: string }[]>(page, 'map.regions')
  expect(regions.map((r) => r.fillColor)).toEqual(['#a8776a', '#aa5500'])

  // Região continua com a cor dela.
  await page.getByRole('button', { name: 'Região', exact: true }).click()
  await expect(page.locator('#lb-region-color')).toHaveValue('#3a7ad0')
})

test('contorno de seleção da região não engorda com o zoom', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const s = mod.useMapStore.getState()
    s.addRegion({
      id: 'r_zoom', tag: '', data: {}, fillColor: '#2a2a2a', fillPattern: 'solid',
      points: [{ x: 640, y: 128 }, { x: 960, y: 128 }, { x: 960, y: 448 }, { x: 640, y: 448 }],
    })
    s.setSelection([{ kind: 'region', id: 'r_zoom' }])
  })

  const yellowAcrossLeftEdge = async () => {
    const at = await worldToPage(page, 640, 300)
    return (await clipPixels(page, { x: Math.round(at.x) - 20, y: Math.round(at.y), width: 40, height: 1 })).filter(isYellow).length
  }
  await expect.poll(yellowAcrossLeftEdge).toBeGreaterThanOrEqual(2)
  const atScale1 = await yellowAcrossLeftEdge()

  // Zoom pelo gesto real (roda do mouse sobre a borda): a câmera mora no
  // PixiCanvas e só é espelhada na store, `setCamera` direto não mexe no canvas.
  const edge = await worldToPage(page, 640, 300)
  await page.mouse.move(edge.x, edge.y)
  // Roda sem Ctrl faz pan (resolveWheel); Ctrl+roda é o zoom.
  await page.keyboard.down('Control')
  for (let i = 0; i < 30 && (await storeValue<number>(page, 'camera.scale')) < 2.8; i++) {
    await page.mouse.wheel(0, -120)
  }
  await page.keyboard.up('Control')
  expect(await storeValue<number>(page, 'camera.scale')).toBeGreaterThanOrEqual(2.8)
  // Sem o redesenho no zoom o contorno, preso em px de mundo, ficaria ~3x mais
  // largo na tela. Com ele, nunca passa da largura medida a 100%.
  await expect.poll(yellowAcrossLeftEdge).toBeLessThanOrEqual(atScale1)
  expect(await yellowAcrossLeftEdge()).toBeGreaterThanOrEqual(1)
})

test('porta trancada e escada selecionadas: contorno amarelo por fora, cor real visível', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const s = mod.useMapStore.getState()
    s.addWall({ id: 'door_e2e', x1: 384, y1: 384, x2: 512, y2: 384, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } })
    s.setSelection([{ kind: 'wall', id: 'door_e2e' }])
  })
  const door = await worldToPage(page, 448, 384)
  const doorColumn = { x: Math.round(door.x) - 4, y: Math.round(door.y) - 10, width: 8, height: 20 }
  const isLockedRed = ([r, g, b]: Rgb) => r > 150 && g < 90 && b < 90
  await expect.poll(async () => (await clipPixels(page, doorColumn)).some(isYellow)).toBe(true)
  expect((await clipPixels(page, doorColumn)).some(isLockedRed)).toBe(true)

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const s = mod.useMapStore.getState()
    s.addStair({ id: 'stair_e2e', shape: 'straight', segments: [{ x1: 704, y1: 640, x2: 960, y2: 640 }], stepWidth: 64, direction: 'up' })
    s.setSelection([{ kind: 'stair', id: 'stair_e2e' }])
  })
  const a = await worldToPage(page, 704, 600)
  const b = await worldToPage(page, 960, 680)
  const stairClip = { x: Math.round(a.x), y: Math.round(a.y), width: Math.round(b.x - a.x), height: Math.round(b.y - a.y) }
  const isStairColor = ([r, g, b]: Rgb) => Math.abs(r - 0xc9) <= 14 && Math.abs(g - 0xb8) <= 14 && Math.abs(b - 0x96) <= 14
  await expect.poll(async () => (await clipPixels(page, stairClip)).some(isYellow)).toBe(true)
  expect((await clipPixels(page, stairClip)).filter(isStairColor).length).toBeGreaterThan(10)
})

test('objeto oculto no editor aparece como fantasma e o clique seleciona', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addProp({ id: 'prop_oculto', src: 'fake.png', x: 400, y: 400, width: 64, height: 64, linkedMapPath: null, hidden: true })
  })
  const topLeft = await worldToPage(page, 368, 366)
  const isWhite = ([r, g, b]: Rgb) => r >= 250 && g >= 250 && b >= 250
  await expect
    .poll(async () => (await clipPixels(page, { x: Math.round(topLeft.x), y: Math.round(topLeft.y), width: 64, height: 5 })).filter(isWhite).length)
    .toBeGreaterThan(8)

  const center = await worldToPage(page, 400, 400)
  await page.mouse.click(center.x, center.y)
  await expect.poll(() => selectionKind(page)).toBe('prop')
})
