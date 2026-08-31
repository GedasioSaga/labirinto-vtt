// E2E de regressão pro bug real: com muitas regiões (~15+) desenhadas via
// `drawRegions` antigo (um único Graphics compartilhado, sem clear() entre elas),
// algumas regiões nasciam sem preenchimento visível — só o contorno aparecia.
// Reproduzido manualmente: 14 regiões OK, 17 quebrava 2. Plano
// `2026-08-26-fix-render-muitas-regioes.md`, Task 2. O fix (Task 1, commit
// `4f6995b`) trocou pra um Graphics próprio por região (`createRegionsRenderer`,
// já coberto por teste unitário decisivo em `drawRegions.test.ts`). Este spec
// fecha o gap de integração: cria 18 regiões contíguas via `addRegion()` no
// mapStore real, dentro do app real, e prova que nenhuma se perde no estado
// e que nenhuma das 18 fica sem preenchimento visível (comparação de pixel
// do mesmo clip antes/depois, região por região — o bug real não era
// determinístico em qual região quebrava).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Region } from '../src/types/map'

const REGION_COLOR = '#1e7a1e'
const COLS = 6
const ROWS = 3
const CELL = 60
// Deslocado pra direita/baixo o suficiente pra ficar fora do painel lateral
// de propriedades do mapa (~0-280px) e da toolbar superior (~0-70px) —
// senão os clips de screenshot das colunas 0-2 caem atrás de UI opaca e
// "antes"/"depois" ficam sempre idênticos (painel estático), o que faria o
// teste de pixel sempre passar, esconda o bug ou não.
const ORIGIN_X = 340
const ORIGIN_Y = 120

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
  await enterEditor(page)
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

test('2. grade de 18 regiões: nenhuma fica vazia (pixel do mesmo ponto muda antes/depois, em todas)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  const cellClip = 20
  // Centro de cada uma das COLS x ROWS regiões da grade — o bug real não era
  // determinístico (17 regiões quebrou 2, posição variável), então checar só
  // uma amostra não prova a ausência do bug; checa-se a grade inteira.
  // Coordenadas relativas ao recorte `gridBox` abaixo (que já começa em
  // ORIGIN_X/ORIGIN_Y), não ao canvas inteiro.
  const cells: { col: number; row: number; x: number; y: number }[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      cells.push({
        col,
        row,
        x: col * CELL + CELL / 2 - cellClip / 2,
        y: row * CELL + CELL / 2 - cellClip / 2,
      })
    }
  }

  // Uma única screenshot cobrindo a grade inteira, antes e depois — em vez de
  // 2x18 chamadas a page.screenshot() (lento, estourava o timeout de 30s sob
  // carga da suíte completa). A comparação por região é feita no browser,
  // recortando cada sub-retângulo das duas imagens via canvas 2D.
  const gridBox = { x: box.x + ORIGIN_X, y: box.y + ORIGIN_Y, width: COLS * CELL, height: ROWS * CELL }
  const beforeShot = await page.screenshot({ clip: gridBox })

  await createContiguousGrid(page)
  await expect.poll(async () => (await getRegions(page)).length).toBe(COLS * ROWS)

  const afterShot = await page.screenshot({ clip: gridBox })

  // "Antes" comparado ao MESMO recorte que "depois" — mesmo padrão de
  // task4-selection-pixel-diff.spec.ts. Comparar contra um ponto não
  // relacionado do canvas não presta: o grid (showGrid, período de 64px sobre
  // todo o canvas) tem fase diferente em cada posição absoluta, então dois
  // recortes em pontos distintos já dão bytes diferentes independente do fill.
  const diffs = await page.evaluate(
    async ({ beforeB64, afterB64, cells, cellClip }) => {
      const loadImage = (base64: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error('falha ao decodificar screenshot'))
          img.src = `data:image/png;base64,${base64}`
        })
      const [beforeImg, afterImg] = await Promise.all([loadImage(beforeB64), loadImage(afterB64)])

      const canvas = document.createElement('canvas')
      canvas.width = beforeImg.width
      canvas.height = beforeImg.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')

      const readCell = (img: HTMLImageElement, x: number, y: number) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        return ctx.getImageData(x, y, cellClip, cellClip).data
      }

      return cells.map(({ col, row, x, y }) => {
        const before = readCell(beforeImg, x, y)
        const after = readCell(afterImg, x, y)
        let equal = before.length === after.length
        for (let i = 0; equal && i < before.length; i++) {
          if (before[i] !== after[i]) equal = false
        }
        return { col, row, equal }
      })
    },
    { beforeB64: beforeShot.toString('base64'), afterB64: afterShot.toString('base64'), cells, cellClip },
  )

  for (const { col, row, equal } of diffs) {
    expect(equal, `região col=${col} row=${row} ficou vazia (pixel igual ao "antes")`).toBe(false)
  }
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
