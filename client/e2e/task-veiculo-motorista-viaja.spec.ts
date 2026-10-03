// VEÍCULO — a viagem da MOTORISTA leva o veículo inteiro, e a vez da iniciativa
// tira o "Descer" de quem não está na vez.
//
// O QUE PROVA: duas telas de jogador de verdade (player.html no Chromium), a
// do Gui e a da Bia, ligadas à MESMA sessão real do mestre
// (src/net/hostSession.ts) pelo WebSocket roteado, como em
// task-veiculo-jogador.spec.ts — agora com um MUNDO de duas cenas (o Pátio e o
// Poço). O mapa do mestre muda pelas regras puras de verdade
// (mapFactory.setTokenPosition, lib/vehicle.ts); a travessia entre cenas é a
// do `adventureStore.transferToken` reduzida ao que esta cena exercita (o
// veículo e quem vai a bordo, no mesmo afastamento).
//   1. o Gui e a Bia sobem no cesto pela tela ("Subir no veículo");
//   2. a Bia, passageira, toca o poço: o cartão já não oferece "Passar" — o
//      botão vem apagado com "A bordo: desça para viajar" — e nada anda;
//   3. o Gui, motorista, toca o poço e passa: lê "Você chegou"; o cesto, ele e a
//      Bia chegam ao Poço, a bordo, no mesmo afastamento; a Bia lê "Você viajou
//      no veículo" (e não "O mestre levou você"); as duas telas mostram
//      "No veículo · motorista" e "No veículo";
//   4. INICIATIVA: na vez da Bia, o Gui perde o "Descer do veículo"; na vez dele, volta.
// O lado do mestre no app Tauri (painel, Caixa de Pedidos) NÃO é aberto aqui;
// o "Deixar ir" e o atalho na mesma cena estão nos testes da sessão
// (src/stores/veiculoMotoristaViaja.test.ts).
import { test, expect, type Browser, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession, type AppliedTransfer, type HostResult, type HostWorld } from '../src/net/hostSession'
import { createEmptyMap, setTokenPosition } from '../src/lib/mapFactory'
import { boardVehicle, leaveVehicle, passengerIdsOf } from '../src/lib/vehicle'
import { PIN_HEAD_OFFSET } from '../src/lib/pins'
import { fitCamera } from '../src/pixi/world'
import type { TurnRef } from '../src/lib/initiative'
import type { MapData, Pin, Token } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const CODE = 'CESTO5'
const GRID = 50
const LARGURA = 20 * GRID
const ALTURA = 12 * GRID
const TELA = { width: 1280, height: 800 }
const FIT_MARGIN = 24 // PlayerView.tsx
const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)
const TOQUE_MS = 120
const ESPERA = 8000
const EVIDENCIA = process.env.LAB_EVIDENCIA ?? ''

type Ponto = { x: number; y: number }
const naTela = (p: Ponto): Ponto => ({ x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) })

const CENA_PATIO = 'cena-patio'
const CENA_POCO = 'cena-poco'
const CESTO: Ponto = { x: 475, y: 325 }
const GUI: Ponto = { x: 425, y: 325 }
const BIA: Ponto = { x: 475, y: 375 }
/** O poço do Pátio: o Gui e a Bia encostam (a folga do pino é meia ficha + uma casa); a cabeça fica fora das fichas. */
const POCO: Ponto = { x: 425, y: 400 }
const SAIDA: Ponto = { x: 625, y: 300 }

function ficha(id: string, name: string, p: Ponto, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

function pino(id: string, p: Ponto, description: string, destino: Pin['destino']): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description, image: null, destino, passagem: 'livre' }
}

function mapaBase(id: string, nome: string): MapData {
  const base = createEmptyMap(id, nome, LARGURA / GRID, ALTURA / GRID, GRID)
  return { ...base, floor: [{ id: `f-${id}`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }] }
}

