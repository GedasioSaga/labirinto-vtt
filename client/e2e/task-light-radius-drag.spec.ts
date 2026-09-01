// E2E do arrasto da alça de raio da Luz (ROADMAP.md, F1 "Iluminação: luz
// editável ... raio arrastável por alça"): a alça fica sobre a borda do
// círculo, no eixo +x a partir do centro (lightRadiusHandlePosition,
// pixi/drawEditHandles.ts) — arrastá-la muda `radius` pra exatamente a
// distância entre o centro da luz e o ponteiro (sem snap de grade nesse
// gesto, PixiCanvas.tsx). O arrasto inteiro usa `updateLightRadiusLive`
// (sem histórico, um snapshot por pointermove) + `commitDragHistory` no
// pointerup — Ctrl+Z logo depois desfaz o gesto inteiro num passo só, não um
// Ctrl+Z por pointermove.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Light } from '../src/types/map'

async function getLights(page: Page): Promise<Light[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.lights
  })
}

// Onda 4, item 24 — `selection` do store virou SelectionSet (array). `[0] ??
// null` adapta pro formato de item único que os specs já esperavam — só
// existe seleção múltipla via Shift+clique/marquee, que nenhum destes specs
// testa.
async function getSelection(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection[0] ?? null
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_light_radius', 'E2E Luz', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. arrastar a alça de raio muda "radius"; Ctrl+Z logo depois desfaz o arrasto inteiro num passo só', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addLight({ id: 'lightHandle', x: 400, y: 400, radius: 100, color: '#ffffff', intensity: 1 })
  })

  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
  // Luz centrada em (400,400), LIGHT_HIT_RADIUS=14 — clique exatamente no centro acerta.
  await page.mouse.click(box.x + 400, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'light', id: 'lightHandle' })

  // Alça em (x+radius, y) = (500,400) — arrasta até (650,400): nova distância
  // até o centro = 250.
  await page.mouse.move(box.x + 500, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 575, box.y + 400, { steps: 5 })
  await page.mouse.move(box.x + 650, box.y + 400, { steps: 5 })
  await page.mouse.up()

  let lights = await getLights(page)
  expect(lights.find((l) => l.id === 'lightHandle')?.radius).toBe(250)

  await page.keyboard.press('Control+z')

  lights = await getLights(page)
  expect(lights.find((l) => l.id === 'lightHandle')?.radius).toBe(100)
})
