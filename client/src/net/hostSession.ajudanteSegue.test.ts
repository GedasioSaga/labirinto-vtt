import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type AppliedTransfer, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * AJUDANTE CONTRATADO: "a ficha segue o jogador". A Duda tem o Arco e o Tiziu
 * emprestado por 30 min. Quando ela troca de cena — pelo pino, pelo "Levar
 * para…" ou pelo "Juntar o grupo" — o Tiziu atravessa junto, assenta ao lado
 * dela e continua na mão dela, com o acordo, na cena nova. Sem isto ele ficava
 * no Porto: na posse dela, com o prazo correndo, e fora de tudo que ela vê.
 */

const CODE = 'AJSEG1'
const PORTO = 'cena-porto'
const CRIPTA = 'cena-cripta'
const GRID = 50
const PRAZO_MINUTOS = 30
const TAREFA = 'carregar a lanterna'
/**
 * Onde o Arco assenta na Cripta: a casa livre ao lado do pino `fundo` (1000, 250).
 * A chegada em casa livre (`arrivalSpot`) não cobre a cabeça do pino, na casa (1025, 275).
 */
const CHEGADA = { x: 975, y: 275 }
/** Casa já escolhida por `planGather` (centro de casa, como ele sempre entrega). */
const PONTO_DO_GRUPO = { x: 625, y: 275 }

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y: 200, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: id, image: null, destino }
}

function welcomeOf(messages: { msg: HostMessage }[]): string {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

/** Porto (aberto): Arco, o Tiziu ao lado dela, o Remo (ficha própria dela, parada longe) e o Bote (do Bruno). */
function mundo(): HostWorld {
  const porto: MapData = {
    ...createEmptyMap('mapa-porto', 'Porto', 40, 10, GRID),
    tokens: [ficha('arco', 350), ficha('tiziu', 300, { publicName: 'Menino', npc: true }), ficha('remo', 1500), ficha('bote', 1600)],
    pins: [viagem('alcapao', 400, 200, { sceneId: CRIPTA, pinId: 'fundo' })],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, GRID),
    tokens: [],
    pins: [viagem('fundo', 1000, 250, { sceneId: PORTO, pinId: 'alcapao' })],
  }
  return { open: { sceneId: PORTO, name: 'Porto', map: porto }, background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }] }
}

function mesa(w: HostWorld): { s: HostSession; duda: string; bruno: string } {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const duda = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Duda' }, w).outbound)
  const bruno = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bruno' }, w).outbound)
  s.assignToken(duda, 'arco')
  s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: PRAZO_MINUTOS, visao: false })
  s.assignToken(bruno, 'bote')
  return { s, duda, bruno }
}

/** O que a store do mestre faz com a transferência: cada ficha sai de uma cena e entra na outra. */
function aplica(w: HostWorld, transfer: AppliedTransfer): HostWorld {
  const moves = [{ tokenId: transfer.tokenId, x: transfer.x, y: transfer.y }, ...(transfer.companions ?? [])]
  const scenes = [w.open, ...w.background]
  const travelling = new Map<string, Token>()
  for (const move of moves) {
    const token = scenes.find((scene) => scene.sceneId === transfer.fromSceneId)?.map.tokens.find((t) => t.id === move.tokenId)
    if (token !== undefined) travelling.set(move.tokenId, { ...token, x: move.x, y: move.y })
  }
  const redo = (scene: HostWorld['open']): HostWorld['open'] => {
    if (scene.sceneId === transfer.fromSceneId) return { ...scene, map: { ...scene.map, tokens: scene.map.tokens.filter((t) => !travelling.has(t.id)) } }
    if (scene.sceneId === transfer.toSceneId) return { ...scene, map: { ...scene.map, tokens: [...scene.map.tokens, ...travelling.values()] } }
    return scene
  }
  return { open: redo(w.open), background: w.background.map(redo) }
}

function transferOf(r: HostResult): AppliedTransfer {
  if (r.applyTransfer === undefined) throw new Error('esperava a transferência')
  return r.applyTransfer
}

/** Pede o alçapão e o mestre deixa ir. */
function atravessa(s: HostSession, w: HostWorld): HostResult {
  s.broadcast(w)
  const requestId = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao' }, w).travelRequest?.requestId
  if (requestId === undefined) throw new Error('esperava o pedido chegar ao mestre')
  return s.approveTravel(requestId, w)
}

