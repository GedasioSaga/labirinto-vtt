// E2E das formas novas de desenho (ROADMAP.md, F1 "Formas e pintura"):
// Retângulo/Elipse/Polígono pela barra produzem a entidade certa no estado
// (kind + geometria), e a opacidade de preenchimento escolhida ANTES de
// desenhar (`drawFillAlpha`, preferência de sessão — mapStore.ts, mesma
// classe de `polygonSides`/`doorKind`) chega intacta no `Drawing` salvo, não
// só o default de 0.5.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'
import type { Drawing } from '../src/types/map'

const CUSTOM_FILL_ALPHA = 0.35

async function getDrawings(page: Page): Promise<Drawing[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.drawings
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_shapes', 'E2E Formas', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

async function setFillPreference(page: Page, filled: boolean, fillAlpha: number) {
  await page.evaluate(
    async ({ filled, fillAlpha }) => {
      const mod = await import('/src/stores/mapStore.ts')
      mod.useMapStore.getState().setDrawFilled(filled)
      mod.useMapStore.getState().setDrawFillAlpha(fillAlpha)
    },
    { filled, fillAlpha },
  )
}

// As três formas moram no botão Desenho: `pickTool` abre a setinha e escolhe o rádio.
async function selectTool(page: Page, label: 'Retângulo' | 'Elipse' | 'Polígono') {
  await pickTool(page, label)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
  await setFillPreference(page, true, CUSTOM_FILL_ALPHA)
})

test('1. ferramenta Retângulo: arrasto de canto a canto cria Drawing kind "rect" com a opacidade escolhida', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Retângulo')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 500, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  const drawing = drawings[0]
  if (drawing.kind !== 'rect') throw new Error('esperava kind "rect"')
  expect(drawing).toMatchObject({ x: 400, y: 400, w: 200, h: 100, filled: true, fillAlpha: CUSTOM_FILL_ALPHA })
})

test('2. ferramenta Elipse: arrasto do centro até a borda cria Drawing kind "ellipse" com a opacidade escolhida', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Elipse')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 500, box.y + 450, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  const drawing = drawings[0]
  if (drawing.kind !== 'ellipse') throw new Error('esperava kind "ellipse"')
  expect(drawing).toMatchObject({ cx: 400, cy: 400, rx: 100, ry: 50, filled: true, fillAlpha: CUSTOM_FILL_ALPHA })
})

test('3. ferramenta Polígono: cliques + duplo clique fecha e cria Drawing kind "polygon" com a opacidade escolhida', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Polígono')

  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.mouse.click(box.x + 450, box.y + 500)
  await page.mouse.dblclick(box.x + 450, box.y + 500)

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  const drawing = drawings[0]
  if (drawing.kind !== 'polygon') throw new Error('esperava kind "polygon"')
  expect(drawing.points.length).toBeGreaterThanOrEqual(3)
  expect(drawing.filled).toBe(true)
  expect(drawing.fillAlpha).toBe(CUSTOM_FILL_ALPHA)
})
