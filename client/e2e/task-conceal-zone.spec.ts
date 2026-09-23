// E2E de A5 (plano valiant-enchanting-patterson.md): zona oculta.
//  1. Tela do jogador: zona ativa sobre a metade de cima de uma sala. O token
//     alheio do lado oculto não sai no payload nem aparece, e o preto é
//     desenhado; depois de "Revelar" o token aparece e o preto some. Mestre
//     simulado com page.routeWebSocket + sessão REAL (src/net/hostSession.ts),
//     como task-player-map.spec.ts.
//  2. Editor: a ferramenta "Zona oculta" cria a zona por arrasto, sem paredes,
//     e o painel edita "Revelar para jogadores" e exclui.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { ConcealZone, MapData, Region, Token } from '../src/types/map'
import { enterEditor } from './helpers/enterEditor'

const CODE = 'ZON123'
const GRID = 50
const WORLD_W = 20 * GRID // 1000
const WORLD_H = 12 * GRID // 600
const CLIENT = 'c1'
const OTHER_CLIENT = 'c2'
/** Linha que divide a sala: acima dela fica a zona oculta. */
const ZONE_BOTTOM = 300
/** Ponto de amostra dentro da zona e à direita (o painel do jogador fica à esquerda). */
const PROBE_ZONE = { x: 800, y: 175 }
/** Mesmo x, na metade visível da sala. */
const PROBE_OPEN = { x: 800, y: 450 }
const FIT_MARGIN = 24 // igual a PlayerView.tsx

function token(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function buildMap(revealed: boolean): MapData {
  const room: Region = {
    id: 'r-salao',
    points: [
      { x: 50, y: 50 },
      { x: 950, y: 50 },
      { x: 950, y: 550 },
      { x: 50, y: 550 },
    ],
    tag: '',
    fillColor: '#7a4b2a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Salão' },
  }
  const zone: ConcealZone = {
    id: 'zona-e2e',
    name: 'Galeria escondida',
    revealed,
    points: [
      { x: 50, y: 50 },
      { x: 950, y: 50 },
      { x: 950, y: ZONE_BOTTOM },
      { x: 50, y: ZONE_BOTTOM },
    ],
  }
  return {
    ...createEmptyMap('m-zona', 'Zona oculta', 20, 12, GRID),
    regions: [room],
    tokens: [token('tok-a', 'Heroi', 500, 450), token('tok-c', 'Espiao', 600, 150)],
    concealZones: [zone],
  }
}

/** Cor [r,g,b] de um ponto de mundo na tela do jogador, pela mesma conta de câmera do PlayerView (fitCamera no primeiro quadro). */
async function worldPixel(page: Page, world: { x: number; y: number }): Promise<[number, number, number]> {
  const screen = await page.evaluate(
    async ({ world, width, height, margin }) => {
      const mod = await import('/src/pixi/world.ts')
      const camera = mod.fitCamera(
        { minX: 0, minY: 0, maxX: width, maxY: height },
        { width: window.innerWidth, height: window.innerHeight },
        margin,
      )
      return { x: Math.round(world.x * camera.scale + camera.x), y: Math.round(world.y * camera.scale + camera.y) }
    },
    { world, width: WORLD_W, height: WORLD_H, margin: FIT_MARGIN },
  )
  const shot = await page.screenshot({ clip: { x: screen.x, y: screen.y, width: 1, height: 1 } })
  const b64 = shot.toString('base64')
  return page.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = img.width
    cv.height = img.height
    const g = cv.getContext('2d')
    if (!g) throw new Error('sem contexto 2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]] as [number, number, number]
  }, b64)
}

const isBlack = ([r, g, b]: [number, number, number]) => r + g + b <= 6