function mapaDe(r: HostResult, clientId: string) {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava o snapshot de ${clientId}`)
  return msg
}

describe('ajudante contratado: o ajudante atravessa junto com a dona', () => {
  it('pino: o Tiziu vai para a Cripta junto do Arco, uma casa ao lado dela', () => {
    const w = mundo()
    const { s } = mesa(w)
    const transfer = transferOf(atravessa(s, w))
    expect(transfer.tokenId).toBe('arco')
    expect({ x: transfer.x, y: transfer.y }).toEqual(CHEGADA)
    expect(transfer.companions?.map((c) => c.tokenId)).toEqual(['tiziu'])
    const tiziu = transfer.companions?.[0]
    if (tiziu === undefined) throw new Error('esperava o Tiziu na travessia')
    // Ao lado, não em cima: a uma casa exata da ficha dela.
    expect(Math.hypot(tiziu.x - CHEGADA.x, tiziu.y - CHEGADA.y)).toBe(GRID)
  })

  it('na Cripta a Duda segue com o Tiziu na mão: vem no snapshot com o acordo, e ela o move', () => {
    const w = mundo()
    const { s, duda } = mesa(w)
    const depois = aplica(w, transferOf(atravessa(s, w)))
    const fio = mapaDe(s.broadcast(depois), 'c1')
    expect(fio.map.id).toBe('mapa-cripta')
    expect(fio.ownTokens).toEqual(['arco', 'tiziu'])
    const tiziu = fio.map.tokens.find((t) => t.id === 'tiziu')
    expect(tiziu?.contrato).toEqual({ tarefa: TAREFA, ate: PRAZO_MINUTOS * 60_000, visao: false })
    expect(tiziu?.name).toBe('Menino')
    // O painel do mestre continua mostrando o empréstimo, agora na Cripta.
    const info = s.listPlayers(depois).find((p) => p.playerId === duda)
    expect(info?.sceneName).toBe('Cripta Rubra')
    expect(Object.keys(info?.loans ?? {})).toEqual(['tiziu'])
    // E ela ainda anda com ele na cena nova.
    const passo = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'tiziu', x: (tiziu?.x ?? 0) + GRID, y: tiziu?.y ?? 0 }, depois)
    expect(passo.applyMove?.tokenId).toBe('tiziu')
  })

  it('"Levar para…": o mestre leva a Duda e o Tiziu vai junto', () => {
    const w = mundo()
    const { s, duda } = mesa(w)
    const transfer = transferOf(s.sendPlayer(duda, CRIPTA, 'fundo', w))
    expect(transfer.tokenId).toBe('arco')
    expect(transfer.companions?.map((c) => c.tokenId)).toEqual(['tiziu'])
    const tiziu = transfer.companions?.[0]
    expect(tiziu === undefined ? null : Math.hypot(tiziu.x - transfer.x, tiziu.y - transfer.y)).toBe(GRID)
  })

  it('"Juntar o grupo": o Arco vai ao ponto do grupo e o Tiziu ao lado, não em cima dela', () => {
    const w = mundo()
    const { s, duda } = mesa(w)
    const transfer = transferOf(s.sendPlayer(duda, CRIPTA, null, w, PONTO_DO_GRUPO))
    expect({ x: transfer.x, y: transfer.y }).toEqual(PONTO_DO_GRUPO)
    expect(transfer.companions?.map((c) => c.tokenId)).toEqual(['tiziu'])
    const tiziu = transfer.companions?.[0]
    expect(tiziu === undefined ? null : Math.hypot(tiziu.x - PONTO_DO_GRUPO.x, tiziu.y - PONTO_DO_GRUPO.y)).toBe(GRID)
  })

  it('controle: ficha PRÓPRIA dela em outro canto (Remo) e ficha do Bruno não são arrastadas', () => {
    const w = mundo()
    const { s, duda } = mesa(w)
    s.assignToken(duda, 'remo')
    const transfer = transferOf(s.sendPlayer(duda, CRIPTA, null, w))
    expect(transfer.companions?.map((c) => c.tokenId)).toEqual(['tiziu'])
  })

  it('controle: sem empréstimo, ninguém acompanha (a transferência vem sem companions)', () => {
    const w = mundo()
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const duda = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Duda' }, w).outbound)
    s.assignToken(duda, 'arco')
    const transfer = transferOf(s.sendPlayer(duda, CRIPTA, null, w))
    expect(transfer.tokenId).toBe('arco')
    expect(transfer.companions).toBeUndefined()
  })

  it('só com o Tiziu na mão, é ele quem viaja e não acompanha a si mesmo', () => {
    const w = mundo()
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const duda = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Duda' }, w).outbound)
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: PRAZO_MINUTOS, visao: true })
    const transfer = transferOf(s.sendPlayer(duda, CRIPTA, null, w))
    expect(transfer.tokenId).toBe('tiziu')
    expect(transfer.companions).toBeUndefined()
  })
})
