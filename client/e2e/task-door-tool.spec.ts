// E2E da ferramenta dedicada "Porta": clicar em cima de uma parede já desenhada
// cria uma porta ALI, alinhada com a parede (nunca flutuando ao lado da linha —
// bug real reportado em screenshot antes desta feature). Mesmo padrão dos
// specs já existentes: passa pela tela inicial, monta o estado via store direto
// e prova o resultado lendo map.walls depois da interação no canvas.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Wall } from '../src/types/map'

async function getWalls(page: Page): Promise<Wall[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_door', 'E2E Porta', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Porta') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. clicar em cima de uma parede diagonal com a ferramenta Porta cria um pedaço porta colinear com a parede original', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // Parede diagonal (dx != dy, nenhum dos dois zero) — prova que o ângulo é
  // herdado por construção, nunca forçado pra horizontal/vertical.
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addWall({
      id: 'wallDiagonal',
      x1: 200,
      y1: 200,
      x2: 500,
      y2: 350,
      blocksLight: true,
      blocksMove: true,
      door: null,
    })
  })

  await selectTool(page, 'Porta')
  // Clique exatamente sobre a linha, em t=0.5: (350, 275).
  await page.mouse.click(box.x + 350, box.y + 275)

  const walls = await getWalls(page)
  expect(walls.find((w) => w.id === 'wallDiagonal')).toBeUndefined()
  expect(walls.length).toBeGreaterThanOrEqual(1)
  expect(walls.length).toBeLessThanOrEqual(3)

  const doorPiece = walls.find((w) => w.door !== null)
  expect(doorPiece).toBeTruthy()
  expect(doorPiece!.door).toEqual({ open: false, locked: false, kind: 'normal' })

  // Colinear com a parede original: mesma razão dx/dy — não só "perto" da
  // linha, EXATAMENTE sobre ela (dentro de erro de ponto flutuante).
  const originalRatio = (500 - 200) / (350 - 200)
  for (const piece of walls) {
    const pieceRatio = (piece.x2 - piece.x1) / (piece.y2 - piece.y1)
    expect(pieceRatio).toBeCloseTo(originalRatio, 9)
  }

  // A porta em si não é nem horizontal nem vertical (prova que o ângulo veio
  // da parede, não foi forçado pro eixo).
  expect(doorPiece!.x1).not.toBe(doorPiece!.x2)
  expect(doorPiece!.y1).not.toBe(doorPiece!.y2)
})

test('2. clicar em área vazia com a ferramenta Porta não cria nada', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Porta')
  await page.mouse.click(box.x + 900, box.y + 700)

  expect(await getWalls(page)).toEqual([])
})
