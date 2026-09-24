/**
 * CARAVANA NO MAPA-MUNDI — a sessão do mestre. No mapa-mundi o jogador vê uma
 * ficha só e não a move; o mestre arrasta a caravana (as fichas seguem) e,
 * parada numa cidade, desembarca: cada ficha volta a ser dela na cena de destino.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { CARAVAN_TOKEN_ID } from '../lib/caravan'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number, destino: { sceneId: string; pinId: string }, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino, ...extra }
}

const PORTO = pino('porto', 700, 250, { sceneId: 's-vila', pinId: 'cais' })
const CAIS = pino('cais', 300, 200, { sceneId: 's-mundo', pinId: 'porto' })

function mundoCom(tokens: Token[], pins: Pin[] = [PORTO]): MapData {
  return { ...createEmptyMap('m-mundo', 'Continente Sombrio', 30, 10, 50), worldMap: true, tokens, pins }
}

const VILA: MapData = { ...createEmptyMap('m-vila', 'Vila do Porto', 20, 10, 50), pins: [CAIS] }
const CRIPTA: MapData = { ...createEmptyMap('m-cripta', 'Cripta', 20, 10, 50), tokens: [ficha('ficha-caio', 'Caio', 100, 100)] }

function mesa(mundo: MapData, vila: MapData = VILA): HostWorld {
  return {
    open: { sceneId: 's-mundo', name: 'Continente Sombrio', map: mundo },
    background: [
      { sceneId: 's-vila', name: 'Vila do Porto', map: vila },
      { sceneId: 's-cripta', name: 'Cripta', map: CRIPTA },
    ],
  }
}

function sala(world: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 400, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrar = (clientId: string, nome: string, tokenId: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, world).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  const ana = entrar('c1', 'Ana', 'ficha-ana')
  const bia = entrar('c2', 'Bia', 'ficha-bia')
  const caio = entrar('c3', 'Caio', 'ficha-caio')
  return { s, ana, bia, caio }
}

function snapshotDe(r: HostResult, clientId: string) {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

describe('no mapa-mundi o jogador recebe só a caravana', () => {
  const world = mesa(mundoCom([ficha('ficha-ana', 'Ana Guerreira', 100, 100), ficha('ficha-bia', 'Bia Arqueira', 100, 100)]))

  it('snapshot com uma ficha só, sem ficha própria nem de colega para arrastar ou dar item', () => {
    const { s } = sala(world)
    const snap = snapshotDe(s.broadcast(world), 'c1')
    expect(snap.map.tokens.map((t) => t.id)).toEqual([CARAVAN_TOKEN_ID])
    expect(snap.ownTokens).toEqual([])
    expect(snap.partyTokens).toEqual([])
    const texto = JSON.stringify(snap)
    for (const segredo of ['ficha-ana', 'Ana Guerreira', 'ficha-bia', 'Bia Arqueira', 'Continente Sombrio', 'Vila do Porto', 'ficha-caio']) {
      expect(texto).not.toContain(segredo)
    }
  })

  it('quem está em outra cena continua vendo a dele, com a própria ficha', () => {
    const { s } = sala(world)
    const snap = snapshotDe(s.broadcast(world), 'c3')
    expect(snap.ownTokens).toEqual(['ficha-caio'])
    expect(JSON.stringify(snap)).not.toContain(CARAVAN_TOKEN_ID)
  })

  it('o jogador não move a caravana: o pedido com o id da própria ficha é travado', () => {
    const { s } = sala(world)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ficha-ana', x: 300, y: 300 }, world)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'locked' } }])
    expect(r.applyMove).toBeUndefined()
  })

  it('pino de passagem livre no mapa-mundi não leva um jogador sozinho', () => {
    const livre = pino('porto', 100, 100, { sceneId: 's-vila', pinId: 'cais' }, { passagem: 'livre' })
    const comLivre = mesa(mundoCom([ficha('ficha-ana', 'Ana', 100, 100), ficha('ficha-bia', 'Bia', 100, 100)], [livre]))
    const { s } = sala(comLivre)
    s.broadcast(comLivre)
    const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'porto' }, comLivre)
    expect(r.applyTransfer).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }])
  })
})

describe('o mestre move a caravana e desembarca na cidade', () => {
  it('as fichas seguem a que o mestre arrastou; parada no porto, a oferta aponta a Vila', () => {
    const inicio = mesa(mundoCom([ficha('ficha-ana', 'Ana', 100, 100), ficha('ficha-bia', 'Bia', 150, 100)]))
    const { s } = sala(inicio)
    expect(s.followCaravans(inicio)).toEqual({ moves: [{ tokenId: 'ficha-bia', x: 100, y: 100 }], stops: [] })

    const arrastou = mesa(mundoCom([ficha('ficha-ana', 'Ana', 100, 100), ficha('ficha-bia', 'Bia', 700, 250)]))
    expect(s.followCaravans(arrastou)).toEqual({
      moves: [{ tokenId: 'ficha-ana', x: 700, y: 250 }],
      stops: [{ sceneId: 's-mundo', sceneName: 'Continente Sombrio', pinId: 'porto', toSceneId: 's-vila', toSceneName: 'Vila do Porto' }],
    })
  })

  it('"Desembarcar": cada ficha vai para uma casa livre em volta do cais, e cada jogador recebe scene.changed', () => {
    const noPorto = mesa(mundoCom([ficha('ficha-ana', 'Ana', 700, 250), ficha('ficha-bia', 'Bia', 700, 250)]))
    const { s, ana, bia } = sala(noPorto)
    const chegadas = s.disembarkCaravan('s-mundo', noPorto)
    expect(chegadas.map((c) => [c.transfer.tokenId, c.transfer.playerId, c.transfer.fromSceneId, c.transfer.toSceneId])).toEqual([
      ['ficha-ana', ana, 's-mundo', 's-vila'],
      ['ficha-bia', bia, 's-mundo', 's-vila'],
    ])
    expect(chegadas.flatMap((c) => c.outbound)).toEqual([
      { clientId: 'c1', msg: { type: 'scene.changed', by: 'master' } },
      { clientId: 'c2', msg: { type: 'scene.changed', by: 'master' } },
    ])
    const [a, b] = chegadas.map((c) => ({ x: c.transfer.x, y: c.transfer.y }))
    expect(a).not.toEqual(b)
    for (const p of [a, b]) expect(Math.hypot(p.x - CAIS.x, p.y - CAIS.y) <= 3 * 50 * Math.SQRT2).toBe(true)

    // Depois da travessia (o integrador moveu as fichas), cada um vê a cidade com a própria ficha.
    const naVila = mesa(mundoCom([]), { ...VILA, tokens: chegadas.map((c) => ficha(c.transfer.tokenId, c.transfer.tokenId, c.transfer.x, c.transfer.y)) })
    const snap = snapshotDe(s.broadcast(naVila), 'c1')
    expect(snap.ownTokens).toEqual(['ficha-ana'])
    expect(snap.map.worldMap).toBeUndefined()
    expect(snap.map.tokens.map((t) => t.id).sort()).toEqual(['ficha-ana', 'ficha-bia'])
  })

  it('caravana fora da cidade, ou cena que não é mapa-mundi: ninguém desembarca', () => {
    const noCampo = mesa(mundoCom([ficha('ficha-ana', 'Ana', 100, 100), ficha('ficha-bia', 'Bia', 100, 100)]))
    const { s } = sala(noCampo)
    expect(s.disembarkCaravan('s-mundo', noCampo)).toEqual([])
    expect(s.disembarkCaravan('s-cripta', noCampo)).toEqual([])
    expect(s.disembarkCaravan('s-inexistente', noCampo)).toEqual([])
  })
})
