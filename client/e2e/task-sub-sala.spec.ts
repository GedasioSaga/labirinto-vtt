// Fatia 2 — salas dentro de sala, pela UI: desenhar dentro vira sub-sala com a
// cor da mãe e sem parede duplicada; clique dentro pega a filha; botão "Criar
// sala dentro"; mover, apagar (+ Ctrl+Z) e Ctrl+D na mãe levam a filha.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

interface RegionInfo { id: string; parentId?: string; fillColor: string; points: { x: number; y: number }[] }

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_sub_sala', 'E2E Sub-sala', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
  await page.keyboard.press('Control+0')
  await expect(page.getByRole('button', { name: 'Zoom: 100%', exact: true })).toBeVisible()
}

async function regions(page: Page): Promise<RegionInfo[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.regions.map((r) => ({ id: r.id, parentId: r.parentId, fillColor: r.fillColor, points: r.points }))
  })
}

async function wallsOf(page: Page, regionId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls.filter((w) => w.regionId === id).length
  }, regionId)
}

async function selectedId(page: Page): Promise<string | undefined> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection[0]?.id)
}

async function worldToPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const camera = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
  const box = await page.locator('canvas').first().boundingBox()
  if (!box) throw new Error('canvas sem caixa')
  return { x: box.x + camera.x + x * camera.scale, y: box.y + camera.y + y * camera.scale }
}

/** Desloca x de mundo para fora do painel esquerdo (o canvas começa atrás dele). */
const OX = 384

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await worldToPage(page, from[0] + OX, from[1])
  const b = await worldToPage(page, to[0] + OX, to[1])
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 })
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await page.mouse.up()
}

/** Ferramenta Sala (N), arrasto, Enter confirma o nome. */
async function drawRoom(page: Page, from: [number, number], to: [number, number], armed = false) {
  if (!armed) await page.keyboard.press('n')
  await drag(page, from, to)
  await page.keyboard.press('Enter')
}

async function clickWorld(page: Page, x: number, y: number) {
  const p = await worldToPage(page, x + OX, y)
  await page.mouse.click(p.x, p.y)
}

/** Casa 128..640 × 128..576 e quarto 128..384 × 128..384 (topo e esquerda sobre a casa); x lógico, +OX no mundo. */
async function drawHouseAndRoom(page: Page): Promise<{ casa: RegionInfo; quarto: RegionInfo }> {
  await drawRoom(page, [128, 128], [640, 576])
  await drawRoom(page, [128, 128], [384, 384])
  const list = await regions(page)
  expect(list).toHaveLength(2)
  return { casa: list[0], quarto: list[1] }
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('sala desenhada dentro vira filha com a cor da mãe, sem parede duplicada, e o clique dentro pega a filha', async ({ page }) => {
  const { casa, quarto } = await drawHouseAndRoom(page)
  expect(quarto.parentId).toBe(casa.id)
  expect(quarto.fillColor).toBe(casa.fillColor)
  expect(await wallsOf(page, casa.id)).toBe(4)
  expect(await wallsOf(page, quarto.id)).toBe(2)

  await page.keyboard.press('v')
  await clickWorld(page, 256, 256)
  expect(await selectedId(page)).toBe(quarto.id)
  await expect(page.getByTestId('room-parent')).toContainText('Dentro de:')
  await clickWorld(page, 600, 500)
  expect(await selectedId(page)).toBe(casa.id)
  await expect(page.getByTestId('room-parent')).toHaveCount(0)
})

test('botão "Criar sala dentro" arma a Sala e a próxima sala vira filha; fora dela avisa', async ({ page }) => {
  await drawRoom(page, [128, 128], [640, 576])
  const [casa] = await regions(page)
  await page.keyboard.press('v')
  await clickWorld(page, 400, 400)
  await page.getByRole('button', { name: 'Criar sala dentro', exact: true }).click()
  await drawRoom(page, [384, 384], [576, 512], true)
  const list = await regions(page)
  expect(list).toHaveLength(2)
  expect(list[1].parentId).toBe(casa.id)

  await page.keyboard.press('v')
  await clickWorld(page, 300, 300)
  await page.getByRole('button', { name: 'Criar sala dentro', exact: true }).click()
  await drawRoom(page, [704, 128], [832, 256], true)
  const after = await regions(page)
  expect(after).toHaveLength(3)
  expect(after[2].parentId).toBeUndefined()
  await expect(page.getByText(/A sala ficou fora d/)).toBeVisible()
})

test('mover a mãe move a filha; apagar a mãe apaga as duas e Ctrl+Z traz as duas', async ({ page }) => {
  const { casa, quarto } = await drawHouseAndRoom(page)
  await page.keyboard.press('v')
  await drag(page, [576, 512], [640, 576])
  const moved = await regions(page)
  expect(moved.find((r) => r.id === casa.id)?.points[0]).toEqual({ x: 128 + OX + 64, y: 192 })
  expect(moved.find((r) => r.id === quarto.id)?.points[0]).toEqual({ x: 128 + OX + 64, y: 192 })

  await clickWorld(page, 640, 576)
  expect(await selectedId(page)).toBe(casa.id)
  await page.keyboard.press('Delete')
  expect(await regions(page)).toHaveLength(0)
  expect(await wallsOf(page, quarto.id)).toBe(0)
  await page.keyboard.press('Control+z')
  const back = await regions(page)
  expect(back.map((r) => r.id)).toEqual([casa.id, quarto.id])
  expect(await wallsOf(page, quarto.id)).toBe(2)
})

interface WallInfo { id: string; x1: number; y1: number; x2: number; y2: number; door: boolean; regionId?: string }

async function walls(page: Page): Promise<WallInfo[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls.map((w) => ({ id: w.id, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, door: w.door !== null, regionId: w.regionId }))
  })
}

