// Prova em nível de PIXEL de que selecionar parede/luz/região/peça dispara o redraw do
// destaque visual (fix `fc53355`: `state.selection` faltava em shapesSubscription.ts e
// propsSubscription.ts). task4-select-delete.spec.ts só prova nível de ESTADO
// (selection/botão) — ver docs/verification/2026-08-25-task4-selecionar-apagar-verificacao.md.
// Este arquivo fecha esse gap: screenshot da região do canvas antes/depois de selecionar,
// byte a byte. Sem o fix, os bytes seriam idênticos (é exatamente o que a revisão final provou
// como prova negativa antes do fix existir).
import { test, expect, type Page } from '@playwright/test'

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_pixel', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Parede' | 'Luz' | 'Região') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar mapa' }).click()
  await page.waitForSelector('canvas')
  await resetMap(page)
})

test('parede: pixel da região muda ao selecionar (destaque amarelo desenha de verdade)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  await selectTool(page, 'Selecionar')
  const clip = { x: box.x + 380, y: box.y + 380, width: 240, height: 40 }
  const before = await page.screenshot({ clip })

  await page.mouse.click(box.x + 500, box.y + 400)
  await expect
    .poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection?.kind))
    .toBe('wall')

  const after = await page.screenshot({ clip })
  expect(before.equals(after)).toBe(false)
})

test('luz: pixel da região muda ao selecionar (anel de destaque desenha de verdade)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Luz')
  await page.mouse.click(box.x + 500, box.y + 500)

  await selectTool(page, 'Selecionar')
  const clip = { x: box.x + 470, y: box.y + 470, width: 60, height: 60 }
  const before = await page.screenshot({ clip })

  await page.mouse.click(box.x + 500, box.y + 500)
  await expect
    .poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection?.kind))
    .toBe('light')

  const after = await page.screenshot({ clip })
  expect(before.equals(after)).toBe(false)
})

test('região: pixel da área muda ao selecionar (preenchimento de destaque desenha de verdade)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Região')
  await page.mouse.click(box.x + 400, box.y + 400)
  await page.mouse.click(box.x + 500, box.y + 400)
  await page.mouse.click(box.x + 450, box.y + 500)
  await page.mouse.dblclick(box.x + 450, box.y + 500)

  await selectTool(page, 'Selecionar')
  const clip = { x: box.x + 400, y: box.y + 400, width: 100, height: 90 }
  const before = await page.screenshot({ clip })

  await page.mouse.click(box.x + 450, box.y + 435)
  await expect
    .poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection?.kind))
    .toBe('region')

  const after = await page.screenshot({ clip })
  expect(before.equals(after)).toBe(false)
})

test('peça: pixel da região muda ao selecionar (contorno de destaque desenha de verdade)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addProp({ id: 'propPixel', src: 'fake.png', x: 400, y: 400, width: 64, height: 64 })
  })
  await selectTool(page, 'Selecionar')
  const clip = { x: box.x + 390, y: box.y + 390, width: 84, height: 84 }
  const before = await page.screenshot({ clip })

  await page.mouse.click(box.x + 400, box.y + 400)
  await expect
    .poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection?.kind))
    .toBe('prop')

  const after = await page.screenshot({ clip })
  expect(before.equals(after)).toBe(false)
})
