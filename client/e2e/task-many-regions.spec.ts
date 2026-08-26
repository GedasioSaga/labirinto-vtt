// E2E de regressão pro bug real: com muitas regiões (~15+) desenhadas via
// `drawRegions` antigo (um único Graphics compartilhado, sem clear() entre elas),
// algumas regiões nasciam sem preenchimento visível — só o contorno aparecia.
// Reproduzido manualmente: 14 regiões OK, 17 quebrava 2. Plano
// `2026-08-26-fix-render-muitas-regioes.md`, Task 2. O fix (Task 1, commit
// `4f6995b`) trocou pra um Graphics próprio por região (`createRegionsRenderer`,
// já coberto por teste unitário decisivo em `drawRegions.test.ts`). Este spec
// fecha o gap de integração: cria 18 regiões contíguas via `addRegion()` no
// mapStore real, dentro do app real, e prova que nenhuma se perde e que a
// região do meio (a faixa que falhava antes) não fica vazia.
import { test, expect, type Page } from '@playwright/test'
import type { Region } from '../src/types/map'

const REGION_COLOR = '#1e7a1e'
const COLS = 6
const ROWS = 3
const CELL = 60
const ORIGIN_X = 100
const ORIGIN_Y = 100

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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_many_regions', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

/** Cria COLS x ROWS regiões retangulares contíguas (sem gap), mesmo padrão do bug real. */
async function createContiguousGrid(page: Page): Promise<void> {
  await page.evaluate(
    async ({ color, cols, rows, cell, originX, originY }) => {
      const mod = await import('/src/stores/mapStore.ts')
      let n = 0
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = originX + col * cell
          const y = originY + row * cell
          mod.useMapStore.getState().addRegion({
            id: `region-grid-${n++}`,
            points: [
              { x, y },
              { x: x + cell, y },
              { x: x + cell, y: y + cell },
              { x, y: y + cell },
            ],
            tag: '',
            fillColor: color,
            fillPattern: 'solid',
            data: {},
          })
        }
      }
    },
    { color: REGION_COLOR, cols: COLS, rows: ROWS, cell: CELL, originX: ORIGIN_X, originY: ORIGIN_Y },
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar mapa' }).click()
  await page.waitForSelector('canvas')
  await resetMap(page)
})

test('1. grade de 18 regiões contíguas: nenhuma se perde no estado', async ({ page }) => {
  await createContiguousGrid(page)

  const regions = await getRegions(page)
  expect(regions).toHaveLength(COLS * ROWS)

  const ids = new Set(regions.map((r) => r.id))
  expect(ids.size).toBe(COLS * ROWS)
  for (let n = 0; n < COLS * ROWS; n++) {
    expect(ids.has(`region-grid-${n}`)).toBe(true)
  }
})

test('2. grade de 18 regiões: a região do meio não fica vazia (pixel difere do fundo)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await createContiguousGrid(page)
  await expect.poll(async () => (await getRegions(page)).length).toBe(COLS * ROWS)

  // Centro da região "do meio" da grade (linha do meio, coluna 3 de 6) — faixa
  // que, no bug real, ficava sem preenchimento (só o contorno aparecia).
  const midCol = 3
  const midRow = 1
  const centerX = ORIGIN_X + midCol * CELL + CELL / 2
  const centerY = ORIGIN_Y + midRow * CELL + CELL / 2
  const clipSize = 20
  const regionClip = {
    x: box.x + centerX - clipSize / 2,
    y: box.y + centerY - clipSize / 2,
    width: clipSize,
    height: clipSize,
  }

  // Ponto do canvas fora de qualquer região, mesmo fundo puro — usado como
  // referência do que "vazia" parece.
  const emptyClip = {
    x: box.x + 700,
    y: box.y + 700,
    width: clipSize,
    height: clipSize,
  }

  const regionShot = await page.screenshot({ clip: regionClip })
  const emptyShot = await page.screenshot({ clip: emptyClip })

  expect(regionShot.equals(emptyShot)).toBe(false)
})

test('3. sem erro de console ao criar e renderizar 18 regiões contíguas', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  await createContiguousGrid(page)
  await expect.poll(async () => (await getRegions(page)).length).toBe(COLS * ROWS)

  expect(consoleErrors).toEqual([])
})
