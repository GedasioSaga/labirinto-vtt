// E2E da página do jogador (client/player.html) no navegador, SEM Tauri.
// O servidor axum é substituído por `page.routeWebSocket`, e o handler usa a
// sessão REAL do mestre (src/net/hostSession.ts): join, névoa no payload,
// validação de movimento com parede — tudo pela lógica de produção.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Token, Wall } from '../src/types/map'

const CODE = 'ABC123'
const GRID = 50
const MAP_W_CELLS = 20
const MAP_H_CELLS = 12
const WORLD_W = MAP_W_CELLS * GRID // 1000
const WORLD_H = MAP_H_CELLS * GRID // 600
const WALL_X = WORLD_W / 2
const FIT_MARGIN = 24 // igual a PlayerView.tsx
const VIEWPORT = { width: 1280, height: 800 } // playwright.config.ts

function token(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function buildMap(): MapData {
  const map = createEmptyMap('m-player', 'Teste jogador', MAP_W_CELLS, MAP_H_CELLS, GRID)
  const wall: Wall = { id: 'w-meio', x1: WALL_X, y1: 0, x2: WALL_X, y2: WORLD_H, blocksLight: true, blocksMove: true, door: null, thickness: 'thick' }
  // Portas no lado do jogador (blocksLight false: o ponto médio fica dentro da visão, não na borda dela).
  const locked: Wall = { id: 'w-porta-trancada', x1: 100, y1: 100, x2: 200, y2: 100, blocksLight: false, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }
  const open: Wall = { id: 'w-porta-aberta', x1: 100, y1: 500, x2: 200, y2: 500, blocksLight: false, blocksMove: false, door: { open: true, locked: false, kind: 'normal' } }
  return {
    ...map,
    floor: [{ id: 'f-chao', shape: { kind: 'rect', cx: WORLD_W / 2, cy: WORLD_H / 2, w: WORLD_W - 20, h: WORLD_H - 20 }, op: 'add', modifiers: {} }],
    walls: [wall, locked, open],
    tokens: [token('tok-a', 'Heroi', 250, 300), token('tok-b', 'Outro', 750, 300)],
  }
}

/** Mesmo enquadramento que PlayerView aplica no primeiro snapshot (fitCamera em pixi/world.ts). */
function worldToScreen(x: number, y: number): { x: number; y: number } {
  const scale = Math.min((VIEWPORT.width - FIT_MARGIN * 2) / WORLD_W, (VIEWPORT.height - FIT_MARGIN * 2) / WORLD_H)
  return { x: VIEWPORT.width / 2 + (x - WORLD_W / 2) * scale, y: VIEWPORT.height / 2 + (y - WORLD_H / 2) * scale }
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = worldToScreen(from.x, from.y)
  const b = worldToScreen(to.x, to.y)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 12 })
  await page.mouse.up()
}

