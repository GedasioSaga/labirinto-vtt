import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { CarriedItem, DoorState, MapData, Token, Wall } from '../types/map'
import { doorKeyLine } from './hostBridge'
import { createHostSession, DOOR_TOGGLE_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * CHAVE ABRE PORTA. A porta trancada do mestre ganha "Abre com: <item>". Quem
 * encosta nela com o item na mochila lê "Usar <item>", e o toque destranca e
 * abre para todos — sem esperar o mestre, que só recebe o aviso. Quem não tem
 * lê "Trancada" como sempre. O jogador nunca descobre que portas a chave abre.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 40
const CHAVE = 'Chave do Escudo'
const fechada: DoorState = { open: false, locked: false, kind: 'normal' }
const comChave: DoorState = { ...fechada, locked: true, abreCom: CHAVE }
const chaveNaMochila: CarriedItem[] = [{ id: 'pino-chave', nome: CHAVE }]

function token(id: string, name: string, x: number, y: number, mochila?: CarriedItem[]): Token {
  const t: Token = { id, characterId: null, name, x, y, size: 1, image: null }
  return mochila === undefined ? t : { ...t, mochila }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

/** Parede vertical em x=500 com a porta do Escritório (trancada, abre com a Chave do Escudo). Diego tem a chave; Ana não. */
function mansao(escritorio: DoorState = comChave, diegoX = 460): MapData {
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID),
    walls: [
      wall('acima', 500, 0, 500, 180),
      { ...wall('escritorio', 500, 180, 500, 220, escritorio), blocksLight: false },
      wall('abaixo', 500, 220, 500, 1000),
    ],
    tokens: [token('diego-ficha', 'Diego', diegoX, 200, chaveNaMochila), token('ana-ficha', 'Ana', 460, 240)],
  }
}

function sequentialIds(): () => string {
  let n = 0
  return () => {
    n += 1
    return `id-${n}`
  }
}

/** Diego (c1) e Ana (c2) jogando na Mansão, de fundo; o Salão está aberto no editor. */
function mesa(map: MapData = mansao()) {
  let clock = 0
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: sequentialIds() })
  const world: HostWorld = {
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
    background: [{ sceneId: 'cena-mansao', name: 'Mansão', map }],
  }
  const entrar = (clientId: string, name: string, tokenId: string): string => {
    const joined = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(joined.playerId, tokenId)
    return joined.playerId
  }
  const diego = entrar('c1', 'Diego', 'diego-ficha')
  const ana = entrar('c2', 'Ana', 'ana-ficha')
  return { s, world, diego, ana, advance: (ms: number) => void (clock += ms) }
}

function snapshotPara(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg
}

describe('protocolo: door.useKey', () => {
  it('só leva a porta: o jogador não escolhe o item nem manda o nome da chave', () => {
    expect(parsePlayerMessage({ type: 'door.useKey', wallId: 'escritorio', itemId: 'pino-chave', nome: CHAVE })).toEqual({ type: 'door.useKey', wallId: 'escritorio' })
    expect(parsePlayerMessage({ type: 'door.useKey', wallId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'door.useKey' })).toBeNull()
  })
})

