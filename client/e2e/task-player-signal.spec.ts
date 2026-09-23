// E2E do sinal (ping de mapa) do jogador. Mestre simulado com
// page.routeWebSocket + sessão REAL (src/net/hostSession.ts), como em
// task-player-map: quem decide o que chega a cada jogador é a lógica de
// produção. O relógio da sessão é controlado para o limite de 1 sinal/s.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession, type HostSignal } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { SIGNAL_MIN_INTERVAL_MS } from '../src/lib/signals'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Region, Token, Wall } from '../src/types/map'

const CODE = 'ABC123'
const GRID = 50
const WORLD_W = 20 * GRID // 1000
const WORLD_H = 12 * GRID // 600
const CLIENT = 'c1'
const OTHER_CLIENT = 'c2'
/** Igual a FIT_MARGIN de PlayerView.tsx: a câmera inicial enquadra o mapa com essa margem. */
const PLAYER_FIT_MARGIN = 24
/** Tolerância em px de mundo: 1 px de tela vale ~0,8 px de mundo, mais o arredondamento do envio. */
const WORLD_TOLERANCE = 3

function token(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function room(id: string, name: string, x1: number, x2: number): Region {
  const points = [
    { x: x1, y: 50 },
    { x: x2, y: 50 },
    { x: x2, y: WORLD_H - 50 },
    { x: x1, y: WORLD_H - 50 },
  ]
  return { id, points, tag: '', fillColor: '#5a4a3a', fillPattern: 'solid', data: {}, room: { shape: 'rect', name } }
}

function wall(id: string, y1: number, y2: number, door: Wall['door']): Wall {
  return { id, x1: WORLD_W / 2, y1, x2: WORLD_W / 2, y2, blocksLight: true, blocksMove: true, door, thickness: 'thick' }
}

/** Mestre falso: sessão real, relógio manual, e só o que vai para CLIENT chega à página. */
async function openPlayer(page: Page, map: () => MapData) {
  let clock = 0
  const session = createHostSession({ code: CODE, visionRadius: 2000, now: () => clock, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const toPage: HostMessage[] = []
  const signals: HostSignal[] = []
  let playerId: string | null = null
  let socket: WebSocketRoute | null = null

  const dispatch = (outbound: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of outbound) {
      if (clientId !== CLIENT || socket === null) continue
      toPage.push(msg)
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') playerId = msg.playerId
    }
  }

  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8')
      const result = session.handleMessage(CLIENT, text, map())
      if (result.signal !== undefined) signals.push(result.signal)
      dispatch(result.outbound)
    })
  })

  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  const id: string | null = playerId
  if (id === null) throw new Error('sem welcome')

  return {
    session,
    playerId: id,
    toPage,
    signals,
    dispatch,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

test('jogador sinaliza por botão, Alt+clique e segurar parado; o mestre recebe cada sinal', async ({ page }) => {
  test.setTimeout(90_000)
  const map: MapData = { ...createEmptyMap('m-sinal', 'Sinal', 20, 12, GRID), tokens: [token('tok-a', 'Heroi', 250, 300)] }
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const host = await openPlayer(page, () => map)
  host.session.assignToken(host.playerId, 'tok-a')
  host.dispatch(host.session.broadcast(map).outbound)
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-tokens-count', '1')
  await page.waitForTimeout(300) // primeiro quadro do Pixi

  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('sem viewport')
  const scale = Math.min((viewport.width - PLAYER_FIT_MARGIN * 2) / WORLD_W, (viewport.height - PLAYER_FIT_MARGIN * 2) / WORLD_H)
  const toScreen = (x: number, y: number) => ({
    x: viewport.width / 2 + (x - WORLD_W / 2) * scale,
    y: viewport.height / 2 + (y - WORLD_H / 2) * scale,
  })
  const expectSignalNear = (index: number, x: number, y: number) => {
    const signal = host.signals[index]
    expect(signal).toMatchObject({ playerId: host.playerId, name: 'Ana' })
    expect(Math.abs((signal?.x ?? Infinity) - x)).toBeLessThanOrEqual(WORLD_TOLERANCE)
    expect(Math.abs((signal?.y ?? Infinity) - y)).toBeLessThanOrEqual(WORLD_TOLERANCE)
  }

  // 1. Botão "Sinalizar": um toque no mapa, e o modo desliga sozinho.
  await page.getByRole('button', { name: 'Sinalizar' }).click()
  await expect(page.getByRole('button', { name: 'Toque no mapa…' })).toHaveAttribute('aria-pressed', 'true')
  const first = toScreen(600, 300)
  await page.mouse.click(first.x, first.y)
  await expect.poll(() => host.signals.length).toBe(1)
  expectSignalNear(0, 600, 300)
  await expect(page.getByRole('button', { name: 'Sinalizar' })).toHaveAttribute('aria-pressed', 'false')
  // O eco do mestre desenha o sinal na tela do próprio jogador.
  await expect(view).toHaveAttribute('data-signals-count', '1')
  await expect(view).toHaveAttribute('data-signals-drawn', '1')
  expect(host.toPage.filter((m) => m.type === 'signal')).toEqual([expect.objectContaining({ from: 'Ana' })])
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${test.info().project.outputDir}/player-signal/sinal-botao.png` })

  // 2. Alt+clique, sem o botão.
  host.advance(SIGNAL_MIN_INTERVAL_MS)
  const second = toScreen(700, 200)
  await page.locator('canvas').click({ position: second, modifiers: ['Alt'] })
  await expect.poll(() => host.signals.length).toBe(2)
  expectSignalNear(1, 700, 200)

  // 3. Clique curto normal NÃO sinaliza (controle do "segurar parado").
  host.advance(SIGNAL_MIN_INTERVAL_MS)
  const short = toScreen(800, 450)
  await page.mouse.click(short.x, short.y)
  await page.waitForTimeout(900)
  expect(host.signals).toHaveLength(2)

  // 4. Segurar parado ~0,5 s sinaliza.
  const hold = toScreen(400, 450)
  await page.mouse.move(hold.x, hold.y)
  await page.mouse.down()
  await page.waitForTimeout(800)
  await page.mouse.up()
  await expect.poll(() => host.signals.length).toBe(3)
  expectSignalNear(2, 400, 450)

  expect(pageErrors).toEqual([])
})

test('sinal de outro jogador só aparece em área que o jogador já conhece, e some em 3 s', async ({ page }) => {
  test.setTimeout(90_000)
  // Sala A (Ana) e sala B (Bia) separadas por parede com porta fechada: Ana nunca viu a B.
  const map: MapData = {
    ...createEmptyMap('m-sinal-2', 'Sinal repassado', 20, 12, GRID),
    regions: [room('r-a', 'Salão', 50, 450), room('r-b', 'Biblioteca', 550, 950)],
    walls: [wall('w-cima', 0, 250, null), wall('w-porta', 250, 350, { open: false, locked: false, kind: 'normal' }), wall('w-baixo', 350, WORLD_H, null)],
    tokens: [token('tok-a', 'Heroi', 250, 430), token('tok-b', 'Maga', 750, 300)],
  }
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const host = await openPlayer(page, () => map)
  const bia = host.session.handleMessage(OTHER_CLIENT, JSON.stringify({ type: 'join', code: CODE, name: 'Bia' }), map)
  const biaWelcome = bia.outbound.find((o) => o.msg.type === 'welcome')?.msg
  if (biaWelcome?.type !== 'welcome') throw new Error('Bia sem welcome')
  host.session.assignToken(biaWelcome.playerId, 'tok-b')
  host.session.assignToken(host.playerId, 'tok-a')
  host.dispatch(host.session.broadcast(map).outbound)
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-own-tokens', 'tok-a')
  await expect(view).toHaveAttribute('data-signals-count', '0')

  // 1. Bia sinaliza na sala B: nada sai para a Ana, nem no payload.
  const hidden = host.session.handleMessage(OTHER_CLIENT, JSON.stringify({ type: 'signal', x: 750, y: 200 }), map)
  expect(hidden.signal).toMatchObject({ name: 'Bia', x: 750, y: 200 })
  expect(JSON.stringify(hidden.outbound.filter((o) => o.clientId === CLIENT))).toBe('[]')
  host.dispatch(hidden.outbound)
  await page.waitForTimeout(500)
  await expect(view).toHaveAttribute('data-signals-count', '0')
  expect(JSON.stringify(host.toPage)).not.toContain('"signal"')

  // 2. Controle positivo: Bia sinaliza na sala A (que a Ana vê) e aparece para a Ana.
  host.advance(SIGNAL_MIN_INTERVAL_MS)
  const known = host.session.handleMessage(OTHER_CLIENT, JSON.stringify({ type: 'signal', x: 250, y: 200 }), map)
  host.dispatch(known.outbound)
  await expect(view).toHaveAttribute('data-signals-count', '1')
  expect(host.toPage.filter((m) => m.type === 'signal')).toEqual([expect.objectContaining({ x: 250, y: 200, from: 'Bia' })])

  // 3. Some sozinho depois de ~3 s.
  await expect(view).toHaveAttribute('data-signals-count', '0', { timeout: 6_000 })
  expect(pageErrors).toEqual([])
})
