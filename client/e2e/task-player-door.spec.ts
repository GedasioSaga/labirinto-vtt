// E2E do jogador abrindo porta (item 2a de PEDIDOS.md, P10). Mesmo padrão de
// task-player-page.spec.ts: `page.routeWebSocket` no lugar do servidor axum e a
// sessão REAL do mestre (src/net/hostSession.ts) validando cada pedido.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession, DOOR_TOGGLE_MIN_INTERVAL_MS } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Token, Wall } from '../src/types/map'

const CODE = 'ABC123'
const GRID = 50
const MAP_W_CELLS = 20
const MAP_H_CELLS = 12
const WORLD_W = MAP_W_CELLS * GRID // 1000
const WORLD_H = MAP_H_CELLS * GRID // 600
const FIT_MARGIN = 24 // igual a PlayerView.tsx
const VIEWPORT = { width: 1280, height: 800 } // playwright.config.ts

/** Parede vertical em x=500 partida por uma porta destrancada (y 280..320). */
const DOOR_X = 500
const DOOR_Y1 = 280
const DOOR_Y2 = 320
const DOOR_MIDDLE = { x: DOOR_X, y: (DOOR_Y1 + DOOR_Y2) / 2 }
/** Porta trancada, também ao alcance do token parado em (450, 300). */
const LOCKED_MIDDLE = { x: 440, y: 360 }

function token(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function buildMap(): MapData {
  const map = createEmptyMap('m-porta', 'Teste porta', MAP_W_CELLS, MAP_H_CELLS, GRID)
  const acima: Wall = { id: 'w-acima', x1: DOOR_X, y1: 0, x2: DOOR_X, y2: DOOR_Y1, blocksLight: true, blocksMove: true, door: null }
  // blocksLight false na porta: o ponto médio dela fica DENTRO da visão, não na borda.
  const porta: Wall = { id: 'w-porta', x1: DOOR_X, y1: DOOR_Y1, x2: DOOR_X, y2: DOOR_Y2, blocksLight: false, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
  const abaixo: Wall = { id: 'w-abaixo', x1: DOOR_X, y1: DOOR_Y2, x2: DOOR_X, y2: WORLD_H, blocksLight: true, blocksMove: true, door: null }
  const trancada: Wall = { id: 'w-trancada', x1: 420, y1: 360, x2: 460, y2: 360, blocksLight: false, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }
  return {
    ...map,
    floor: [{ id: 'f-chao', shape: { kind: 'rect', cx: WORLD_W / 2, cy: WORLD_H / 2, w: WORLD_W - 20, h: WORLD_H - 20 }, op: 'add', modifiers: {} }],
    walls: [acima, porta, abaixo, trancada],
    tokens: [token('tok-a', 'Heroi', 450, 300)],
  }
}

/** Mesmo enquadramento que PlayerView aplica no primeiro snapshot (fitCamera em pixi/world.ts). */
function worldToScreen(x: number, y: number): { x: number; y: number } {
  const scale = Math.min((VIEWPORT.width - FIT_MARGIN * 2) / WORLD_W, (VIEWPORT.height - FIT_MARGIN * 2) / WORLD_H)
  return { x: VIEWPORT.width / 2 + (x - WORLD_W / 2) * scale, y: VIEWPORT.height / 2 + (y - WORLD_H / 2) * scale }
}

async function tap(page: Page, world: { x: number; y: number }) {
  const point = worldToScreen(world.x, world.y)
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.up()
}

/**
 * Toca na porta até o host responder. Sob 4 workers o quadro do Pixi atrasa e o
 * mesmo toque pode (a) demorar entre down e up e virar "segurar parado" (sinal,
 * ver SIGNAL_LONG_PRESS_MS) ou (b) cair na janela de DOOR_TOGGLE_MIN_INTERVAL_MS
 * do pedido anterior, que o host descarta em silêncio de propósito. As duas
 * coisas somem num toque de gente de verdade; aqui o retry evita teste instável.
 */
async function tapUntil(page: Page, world: { x: number; y: number }, done: () => boolean, what: string) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await tap(page, world)
    for (let wait = 0; wait < 25; wait += 1) {
      if (done()) return
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(DOOR_TOGGLE_MIN_INTERVAL_MS * 2)
  }
  throw new Error(`o host nunca respondeu ao toque na porta (${what})`)
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = worldToScreen(from.x, from.y)
  const b = worldToScreen(to.x, to.y)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 12 })
  await page.mouse.up()
}

