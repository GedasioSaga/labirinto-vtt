// Nitidez em tela com escala (Windows 125%/150%): o canvas do Pixi tem de ter
// backbuffer em pixels FÍSICOS (autoDensity + resolution = devicePixelRatio) e,
// mesmo assim, clique e arrasto continuam em pixels CSS — o token certo é
// selecionado e vai para a posição certa. Antes o backbuffer era 1:1 com o CSS
// e o sistema esticava a imagem (linhas e textos borrados).
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Token } from '../src/types/map'

const DPR = 1.25
test.use({ deviceScaleFactor: DPR })

type CanvasDensity = { dpr: number; cssWidth: number; cssHeight: number; width: number; height: number }

async function canvasDensity(page: Page): Promise<CanvasDensity> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) throw new Error('canvas ausente')
    const rect = canvas.getBoundingClientRect()
    return { dpr: window.devicePixelRatio, cssWidth: rect.width, cssHeight: rect.height, width: canvas.width, height: canvas.height }
  })
}

function expectPhysicalBackbuffer(density: CanvasDensity, dpr: number) {
  expect(density.dpr).toBe(dpr)
  expect(density.cssWidth).toBeGreaterThan(0)
  expect(density.width).toBe(Math.round(density.cssWidth * dpr))
  expect(density.height).toBe(Math.round(density.cssHeight * dpr))
}

test.describe('editor', () => {
  test.beforeEach(async ({ page }) => {
    await enterEditor(page)
    await page.evaluate(async () => {
      const mapFactory = await import('/src/lib/mapFactory.ts')
      const mod = await import('/src/stores/mapStore.ts')
      mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_dpr', 'E2E DPR', 30, 20, 64))
      mod.useMapStore.getState().setActiveTool('select')
    })
    // Ctrl+0: câmera (0,0,1), então 1 px CSS do canvas = 1 px de mundo.
    await page.keyboard.press('Control+0')
    await expect(page.getByRole('button', { name: 'Zoom: 100%', exact: true })).toBeVisible()
  })

  test('1. backbuffer em pixels físicos; clique seleciona o token certo e o arrasto o leva ao ponto certo', async ({ page }) => {
    expectPhysicalBackbuffer(await canvasDensity(page), DPR)

    // Dois tokens vizinhos: com coordenada escalada errada (x1,25) o clique em A cairia em B ou no vazio.
    await page.evaluate(async () => {
      const mod = await import('/src/stores/mapStore.ts')
      const state = mod.useMapStore.getState()
      state.addToken({ id: 'tokA', characterId: null, name: 'A', x: 416, y: 416, size: 1, image: null })
      state.addToken({ id: 'tokB', characterId: null, name: 'B', x: 544, y: 544, size: 1, image: null })
    })
    const box = await page.locator('canvas').boundingBox()
    if (!box) throw new Error('canvas sem bounding box')

    const selection = () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection)
    await page.mouse.click(box.x + 544, box.y + 544)
    await expect.poll(selection).toEqual([{ kind: 'token', id: 'tokB' }])
    await page.mouse.click(box.x + 416, box.y + 416)
    await expect.poll(selection).toEqual([{ kind: 'token', id: 'tokA' }])

    // Arrasto de A de (416,416) para o centro de célula (736,416).
    await page.mouse.move(box.x + 416, box.y + 416)
    await page.mouse.down()
    await page.mouse.move(box.x + 576, box.y + 416, { steps: 6 })
    await page.mouse.move(box.x + 736, box.y + 416, { steps: 6 })
    await page.mouse.up()

    const tokens = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.tokens)
    const moved = tokens.find((t: Token) => t.id === 'tokA')
    expect(moved?.x).toBeCloseTo(736, 0)
    expect(moved?.y).toBeCloseTo(416, 0)
    expect(tokens.find((t: Token) => t.id === 'tokB')).toMatchObject({ x: 544, y: 544 })
  })

  test('2. troca de devicePixelRatio em execução (outro monitor): backbuffer acompanha', async ({ page }) => {
    expectPhysicalBackbuffer(await canvasDensity(page), DPR)
    const cdp = await page.context().newCDPSession(page)
    // A emulação de escala do Chromium muda devicePixelRatio e `matches` da media
    // query, mas não emite 'change' nem 'resize' (medido). Numa troca real de
    // monitor o navegador emite; aqui o evento é disparado à mão e o app lê o
    // devicePixelRatio REAL (2) pelo mesmo caminho de produção.
    const switchTo = async (deviceScaleFactor: number) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor, mobile: false })
      await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    }
    await switchTo(2)
    await expect.poll(async () => {
      const d = await canvasDensity(page)
      return d.dpr === 2 && d.width === Math.round(d.cssWidth * 2) && d.height === Math.round(d.cssHeight * 2)
    }).toBe(true)
    await switchTo(DPR)
    await expect.poll(async () => {
      const d = await canvasDensity(page)
      return d.dpr === DPR && d.width === Math.round(d.cssWidth * DPR)
    }).toBe(true)
  })
})

