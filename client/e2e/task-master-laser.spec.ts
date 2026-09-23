// E2E do laser do mestre no editor (fora do Tauri não há hostBridge: aqui
// o rastro local, que sai pelo mesmo emit que chama `hostBridge.laserMove`, e
// a regra da tecla). L segurado ou o botão Laser só ARMAM: o traço sai com o
// botão esquerdo pressionado e não aciona a ferramenta ativa. L é também o
// atalho da ferramenta Linha: toque curto = Linha, e L num campo de texto não
// faz nenhuma das duas.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

test.beforeEach(async ({ page }) => {
  // Mesmo stub de task4-select-delete: fora do webview real não há __TAURI_INTERNALS__.
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await enterEditor(page)
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_laser', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
})

async function helpers(page: Page) {
  const host = page.locator('[data-laser-drawn]')
  await expect(host).toHaveAttribute('data-laser-drawn', '0')
  const box = await page.locator('canvas').first().boundingBox()
  if (box === null) throw new Error('sem canvas')
  return {
    host,
    box,
    drawn: async () => Number(await host.getAttribute('data-laser-drawn')),
    cursor: () => host.evaluate((el) => (el as HTMLElement).style.cursor),
    activeTool: () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().activeTool),
    setTool: (tool: 'select') => page.evaluate(async (t) => (await import('/src/stores/mapStore.ts')).useMapStore.getState().setActiveTool(t), tool),
    laser: () =>
      page.evaluate(async () => {
        const s = (await import('/src/stores/laserStore.ts')).useLaserStore.getState()
        return { held: s.held, toggled: s.toggled, drawing: s.drawing, trail: s.trail.length }
      }),
  }
}

test('L arma sem desenhar; botão esquerdo desenha; soltar apaga; toque curto seleciona a Linha; L num campo de texto não arma', async ({ page }) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const h = await helpers(page)
  const cx = h.box.x + h.box.width / 2
  const cy = h.box.y + h.box.height / 2
  await page.mouse.move(cx, cy)

  // 1. Segurar L e mexer sem botão: armado, mira no cursor, nada desenhado nem emitido.
  await page.keyboard.down('l')
  await page.mouse.move(cx + 120, cy + 40, { steps: 8 })
  await expect.poll(async () => (await h.laser()).held).toBe(true)
  await expect.poll(h.cursor).toBe('crosshair')
  await page.waitForTimeout(300)
  expect(await h.laser()).toMatchObject({ drawing: false, trail: 0 })
  expect(await h.drawn()).toBe(0)

  // 2. Botão esquerdo pressionado e mexendo: rastro.
  await page.mouse.down()
  await page.mouse.move(cx - 60, cy + 80, { steps: 10 })
  expect((await h.laser()).drawing).toBe(true)
  await expect.poll(async () => (await h.laser()).trail).toBeGreaterThan(2)
  await expect.poll(h.drawn).toBeGreaterThan(2)
  await page.screenshot({ path: `${test.info().project.outputDir}/master-laser/laser-editor.png` })

  // 3. Soltar o botão encerra o traço; o rastro some sozinho em ~1 s.
  await page.mouse.up()
  expect((await h.laser()).drawing).toBe(false)
  await page.keyboard.up('l')
  expect((await h.laser()).held).toBe(false)
  expect(await h.cursor()).not.toBe('crosshair')
  expect(await h.activeTool()).toBe('select')
  await expect(h.host).toHaveAttribute('data-laser-drawn', '0', { timeout: 3_000 })

  // 4. Segurar parado além do tempo do toque arma, sem ponta nem rastro.
  await expect.poll(async () => (await h.laser()).trail, { timeout: 3_000 }).toBe(0)
  await page.keyboard.down('l')
  await page.waitForTimeout(500)
  expect(await h.laser()).toMatchObject({ held: true, drawing: false, trail: 0 })
  expect(await h.drawn()).toBe(0)
  await page.keyboard.up('l')
  expect(await h.activeTool()).toBe('select')

  // 5. Toque curto sem mexer o mouse: atalho da Linha, sem laser.
  await page.keyboard.press('l')
  await expect.poll(h.activeTool).toBe('line')
  expect((await h.laser()).held).toBe(false)
  expect(await h.drawn()).toBe(0)

  // 6. Foco num campo de texto: digitar L não arma o laser nem troca a ferramenta.
  await h.setTool('select')
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.id = 'laser-e2e-campo'
    input.style.position = 'fixed'
    input.style.left = '0'
    input.style.top = '0'
    document.body.appendChild(input)
    input.focus()
  })
  await page.keyboard.down('l')
  await page.mouse.move(cx - 80, cy - 30, { steps: 6 })
  await page.waitForTimeout(500)
  await page.keyboard.up('l')
  expect((await h.laser()).held).toBe(false)
  expect(await h.drawn()).toBe(0)
  expect(await h.activeTool()).toBe('select')
  await expect(page.locator('#laser-e2e-campo')).toHaveValue('l')

  expect(pageErrors).toEqual([])
})

