// E2E de dois defeitos de perda de trabalho no editor:
//  1. Ctrl+Z / Backspace com rascunho ponto a ponto aberto (Região, Área
//     poligonal, Chão corredor) tiram o ÚLTIMO PONTO do rascunho — nunca
//     desfazem o mapa nem apagam a seleção. Com o último ponto tirado o
//     rascunho some e a tecla seguinte volta a valer para o mapa.
//  2. Com zoom afastado, o campo de nome da Sala recém-criada não pode
//     engolir o arrasto que começa logo abaixo da sala (fora do texto).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

type Counts = { rooms: number; regions: number[]; drawings: number[]; floor: number[]; selection: number }

async function counts(page: Page): Promise<Counts> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map, selection } = mod.useMapStore.getState()
    const pointsOf = (shape: unknown) => ((shape as { points?: unknown[] }).points ?? []).length
    return {
      rooms: map.regions.filter((r) => r.room).length,
      regions: map.regions.filter((r) => !r.room).map((r) => r.points.length),
      drawings: map.drawings.map((d) => pointsOf(d)),
      floor: map.floor.map((f) => pointsOf(f.shape)),
      selection: selection.length,
    }
  })
}

async function resetMap(page: Page, grid = 64, size = 30) {
  await page.evaluate(
    async ([g, s]) => {
      const mapFactory = await import('/src/lib/mapFactory.ts')
      const mod = await import('/src/stores/mapStore.ts')
      mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_rascunho', 'E2E Rascunho', s, s, g))
      mod.useMapStore.getState().setActiveTool('select')
    },
    [grid, size],
  )
}

async function setTool(page: Page, tool: string, floorShapeKind?: string) {
  await page.evaluate(
    async ([t, k]) => {
      const mod = await import('/src/stores/mapStore.ts')
      const s = mod.useMapStore.getState()
      if (k) s.setFloorShapeKind(k as never)
      s.setActiveTool(t as never)
    },
    [tool, floorShapeKind ?? ''],
  )
}

async function canvasPoint(page: Page, x: number, y: number) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { x: box.x + x, y: box.y + y }
}

/** Desenha uma Sala e fecha o campo de nome com Enter; a Sala fica selecionada. */
async function drawRoomAndConfirm(page: Page) {
  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  const a = await canvasPoint(page, 400, 400)
  const b = await canvasPoint(page, 600, 500)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 5 })
  await page.mouse.up()
  const overlay = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(overlay).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(overlay).toHaveCount(0)
}

async function clickCanvas(page: Page, x: number, y: number) {
  const p = await canvasPoint(page, x, y)
  await page.mouse.click(p.x, p.y)
}

async function dblclickCanvas(page: Page, x: number, y: number) {
  const p = await canvasPoint(page, x, y)
  await page.mouse.dblclick(p.x, p.y)
}

const DRAFTS: Array<{ name: string; tool: string; floorShapeKind?: string; created: (c: Counts) => number[] }> = [
  { name: 'Região', tool: 'region', created: (c) => c.regions },
  { name: 'Área poligonal', tool: 'polygon', created: (c) => c.drawings },
  { name: 'Chão corredor', tool: 'floor', floorShapeKind: 'corridor', created: (c) => c.floor },
]