// Jogador: mesmo arranjo de task-player-page.spec.ts (sessão real do mestre atrás de routeWebSocket).
const CODE = 'ABC123'
const GRID = 50
const WORLD_W = 1000
const WORLD_H = 600
const FIT_MARGIN = 24 // igual a PlayerView.tsx
const VIEWPORT = { width: 1280, height: 800 } // playwright.config.ts

function worldToScreen(x: number, y: number): { x: number; y: number } {
  const scale = Math.min((VIEWPORT.width - FIT_MARGIN * 2) / WORLD_W, (VIEWPORT.height - FIT_MARGIN * 2) / WORLD_H)
  return { x: VIEWPORT.width / 2 + (x - WORLD_W / 2) * scale, y: VIEWPORT.height / 2 + (y - WORLD_H / 2) * scale }
}

function buildPlayerMap(): MapData {
  const map = createEmptyMap('m-dpr', 'Jogador DPR', WORLD_W / GRID, WORLD_H / GRID, GRID)
  return {
    ...map,
    floor: [{ id: 'f-chao', shape: { kind: 'rect', cx: WORLD_W / 2, cy: WORLD_H / 2, w: WORLD_W - 20, h: WORLD_H - 20 }, op: 'add', modifiers: {} }],
    tokens: [{ id: 'tok-a', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null }],
  }
}

test('3. jogador: backbuffer em pixels físicos e arrasto leva o token ao ponto certo', async ({ page }) => {
  test.setTimeout(90_000)
  let map = buildPlayerMap()
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const sent: HostMessage[] = []
  let playerId: string | null = null
  let socket: WebSocketRoute | null = null
  const CLIENT = 'c1'
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  const dispatch = (outbound: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of outbound) {
      if (clientId !== CLIENT || socket === null) continue
      sent.push(msg)
      socket.send(JSON.stringify(msg))
    }
  }
  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8')
      const result = session.handleMessage(CLIENT, text, map)
      dispatch(result.outbound)
      for (const { msg } of result.outbound) if (msg.type === 'welcome') playerId = msg.playerId
      if (result.applyMove) {
        const { tokenId, x, y } = result.applyMove
        map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
        dispatch(session.broadcast(map).outbound)
      }
    })
  })

  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  expect(playerId).not.toBeNull()
  session.assignToken(playerId!, 'tok-a')
  dispatch(session.broadcast(map).outbound)
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('[data-tokens-count]')).toHaveAttribute('data-tokens-count', '1')
  await page.waitForTimeout(300)

  expectPhysicalBackbuffer(await canvasDensity(page), DPR)

  const a = worldToScreen(250, 300)
  const b = worldToScreen(350, 300)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => sent.some((m) => m.type === 'token.move.accepted')).toBe(true)
  expect(map.tokens.find((t) => t.id === 'tok-a')).toMatchObject({ x: 350, y: 300 })
  expect(pageErrors).toEqual([])
})
