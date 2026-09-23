// Nitidez do texto com zoom (14/09/2026). O Pixi rasteriza cada Text na
// resolução do renderer; dentro do `world` escalado a textura era esticada e
// o nome da sala saía mole a 200% e em blocos 4x4 a 400% (screenshot medido).
// Agora a resolução do Text acompanha o zoom em degraus (pixi/textResolution.ts)
// e o editor publica a maior resolução aplicada em `data-text-resolution`.
// O mapa só tem um Text no mundo (o nome da sala), então esse valor é o dele.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

test.use({ deviceScaleFactor: 1 })

/** Ctrl+roda com deltaY = −ln(fator)/0,001 multiplica a escala por `fator` (zoomAt, world.ts). */
async function zoomBy(page: Page, factor: number) {
  await page.evaluate((deltaY) => {
    const canvas = document.querySelector('canvas')
    if (!canvas) throw new Error('canvas ausente')
    const rect = canvas.getBoundingClientRect()
    canvas.dispatchEvent(
      new WheelEvent('wheel', { deltaY, ctrlKey: true, clientX: rect.left + 200, clientY: rect.top + 200, bubbles: true, cancelable: true }),
    )
  }, -Math.log(factor) * 1000)
}

test('nome da sala é rasterizado na resolução do zoom (400% → 4x) e volta a 1x em 100%', async ({ page }) => {
  await enterEditor(page)
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const map = mapFactory.createEmptyMap('map_e2e_text_zoom', 'E2E Texto', 30, 20, 64)
    map.regions = [
      {
        id: 'r-sala',
        points: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }],
        tag: '',
        fillColor: '#7a4b2a',
        fillPattern: 'solid',
        data: {},
        room: { shape: 'rect', name: 'Salão' },
      },
    ]
    mod.useMapStore.getState().loadMap(map)
    mod.useMapStore.getState().setActiveTool('select')
  })
  await page.keyboard.press('Control+0')
  await expect(page.getByRole('button', { name: 'Zoom: 100%', exact: true })).toBeVisible()

  const host = page.locator('canvas').locator('..')
  await expect(host).toHaveAttribute('data-text-resolution', '1')

  await zoomBy(page, 4)
  await expect(page.getByRole('button', { name: 'Zoom: 400% — zoom máximo', exact: true })).toBeVisible()
  await expect(host).toHaveAttribute('data-text-resolution', '4')

  await zoomBy(page, 0.5)
  await expect(page.getByRole('button', { name: 'Zoom: 200%', exact: true })).toBeVisible()
  await expect(host).toHaveAttribute('data-text-resolution', '2')

  await page.keyboard.press('Control+0')
  await expect(page.getByRole('button', { name: 'Zoom: 100%', exact: true })).toBeVisible()
  await expect(host).toHaveAttribute('data-text-resolution', '1')
})
