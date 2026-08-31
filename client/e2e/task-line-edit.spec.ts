// E2E da edição pós-criação do Drawing kind 'line' (ferramenta "Linha" — reta simples
// de 2 pontos, DIFERENTE de Parede): arrastar uma ponta e arrastar o corpo inteiro.
// Espelha o padrão já usado para Parede solta em `task-alignment-door-curve-portal.spec.ts`
// (testes 7 e 8), mas sem guias de alinhamento — updateLinePoint/moveDrawing não
// chamam computeAlignment, então cada `.mouse.move` é uma posição final direta.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Drawing } from '../src/types/map'

type MapSnapshot = {
  drawings: Drawing[]
}

async function getMapSnapshot(page: Page): Promise<MapSnapshot> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    return { drawings: map.drawings }
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_line', 'E2E Line', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  // stub mínimo do bridge Tauri — mesmo padrão de task-alignment-door-curve-portal.spec.ts.
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await enterEditor(page)
  await resetMap(page)
})

test('linha: arrastar uma ponta move só ela, depois arrastar o corpo desloca as duas igualmente', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addDrawing({ id: 'lineDrag', kind: 'line', x1: 300, y1: 400, x2: 500, y2: 400, color: '#ffffff', width: 4 })
  })
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()

  // Seleciona clicando no meio do segmento (400,400) — longe de qualquer ponta.
  await page.mouse.click(box.x + 400, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'drawing', id: 'lineDrag' })

  // Arrasta a ponta 0 (300,400) — só ela deve mudar.
  await page.mouse.move(box.x + 300, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 260, box.y + 350, { steps: 5 })
  await page.mouse.up()

  let { drawings } = await getMapSnapshot(page)
  let line = drawings.find((d) => d.id === 'lineDrag')
  expect(line).toBeTruthy()
  if (!line || line.kind !== 'line') throw new Error('esperava um drawing kind line')
  expect(line.x1).toBe(260)
  expect(line.y1).toBe(350)
  expect(line.x2).toBe(500)
  expect(line.y2).toBe(400)

  // Arrasta o corpo (clique no meio do segmento atual, longe de qualquer ponta) —
  // dragging-line-body é delta-based (moveDrawing soma dx/dy), então as duas
  // pontas deslocam pelo mesmo delta e a forma (comprimento/direção) se preserva.
  // steps:1 evita que um sub-passo intermediário do mouse.move caia sobre uma
  // ponta e mude o modo de arrasto no meio do gesto.
  await page.mouse.move(box.x + 380, box.y + 375)
  await page.mouse.down()
  await page.mouse.move(box.x + 430, box.y + 405, { steps: 1 })
  await page.mouse.up()

  ;({ drawings } = await getMapSnapshot(page))
  line = drawings.find((d) => d.id === 'lineDrag')
  expect(line).toBeTruthy()
  if (!line || line.kind !== 'line') throw new Error('esperava um drawing kind line')
  expect(line.x1).toBe(310)
  expect(line.y1).toBe(380)
  expect(line.x2).toBe(550)
  expect(line.y2).toBe(430)
})