test('jogador toca na porta encostada, ela abre para todos, entra em diagonal; trancada só avisa', async ({ page }) => {
  // Mesmo motivo de task-player-page.spec.ts: raster do minimapa por software satura com 4 workers.
  test.setTimeout(120_000)
  let map = buildMap()
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const sent: HostMessage[] = []
  const received: { type?: string }[] = []
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
      received.push(JSON.parse(text) as { type?: string })
      const result = session.handleMessage(CLIENT, text, map)
      dispatch(result.outbound)
      for (const { msg } of result.outbound) if (msg.type === 'welcome') playerId = msg.playerId
      if (result.applyMove) {
        const { tokenId, x, y } = result.applyMove
        map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
        dispatch(session.broadcast(map).outbound)
      }
      // Igual ao App do mestre (net/hostBridge.ts): aplica no mapa e transmite para todos.
      if (result.applyDoor) {
        const { wallId, open } = result.applyDoor
        map = { ...map, walls: map.walls.map((w) => (w.id === wallId && w.door ? { ...w, door: { ...w.door, open } } : w)) }
        dispatch(session.broadcast(map).outbound)
      }
    })
  })

  const shot = (name: string) => `${test.info().project.outputDir}/player-door/${name}.png`
  const doorOf = (id: string) => map.walls.find((w) => w.id === id)?.door
  const rejected = (reason: string) => sent.some((m) => m.type === 'door.toggle.rejected' && m.reason === reason)

  // 1. Entrar e receber o personagem
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  expect(playerId).not.toBeNull()
  session.assignToken(playerId!, 'tok-a')
  dispatch(session.broadcast(map).outbound)
  const view = page.locator('[data-walls-count]')
  await expect(view).toHaveAttribute('data-tokens-count', '1')

  // 2. Destaque: só a porta destrancada ao alcance do token ganha halo.
  await expect(view).toHaveAttribute('data-door-hints', '1')
  await page.waitForTimeout(300)
  await page.screenshot({ path: shot('1-porta-fechada-com-destaque') })

  // 3. Toque na porta: o mestre valida e ela abre para todos.
  await tapUntil(page, DOOR_MIDDLE, () => doorOf('w-porta')?.open === true, 'abrir')
  expect(sent.some((m) => m.type === 'door.toggle.rejected')).toBe(false)
  await page.waitForTimeout(300)
  await page.screenshot({ path: shot('2-porta-aberta') })

  // 4. Entrar em diagonal pelo vão: o traço reto passa 4 px abaixo do vão e antes era recusado.
  await drag(page, { x: 450, y: 300 }, { x: 600, y: 360 })
  await expect.poll(() => map.tokens.find((t) => t.id === 'tok-a'), { timeout: 15_000 }).toMatchObject({ x: 600, y: 360 })
  expect(sent.some((m) => m.type === 'token.move.rejected')).toBe(false)
  await page.waitForTimeout(300)
  await page.screenshot({ path: shot('3-entrou-em-diagonal') })

  // 5. Token de volta ao lado da porta trancada: tocar nela só avisa "Trancada".
  await drag(page, { x: 600, y: 360 }, { x: 450, y: 300 })
  await expect.poll(() => map.tokens.find((t) => t.id === 'tok-a'), { timeout: 15_000 }).toMatchObject({ x: 450, y: 300 })
  await tapUntil(page, LOCKED_MIDDLE, () => rejected('locked'), 'trancada')
  // O aviso vive DOOR_NOTICE_TTL_MS na tela: asserção logo depois da recusa chegar.
  await expect(page.getByRole('status')).toHaveText('Trancada')
  expect(doorOf('w-trancada')).toMatchObject({ open: false, locked: true })
  await page.screenshot({ path: shot('4-trancada') })

  // 6. Fechar a porta de novo (mesmo toque, porta aberta perto do token).
  await page.waitForTimeout(DOOR_TOGGLE_MIN_INTERVAL_MS * 2)
  await tapUntil(page, DOOR_MIDDLE, () => doorOf('w-porta')?.open === false, 'fechar')
  await page.screenshot({ path: shot('5-porta-fechada-de-novo') })

  // Diagnóstico de UX, sem falhar o teste: quantos toques viraram sinal por demora entre down e up.
  console.log('sinais enviados por toque demorado:', received.filter((m) => m.type === 'signal').length)
  expect(pageErrors).toEqual([])
})
