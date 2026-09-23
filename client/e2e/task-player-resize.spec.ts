// Regressão: o canvas do jogador ficava preso no tamanho inicial quando o container
// mudava sem evento 'resize' da janela (o ResizePlugin do Pixi só escuta window).
// PlayerView observa o container com ResizeObserver e chama app.resize().
// O mestre é simulado com page.routeWebSocket + sessão real, como em task-player-page.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { MapData } from '../src/types/map'

const CODE = 'ABC123'
const CLIENT = 'c1'
const TOLERANCE_PX = 2

function buildMap(): MapData {
  return {
    ...createEmptyMap('m-resize', 'Resize jogador', 20, 12, 50),
    tokens: [{ id: 'tok-a', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null }],
  }
}

/** Retângulo do canvas e do container dele (o div do PlayerView). */
async function canvasAndContainer(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const container = canvas?.parentElement
    if (!canvas || !container) return null
    const c = canvas.getBoundingClientRect()
    const p = container.getBoundingClientRect()
    return { canvas: [c.width, c.height], container: [p.width, p.height] }
  })
}

async function expectCanvasCovers(page: Page, width: number, height: number) {
  await expect
    .poll(async () => {
      const r = await canvasAndContainer(page)
      if (r === null) return false
      const [cw, ch] = r.canvas
      const [pw, ph] = r.container
      return Math.abs(pw - width) <= TOLERANCE_PX && Math.abs(ph - height) <= TOLERANCE_PX && Math.abs(cw - pw) <= TOLERANCE_PX && Math.abs(ch - ph) <= TOLERANCE_PX
    })
    .toBe(true)
}

async function setContainerSize(page: Page, width: string, height: string) {
  await page.evaluate(
    ([w, h]) => {
      const container = document.querySelector('canvas')?.parentElement
      if (!container) throw new Error('container do canvas ausente')
      container.style.width = w
      container.style.height = h
    },
    [width, height],
  )
}

test('página do jogador: canvas acompanha o container sem evento resize da janela', async ({ page }) => {
  test.setTimeout(90_000)
  const map = buildMap()
  const session = createHostSession({ code: CODE, visionRadius: 2000 })
  let playerId: string | null = null
  let socket: WebSocketRoute | null = null

  const dispatch = (outbound: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of outbound) {
      if (clientId !== CLIENT || socket === null) continue
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') playerId = msg.playerId
    }
  }

  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8')
      dispatch(session.handleMessage(CLIENT, text, map).outbound)
    })
  })

  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  if (playerId === null) throw new Error('sem welcome')

  session.assignToken(playerId, 'tok-a')
  dispatch(session.broadcast(map).outbound)
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('[data-tokens-count]')).toHaveAttribute('data-tokens-count', '1')

  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('sem viewport')
  await expectCanvasCovers(page, viewport.width, viewport.height)

  // Encolhe só o container por CSS: a janela não recebe 'resize'.
  await setContainerSize(page, '640px', '360px')
  await expectCanvasCovers(page, 640, 360)

  // Solta o CSS: o container volta a cobrir a janela e o canvas precisa acompanhar.
  await setContainerSize(page, '', '')
  await expectCanvasCovers(page, viewport.width, viewport.height)
})
