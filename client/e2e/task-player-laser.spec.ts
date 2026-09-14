// E2E do laser do mestre na tela do jogador. Mestre simulado com
// page.routeWebSocket + sessão REAL (src/net/hostSession.ts), como em
// task-player-signal: a mensagem `laser` sai de `session.laser`, a mesma
// usada pelo hostBridge dentro do Tauri.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { LASER_TRAIL_MS } from '../src/lib/laser'
import type { HostMessage } from '../src/net/protocol'
import type { MapData } from '../src/types/map'

const CODE = 'ABC123'
const CLIENT = 'c1'

async function openPlayer(page: Page, map: () => MapData) {
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
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
      dispatch(session.handleMessage(CLIENT, text, map()).outbound)
    })
  })

  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  const id: string | null = playerId
  if (id === null) throw new Error('sem welcome')
  return { session, playerId: id, dispatch }
}

test('laser do mestre chega ao jogador, a ponta fica acesa enquanto ligado e o rastro some ~1 s depois do off', async ({ page }) => {
  test.setTimeout(60_000)
  const map: MapData = {
    ...createEmptyMap('m-laser', 'Laser', 20, 12, 50),
    tokens: [{ id: 'tok-a', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null }],
  }
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const host = await openPlayer(page, () => map)
  host.session.assignToken(host.playerId, 'tok-a')
  host.dispatch(host.session.broadcast(map).outbound)
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-tokens-count', '1')
  await expect(view).toHaveAttribute('data-laser-drawn', '0')
  const drawn = async () => Number(await view.getAttribute('data-laser-drawn'))

  // 1. Lote de pontos: o rastro aparece.
  host.dispatch(host.session.laser({ type: 'laser', points: [{ x: 300, y: 200 }, { x: 450, y: 260 }, { x: 600, y: 300 }, { x: 750, y: 280 }] }).outbound)
  await expect(view).toHaveAttribute('data-laser-points', '4')
  // Com o laser ligado a ponta sempre conta: o desenho aparece mesmo se os quadros do Pixi atrasarem sob carga.
  await expect.poll(drawn).toBeGreaterThanOrEqual(1)
  await page.screenshot({ path: `${test.info().project.outputDir}/player-laser/laser-rastro.png` })

  // 2. Ligado e parado: o rastro apaga, mas a ponta continua na tela.
  await page.waitForTimeout(LASER_TRAIL_MS + 400)
  await expect.poll(drawn).toBe(1)
  await expect(view).toHaveAttribute('data-laser-points', '1')

  // 3. Novo lote e off logo em seguida: não some na hora, some sozinho depois de ~1 s.
  // O observador anota no próprio elemento, com o relógio da página, quando viu
  // "desligado mas ainda com rastro" e quando o rastro sumiu. Fica armado ANTES
  // do lote e o off sai sem esperar quadro: qualquer espera no meio (quadro do
  // Pixi lento sob carga) pode passar de 1 s e expirar o lote antes do off.
  await view.evaluate((el) => {
    new MutationObserver(() => {
      const now = String(Date.now())
      if (el.dataset.laserOn === 'false' && el.dataset.laserPoints !== '0' && el.dataset.laserOffSeenAt === undefined) el.dataset.laserOffSeenAt = now
      if (el.dataset.laserPoints === '0' && el.dataset.laserClearedAt === undefined) el.dataset.laserClearedAt = now
    }).observe(el, { attributes: true, attributeFilter: ['data-laser-on', 'data-laser-points'] })
  })
  host.dispatch(host.session.laser({ type: 'laser', points: [{ x: 700, y: 400 }, { x: 800, y: 420 }] }).outbound)
  host.dispatch(host.session.laser({ type: 'laser', off: true }).outbound)
  await expect(view).toHaveAttribute('data-laser-cleared-at', /^\d+$/, { timeout: LASER_TRAIL_MS * 5 })
  const offSeenAt = await view.getAttribute('data-laser-off-seen-at')
  expect(offSeenAt).toMatch(/^\d+$/)
  const clearedAt = Number(await view.getAttribute('data-laser-cleared-at'))
  expect(clearedAt - Number(offSeenAt)).toBeGreaterThanOrEqual(LASER_TRAIL_MS * 0.8)
  await expect(view).toHaveAttribute('data-laser-drawn', '0', { timeout: LASER_TRAIL_MS * 3 })

  expect(pageErrors).toEqual([])
})
