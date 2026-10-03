// VEÍCULO pela tela do jogador — "os jogadores não estão conseguindo subir nele
// nem controlar o token".
//
// O QUE PROVA: duas telas de jogador de verdade (player.html no Chromium), a
// do Gui e a da Bia, ligadas à MESMA sessão real do mestre
// (src/net/hostSession.ts) pelo WebSocket roteado, como em
// task-jornada-so-a-propria-ficha-arrasta.spec.ts. O mapa do mestre muda pelas
// regras puras de verdade (mapFactory.setTokenPosition, lib/vehicle.ts): é o
// que o App faz com o `applyMove`/`applyVehicle` da sessão, sem as stores.
//   1. o Gui, encostado no cesto, vê "Subir no veículo", sobe e lê "No veículo · motorista";
//   2. a Bia sobe depois e lê só "No veículo";
//   3. o Gui arrasta a ficha dele: o cesto e a Bia andam junto, mesmo deslocamento;
//   4. a Bia arrasta a dela: não anda, e a tela diz "A bordo: desça para andar";
//   5. o Gui toca "Descer do veículo": fica a pé e a Bia vira a motorista.
// O lado do mestre no app Tauri (painel, arrasto) NÃO é aberto aqui.
import { test, expect, type Browser, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession, type HostResult } from '../src/net/hostSession'
import { createEmptyMap, setTokenPosition } from '../src/lib/mapFactory'
import { boardVehicle, leaveVehicle, passengerIdsOf } from '../src/lib/vehicle'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Token } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const CODE = 'CESTO3'
const GRID = 50
const LARGURA = 20 * GRID
const ALTURA = 12 * GRID
const TELA = { width: 1280, height: 800 }
const FIT_MARGIN = 24 // PlayerView.tsx
const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const EVIDENCIA = process.env.LAB_EVIDENCIA ?? ''

type Ponto = { x: number; y: number }
const naTela = (p: Ponto): Ponto => ({ x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) })

const CESTO: Ponto = { x: 475, y: 325 }
const GUI: Ponto = { x: 425, y: 325 }
const BIA: Ponto = { x: 525, y: 325 }

function ficha(id: string, name: string, p: Ponto, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

function mapaInicial(): MapData {
  const base = createEmptyMap('m-cesto', 'Poço', LARGURA / GRID, ALTURA / GRID, GRID)
  return {
    ...base,
    floor: [{ id: 'f-chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    tokens: [ficha('cesto', 'Cesto', CESTO, { color: '#8b5a2b', npc: true, veiculo: { lugares: 2 } }), ficha('gui', 'Gui', GUI), ficha('bia', 'Bia', BIA)],
  }
}

/** A mesa: uma sessão real, o mapa do mestre e as telas ligadas a ela. */
function criarMesa() {
  let map = mapaInicial()
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const sockets = new Map<string, WebSocketRoute>()
  const idDe = new Map<string, string>()
  const despachar = (r: HostResult) => {
    for (const { clientId, msg } of r.outbound) {
      if (msg.type === 'welcome') idDe.set(clientId, msg.playerId)
      sockets.get(clientId)?.send(JSON.stringify(msg))
    }
  }
  /** O que o App faz com o resultado: aplica no mapa do mestre e manda o recorte novo a todos. */
  const aplicar = (r: HostResult) => {
    despachar(r)
    let mudou = false
    if (r.applyMove) {
      map = setTokenPosition(map, r.applyMove.tokenId, r.applyMove.x, r.applyMove.y)
      mudou = true
    }
    const v = r.applyVehicle
    if (v?.op === 'board') {
      const result = boardVehicle(map, v.vehicleId, v.tokenId)
      if (result.ok) map = result.map
      mudou = true
    } else if (v?.op === 'leave') {
      map = leaveVehicle(map, v.tokenId)
      map = setTokenPosition(map, v.tokenId, v.x, v.y)
      mudou = true
    }
    if (mudou) despachar(session.broadcast(map))
  }
  const ligar = async (page: Page, clientId: string) => {
    await page.routeWebSocket(
      (url) => url.pathname === '/ws',
      (ws) => {
        sockets.set(clientId, ws)
        ws.onMessage((bruto) => aplicar(session.handleMessage(clientId, typeof bruto === 'string' ? bruto : bruto.toString('utf8'), map)))
      },
    )
  }
  const atribuir = (clientId: string, tokenId: string) => {
    const pid = idDe.get(clientId)
    if (pid === undefined) throw new Error(`${clientId} não recebeu welcome`)
    despachar(session.assignToken(pid, tokenId))
    despachar(session.broadcast(map))
  }
  return { ligar, atribuir, mapa: () => map }
}

async function entrar(browser: Browser, mesa: ReturnType<typeof criarMesa>, clientId: string, nome: string, tokenId: string): Promise<Page> {
  const context = await browser.newContext({ viewport: TELA })
  const page = await context.newPage()
  await mesa.ligar(page, clientId)
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODE, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Aguardando o mestre/ })).toBeVisible({ timeout: 10_000 })
  mesa.atribuir(clientId, tokenId)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 })
  return page
}

