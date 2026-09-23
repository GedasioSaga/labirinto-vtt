// E2E do tipo estrutural de porta (ROADMAP.md, F2 "Portas: normal / ... /
// portão"): `normal`/`double`/`gate` produzem vãos de comprimento diferente
// (DOOR_LENGTH_BY_KIND, mapStore.ts: 32/64/96px) — a preferência escolhida no
// painel "Tipo de porta" (DoorKindControls) antes do clique decide o `kind`
// da porta nova e o comprimento do vão que `addDoorOnWall` abre. O toggle
// "Trancada" (WallDoorControls) edita `door.locked` de uma porta JÁ CRIADA e
// SELECIONADA, com histórico.
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_door_kinds', 'E2E Portas', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function addLongWall(page: Page) {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    // Comprimento 300 — folga suficiente pro vão de 96px (kind 'gate') caber
    // sem estourar a parede pros dois lados.
    mod.useMapStore.getState().addWall({ id: 'wallLongDoor', x1: 400, y1: 400, x2: 700, y2: 400, blocksLight: true, blocksMove: true, door: null })
  })
}

function doorPieceLength(walls: Wall[]): number {
  const doorPiece = walls.find((w) => w.door !== null)
  if (!doorPiece) throw new Error('nenhuma parede com porta encontrada')
  return Math.hypot(doorPiece.x2 - doorPiece.x1, doorPiece.y2 - doorPiece.y1)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. tipo "Normal": vão de 32px', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await addLongWall(page)

  await page.getByRole('button', { name: 'Porta', exact: true }).click()
  await page.getByRole('radio', { name: 'Normal', exact: true }).click()
  await page.mouse.click(box.x + 550, box.y + 400)

  const walls = await getWalls(page)
  const doorPiece = walls.find((w) => w.door !== null)
  expect(doorPiece?.door?.kind).toBe('normal')
  expect(doorPieceLength(walls)).toBeCloseTo(32, 6)
})

test('2. tipo "Dupla": vão de 64px', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await addLongWall(page)

  await page.getByRole('button', { name: 'Porta', exact: true }).click()
  await page.getByRole('radio', { name: 'Dupla', exact: true }).click()
  await page.mouse.click(box.x + 550, box.y + 400)

  const walls = await getWalls(page)
  const doorPiece = walls.find((w) => w.door !== null)
  expect(doorPiece?.door?.kind).toBe('double')
  expect(doorPieceLength(walls)).toBeCloseTo(64, 6)
})

test('3. tipo "Portão": vão de 96px', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await addLongWall(page)

  await page.getByRole('button', { name: 'Porta', exact: true }).click()
  await page.getByRole('radio', { name: 'Portão', exact: true }).click()
  await page.mouse.click(box.x + 550, box.y + 400)

  const walls = await getWalls(page)
  const doorPiece = walls.find((w) => w.door !== null)
  expect(doorPiece?.door?.kind).toBe('gate')
  expect(doorPieceLength(walls)).toBeCloseTo(96, 6)
})

test('4. toggle "Trancada" persiste em door.locked de uma porta já criada', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addWall({
      id: 'wallWithDoor',
      x1: 400,
      y1: 400,
      x2: 500,
      y2: 400,
      blocksLight: true,
      blocksMove: true,
      door: { open: false, locked: false, kind: 'normal' },
    })
  })

  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
  await page.mouse.click(box.x + 450, box.y + 400)

  // O checkbox real fica visualmente coberto pelo track decorativo do Toggle
  // (mesmo padrão de task-alignment-door-curve-portal.spec.ts) — force:true
  // clica direto no input, como o usuário clicando em cima do interruptor faria.
  // Rótulo fixo "Trancada" (nomeia o estado LIGADO); o checked mostra se está.
  const trancada = page.getByRole('checkbox', { name: 'Trancada', exact: true })
  await expect(trancada).not.toBeChecked()
  await trancada.click({ force: true })

  let walls = await getWalls(page)
  expect(walls.find((w) => w.id === 'wallWithDoor')?.door?.locked).toBe(true)
  await expect(trancada).toBeChecked()

  await trancada.click({ force: true })

  walls = await getWalls(page)
  expect(walls.find((w) => w.id === 'wallWithDoor')?.door?.locked).toBe(false)
})
