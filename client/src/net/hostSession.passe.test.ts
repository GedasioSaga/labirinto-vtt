import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PASSAGEM POR PASSE (crachá, catraca): a ficha que carrega o item do passe,
 * ou que o mestre marcou no pino, passa sem pedido; as outras geram o pedido
 * "sem passe" ao mestre. Deixar uma passar não destranca o pino para ninguém,
 * e o jogador nunca recebe o que é o passe nem quem o tem.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SAGUAO = 'cena-saguao'
const LAB = 'cena-lab'
const ITEM_DO_PASSE = 'Crachá'
const FICHA_MARCADA_LONGE = 'ficha-de-outra-cena'

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function catraca(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'catraca',
    x: 400,
    y: 200,
    kind: 'viagem',
    description: 'Catraca',
    image: null,
    destino: { sceneId: LAB, pinId: 'entrada' },
    passagem: 'passe',
    passe: { item: ITEM_DO_PASSE, fichas: ['ficha-bia', FICHA_MARCADA_LONGE] },
    ...extra,
  }
}

function saguao(pin: Pin): MapData {
  return {
    ...createEmptyMap('mapa-saguao', 'Saguão', 40, 10, 50),
    tokens: [
      // Minúsculo e sem acento de propósito: o passe confere o nome do item, não a grafia.
      // Todas encostadas na catraca (400, 200): o pino de viagem só atravessa de perto.
      token('ficha-fabi', 350, 200, { mochila: [{ id: 'item-1', nome: 'cracha' }] }),
      token('ficha-caio', 360, 240, { mochila: [{ id: 'item-2', nome: 'Lanterna' }] }),
      token('ficha-bia', 340, 160),
      token('ficha-duda', 330, 220),
    ],
    pins: [pin],
  }
}

function lab(): MapData {
  return {
    ...createEmptyMap('mapa-lab', 'Laboratório', 40, 10, 50),
    pins: [{ id: 'entrada', x: 1000, y: 250, kind: 'viagem', description: 'Entrada', image: null, destino: { sceneId: SAGUAO, pinId: 'catraca' } }],
  }
}

function mundo(pin: Pin = catraca()): HostWorld {
  return {
    open: { sceneId: SAGUAO, name: 'Saguão', map: saguao(pin) },
    background: [{ sceneId: LAB, name: 'Laboratório', map: lab() }],
  }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function snapshotDe(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

function mesa(w: HostWorld) {
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
  const entra = (clientId: string, nome: string, ficha: string) => {
    const playerId = welcomeOf(s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, w))
    s.assignToken(playerId, ficha)
  }
  entra('c-fabi', 'Fabi', 'ficha-fabi')
  entra('c-caio', 'Caio', 'ficha-caio')
  entra('c-bia', 'Bia', 'ficha-bia')
  entra('c-duda', 'Duda', 'ficha-duda')
  // O primeiro envio: o broadcast só manda de novo quando a tela de alguém muda.
  const inicial = s.broadcast(w)
  return { s, inicial, pedir: (clientId: string) => s.handleMessage(clientId, { type: 'pin.travel.request', pinId: 'catraca' }, w) }
}

describe('hostSession: passagem por passe', () => {
  it('a Fabi, com o crachá na mochila, passa a catraca sem pedido ao mestre', () => {
    const t = mesa(mundo())
    const r = t.pedir('c-fabi')
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toMatchObject({ tokenId: 'ficha-fabi', fromSceneId: SAGUAO, toSceneId: LAB })
    expect(r.outbound).toEqual([{ clientId: 'c-fabi', msg: { type: 'scene.changed' } }])
  })

  it('a Bia, marcada pelo mestre no pino, passa sem crachá e sem pedido', () => {
    const t = mesa(mundo())
    const r = t.pedir('c-bia')
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toMatchObject({ tokenId: 'ficha-bia', toSceneId: LAB })
  })

  it('o Caio, sem passe, gera o pedido "sem passe" ao mestre e não passa sozinho', () => {
    const t = mesa(mundo())
    const r = t.pedir('c-caio')
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest).toMatchObject({ playerName: 'Caio', toSceneId: LAB, motivo: 'sem-passe' })
  })

  it('o mestre deixar o Caio ir não destranca a catraca: a Duda, sem passe, ainda gera pedido', () => {
    const w = mundo()
    const t = mesa(w)
    const pedido = t.pedir('c-caio').travelRequest
    if (pedido === undefined) throw new Error('o pedido do Caio deveria chegar ao mestre')
    expect(t.s.approveTravel(pedido.requestId, w).applyTransfer).toMatchObject({ tokenId: 'ficha-caio', toSceneId: LAB })
    const daDuda = t.pedir('c-duda')
    expect(daDuda.applyTransfer).toBeUndefined()
    expect(daDuda.travelRequest).toMatchObject({ playerName: 'Duda', motivo: 'sem-passe' })
  })

  it('controle: no modo "pede", o pedido do Caio chega sem o motivo "sem passe"', () => {
    const t = mesa(mundo(catraca({ passagem: 'pede' })))
    const r = t.pedir('c-caio')
    expect(r.travelRequest).toMatchObject({ playerName: 'Caio' })
    expect(r.travelRequest?.motivo).toBeUndefined()
  })

  it('o pacote do jogador não traz o passe: nem o item, nem a lista de quem tem', () => {
    const w = mundo()
    const t = mesa(w)
    const r = t.inicial
    const pinoDoCaio = snapshotDe(r, 'c-caio').map.pins.find((p) => p.id === 'catraca')
    // O modo vai (o cartão oferece "Passar"); o que abre a catraca, não.
    expect(pinoDoCaio).toMatchObject({ id: 'catraca', passagem: 'passe' })
    expect(pinoDoCaio !== undefined && 'passe' in pinoDoCaio).toBe(false)
    const pacoteDoCaio = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-caio'))
    expect(pacoteDoCaio).not.toContain(FICHA_MARCADA_LONGE)
    expect(pacoteDoCaio).not.toContain(ITEM_DO_PASSE)
    expect(pacoteDoCaio).not.toContain('cracha')
    expect(pacoteDoCaio).not.toContain('"fichas"')
    // Controle: a Fabi recebe a PRÓPRIA mochila — o teste acima enxergaria o nome se ele vazasse.
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-fabi'))).toContain('cracha')
  })
})
