// Verificação e2e do "ímã" de vértice ao desenhar Parede/Linha (findNearestExistingVertex
// em selectionHitTest.ts, chamado no PixiCanvas): se a ponta do arrasto cai perto (mas não
// exatamente em cima) de um vértice já existente no mapa — ponta de outra parede, vértice
// de uma região, ponta de outra linha/curva — a nova parede/linha gruda EXATAMENTE nesse
// ponto, em vez de ficar com uma pontinha solta boiando perto (bug real reportado pelo
// usuário: linha/parede curta desconectada perto de uma região, sem tocar nela de verdade).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'
import type { Wall, Drawing, Region } from '../src/types/map'

async function getWalls(page: Page): Promise<Wall[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls
  })
}

async function getDrawings(page: Page): Promise<Drawing[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.drawings
  })
}

// Região quadrada com vértice conhecido em (700,700) — mundo coincide com tela porque
// a câmera nasce em { x: 0, y: 0, scale: 1 } (ver mapStore.ts), então box.x+700/box.y+700
// aponta exatamente nesse vértice.
const region: Region = {
  id: 'r_magnet',
  points: [
    { x: 500, y: 500 },
    { x: 700, y: 500 },
    { x: 700, y: 700 },
    { x: 500, y: 700 },
  ],
  tag: '',
  fillColor: '#3a7ad0',
  fillPattern: 'solid',
  data: {},
}

async function resetMapWithRegion(page: Page) {
  await page.evaluate(async (regionArg: Region) => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    let map = mapFactory.createEmptyMap('map_e2e_vertex_magnet', 'E2E', 30, 20, 64)
    map = mapFactory.addRegion(map, regionArg)
    mod.useMapStore.getState().loadMap(map)
    mod.useMapStore.getState().setActiveTool('select')
    // Desliga o snap de grade: sem isso não dá pra distinguir "grudou no vértice
    // da região" de "coincidiu com uma célula da grade" — 700 nem é múltiplo de 64.
    mod.useMapStore.getState().setSnapEnabled(false)
  }, region)
}

// Linha mora no botão Desenho: `pickTool` abre a setinha e escolhe o rádio.
async function selectTool(page: Page, label: 'Parede' | 'Linha') {
  await pickTool(page, label)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMapWithRegion(page)
})

test('1. parede terminando perto (nao exatamente em cima) de um vertice de regiao existente gruda EXATAMENTE nele', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Parede')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  // Solta a 8px do vértice (700,700) da região — perto o bastante pro ímã (tolerância
  // 12px), mas NÃO exatamente em cima, reproduzindo o gesto real do usuário.
  await page.mouse.move(box.x + 706, box.y + 705, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  expect(walls[0].x2).toBe(700)
  expect(walls[0].y2).toBe(700)
})

test('2. linha terminando perto de um vertice de regiao existente gruda EXATAMENTE nele', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Linha')

  await page.mouse.move(box.x + 300, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 695, box.y + 703, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  const line = drawings[0]
  if (line.kind !== 'line') throw new Error('esperava kind "line"')
  expect(line.x2).toBe(700)
  expect(line.y2).toBe(700)
})

test('3. parede COMECANDO perto de um vertice de regiao existente gruda o ponto inicial EXATAMENTE nele', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Parede')

  // pointerdown a 7px do vértice (500,500) — o ímã do início do arrasto. Ponto
  // final bem longe de qualquer vértice, mas dentro do viewport (800px de
  // altura, ver playwright.config.ts) pra não sair da janela e virar
  // 'pointerupoutside' em vez de 'pointerup'.
  await page.mouse.move(box.x + 507, box.y + 494)
  await page.mouse.down()
  await page.mouse.move(box.x + 900, box.y + 300, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  expect(walls[0].x1).toBe(500)
  expect(walls[0].y1).toBe(500)
  expect(walls[0].x2).toBe(900)
  expect(walls[0].y2).toBe(300)
})

test('4. parede terminando longe de qualquer vertice (fora da tolerancia) NAO gruda — mantem o ponto bruto', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Parede')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  // 40px do vértice (700,700) — bem fora da tolerância de 12px do ímã.
  await page.mouse.move(box.x + 740, box.y + 740, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  expect(walls[0].x2).toBe(740)
  expect(walls[0].y2).toBe(740)
})
