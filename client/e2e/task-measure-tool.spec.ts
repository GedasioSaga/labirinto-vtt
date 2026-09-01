// E2E da ferramenta Medir (ROADMAP.md, F2 "Medidas: medir distância"): é
// puramente efêmera — mostra a distância enquanto arrasta
// (measurementIndicatorRenderer, pixi/PixiCanvas.tsx) e nunca grava nada no
// mapa. Nenhuma entidade nasce em nenhum dos 7 arrays de MapData, e o gesto
// não derruba a página (sem erro de console/exceção não tratada).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

interface EntityCounts {
  walls: number
  regions: number
  tokens: number
  props: number
  stairs: number
  drawings: number
  lights: number
}

async function getEntityCounts(page: Page): Promise<EntityCounts> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    return {
      walls: map.walls.length,
      regions: map.regions.length,
      tokens: map.tokens.length,
      props: map.props.length,
      stairs: map.stairs.length,
      drawings: map.drawings.length,
      lights: map.lights.length,
    }
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_measure', 'E2E Medir', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. arrastar com a ferramenta Medir não cria nenhuma entidade e não gera erro de console', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  const before = await getEntityCounts(page)
  expect(before).toEqual({ walls: 0, regions: 0, tokens: 0, props: 0, stairs: 0, drawings: 0, lights: 0 })

  await page.getByRole('button', { name: 'Medir', exact: true }).click()
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 500, box.y + 400, { steps: 5 })
  await page.mouse.move(box.x + 600, box.y + 500, { steps: 5 })
  await page.mouse.up()

  // Um segundo arrasto de medição — prova que o gesto não deixa resíduo
  // cumulativo (ex.: um "draft" que vira entidade real por engano no segundo uso).
  await page.mouse.move(box.x + 700, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 750, box.y + 350, { steps: 5 })
  await page.mouse.up()

  const after = await getEntityCounts(page)
  expect(after).toEqual(before)
  expect(errors).toEqual([])
})
