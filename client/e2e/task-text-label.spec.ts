// Verificação e2e da ferramenta Texto (plano `2026-08-26-ferramenta-texto.md`, Task 4).
// Mesmo padrão de task-drawing-tools.spec.ts: passa pela tela inicial, prova estado
// (drawings/selection) via mapStore.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Drawing } from '../src/types/map'

async function getDrawings(page: Page): Promise<Drawing[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.drawings
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_text', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Texto') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. texto: clique no canvas cria rótulo e seleciona automaticamente', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Texto')
  await page.mouse.click(box.x + 400, box.y + 400)

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  expect(drawings[0].kind).toBe('text')
  if (drawings[0].kind === 'text') expect(drawings[0].text).toBe('Rótulo')

  expect(await getSelection(page)).toEqual({ kind: 'drawing', id: drawings[0].id })
})

test('2. texto: digitar no campo do painel atualiza o texto do rótulo', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Texto')
  await page.mouse.click(box.x + 400, box.y + 400)

  const textInput = page.locator('#lb-text-content')
  await textInput.fill('Sala do Tesouro')

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  if (drawings[0].kind === 'text') expect(drawings[0].text).toBe('Sala do Tesouro')
})

test('3. texto: slider de tamanho de fonte atualiza o fontSize do rótulo', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Texto')
  await page.mouse.click(box.x + 400, box.y + 400)

  const fontSizeSlider = page.locator('#lb-text-fontsize')
  await fontSizeSlider.fill('32')

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  if (drawings[0].kind === 'text') expect(drawings[0].fontSize).toBe(32)
})

test('5. texto: seletor de fonte com o rótulo selecionado atualiza o fontFamily do rótulo', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Texto')
  await page.mouse.click(box.x + 400, box.y + 400)

  const fontFamilySelect = page.locator('#lb-text-fontfamily')
  await fontFamilySelect.selectOption('Georgia')

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  if (drawings[0].kind === 'text') expect(drawings[0].fontFamily).toBe('Georgia')
})

test('6. texto: mudar a fonte padrão (nenhum rótulo selecionado) e depois clicar no canvas cria o rótulo já com essa fontFamily', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // Ferramenta Texto ativa mas SEM rótulo selecionado ainda: painel mostrado é
  // "Estilo de desenho" (#lb-draw-fontfamily), que define o padrão do PRÓXIMO
  // rótulo — caminho distinto de #lb-text-fontfamily (teste "5.", que edita um
  // rótulo já selecionado). Ver comentário de showDrawingStyle em PropertiesPanel.tsx.
  await selectTool(page, 'Texto')

  const drawFontFamilySelect = page.locator('#lb-draw-fontfamily')
  await drawFontFamilySelect.selectOption('Georgia')

  await page.mouse.click(box.x + 400, box.y + 400)

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  if (drawings[0].kind === 'text') expect(drawings[0].fontFamily).toBe('Georgia')
})

test('4. texto: Delete com o rótulo selecionado apaga de map.drawings', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Texto')
  await page.mouse.click(box.x + 400, box.y + 400)
  expect(await getDrawings(page)).toHaveLength(1)

  await page.keyboard.press('Delete')
  expect(await getDrawings(page)).toEqual([])
})