async function arrastar(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 14 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
}

async function foto(page: Page, nome: string): Promise<void> {
  if (EVIDENCIA !== '') await page.screenshot({ path: `${EVIDENCIA}/${nome}.png` })
}

const posicao = (map: MapData, id: string) => {
  const t = map.tokens.find((token) => token.id === id)
  return t === undefined ? null : { x: t.x, y: t.y }
}

test('jogadores sobem no cesto, o motorista dirige levando a passageira, ela não anda sozinha, e o Gui desce', async ({ browser }) => {
  test.setTimeout(180_000)
  const mesa = criarMesa()
  const gui = await entrar(browser, mesa, 'c-gui', 'Gui', 'gui')
  const bia = await entrar(browser, mesa, 'c-bia', 'Bia', 'bia')

  // 1. Encostado no cesto, o Gui vê "Subir"; sobe sozinho e lê que é o motorista.
  const subirGui = gui.getByRole('button', { name: 'Subir no veículo' })
  await expect(subirGui).toBeVisible({ timeout: 10_000 })
  await foto(gui, '1-gui-subir')
  await subirGui.click()
  await expect(gui.getByText('No veículo · motorista', { exact: true })).toBeVisible({ timeout: 8000 })
  expect(passengerIdsOf(mesa.mapa(), 'cesto')).toEqual(['gui'])
  await foto(gui, '2-gui-motorista')

  // 2. A Bia sobe depois: passageira.
  await bia.getByRole('button', { name: 'Subir no veículo' }).click()
  await expect(bia.getByText('No veículo', { exact: true })).toBeVisible({ timeout: 8000 })
  expect(passengerIdsOf(mesa.mapa(), 'cesto')).toEqual(['gui', 'bia'])
  await foto(bia, '3-bia-passageira')

  // 3. O Gui arrasta a ficha dele duas casas para baixo: o cesto e a Bia vão junto.
  const destinoGui: Ponto = { x: GUI.x, y: GUI.y + 2 * GRID }
  await arrastar(gui, naTela(GUI), naTela(destinoGui))
  await expect.poll(() => posicao(mesa.mapa(), 'gui'), { timeout: 8000 }).toEqual(destinoGui)
  expect(posicao(mesa.mapa(), 'cesto')).toEqual({ x: CESTO.x, y: CESTO.y + 2 * GRID })
  expect(posicao(mesa.mapa(), 'bia')).toEqual({ x: BIA.x, y: BIA.y + 2 * GRID })
  expect(passengerIdsOf(mesa.mapa(), 'cesto')).toEqual(['gui', 'bia'])
  await gui.waitForTimeout(600)
  await foto(gui, '4-gui-dirigiu')
  await foto(bia, '5-bia-levada')

  // 4. A Bia tenta andar sozinha: fica, e a tela dela diz para descer.
  const biaAgora: Ponto = { x: BIA.x, y: BIA.y + 2 * GRID }
  await arrastar(bia, naTela(biaAgora), naTela({ x: biaAgora.x + 2 * GRID, y: biaAgora.y }))
  await expect(bia.getByText('A bordo: desça para andar', { exact: true })).toBeVisible({ timeout: 8000 })
  expect(posicao(mesa.mapa(), 'bia')).toEqual(biaAgora)
  expect(passengerIdsOf(mesa.mapa(), 'cesto')).toEqual(['gui', 'bia'])
  await foto(bia, '6-bia-a-bordo-nao-anda')
  await bia.waitForTimeout(1500)
  await foto(bia, '6b-bia-voltou')

  // 5. O Gui desce: fica onde está, a pé; a Bia vira a motorista.
  await gui.getByRole('button', { name: 'Descer do veículo' }).click()
  await expect(gui.getByText('No veículo · motorista', { exact: true })).toBeHidden({ timeout: 8000 })
  await expect(gui.getByRole('button', { name: 'Subir no veículo' })).toBeVisible({ timeout: 8000 })
  await expect(bia.getByText('No veículo · motorista', { exact: true })).toBeVisible({ timeout: 8000 })
  expect(passengerIdsOf(mesa.mapa(), 'cesto')).toEqual(['bia'])
  expect(posicao(mesa.mapa(), 'gui')).toEqual(destinoGui)
  await foto(gui, '7-gui-desceu')
  await foto(bia, '8-bia-motorista')
})
