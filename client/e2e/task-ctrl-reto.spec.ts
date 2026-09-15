// Verificação e2e do travamento em ângulo (Ctrl durante o arrasto) nas
// ferramentas Parede e Linha. Ctrl segurado -> segmento final trava num
// múltiplo exato de 45° (0/45/90/135/180/225/270/315 — não só horizontal/
// vertical, ver constrainToAngleStep em world.ts). Sem Ctrl -> ângulo livre.
// Soltar Ctrl no meio do arrasto -> volta ao livre.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'
import type { Wall, Drawing } from '../src/types/map'

// Distância (em graus) do ângulo do segmento (dx,dy) até o múltiplo de
// `stepDegrees` mais próximo — 0 significa "caiu exatamente num múltiplo".
// Tolerância pequena só pra ponto flutuante (mapa com snap de grade desligado
// em resetMap, então não há arredondamento de grade competindo com o ângulo).
function angleGapFromNearestStep(dx: number, dy: number, stepDegrees = 45): number {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI
  const normalized = ((deg % 360) + 360) % 360
  const remainder = normalized % stepDegrees
  return Math.min(remainder, stepDegrees - remainder)
}

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

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_ctrl_reto', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    // desliga snap de grade pra não mascarar o teste de ângulo livre com arredondamento coincidente
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

// Combinação apontada como não coberta na revisão da task T2 (gap #4): grade
// HEXAGONAL com "Travar na grade" LIGADO. Sem isso, `snapToHexGrid` reaplicado
// depois de `constrainToAngleStep` (PixiCanvas.tsx) podia deslocar o segmento
// final pra fora do múltiplo de 45°, mesmo com Ctrl travando o ângulo — e nem
// typecheck nem os testes acima (que sempre desligam o snap) detectavam isso.
async function resetMapHexSnap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_ctrl_reto_hex', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setGridShape('hex')
    mod.useMapStore.getState().setSnapEnabled(true)
  })
}

// Linha mora no botão Desenho: `pickTool` abre a setinha e escolhe o rádio.
async function selectTool(page: Page, label: 'Parede' | 'Linha') {
  await pickTool(page, label)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. parede sem Ctrl: arrasto diagonal fica em ângulo livre (x e y diferentes)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Parede')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 480, box.y + 440, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  expect(walls[0].x1).not.toBe(walls[0].x2)
  expect(walls[0].y1).not.toBe(walls[0].y2)
})

test('2. parede com Ctrl: varios angulos de arrasto brutos diferentes sempre travam num multiplo exato de 45 graus', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Parede')

  // Deltas brutos escolhidos pra não cair, por acidente, já em cima de um
  // múltiplo de 45° antes do travamento (cobrem os 4 quadrantes e ângulos
  // livres bem distintos entre si: ~27°, ~72°, ~124°, ~239°).
  const rawDeltas = [
    { dx: 80, dy: 40 },
    { dx: 30, dy: 90 },
    { dx: -70, dy: 47 },
    { dx: -50, dy: -83 },
  ]

  for (const { dx, dy } of rawDeltas) {
    await resetMap(page)
    await selectTool(page, 'Parede')

    await page.mouse.move(box.x + 400, box.y + 400)
    await page.mouse.down()
    await page.keyboard.down('Control')
    await page.mouse.move(box.x + 400 + dx, box.y + 400 + dy, { steps: 5 })
    await page.mouse.up()
    await page.keyboard.up('Control')

    const walls = await getWalls(page)
    expect(walls).toHaveLength(1)
    const wall = walls[0]
    const gap = angleGapFromNearestStep(wall.x2 - wall.x1, wall.y2 - wall.y1)
    expect(gap).toBeLessThan(0.01)
  }
})

test('3. parede: soltar Ctrl antes de finalizar volta ao ângulo livre', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Parede')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.keyboard.down('Control')
  await page.mouse.move(box.x + 480, box.y + 440, { steps: 5 })
  await page.keyboard.up('Control')
  await page.mouse.move(box.x + 520, box.y + 470, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  expect(walls).toHaveLength(1)
  expect(walls[0].x1).not.toBe(walls[0].x2)
  expect(walls[0].y1).not.toBe(walls[0].y2)
})

test('4. linha sem Ctrl: arrasto diagonal fica em ângulo livre', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Linha')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 480, box.y + 440, { steps: 5 })
  await page.mouse.up()

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  const line = drawings[0]
  if (line.kind !== 'line') throw new Error('esperava kind "line"')
  expect(line.x1).not.toBe(line.x2)
  expect(line.y1).not.toBe(line.y2)
})

test('5. linha com Ctrl: arrasto diagonal trava num multiplo exato de 45 graus', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await selectTool(page, 'Linha')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.keyboard.down('Control')
  await page.mouse.move(box.x + 480, box.y + 440, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  const line = drawings[0]
  if (line.kind !== 'line') throw new Error('esperava kind "line"')
  const gap = angleGapFromNearestStep(line.x2 - line.x1, line.y2 - line.y1)
  expect(gap).toBeLessThan(0.01)
})

test('6. parede com Ctrl + grade HEXAGONAL + snap de grade LIGADO: segmento final continua num multiplo exato de 45 graus (gap #4 da revisão T2)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  const rawDeltas = [
    { dx: 80, dy: 40 },
    { dx: 30, dy: 90 },
    { dx: -70, dy: 47 },
    { dx: -50, dy: -83 },
    // combinação citada na revisão como caso concreto de falha (~223° em vez de 225°)
    { dx: -100, dy: -100 },
  ]

  for (const { dx, dy } of rawDeltas) {
    await resetMapHexSnap(page)
    await selectTool(page, 'Parede')

    await page.mouse.move(box.x + 400, box.y + 400)
    await page.mouse.down()
    await page.keyboard.down('Control')
    await page.mouse.move(box.x + 400 + dx, box.y + 400 + dy, { steps: 5 })
    await page.mouse.up()
    await page.keyboard.up('Control')

    const walls = await getWalls(page)
    expect(walls).toHaveLength(1)
    const wall = walls[0]
    const gap = angleGapFromNearestStep(wall.x2 - wall.x1, wall.y2 - wall.y1)
    expect(gap).toBeLessThan(0.01)
  }
})

test('7. linha com Ctrl + grade HEXAGONAL + snap de grade LIGADO: segmento final continua num multiplo exato de 45 graus', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await resetMapHexSnap(page)
  await selectTool(page, 'Linha')

  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.keyboard.down('Control')
  await page.mouse.move(box.x + 300, box.y + 300, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')

  const drawings = await getDrawings(page)
  expect(drawings).toHaveLength(1)
  const line = drawings[0]
  if (line.kind !== 'line') throw new Error('esperava kind "line"')
  const gap = angleGapFromNearestStep(line.x2 - line.x1, line.y2 - line.y1)
  expect(gap).toBeLessThan(0.01)
})