test.describe('1. desfazer com rascunho ponto a ponto aberto', () => {
  test.beforeEach(async ({ page }) => {
    await enterEditor(page)
    await resetMap(page)
    await drawRoomAndConfirm(page)
  })

  for (const draft of DRAFTS) {
    test(`${draft.name}: Ctrl+Z e Backspace tiram o último ponto, sem tocar na Sala nem na seleção`, async ({ page }) => {
      const before = await counts(page)
      expect(before.rooms).toBe(1)
      expect(before.selection).toBe(1)
      const pastBefore = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().past.length)

      await setTool(page, draft.tool, draft.floorShapeKind)
      // A seleção da Sala recém-desenhada precisa continuar viva durante o rascunho.
      await page.evaluate(async () => {
        const mod = await import('/src/stores/mapStore.ts')
        const s = mod.useMapStore.getState()
        const room = s.map.regions.find((r) => r.room)
        if (room) s.setSelection([{ kind: 'region', id: room.id }])
      })

      // Viewport padrão 1280x800: y abaixo de 800 cai fora do canvas e x abaixo
      // de ~290 cai no painel lateral, que fica POR CIMA do canvas.
      await clickCanvas(page, 450, 600)
      await clickCanvas(page, 650, 600)
      await clickCanvas(page, 650, 660) // ponto errado
      await clickCanvas(page, 1000, 660) // outro ponto errado
      await page.keyboard.press('Control+z')
      await page.keyboard.press('Backspace')

      let now = await counts(page)
      expect(now.rooms).toBe(1)
      expect(now.selection).toBe(1)
      expect(await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().past.length)).toBe(pastBefore)

      // Termina com o ponto certo: 2 que sobraram + o do duplo clique.
      await dblclickCanvas(page, 450, 720)
      now = await counts(page)
      expect(now.rooms).toBe(1)
      expect(draft.created(now)).toEqual([...draft.created(before), 3])
    })
  }

  test('Região: Ctrl+Z com 1 ponto cancela o rascunho; o Ctrl+Z seguinte volta a desfazer o mapa', async ({ page }) => {
    await setTool(page, 'region')
    await clickCanvas(page, 450, 600)
    await page.keyboard.press('Control+z')
    expect((await counts(page)).rooms).toBe(1)
    // Sem rascunho, o duplo clique sozinho não fecha região nenhuma.
    await dblclickCanvas(page, 650, 600)
    expect((await counts(page)).regions).toEqual([])
    await page.keyboard.press('Control+z')
    expect((await counts(page)).rooms).toBe(0)
  })
})

test.describe('2. campo de nome com zoom afastado', () => {
  const G = 48
  test.use({ viewport: { width: 1600, height: 1000 } })

  test('arrasto logo abaixo da Sala recém-criada confirma o nome e cria a Sala seguinte; clicar no campo continua editando', async ({ page }) => {
    await enterEditor(page)
    await resetMap(page, G, 60)
    await page.getByText('Grudar Parede na grade', { exact: true }).click()
    const center = await canvasPoint(page, 800, 500)
    await page.mouse.move(center.x, center.y)
    for (let i = 0; i < 8; i++) {
      await page.keyboard.down('Control')
      await page.mouse.wheel(0, 200)
      await page.keyboard.up('Control')
    }
    const cam = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
    expect(cam.scale).toBeLessThan(0.25)
    const scr = async (bx: number, by: number) => canvasPoint(page, bx * G * cam.scale + cam.x, by * G * cam.scale + cam.y)
    const dragBlocks = async (x: number, y: number, w: number, h: number) => {
      const a = await scr(x, y)
      const b = await scr(x + w, y + h)
      await page.mouse.move(a.x, a.y)
      await page.mouse.down()
      await page.mouse.move(b.x, b.y, { steps: 4 })
      await page.mouse.up()
    }

    await page.getByRole('button', { name: 'Sala', exact: true }).click()
    await dragBlocks(20, 20, 6, 3)
    const overlay = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
    await expect(overlay).toBeFocused()
    await page.keyboard.type('Taverna')

    // Clicar DENTRO do campo continua editando (não cria Sala, não fecha o campo).
    const box = await overlay.boundingBox()
    if (!box) throw new Error('campo sem caixa')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(overlay).toBeFocused()
    expect((await counts(page)).rooms).toBe(1)

    // Arrasto começando na borda de baixo da Sala (fora do texto do nome).
    await dragBlocks(23, 23, 3, 3)
    const now = await counts(page)
    expect(now.rooms).toBe(2)
    const names = await page.evaluate(async () =>
      (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.regions.filter((r) => r.room).map((r) => r.room?.name),
    )
    expect(names[0]).toBe('Taverna')
  })
})
