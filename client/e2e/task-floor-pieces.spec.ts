// E2E da ferramenta "Chão" (chão por peças) — prova o CAMINHO DE UI até o
// motor que já existia (floorSdf/floorContour/add*FloorPiece*), lição D5 do
// ROADMAP: forma e operação escolhidas pela setinha da barra, peça criada
// arrastando com o mouse, seleção por clique no canvas, mover = 1 undo,
// Delete apaga, corredor por cliques. Mesmo harness de
// task-room-circle-polygon.spec.ts: store via import dinâmico, câmera em
// {0,0,1}, coordenada de mundo = offset do canvas.
//
// O canvas é medido a CADA gesto (`at`), não uma vez no início: abrir a
// setinha de variantes dá foco ao popover e rola o `.lb-editor` alguns px
// (medido: -37 com o menu aberto, -5 depois de fechar) — um boundingBox
// antigo erraria o ponto de mundo por essa diferença.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { FloorPiece } from '../src/types/map'

async function getFloor(page: Page): Promise<FloorPiece[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.floor
  })
}

async function getSelection(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection
  })
}

async function getPastLength(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().past.length
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_floor_pieces', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

/** Ponto de tela para a coordenada de mundo (x,y), com o canvas medido agora. */
async function at(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { x: box.x + x, y: box.y + y }
}

async function clickAt(page: Page, x: number, y: number) {
  const p = await at(page, x, y)
  await page.mouse.click(p.x, p.y)
}

async function drag(page: Page, from: [number, number], to: [number, number], steps = 6) {
  const a = await at(page, from[0], from[1])
  const b = await at(page, to[0], to[1])
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps })
  await page.mouse.up()
}

async function selectTool(page: Page, label: 'Selecionar' | 'Chão') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/** Escolhe uma variante pela setinha da barra — o caminho de UI real, não a store. */
async function pickFloorVariant(page: Page, option: RegExp) {
  await page.getByRole('button', { name: 'Opções de Chão', exact: true }).click()
  await page.getByRole('group', { name: 'Opções de Chão' }).getByRole('radio', { name: option }).click()
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. retângulo somado + retângulo subtraído por dentro; seleciona, edita no painel, move (1 undo), desfaz, apaga', async ({ page }, testInfo) => {
  await selectTool(page, 'Chão')
  await pickFloorVariant(page, /^Retângulo/)
  await pickFloorVariant(page, /^Somar/)
  await drag(page, [450, 300], [750, 550])

  let floor = await getFloor(page)
  expect(floor).toHaveLength(1)
  expect(floor[0]).toMatchObject({ op: 'add', shape: { kind: 'rect', cx: 600, cy: 425, w: 300, h: 250 } })

  await pickFloorVariant(page, /^Subtrair/)
  await drag(page, [540, 370], [660, 480])

  floor = await getFloor(page)
  expect(floor).toHaveLength(2)
  expect(floor[1]).toMatchObject({ op: 'subtract', shape: { kind: 'rect', cx: 600, cy: 425, w: 120, h: 110 } })

  // Clique sem arrasto não cria peça degenerada.
  await clickAt(page, 480, 520)
  expect(await getFloor(page)).toHaveLength(2)

  const away = await at(page, 900, 650)
  await page.mouse.move(away.x, away.y)
  await page.screenshot({ path: testInfo.outputPath('floor-two-pieces.png') })

  await selectTool(page, 'Selecionar')
  // Dentro do buraco: a peça subtrativa é a mais recente que contém o ponto.
  await clickAt(page, 600, 425)
  expect(await getSelection(page)).toEqual([{ kind: 'floor', id: floor[1].id }])
  // No chão somado, fora do buraco: a peça somada.
  await clickAt(page, 480, 330)
  expect(await getSelection(page)).toEqual([{ kind: 'floor', id: floor[0].id }])
  await page.mouse.move(away.x, away.y)
  await page.screenshot({ path: testInfo.outputPath('floor-selected.png') })

  // Painel da peça é alcançável e edita com histórico.
  await expect(page.getByRole('heading', { name: /Peça de chão/ })).toBeVisible()
  await page.getByLabel('Largura (px)').fill('320')
  floor = await getFloor(page)
  expect(floor[0].shape).toMatchObject({ kind: 'rect', w: 320 })

  // Arrastar o corpo move a peça; o gesto inteiro é UMA entrada de undo.
  const pastBefore = await getPastLength(page)
  await drag(page, [480, 330], [520, 360], 8)
  floor = await getFloor(page)
  expect(floor[0].shape).toMatchObject({ cx: 640, cy: 455 })
  expect(await getPastLength(page)).toBe(pastBefore + 1)

  await page.keyboard.press('Control+z')
  floor = await getFloor(page)
  expect(floor[0].shape).toMatchObject({ cx: 600, cy: 425, w: 320 })

  await clickAt(page, 470, 330)
  expect(await getSelection(page)).toEqual([{ kind: 'floor', id: floor[0].id }])
  await page.keyboard.press('Delete')
  floor = await getFloor(page)
  expect(floor).toHaveLength(1)
  expect(floor[0].op).toBe('subtract')
  expect(await getSelection(page)).toEqual([])
})

test('2. corredor por cliques: duplo clique termina, Enter termina, Esc cancela', async ({ page }) => {
  await selectTool(page, 'Chão')
  await pickFloorVariant(page, /^Corredor/)

  await clickAt(page, 450, 350)
  await clickAt(page, 650, 350)
  const last = await at(page, 650, 500)
  await page.mouse.dblclick(last.x, last.y)

  let floor = await getFloor(page)
  expect(floor).toHaveLength(1)
  // Largura padrão = grid/2 = 32; o ponto repetido do duplo clique é descartado.
  expect(floor[0]).toMatchObject({
    op: 'add',
    shape: {
      kind: 'corridor',
      points: [
        { x: 450, y: 350, width: 32 },
        { x: 650, y: 350, width: 32 },
        { x: 650, y: 500, width: 32 },
      ],
    },
  })

  await clickAt(page, 850, 300)
  await clickAt(page, 850, 450)
  await page.keyboard.press('Enter')
  floor = await getFloor(page)
  expect(floor).toHaveLength(2)
  expect(floor[1].shape).toMatchObject({ kind: 'corridor', points: [{ x: 850, y: 300 }, { x: 850, y: 450 }] })

  await clickAt(page, 450, 620)
  await clickAt(page, 650, 620)
  await page.keyboard.press('Escape')
  // Depois do Esc, um Enter não pode ressuscitar o rascunho cancelado.
  await page.keyboard.press('Enter')
  expect(await getFloor(page)).toHaveLength(2)
})