test('tela do jogador: zona oculta esconde o token alheio e pinta preto; Revelar mostra', async ({ page }) => {
  test.setTimeout(90_000)
  let map = buildMap(false)
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

  const shot = (name: string) => `${test.info().project.outputDir}/conceal-zone/${name}.png`

  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  if (playerId === null) throw new Error('sem welcome')

  // O Espião é da Bia e fica na metade de cima (dentro da zona), sem parede entre ele e o Heroi.
  const other = session.handleMessage(OTHER_CLIENT, JSON.stringify({ type: 'join', code: CODE, name: 'Bia' }), map)
  const otherWelcome = other.outbound.find((o) => o.msg.type === 'welcome')?.msg
  if (otherWelcome?.type !== 'welcome') throw new Error('Bia sem welcome')
  session.assignToken(otherWelcome.playerId, 'tok-c')

  // 1. Zona ativa: só o próprio token, a sala sai (metade visível) e o preto é desenhado.
  session.assignToken(playerId, 'tok-a')
  dispatch(session.broadcast(map).outbound)
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-concealed-count', '1')
  await expect(view).toHaveAttribute('data-tokens-count', '1')
  await expect(view).toHaveAttribute('data-regions-count', '1')
  const hidden = lastSnapshot()
  const hiddenPayload = JSON.stringify(hidden)
  expect(hiddenPayload).not.toContain('tok-c')
  expect(hiddenPayload).not.toContain('Espiao')
  expect(hiddenPayload).not.toContain('Galeria escondida')
  expect(hidden.concealed).toHaveLength(1)
  await page.waitForTimeout(400) // primeiro quadro do Pixi antes de ler pixel
  expect(isBlack(await worldPixel(page, PROBE_ZONE))).toBe(true)
  expect(isBlack(await worldPixel(page, PROBE_OPEN))).toBe(false)
  await page.screenshot({ path: shot('zona-ativa') })

  // 2. Mestre revela: o Espião aparece, a zona sai de `concealed` e o preto some.
  map = buildMap(true)
  dispatch(session.broadcast(map).outbound)
  await expect(view).toHaveAttribute('data-concealed-count', '0')
  await expect(view).toHaveAttribute('data-tokens-count', '2')
  const shown = lastSnapshot()
  expect(JSON.stringify(shown)).toContain('tok-c')
  expect(shown.concealed).toEqual([])
  await page.waitForTimeout(400)
  expect(isBlack(await worldPixel(page, PROBE_ZONE))).toBe(false)
  await page.screenshot({ path: shot('zona-revelada') })

  expect(pageErrors).toEqual([])
})

async function editorZones(page: Page): Promise<{ zones: ConcealZone[]; walls: number; selected: string | null }> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const state = mod.useMapStore.getState()
    return { zones: state.map.concealZones, walls: state.map.walls.length, selected: state.selectedConcealZoneId }
  })
}

test('editor: ferramenta Zona oculta cria por arrasto, sem paredes, e o painel revela e exclui', async ({ page }) => {
  await enterEditor(page)
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_conceal', 'E2E Zona oculta', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.getByRole('button', { name: 'Zona oculta', exact: true }).click()
  await page.mouse.move(box.x + 400, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 650, box.y + 450, { steps: 5 })
  await page.mouse.up()

  const created = await editorZones(page)
  expect(created.zones).toHaveLength(1)
  expect(created.zones[0]).toMatchObject({ name: 'Zona oculta', revealed: false })
  expect(created.walls).toBe(0)
  expect(created.selected).toBe(created.zones[0].id)

  await expect(page.getByRole('heading', { name: 'Zona oculta' })).toBeVisible()
  await page.getByText('Revelar para jogadores').click()
  await expect.poll(async () => (await editorZones(page)).zones[0]?.revealed).toBe(true)

  // Clique sem arrasto no vazio fecha o painel; clique na zona reabre.
  // (900, 600): canvas livre, fora do painel da esquerda e da barra de cima.
  await page.mouse.click(box.x + 900, box.y + 600)
  await expect.poll(async () => (await editorZones(page)).selected).toBeNull()
  await page.mouse.click(box.x + 500, box.y + 380)
  await expect.poll(async () => (await editorZones(page)).selected).toBe(created.zones[0].id)

  await page.getByRole('button', { name: 'Excluir zona' }).click()
  await expect.poll(async () => (await editorZones(page)).zones.length).toBe(0)
})