function mundoInicial(): HostWorld {
  const patio: MapData = {
    ...mapaBase('m-patio', 'Pátio'),
    tokens: [ficha('cesto', 'Cesto', CESTO, { color: '#8b5a2b', npc: true, veiculo: { lugares: 2 } }), ficha('gui', 'Gui', GUI), ficha('bia', 'Bia', BIA)],
    pins: [pino('poco', POCO, 'Poço', { sceneId: CENA_POCO, pinId: 'saida' })],
  }
  const poco: MapData = { ...mapaBase('m-poco', 'Poço'), pins: [pino('saida', SAIDA, 'Boca do poço', { sceneId: CENA_PATIO, pinId: 'poco' })] }
  return { open: { sceneId: CENA_PATIO, name: 'Pátio', map: patio }, background: [{ sceneId: CENA_POCO, name: 'Poço', map: poco }] }
}

/**
 * A travessia do `adventureStore.transferToken` no que esta cena usa: o
 * veículo e quem vai a bordo saem de uma cena e chegam na outra, cada um no
 * afastamento que tinha em volta do veículo, ainda a bordo.
 */
function transferir(world: HostWorld, t: AppliedTransfer): HostWorld {
  const cenas = [world.open, ...world.background]
  const de = cenas.find((c) => c.sceneId === t.fromSceneId)
  const para = cenas.find((c) => c.sceneId === t.toSceneId)
  const lider = de?.map.tokens.find((tk) => tk.id === t.tokenId)
  if (de === undefined || para === undefined || lider === undefined) return world
  const ids = new Set([lider.id, ...passengerIdsOf(de.map, lider.id)])
  const dx = t.x - lider.x
  const dy = t.y - lider.y
  const viajam = de.map.tokens.filter((tk) => ids.has(tk.id)).map((tk) => ({ ...tk, x: tk.x + dx, y: tk.y + dy }))
  const troca = (c: (typeof cenas)[number]) => {
    if (c === de) return { ...c, map: { ...c.map, tokens: c.map.tokens.filter((tk) => !ids.has(tk.id)) } }
    if (c === para) return { ...c, map: { ...c.map, tokens: [...c.map.tokens, ...viajam] } }
    return c
  }
  return { ...world, open: troca(world.open), background: world.background.map(troca) }
}

