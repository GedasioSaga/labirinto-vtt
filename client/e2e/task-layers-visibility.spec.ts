// E2E do sistema de camadas (ROADMAP.md, Fundação/F1 "Camadas"): ocultar uma
// camada tira a entidade do hit-test (lib/selectionHitTest.ts) — clicar onde
// ela estava não seleciona mais nada — e mostrar de volta restaura. Não
// precisamos comparar pixel do canvas pra provar "sumiu da tela": hit-test e
// render usam as MESMAS funções `visible*` de lib/layers.ts (ver comentário em
// selectionHitTest.ts:201-213, "os dois precisam concordar, senão dá pra
// clicar em algo invisível ou ver algo que não clica"), então provar que o
// clique parou de acertar já prova a camada oculta pros dois lados.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Wall } from '../src/types/map'

async function getWalls(page: Page): Promise<Wall[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls
  })
}

// Onda 4, item 24 — `selection` do store virou SelectionSet (array). `[0] ??
// null` adapta pro formato de item único que os specs já esperavam.
async function getSelection(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection[0] ?? null
  })
}

async function getHiddenLayers(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.hiddenLayers
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_layers', 'E2E Camadas', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Parede') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. ocultar a camada "Paredes" tira a parede do hit-test; mostrar de volta restaura', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Parede')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  const wallId = walls[0].id

  await selectTool(page, 'Selecionar')

  // Confirma primeiro que o clique acerta a parede ENQUANTO a camada está
  // visível — sem essa linha, um teste que só esconde a camada antes de nunca
  // ter provado que o clique acertava provaria menos do que parece.
  await page.mouse.click(box.x + 500, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'wall', id: wallId })

  // Clique em área vazia limpa a seleção antes do próximo passo, pra isolar
  // o efeito do toggle de camada do efeito colateral de toggleLayerVisibility
  // (que já limpa a seleção sozinho se o item selecionado está na camada
  // ocultada — mapStore.ts, toggleLayerVisibility).
  await page.mouse.click(box.x + 900, box.y + 700)
  expect(await getSelection(page)).toBeNull()

  // Lista compacta (LayersPanel.tsx): o olho de cada linha tem nome com a
  // ação do próximo clique ("Ocultar Paredes" ↔ "Mostrar Paredes") e
  // aria-pressed = camada oculta. A contagem conta TODAS as entidades da
  // camada, visíveis ou não (countEntitiesByLayer) — não muda ao ocultar.
  const layersSection = page.getByRole('button', { name: 'Camadas', exact: true })
  await expect(layersSection).toHaveAttribute('aria-expanded', 'true')
  const wallsRow = page.getByRole('list', { name: 'Camadas do mapa' }).getByRole('listitem').filter({ hasText: 'Paredes' })
  await expect(wallsRow).toHaveText(/^Paredes\s*1$/)

  await page.getByRole('button', { name: 'Ocultar Paredes', exact: true }).click()
  expect(await getHiddenLayers(page)).toContain('paredes')
  await expect(page.getByRole('button', { name: 'Mostrar Paredes', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.mouse.click(box.x + 500, box.y + 400)
  expect(await getSelection(page)).toBeNull()

  await page.getByRole('button', { name: 'Mostrar Paredes', exact: true }).click()
  expect(await getHiddenLayers(page)).not.toContain('paredes')
  await expect(page.getByRole('button', { name: 'Ocultar Paredes', exact: true })).toHaveAttribute('aria-pressed', 'false')

  await page.mouse.click(box.x + 500, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'wall', id: wallId })
})