/** Ferramenta Porta (D) e clique sobre a parede. */
async function putDoor(page: Page, x: number, y: number) {
  await page.keyboard.press('d')
  await clickWorld(page, x, y)
}

test('portas na Casa e no Quarto: mover a Casa leva todas as paredes e portas, nada fica na posição antiga', async ({ page }) => {
  await drawHouseAndRoom(page)
  await putDoor(page, 400, 576)
  await putDoor(page, 384, 256)
  const before = await walls(page)
  expect(before.filter((w) => w.door)).toHaveLength(2)
  expect(before.every((w) => w.regionId !== undefined)).toBe(true)

  await page.keyboard.press('v')
  await drag(page, [576, 512], [576, 448])
  const after = await walls(page)
  expect(after).toHaveLength(before.length)
  for (const w of before) {
    expect(after.find((a) => a.id === w.id)).toMatchObject({ x1: w.x1, y1: w.y1 - 64, x2: w.x2, y2: w.y2 - 64 })
  }
})

test('largura da Casa no painel: a porta continua sobre a parede de baixo', async ({ page }) => {
  await drawRoom(page, [128, 128], [640, 576])
  const [casa] = await regions(page)
  await putDoor(page, 256, 576)
  await page.keyboard.press('v')
  await clickWorld(page, 400, 400)
  await page.locator('#lb-room-width').fill('768')
  const [resized] = await regions(page)
  const maxX = Math.max(...resized.points.map((p) => p.x))
  expect(maxX).toBe(casa.points[0].x + 768)
  const door = (await walls(page)).find((w) => w.door)
  expect(door?.y1).toBe(576)
  expect(door?.y2).toBe(576)
  const center = ((door?.x1 ?? 0) + (door?.x2 ?? 0)) / 2
  expect(center).toBeGreaterThan(casa.points[0].x)
  expect(center).toBeLessThan(maxX)
  // Centro na mesma fração da parede de antes (256 lógico = 1/4 da largura de 512).
  expect(center).toBeCloseTo(casa.points[0].x + 768 / 4, 0)
})

test('Ctrl+D na Casa com portas: cópia ao lado, sem sobrepor, e com as portas', async ({ page }) => {
  const { casa } = await drawHouseAndRoom(page)
  await putDoor(page, 400, 576)
  await putDoor(page, 384, 256)
  await page.keyboard.press('v')
  await clickWorld(page, 576, 512)
  await page.keyboard.press('Control+d')
  const list = await regions(page)
  const copy = list.find((r) => r.id !== casa.id && r.parentId === undefined)
  expect(copy?.points[0]).toEqual({ x: casa.points[0].x + 512 + 64, y: casa.points[0].y })
  const copyIds = new Set(list.filter((r) => r.id === copy?.id || r.parentId === copy?.id).map((r) => r.id))
  expect((await walls(page)).filter((w) => w.door && copyIds.has(w.regionId ?? ''))).toHaveLength(2)
})

test('arrastar o Quarto para fora da Casa vira sala de topo', async ({ page }) => {
  await drawRoom(page, [128, 128], [512, 448])
  await drawRoom(page, [128, 128], [256, 256])
  const [casa, quarto] = await regions(page)
  expect(quarto.parentId).toBe(casa.id)
  await page.keyboard.press('v')
  // Longe do centro: no meio da sala fica o nome, e arrastar ali move só o rótulo.
  await drag(page, [160, 232], [608, 232])
  const moved = (await regions(page)).find((r) => r.id === quarto.id)
  expect(moved?.points[0].x).toBe(quarto.points[0].x + 448)
  expect(moved?.parentId).toBeUndefined()
  // Fora da Casa o Quarto não pode ficar sem as paredes de cima e da esquerda.
  expect(await wallsOf(page, quarto.id)).toBe(4)
  await clickWorld(page, 608, 232)
  await expect(page.getByTestId('room-parent')).toHaveCount(0)
})

test('Ctrl+D na mãe copia mãe e filha com as paredes', async ({ page }) => {
  const { casa } = await drawHouseAndRoom(page)
  await page.keyboard.press('v')
  await clickWorld(page, 600, 500)
  expect(await selectedId(page)).toBe(casa.id)
  await page.keyboard.press('Control+d')
  const list = await regions(page)
  expect(list).toHaveLength(4)
  const copy = list.find((r) => r.id === (list[2].parentId ?? list[2].id) && r.id !== casa.id) ?? list[2]
  const copyChild = list.find((r) => r.parentId === copy.id)
  expect(copyChild).toBeDefined()
  expect(await wallsOf(page, copy.id)).toBe(4)
  expect(await wallsOf(page, copyChild?.id ?? '')).toBe(2)
})