/** A mesa: uma sessão real, o mundo do mestre e as telas ligadas a ela. */
function criarMesa() {
  let world = mundoInicial()
  let turno: TurnRef | null = null
  let n = 0
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: () => `id-${++n}`, getTurn: () => turno })
  const sockets = new Map<string, WebSocketRoute>()
  const idDe = new Map<string, string>()
  const despachar = (r: HostResult) => {
    for (const { clientId, msg } of r.outbound) {
      if (msg.type === 'welcome') idDe.set(clientId, msg.playerId)
      sockets.get(clientId)?.send(JSON.stringify(msg))
    }
  }
  const cenaDe = (sceneId: string | undefined) => (sceneId === undefined ? world.open : [world.open, ...world.background].find((c) => c.sceneId === sceneId))
  const mudarMapa = (sceneId: string | undefined, f: (map: MapData) => MapData) => {
    const alvo = cenaDe(sceneId)
    if (alvo === undefined) return
    const troca = (c: typeof alvo) => (c === alvo ? { ...c, map: f(c.map) } : c)
    world = { ...world, open: troca(world.open), background: world.background.map(troca) }
  }
  /** O que o App faz com o resultado: aplica no mundo do mestre e manda o recorte novo a todos. */
  const aplicar = (r: HostResult) => {
    let mudou = false
    if (r.applyTransfer) {
      // A ponte move ANTES de mandar o "scene.changed": a ordem dos envios é a ordem em que o jogador recebe.
      world = transferir(world, r.applyTransfer)
      mudou = true
    }
    despachar(r)
    if (r.applyMove) {
      const { tokenId, x, y, sceneId } = r.applyMove
      mudarMapa(sceneId, (map) => setTokenPosition(map, tokenId, x, y))
      mudou = true
    }
    const v = r.applyVehicle
    if (v?.op === 'board') {
      mudarMapa(v.sceneId, (map) => {
        const result = boardVehicle(map, v.vehicleId, v.tokenId)
        return result.ok ? result.map : map
      })
      mudou = true
    } else if (v?.op === 'leave') {
      mudarMapa(v.sceneId, (map) => setTokenPosition(leaveVehicle(map, v.tokenId), v.tokenId, v.x, v.y))
      mudou = true
    }
    if (mudou) despachar(session.broadcast(world))
  }
  const ligar = async (page: Page, clientId: string) => {
    await page.routeWebSocket(
      (url) => url.pathname === '/ws',
      (ws) => {
        sockets.set(clientId, ws)
        ws.onMessage((bruto) => aplicar(session.handleMessage(clientId, typeof bruto === 'string' ? bruto : bruto.toString('utf8'), world)))
      },
    )
  }
  const atribuir = (clientId: string, tokenId: string) => {
    const pid = idDe.get(clientId)
    if (pid === undefined) throw new Error(`${clientId} não recebeu welcome`)
    despachar(session.assignToken(pid, tokenId))
    despachar(session.broadcast(world))
  }
  const vez = (ref: TurnRef | null) => {
    turno = ref
    despachar(session.broadcast(world))
  }
  return { ligar, atribuir, vez, mapa: (sceneId: string) => cenaDe(sceneId)?.map ?? null }
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

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Toca a cabeça do poço → "Passar" → confirma "Passar por aqui?". */
async function passarPeloPoco(page: Page): Promise<void> {
  await tocar(page, naTela({ x: POCO.x, y: POCO.y - PIN_HEAD_OFFSET }))
  const cartao = page.getByRole('dialog').filter({ hasText: 'Poço' })
  await expect(cartao).toBeVisible({ timeout: ESPERA })
  await cartao.getByRole('button', { name: 'Passar', exact: true }).click()
  await page.getByRole('group', { name: 'Passar por aqui?' }).getByRole('button', { name: /^(passar|sim|confirmar|ir)$/i }).first().click()
}

async function foto(page: Page, nome: string): Promise<void> {
  if (EVIDENCIA !== '') await page.screenshot({ path: `${EVIDENCIA}/${nome}.png` })
}

const ids = (map: MapData | null) => (map?.tokens ?? []).map((t) => t.id).sort()
const posicao = (map: MapData | null, id: string) => {
  const t = map?.tokens.find((token) => token.id === id)
  return t === undefined ? null : { x: t.x, y: t.y }
}

