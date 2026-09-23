// E2E da tela do jogador, parte 1: cor das salas, nomes, porta, texto, névoa
// com memória e painel. Mestre simulado com page.routeWebSocket + sessão REAL
// (src/net/hostSession.ts), como em task-player-page.spec.ts: o que sai no
// payload é decidido pela lógica de produção, não pelo teste.
import { test, expect, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { Drawing, MapData, Region, Token, Wall } from '../src/types/map'

const CODE = 'ABC123'
const GRID = 50
const WORLD_W = 20 * GRID // 1000
const WORLD_H = 12 * GRID // 600
const MID_X = WORLD_W / 2
const CLIENT = 'c1'
const OTHER_CLIENT = 'c2'
const SETTINGS_KEY = 'labirinto.jogador.ajustes' // igual a PlayerPanel.tsx

function token(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function room(id: string, name: string, fillColor: string, x1: number, x2: number): Region {
  const points = [
    { x: x1, y: 50 },
    { x: x2, y: 50 },
    { x: x2, y: WORLD_H - 50 },
    { x: x1, y: WORLD_H - 50 },
  ]
  return { id, points, tag: '', fillColor, fillPattern: 'solid', data: {}, room: { shape: 'rect', name } }
}

function wall(id: string, y1: number, y2: number, door: Wall['door']): Wall {
  return { id, x1: MID_X, y1, x2: MID_X, y2, blocksLight: true, blocksMove: true, door, thickness: 'thick' }
}

/** Duas salas lado a lado, separadas por uma parede com porta fechada no meio: da sala A não se vê a B. */
function buildMap(): MapData {
  // Texto e tokens fora do centróide das salas (onde fica o nome) e à direita do painel, para o screenshot mostrar tudo.
  const text: Drawing = { id: 'd-texto', kind: 'text', x: 300, y: 130, text: 'Altar antigo', color: '#f5e6b8', fontSize: 22 }
  return {
    ...createEmptyMap('m-mapa', 'Tela do jogador', 20, 12, GRID),
    regions: [room('r-a', 'Salão', '#7a4b2a', 50, 450), room('r-b', 'Biblioteca', '#2f5d50', 550, 950)],
    walls: [
      wall('w-cima', 0, 250, null),
      wall('w-porta', 250, 350, { open: false, locked: false, kind: 'normal' }),
      wall('w-baixo', 350, WORLD_H, null),
    ],
    drawings: [text],
    tokens: [token('tok-a', 'Heroi', 250, 430), token('tok-c', 'Espiao', 380, 480)],
  }
}

test('tela do jogador: salas coloridas, explorado persiste e token alheio fora da visão não vaza', async ({ page }) => {
  // Raster/vision por software sob 5 workers: mesmo folga de task-player-page.
  test.setTimeout(90_000)
  let map = buildMap()
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const sent: HostMessage[] = []
  let playerId: string | null = null
  let socket: WebSocketRoute | null = null
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  const dispatch = (outbound: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of outbound) {
      if (clientId !== CLIENT || socket === null) continue
      sent.push(msg)
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') playerId = msg.playerId
    }
  }
  const lastSnapshot = () => {
    const snapshot = [...sent].reverse().find((m) => m.type === 'snapshot')
    if (snapshot?.type !== 'snapshot') throw new Error('sem snapshot')
    return snapshot
  }

  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8')
      dispatch(session.handleMessage(CLIENT, text, map).outbound)
    })
  })

  // Sem node:path: o tsconfig.e2e.json não carrega @types/node.
  const shot = (name: string) => `${test.info().project.outputDir}/player-map/${name}.png`

  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  if (playerId === null) throw new Error('sem welcome')

  // Outro jogador (Bia) entra por outra conexão e fica com o Espião, parado na sala A.
  const other = session.handleMessage(OTHER_CLIENT, JSON.stringify({ type: 'join', code: CODE, name: 'Bia' }), map)
  const otherWelcome = other.outbound.find((o) => o.msg.type === 'welcome')?.msg
  if (otherWelcome?.type !== 'welcome') throw new Error('Bia sem welcome')
  session.assignToken(otherWelcome.playerId, 'tok-c')

  // 1. Heroi na sala A: vê a sala A, o texto e o Espião; a sala B está atrás da porta fechada.
  session.assignToken(playerId, 'tok-a')
  dispatch(session.broadcast(map).outbound)
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-regions-count', '1')
  await expect(view).toHaveAttribute('data-labels-count', '1')
  await expect(view).toHaveAttribute('data-tokens-count', '2')
  await expect(view).toHaveAttribute('data-own-tokens', 'tok-a')
  expect(lastSnapshot().map.regions.map((r) => r.id)).toEqual(['r-a'])
  const cellsBefore = Number(await view.getAttribute('data-explored-cells'))
  expect(cellsBefore).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Centralizar em Heroi' })).toBeVisible()
  await page.waitForTimeout(400) // primeiro quadro do Pixi antes do screenshot
  await page.screenshot({ path: shot('antes-sala-a') })

  // 2. Mestre leva o Heroi para a sala B. A sala A e o texto continuam (explorados),
  // o explorado cresce e o Espião, agora fora da visão, não aparece nem no payload.
  map = { ...map, tokens: map.tokens.map((t) => (t.id === 'tok-a' ? { ...t, x: 750, y: 430 } : t)) }
  dispatch(session.broadcast(map).outbound)
  await expect(view).toHaveAttribute('data-regions-count', '2')
  await expect(view).toHaveAttribute('data-tokens-count', '1')
  await expect(view).toHaveAttribute('data-labels-count', '1')
  await expect.poll(async () => Number(await view.getAttribute('data-explored-cells'))).toBeGreaterThan(cellsBefore)
  const after = lastSnapshot()
  expect(after.map.regions.map((r) => r.id).sort()).toEqual(['r-a', 'r-b'])
  const payload = JSON.stringify(after)
  expect(payload).not.toContain('tok-c')
  expect(payload).not.toContain('Espiao')
  await page.waitForTimeout(400)
  await page.screenshot({ path: shot('depois-sala-b') })

  // 3. Painel: centralizar, brilho, grade e nomes salvos em localStorage.
  await page.getByRole('button', { name: 'Centralizar no meu personagem' }).click()
  await page.getByLabel('Brilho do explorado').fill('0.8')
  await page.getByLabel('Grade').uncheck()
  await page.getByLabel('Nomes').uncheck()
  const saved = await page.evaluate((key) => localStorage.getItem(key), SETTINGS_KEY)
  expect(JSON.parse(saved ?? 'null')).toEqual({ exploredBrightness: 0.8, showGrid: false, showNames: false })
  await page.waitForTimeout(300)
  await page.screenshot({ path: shot('painel-ajustado') })

  // 4. Tela estreita: o painel vira gaveta atrás de um botão.
  await page.setViewportSize({ width: 480, height: 800 })
  const panel = page.getByRole('complementary', { name: 'Painel do jogador' })
  await expect(panel).toBeHidden()
  const toggle = page.getByRole('button', { name: 'Painel' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
