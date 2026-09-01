// E2E da ferramenta Escada (ROADMAP.md, F2 "Escadas: cima/baixo"): arrasto
// cria um Stair reto (shape 'straight', `stepWidth` default = map.grid —
// lib/stairs.ts), seleção por clique funciona (findStairAt,
// lib/selectionHitTest.ts, mesma tolerância de Parede), e trocar a direção no
// painel (StairControls) persiste em `Stair.direction` com histórico.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Stair } from '../src/types/map'

async function getStairs(page: Page): Promise<Stair[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.stairs
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

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_stair', 'E2E Escada', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Escada') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. arrasto com a ferramenta Escada cria um Stair reto; clique seleciona; trocar direção persiste', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Escada')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  let stairs = await getStairs(page)
  expect(stairs).toHaveLength(1)
  const stair = stairs[0]
  expect(stair.shape).toBe('straight')
  expect(stair.segments).toEqual([{ x1: 400, y1: 400, x2: 600, y2: 400 }])
  expect(stair.stepWidth).toBe(64) // default na criação = map.grid (createEmptyMap acima)
  expect(stair.direction).toBe('up')

  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 500, box.y + 400) // ponto médio do lance
  expect(await getSelection(page)).toEqual({ kind: 'stair', id: stair.id })

  // Direction 'up' -> checked=true ("Sobe (desmarcado = desce)") — desmarcar troca pra 'down'.
  await page.getByRole('checkbox', { name: 'Sobe (desmarcado = desce)' }).click({ force: true })
  stairs = await getStairs(page)
  expect(stairs.find((s) => s.id === stair.id)?.direction).toBe('down')

  await page.getByRole('checkbox', { name: 'Sobe (desmarcado = desce)' }).click({ force: true })
  stairs = await getStairs(page)
  expect(stairs.find((s) => s.id === stair.id)?.direction).toBe('up')
})
