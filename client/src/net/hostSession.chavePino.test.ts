import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { CarriedItem, MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * CHAVE ABRE PORTA no pino de viagem TRANCADO. O mestre escreve "Abre com"
 * no pino; quem encosta nele com o item na mochila passa sem pedir (como no
 * livre) e o mestre recebe o aviso. Quem não tem continua barrado, com o
 * motivo genérico de sempre. O "Abre com" nunca vai ao jogador; o nome da
 * chave só volta a quem a carrega e está encostado.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 50
const SALAO = 'cena-salao'
const MANSAO = 'cena-mansao'
const CRIPTA = 'cena-cripta'
const CHAVE = 'Chave do Escudo'
const PINO = { x: 400, y: 200 }
const chaveNaMochila: CarriedItem[] = [{ id: 'pino-chave', nome: CHAVE }]

function token(id: string, name: string, x: number, y: number, mochila?: CarriedItem[]): Token {
  const t: Token = { id, characterId: null, name, x, y, size: 1, image: null }
  return mochila === undefined ? t : { ...t, mochila }
}

interface Montagem {
  portao?: Partial<Pin>
  diegoX?: number
  mansaoAberta?: boolean
}

function mansao(m: Montagem): MapData {
  const portao: Pin = {
    id: 'portao',
    ...PINO,
    kind: 'viagem',
    description: 'Portão do cemitério',
    image: null,
    destino: { sceneId: CRIPTA, pinId: 'fundo' },
    passagem: 'trancada',
    abreCom: CHAVE,
    ...m.portao,
  }
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 40, 10, GRID),
    // Diego encosta no portão (50 px do centro; alcance 75) com a chave; Ana encosta sem.
    tokens: [token('diego-ficha', 'Diego', m.diegoX ?? PINO.x - 50, PINO.y, chaveNaMochila), token('ana-ficha', 'Ana', PINO.x - 40, PINO.y + 40)],
    pins: [portao],
  }
}

function mundo(m: Montagem = {}): HostWorld {
  const salao = { sceneId: SALAO, name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 40, 10, GRID) }
  const mansaoCena = { sceneId: MANSAO, name: 'Mansão', map: mansao(m) }
  const cripta = {
    sceneId: CRIPTA,
    name: 'Cripta',
    map: {
      ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, GRID),
      pins: [{ id: 'fundo', x: 1000, y: 250, kind: 'viagem', description: 'Fundo', image: null, destino: { sceneId: MANSAO, pinId: 'portao' } } satisfies Pin],
    },
  }
  return m.mansaoAberta === true ? { open: mansaoCena, background: [salao, cripta] } : { open: salao, background: [mansaoCena, cripta] }
}

function mesa(world: HostWorld) {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const entrar = (clientId: string, name: string, tokenId: string): string => {
    const joined = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(joined.playerId, tokenId)
    return joined.playerId
  }
  const diego = entrar('c1', 'Diego', 'diego-ficha')
  const ana = entrar('c2', 'Ana', 'ana-ficha')
  s.broadcast(world)
  const pedir = (clientId: string) => s.handleMessage(clientId, { type: 'pin.travel.request', pinId: 'portao' }, world)
  return { s, diego, ana, pedir }
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
}

function pinoNoSnapshot(result: HostResult, clientId: string): Pin | undefined {
  const msg: HostMessage | undefined = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg.map.pins.find((p) => p.id === 'portao')
}

describe('hostSession: a chave da mochila abre o pino de viagem trancado', () => {
  it('Diego encostado com a chave passa sem pedir, a ficha DELE vai para a Cripta e o mestre recebe o aviso', () => {
    const m = mesa(mundo())
    const r = m.pedir('c1')
    expect(r.travelRequest).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
    expect(r.applyTransfer).toMatchObject({ tokenId: 'diego-ficha', playerId: m.diego, fromSceneId: MANSAO, toSceneId: CRIPTA })
    expect(r.pinKeyUsed).toEqual({ playerId: m.diego, playerName: 'Diego', itemName: CHAVE, pinLabel: 'Portão do cemitério', sceneName: 'Mansão' })
  })

  // Grupo rede (pino trancado vira pedido): sem a chave ninguém passa sozinho.
  // No trancado MUDO é a recusa genérica de sempre; no que aceita tentativas
  // (o padrão) vira pedido ao mestre, marcado trancado — nunca passagem.
  const soPedeAoMestre = (r: HostResult, playerName: string) => {
    expect(r.applyTransfer).toBeUndefined()
    expect(r.pinKeyUsed).toBeUndefined()
    expect(r.travelRequest).toMatchObject({ playerName, trancada: true })
  }

  it('Ana encostada sem a chave: a mesma recusa genérica de sempre, e nada chega ao mestre', () => {
    const m = mesa(mundo({ portao: { mudo: true } }))
    const r = m.pedir('c2')
    expect(recusa(r)).toBe('unavailable')
    expect(r.applyTransfer).toBeUndefined()
    expect(r.pinKeyUsed).toBeUndefined()
    expect(r.travelRequest).toBeUndefined()
    soPedeAoMestre(mesa(mundo()).pedir('c2'), 'Ana')
  })

  it('Diego com a chave, mas longe do pino: não passa', () => {
    const m = mesa(mundo({ diegoX: 150, portao: { mudo: true } }))
    const r = m.pedir('c1')
    expect(recusa(r)).toBe('unavailable')
    expect(r.applyTransfer).toBeUndefined()
    expect(r.pinKeyUsed).toBeUndefined()
    soPedeAoMestre(mesa(mundo({ diegoX: 150 })).pedir('c1'), 'Diego')
  })

  it('pino trancado sem "Abre com": nem quem carrega a chave passa', () => {
    const m = mesa(mundo({ portao: { abreCom: undefined, mudo: true } }))
    const r = m.pedir('c1')
    expect(recusa(r)).toBe('unavailable')
    expect(r.applyTransfer).toBeUndefined()
    soPedeAoMestre(mesa(mundo({ portao: { abreCom: undefined } })).pedir('c1'), 'Diego')
  })

  it('"Abre com" que sobrou num pino que voltou a "Pede ao mestre": o pedido vai ao mestre, sem atalho da chave', () => {
    const m = mesa(mundo({ portao: { passagem: 'pede' } }))
    const r = m.pedir('c1')
    expect(r.applyTransfer).toBeUndefined()
    expect(r.pinKeyUsed).toBeUndefined()
    expect(r.travelRequest).toMatchObject({ playerName: 'Diego', pinLabel: 'Portão do cemitério', toSceneId: CRIPTA })
  })

  it('pino na cena aberta no editor: o aviso não repete o nome da cena', () => {
    const m = mesa(mundo({ mansaoAberta: true }))
    const r = m.pedir('c1')
    expect(r.pinKeyUsed).toEqual({ playerId: m.diego, playerName: 'Diego', itemName: CHAVE, pinLabel: 'Portão do cemitério' })
  })

  it('o recorte: Diego recebe só o nome da chave que ele carrega; o "Abre com" não sai para ninguém', () => {
    const m = mesa(mundo())
    const b = m.s.broadcast(mundo())
    const deDiego = pinoNoSnapshot(b, 'c1')
    const deAna = pinoNoSnapshot(b, 'c2')
    expect(deDiego?.chave).toBe(CHAVE)
    expect(deDiego?.passagem).toBe('trancada')
    expect(deDiego !== undefined && 'abreCom' in deDiego).toBe(false)
    expect(deAna?.passagem).toBe('trancada')
    expect(deAna !== undefined && ('abreCom' in deAna || 'chave' in deAna)).toBe(false)
  })
})