test('a motorista passa pelo poço levando o cesto e a passageira; a passageira não passa sozinha; fora da vez, sem "Descer"', async ({ browser }) => {
  test.setTimeout(180_000)
  const mesa = criarMesa()
  const gui = await entrar(browser, mesa, 'c-gui', 'Gui', 'gui')
  const bia = await entrar(browser, mesa, 'c-bia', 'Bia', 'bia')

  // 1. Os dois sobem: o Gui primeiro (motorista), a Bia depois.
  await gui.getByRole('button', { name: 'Subir no veículo' }).click()
  await expect(gui.getByText('No veículo · motorista', { exact: true })).toBeVisible({ timeout: ESPERA })
  await bia.getByRole('button', { name: 'Subir no veículo' }).click()
  await expect(bia.getByText('No veículo', { exact: true })).toBeVisible({ timeout: ESPERA })
  expect(passengerIdsOf(mesa.mapa(CENA_PATIO) as MapData, 'cesto')).toEqual(['gui', 'bia'])

  // 2. A Bia, passageira, abre o poço: o cartão já diz que não dá, sem "Passar" para clicar.
  await tocar(bia, naTela({ x: POCO.x, y: POCO.y - PIN_HEAD_OFFSET }))
  const cartaoDaBia = bia.getByRole('dialog').filter({ hasText: 'Poço' })
  await expect(cartaoDaBia).toBeVisible({ timeout: ESPERA })
  const apagado = cartaoDaBia.getByRole('button', { name: 'A bordo: desça para viajar' })
  await expect(apagado).toBeVisible({ timeout: ESPERA })
  await expect(apagado).toBeDisabled()
  await expect(cartaoDaBia.getByRole('button', { name: 'Passar', exact: true })).toHaveCount(0)
  expect(ids(mesa.mapa(CENA_PATIO))).toEqual(['bia', 'cesto', 'gui'])
  expect(ids(mesa.mapa(CENA_POCO))).toEqual([])
  await foto(bia, '1-bia-a-bordo-nao-viaja')
  await cartaoDaBia.getByRole('button', { name: 'Fechar' }).click()
  await expect(cartaoDaBia).toBeHidden({ timeout: ESPERA })

  // 3. O Gui, motorista, passa: o cesto e a Bia vão junto, a bordo, no mesmo afastamento.
  await passarPeloPoco(gui)
  await expect(gui.getByText(/Você chegou/).first()).toBeVisible({ timeout: ESPERA })
  await expect.poll(() => ids(mesa.mapa(CENA_POCO)), { timeout: ESPERA }).toEqual(['bia', 'cesto', 'gui'])
  expect(ids(mesa.mapa(CENA_PATIO))).toEqual([])
  const poco = mesa.mapa(CENA_POCO) as MapData
  expect(passengerIdsOf(poco, 'cesto')).toEqual(['gui', 'bia'])
  const cesto = posicao(poco, 'cesto') as Ponto
  expect(posicao(poco, 'gui')).toEqual({ x: cesto.x + (GUI.x - CESTO.x), y: cesto.y + (GUI.y - CESTO.y) })
  expect(posicao(poco, 'bia')).toEqual({ x: cesto.x + (BIA.x - CESTO.x), y: cesto.y + (BIA.y - CESTO.y) })
  // A Bia não pediu e o mestre não levou: quem dirigiu foi o Gui, que ela não precisa saber quem é.
  await expect(bia.getByText('Você viajou no veículo').first()).toBeVisible({ timeout: ESPERA })
  await expect(bia.getByText('O mestre levou você para outro lugar')).toHaveCount(0)
  // As duas telas, já no Poço, continuam a bordo.
  await expect(gui.getByText('No veículo · motorista', { exact: true })).toBeVisible({ timeout: ESPERA })
  await expect(bia.getByText('No veículo', { exact: true })).toBeVisible({ timeout: ESPERA })
  await gui.waitForTimeout(600)
  await foto(gui, '2-gui-chegou-no-cesto')
  await foto(bia, '3-bia-chegou-a-bordo')

  // 4. INICIATIVA no Poço: na vez da Bia, o Gui não ganha o "Descer"; na vez dele, ganha.
  const descerGui = gui.getByRole('button', { name: 'Descer do veículo' })
  await expect(descerGui).toBeVisible({ timeout: ESPERA })
  mesa.vez({ mapId: 'm-poco', tokenId: 'bia' })
  await expect(descerGui).toBeHidden({ timeout: ESPERA })
  await expect(gui.getByText('No veículo · motorista', { exact: true })).toBeVisible()
  await expect(bia.getByRole('button', { name: 'Descer do veículo' })).toBeVisible({ timeout: ESPERA })
  await foto(gui, '4-gui-fora-da-vez')
  mesa.vez({ mapId: 'm-poco', tokenId: 'gui' })
  await expect(descerGui).toBeVisible({ timeout: ESPERA })
  await expect(bia.getByRole('button', { name: 'Descer do veículo' })).toBeHidden({ timeout: ESPERA })
  await foto(gui, '5-gui-na-vez')
})