test('página do jogador: espera, mapa com névoa, movimento aceito e bloqueado pela parede', async ({ page }) => {
  // ~11s sozinho, ~40s com 5 workers (raster por software do minimapa): 30s padrão estoura sob carga.
  test.setTimeout(90_000)
  let map = buildMap()
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const sent: HostMessage[] = []
  const received: unknown[] = []
  let playerId: string | null = null
  let socket: WebSocketRoute | null = null
  const CLIENT = 'c1'
  // Exceção no Pixi dentro do efeito desmonta o React inteiro (página branca): falha com a mensagem real.
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  const dispatch = (outbound: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of outbound) {
      if (clientId !== CLIENT || socket === null) continue
      sent.push(msg)
      socket.send(JSON.stringify(msg))
    }
  }

  // Só o /ws do jogador: o HMR do Vite usa outro caminho e segue para o servidor real.
  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8')
      const parsed: unknown = JSON.parse(text)
      received.push(parsed)
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

  // Sem node:path: o tsconfig.e2e.json não carrega @types/node.
  const shot = (name: string) => `${test.info().project.outputDir}/player-page/${name}.png`

  // 1. Entrar -> espera
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  expect(playerId).not.toBeNull()
  expect(received[0]).toEqual({ type: 'join', code: CODE, name: 'Ana' })
  await page.screenshot({ path: shot('espera') })

  // 2. Mestre atribui token A e transmite -> canvas, sem mensagem
  session.assignToken(playerId!, 'tok-a')
  dispatch(session.broadcast(map).outbound)
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  const snapshot = [...sent].reverse().find((m) => m.type === 'snapshot')
  expect(snapshot).toBeDefined()
  if (snapshot?.type !== 'snapshot') throw new Error('sem snapshot')
  const payload = JSON.stringify(snapshot.map)
  expect(payload).toContain('tok-a')
  expect(payload).not.toContain('tok-b') // névoa no payload, não só no render
  expect(snapshot.vision.length).toBe(1)
  expect(snapshot.map.walls.map((w) => w.id).sort()).toEqual(['w-meio', 'w-porta-aberta', 'w-porta-trancada'])
  const view = page.locator('[data-walls-count]')
  await expect(view).toHaveAttribute('data-walls-count', '3')
  await expect(view).toHaveAttribute('data-tokens-count', '1')
  // Deixa o Pixi desenhar o primeiro quadro antes do screenshot/arrasto.
  await page.waitForTimeout(300)
  await page.screenshot({ path: shot('mapa') })

  // 3. Arrasto válido na mesma área
  await drag(page, { x: 250, y: 300 }, { x: 350, y: 300 })
  await expect.poll(() => sent.some((m) => m.type === 'token.move.accepted')).toBe(true)
  const moves = received.filter((m): m is { type: string; tokenId: string; x: number; y: number } => (m as { type?: string }).type === 'token.move')
  expect(moves).toHaveLength(1)
  expect(moves[0]).toMatchObject({ tokenId: 'tok-a', x: 350, y: 300 })
  expect(map.tokens.find((t) => t.id === 'tok-a')).toMatchObject({ x: 350, y: 300 })
  expect(sent.some((m) => m.type === 'token.move.rejected' || m.type === 'error')).toBe(false)
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.waitForTimeout(200)
  await page.screenshot({ path: shot('depois-mover') })

  // 4. Arrasto cruzando a parede -> rejeitado, mapa do mestre intacto
  await drag(page, { x: 350, y: 300 }, { x: 650, y: 300 })
  await expect.poll(() => sent.find((m) => m.type === 'token.move.rejected')).toMatchObject({ type: 'token.move.rejected', reason: 'wall' })
  expect(map.tokens.find((t) => t.id === 'tok-a')).toMatchObject({ x: 350, y: 300 })
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)

  // 5. Depois da rejeição a página voltou o token: um novo arrasto a partir de 350,300 ainda pega o token.
  await drag(page, { x: 350, y: 300 }, { x: 350, y: 400 })
  await expect.poll(() => sent.filter((m) => m.type === 'token.move.accepted').length).toBe(2)
  expect(map.tokens.find((t) => t.id === 'tok-a')).toMatchObject({ x: 350, y: 400 })
  await expect(canvas).toBeVisible()

  // 6. Mestre traz o token B para a visão, esconde atrás da parede e traz de volta:
  // a view com `Text` some e volta sem exceção do Pixi (antes: TexturePool.returnTexture).
  const moveB = async (x: number, count: string) => {
    map = { ...map, tokens: map.tokens.map((t) => (t.id === 'tok-b' ? { ...t, x, y: 300 } : t)) }
    dispatch(session.broadcast(map).outbound)
    await expect(view).toHaveAttribute('data-tokens-count', count)
    await page.waitForTimeout(200) // renderiza o quadro com o estado novo
  }
  await moveB(150, '2')
  await moveB(750, '1')
  await moveB(150, '2')
  await moveB(750, '1')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