describe('hostSession: a chave na mochila abre a porta sem pedir ao mestre', () => {
  it('Diego com a chave toca o Escritório: "Trancada" já vem com o nome da chave que ele carrega', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'escritorio' }, t.world)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked', key: CHAVE } }])
    expect(r.applyDoor).toBeUndefined()
  })

  it('"Usar Chave do Escudo": destranca e abre na cena de fundo, e o mestre recebe o aviso com quem, qual item e onde', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'door.useKey', wallId: 'escritorio' }, t.world)
    expect(r.applyDoor).toEqual({ wallId: 'escritorio', open: true, unlock: true, sceneId: 'cena-mansao', playerId: t.diego, playerName: 'Diego' })
    expect(r.doorKeyUsed).toEqual({ playerId: t.diego, playerName: 'Diego', itemName: CHAVE, sceneName: 'Mansão' })
    expect(r.doorRequest).toBeUndefined()
    expect(r.outbound).toEqual([])
    expect(doorKeyLine({ playerId: t.diego, playerName: 'Diego', itemName: CHAVE, sceneName: 'Mansão' })).toBe('Diego abriu uma porta com Chave do Escudo em Mansão')
    expect(doorKeyLine({ playerId: t.diego, playerName: 'Diego', itemName: CHAVE })).toBe('Diego abriu uma porta com Chave do Escudo')
  })

  it('o nome da chave casa sem diferença de maiúscula e espaço: "chave do escudo " na porta abre com a Chave do Escudo', () => {
    const t = mesa(mansao({ ...comChave, abreCom: ' chave do ESCUDO ' }))
    expect(t.s.handleMessage('c1', { type: 'door.useKey', wallId: 'escritorio' }, t.world).applyDoor).toEqual({ wallId: 'escritorio', open: true, unlock: true, sceneId: 'cena-mansao', playerId: t.diego, playerName: 'Diego' })
  })

  it('Ana sem a chave: "Trancada" sem nome de chave (fica o Pedir ao mestre), e "Usar" dela não abre nada', () => {
    const t = mesa()
    const toque = t.s.handleMessage('c2', { type: 'door.toggle', wallId: 'escritorio' }, t.world)
    expect(toque.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked' } }])
    t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    const usar = t.s.handleMessage('c2', { type: 'door.useKey', wallId: 'escritorio' }, t.world)
    expect(usar.applyDoor).toBeUndefined()
    expect(usar.doorKeyUsed).toBeUndefined()
    expect(usar.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked' } }])
    // O pedido ao mestre continua de pé para quem não tem a chave.
    t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    expect(t.s.handleMessage('c2', { type: 'door.request', wallId: 'escritorio', how: 'knock' }, t.world).doorRequest).toBeDefined()
  })

  it('porta trancada sem "Abre com" ou que abre com outro item: a chave errada não abre e não aparece', () => {
    for (const porta of [{ ...fechada, locked: true }, { ...comChave, abreCom: 'Chave da Cripta' }]) {
      const t = mesa(mansao(porta))
      const toque = t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'escritorio' }, t.world)
      expect(toque.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked' } }])
      t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
      const usar = t.s.handleMessage('c1', { type: 'door.useKey', wallId: 'escritorio' }, t.world)
      expect(usar.applyDoor).toBeUndefined()
      expect(usar.doorKeyUsed).toBeUndefined()
    }
  })

  it('Diego com a chave mas longe da porta: não abre, e a recusa não diz o nome da chave', () => {
    const t = mesa(mansao(comChave, 200))
    const usar = t.s.handleMessage('c1', { type: 'door.useKey', wallId: 'escritorio' }, t.world)
    expect(usar.applyDoor).toBeUndefined()
    expect(usar.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'far' } }])
    t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    const toque = t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'escritorio' }, t.world)
    expect(toque.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked' } }])
  })

  it('porta que ele não vê ou que não existe: "Usar" responde not_visible, sem abrir', () => {
    const t = mesa()
    for (const wallId of ['acima', 'nao-existe']) {
      const r = t.s.handleMessage('c1', { type: 'door.useKey', wallId }, t.world)
      expect(r.applyDoor).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId, reason: 'not_visible' } }])
      t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    }
  })
})

describe('SEGURANÇA: o jogador nunca descobre que portas a chave abre', () => {
  it('o snapshot de quem tem e de quem não tem a chave não leva o "Abre com" da porta', () => {
    const t = mesa()
    const envio = t.s.broadcast(t.world)
    const diego = snapshotPara(envio, 'c1')
    const ana = snapshotPara(envio, 'c2')
    expect(diego.map.walls.find((w) => w.id === 'escritorio')?.door).toEqual(fechada)
    expect(ana.map.walls.find((w) => w.id === 'escritorio')?.door).toEqual(fechada)
    expect(JSON.stringify(diego)).not.toContain('abreCom')
    expect(JSON.stringify(ana)).not.toContain('abreCom')
    // A mochila do Diego não vai para a Ana; e a porta não diz o nome da chave a ninguém.
    expect(JSON.stringify(ana)).not.toContain(CHAVE)
  })

  it('a porta lembrada, longe da vista, também não guarda o "Abre com"', () => {
    const t = mesa()
    t.s.broadcast(t.world)
    const longe: MapData = { ...mansao(), tokens: [token('diego-ficha', 'Diego', 100, 200, chaveNaMochila), token('ana-ficha', 'Ana', 100, 300)] }
    const envio = t.s.broadcast({ ...t.world, background: [{ sceneId: 'cena-mansao', name: 'Mansão', map: longe }] })
    for (const clientId of ['c1', 'c2']) {
      const snap = snapshotPara(envio, clientId)
      expect(snap.map.walls.some((w) => w.id === 'escritorio')).toBe(true)
      expect(JSON.stringify(snap)).not.toContain('abreCom')
    }
  })

  it('nada que vai ao jogador ao usar a chave leva o nome da cena', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'door.useKey', wallId: 'escritorio' }, t.world)
    expect(r.doorKeyUsed?.sceneName).toBe('Mansão')
    const paraJogador = JSON.stringify(r.outbound)
    expect(paraJogador).not.toContain('Mansão')
    expect(paraJogador).not.toContain('cena-')
  })
})
