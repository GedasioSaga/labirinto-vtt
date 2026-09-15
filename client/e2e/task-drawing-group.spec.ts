// E2E da Fatia 2 do plano de 15/09/2026: as 7 formas de desenho num botão
// "Desenho". Nome acessível fixo, ícone e dica da forma corrente, setinha com
// o grupo Forma e as variantes da forma.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { DRAWING_SHAPE_LABELS, pickTool } from './helpers/tools'
import type { Drawing } from '../src/types/map'

async function storeState(page: Page): Promise<{ activeTool: string; lastDrawingTool: string; drawings: Drawing[] }> {
  return page.evaluate(async () => {
    const { activeTool, lastDrawingTool, map } = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    return { activeTool, lastDrawingTool, drawings: map.drawings }
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_drawing_group', 'E2E Desenho', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setSnapEnabled(false)
  })
})

test('1. a barra tem Desenho e nenhum botão com nome de forma', async ({ page }) => {
  const toolbar = page.getByRole('toolbar', { name: 'Ferramentas do mapa' })
  await expect(toolbar.getByRole('button', { name: 'Desenho', exact: true })).toHaveCount(1)
  await expect(toolbar.getByRole('button', { name: 'Opções de Desenho', exact: true })).toHaveCount(1)
  for (const label of DRAWING_SHAPE_LABELS) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0)
  }
})

test('2. setinha → Elipse: ativa a elipse, a dica diz Elipse e o arrasto cria kind "ellipse"', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await pickTool(page, 'Elipse')
  await expect(page.getByRole('group', { name: 'Opções de Desenho' })).toHaveCount(0)

  expect((await storeState(page)).activeTool).toBe('ellipse')
  const desenho = page.getByRole('button', { name: 'Desenho', exact: true })
  await expect(desenho).toHaveAttribute('aria-pressed', 'true')
  await expect(desenho).toHaveAttribute('data-tip', /Elipse/)

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 500, box.y + 450, { steps: 5 })
  await page.mouse.up()
  const { drawings } = await storeState(page)
  expect(drawings).toHaveLength(1)
  expect(drawings[0].kind).toBe('ellipse')
})

test('3. tecla R ativa o retângulo; depois de Selecionar, o clique em Desenho volta ao retângulo', async ({ page }) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('r')
  await expect.poll(async () => (await storeState(page)).activeTool).toBe('rect')

  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
  const desenho = page.getByRole('button', { name: 'Desenho', exact: true })
  await expect(desenho).toHaveAttribute('aria-pressed', 'false')
  await expect(desenho).toHaveAttribute('data-tip', 'Desenho: Retângulo (R)')

  await desenho.click()
  const state = await storeState(page)
  expect(state.activeTool).toBe('rect')
  expect(state.lastDrawingTool).toBe('rect')
  await expect(desenho).toHaveAttribute('aria-pressed', 'true')
})

test('4. com o Pincel a setinha mostra Textura do traço; com a Linha, não', async ({ page }) => {
  const arrow = page.getByRole('button', { name: 'Opções de Desenho', exact: true })
  const menu = page.getByRole('group', { name: 'Opções de Desenho' })

  await pickTool(page, 'Pincel')
  await arrow.click()
  await expect(menu.getByRole('radiogroup', { name: 'Forma' }).getByRole('radio')).toHaveCount(7)
  await expect(menu.getByRole('radiogroup', { name: 'Textura do traço' })).toHaveCount(1)
  // Textura não troca de ferramenta (D8).
  await menu.getByRole('radio', { name: 'Lápis', exact: true }).click()
  await expect(menu).toHaveCount(0)
  const afterTexture = await page.evaluate(async () => {
    const state = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    return { activeTool: state.activeTool, drawTexture: state.drawTexture }
  })
  expect(afterTexture).toEqual({ activeTool: 'brush', drawTexture: 'pencil' })

  await pickTool(page, 'Linha')
  await arrow.click()
  await expect(menu.getByRole('radiogroup', { name: 'Forma' })).toHaveCount(1)
  await expect(menu.getByRole('radiogroup', { name: 'Textura do traço' })).toHaveCount(0)
  await expect(menu.getByRole('radio', { name: 'Linha', exact: true })).toHaveAttribute('aria-checked', 'true')
})

test('5. Esc fecha o menu e devolve o foco à setinha', async ({ page }) => {
  const arrow = page.getByRole('button', { name: 'Opções de Desenho', exact: true })
  await arrow.click()
  const menu = page.getByRole('group', { name: 'Opções de Desenho' })
  await expect(menu).toBeVisible()
  await expect(arrow).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(arrow).toBeFocused()
  await expect(arrow).toHaveAttribute('aria-expanded', 'false')
})
