// E2E da Fase 5 (ROADMAP.md): as 3 variantes que a setinha (ToolVariantMenu)
// passou a oferecer de verdade — escada P/M/G, pincel caneta/lápis/marcador,
// borracha objeto/parte — mais o "Formato da linha" (B2, reta ⇄ curva) no
// painel esquerdo. Cada teste abre a setinha pelo MESMO caminho que o usuário
// usaria (botão "Opções de <ferramenta>" ao lado do botão principal, nunca a
// store direto) — é exatamente a verificação que a dívida D5 (ROADMAP.md)
// pede: capacidade pronta não basta, precisa estar ALCANÇÁVEL pela UI.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'
import type { Drawing, Stair } from '../src/types/map'

async function getStairs(page: Page): Promise<Stair[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.stairs
  })
}

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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_fase5', 'E2E Fase 5', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

/** Clica a setinha (botão irmão "Opções de <ferramenta>") — NUNCA o botão
 *  principal, que continua só selecionando a ferramenta (Toolbar.tsx). */
async function openVariantMenu(page: Page, tool: string) {
  await page.getByRole('button', { name: `Opções de ${tool}`, exact: true }).click()
}

async function selectMainTool(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. setinha da Escada: escolher "Grande" muda a preferência e a PRÓXIMA escada nasce com stepWidth = 2×grid', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await openVariantMenu(page, 'Escada')
  await page.getByRole('radio', { name: 'Grande' }).click()

  await selectMainTool(page, 'Escada')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  const stairs = await getStairs(page)
  expect(stairs).toHaveLength(1)
  expect(stairs[0].stepWidth).toBe(128) // 2 × grid(64), lib/stairs.ts STAIR_SIZE_PRESET_RATIO.large
})

test('2. setinha do Pincel: escolher "Lápis" muda a preferência e o PRÓXIMO traço nasce com texture "pencil"', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // A setinha do Pincel agora é a do botão Desenho (plano 15/09, fatia 2); com
  // o Pincel como forma o menu mostra Textura do traço abaixo de Forma.
  await openVariantMenu(page, 'Desenho')
  await page.getByRole('group', { name: 'Opções de Desenho' }).getByRole('radio', { name: 'Lápis' }).click()

  await pickTool(page, 'Pincel')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 420, { steps: 5 })
  await page.mouse.move(box.x + 500, box.y + 400, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  const drawing = drawings[0]
  expect(drawing.kind).toBe('freehand')
  if (drawing.kind === 'freehand') expect(drawing.texture).toBe('pencil')
})

test('3. setinha da Borracha: escolher "Só uma parte" corta o traço em vez de apagar tudo', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await pickTool(page, 'Pincel')
  await page.mouse.move(box.x + 300, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 400, box.y + 400, { steps: 10 })
  await page.mouse.move(box.x + 500, box.y + 400, { steps: 10 })
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 10 })
  await page.mouse.up()
  expect(await getDrawings(page)).toHaveLength(1)

  await openVariantMenu(page, 'Borracha')
  await page.getByRole('radio', { name: 'Só uma parte' }).click()

  await selectMainTool(page, 'Borracha')
  await page.mouse.click(box.x + 450, box.y + 400)

  const drawings = await getDrawings(page)
  // Cortado (2+ pedaços), não removido inteiro (0) — é a diferença que separa
  // este modo do comportamento padrão "objeto inteiro", já coberto por
  // task-eraser-tool.spec.ts.
  expect(drawings.length).toBeGreaterThan(1)
  expect(drawings.every((d) => d.kind === 'freehand')).toBe(true)
})

test('4. painel "Formato da linha": Curva converte a linha selecionada; Reta desfaz quando a curve resultante tem só 2 pontos', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await pickTool(page, 'Linha')
  await page.mouse.move(box.x + 300, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 500, box.y + 400, { steps: 5 })
  await page.mouse.up()
  expect((await getDrawings(page))[0].kind).toBe('line')

  await selectMainTool(page, 'Selecionar')
  await page.mouse.click(box.x + 400, box.y + 400) // meio da linha

  // Duas seções distintas usam o rótulo "Reta": LineCapControls ("Ponta da
  // linha") e LineShapeControls ("Formato da linha") — escopar pelo
  // radiogroup certo evita ambiguidade de seletor.
  const shapeGroup = page.getByRole('radiogroup', { name: 'Formato da linha' })
  await shapeGroup.getByRole('radio', { name: 'Curva' }).click()
  expect((await getDrawings(page))[0].kind).toBe('curve')

  await shapeGroup.getByRole('radio', { name: 'Reta' }).click()
  expect((await getDrawings(page))[0].kind).toBe('line')
})