test('com o laser armado, botão direito não desenha e clicar-arrastar um token não seleciona nem move', async ({ page }) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const h = await helpers(page)
  const token = () =>
    page.evaluate(async () => {
      const s = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
      const t = s.map.tokens.find((tok) => tok.id === 'tokLaser')
      return { x: t?.x, y: t?.y, selection: s.selection.length }
    })
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tokLaser', characterId: null, name: 'Token', x: 400, y: 400, size: 1, image: null })
  })
  const tx = h.box.x + 400
  const ty = h.box.y + 400
  // 1. Botão direito com L segurado, longe do token (botão direito arrasta item no Selecionar): nada de laser.
  const ex = h.box.x + 150
  const ey = h.box.y + 150
  await page.mouse.move(ex, ey)
  await page.keyboard.down('l')
  await page.waitForTimeout(400)
  expect((await h.laser()).held).toBe(true)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(ex + 60, ey + 40, { steps: 6 })
  await page.mouse.up({ button: 'right' })
  expect(await h.laser()).toMatchObject({ drawing: false, trail: 0 })
  expect(await h.drawn()).toBe(0)
  await page.keyboard.up('l')
  await page.keyboard.press('Escape')
  expect(await token()).toEqual({ x: 400, y: 400, selection: 0 })

  // 2. Arrastar a partir do token com o laser armado: rastro sim, token parado e nada selecionado.
  await page.mouse.move(tx, ty)
  await page.keyboard.down('l')
  await page.waitForTimeout(400)
  await page.mouse.down()
  await page.mouse.move(tx + 160, ty + 80, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('l')
  expect((await h.laser()).trail).toBeGreaterThan(2)
  expect(await token()).toEqual({ x: 400, y: 400, selection: 0 })

  // 3. Controle: o mesmo arrasto sem laser move o token (o passo 2 não passou por acaso).
  await page.mouse.move(tx, ty)
  await page.mouse.down()
  await page.mouse.move(tx + 160, ty + 80, { steps: 8 })
  await page.mouse.up()
  expect((await token()).x).not.toBe(400)

  expect(pageErrors).toEqual([])
})

test('botão Laser ligado arma: mover sem botão não desenha, clicar e arrastar desenha, desligar encerra', async ({ page }) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const h = await helpers(page)
  const cx = h.box.x + h.box.width / 2
  const cy = h.box.y + h.box.height / 2
  await page.mouse.move(cx, cy)

  await page.evaluate(async () => (await import('/src/stores/laserStore.ts')).useLaserStore.getState().setToggled(true))
  await expect.poll(h.cursor).toBe('crosshair')
  await page.mouse.move(cx + 150, cy + 50, { steps: 10 })
  await page.waitForTimeout(300)
  expect(await h.laser()).toMatchObject({ toggled: true, drawing: false, trail: 0 })
  expect(await h.drawn()).toBe(0)

  await page.mouse.down()
  await page.mouse.move(cx - 100, cy - 40, { steps: 10 })
  expect((await h.laser()).drawing).toBe(true)
  await expect.poll(h.drawn).toBeGreaterThan(2)
  // Desligar o botão com o mouse ainda pressionado encerra o traço.
  await page.evaluate(async () => (await import('/src/stores/laserStore.ts')).useLaserStore.getState().setToggled(false))
  expect((await h.laser()).drawing).toBe(false)
  await page.mouse.up()
  expect(await h.activeTool()).toBe('select')
  expect(await h.cursor()).not.toBe('crosshair')
  await expect(h.host).toHaveAttribute('data-laser-drawn', '0', { timeout: 3_000 })

  expect(pageErrors).toEqual([])
})
