/**
 * RETOMAR A MESA, lado da sessão: a sala reaberta com a mesa guardada devolve
 * a cada jogador, pelo NOME, as fichas, o raio e a cena que ele tinha. A mesa
 * guardada é do mestre: quem entra com outro nome não fica sabendo de quem
 * ainda não voltou, nem das fichas dele, nem da cena em que elas estão.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SavedSeat } from '../lib/savedTable'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

const SALAO: HostScene = { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', [ficha('lirio', 100, 100), ficha('vela', 300, 100)]) }
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('grog', 777, 333)]) }
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

const ASSENTOS: SavedSeat[] = [
  { name: 'Ana', tokenIds: ['lirio'], visionRadius: 350, sceneKey: 'm-salao' },
  { name: 'Bruno', tokenIds: ['grog'], visionRadius: null, sceneKey: 'm-cripta' },
]

function mesa(assentos: readonly SavedSeat[] = ASSENTOS) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000 + n, randomId: () => `id-${(n += 1)}`, restoreSeats: assentos })
  const entra = (clientId: string, name: string) => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return { playerId: welcome.playerId, result: r }
  }
  return { s, entra }
}

describe('hostSession: retomar a mesa pelo nome', () => {
  it('Ana entra como "ana" e já está com Lírio, no raio e na cena de antes', () => {
    const { s, entra } = mesa()
    const ana = entra('c1', 'ana')
    expect(ana.result.reclaimed).toEqual({ playerId: ana.playerId, name: 'Ana', tokenIds: ['lirio'] })
    const snapshot = ana.result.outbound[1]?.msg
    if (snapshot?.type !== 'snapshot') throw new Error('quem retoma a ficha entra jogando')
    expect(snapshot.ownTokens).toEqual(['lirio'])
    expect(s.listPlayers(mundo)[0]).toMatchObject({ name: 'ana', status: 'playing', tokenIds: ['lirio'], visionRadius: 350, sceneName: 'Salao Norte' })
  })

  it('quem retoma NÃO recebe nada de quem ainda não voltou (nome, ficha, cena, posição)', () => {
    const { entra } = mesa()
    const texto = JSON.stringify(entra('c1', 'Ana').result.outbound)
    expect(texto).toContain('lirio')
    expect(texto).not.toContain('Bruno')
    expect(texto).not.toContain('grog')
    expect(texto).not.toContain('Cripta')
    expect(texto).not.toContain('777')
  })

  it('nome novo fica "Sem personagem", como hoje, e não fica sabendo da mesa guardada', () => {
    const { s, entra } = mesa()
    const carla = entra('c1', 'Carla')
    expect(carla.result.reclaimed).toBeUndefined()
    expect(carla.result.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
    expect(s.listPlayers(mundo)[0]).toMatchObject({ name: 'Carla', status: 'waiting', tokenIds: [], visionRadius: 700 })
    // Nem na entrada nem na lista de companheiros: assento guardado não é jogador.
    const texto = JSON.stringify([carla.result.outbound, s.partyUpdates(mundo).outbound])
    for (const segredo of ['Ana', 'Bruno', 'lirio', 'grog', 'Cripta', 'Salao']) expect(texto).not.toContain(segredo)
  })

  it('o assento vale uma vez: outra "Ana" com a primeira na sala vira "Ana (2)" sem ficha', () => {
    const { s, entra } = mesa()
    entra('c1', 'Ana')
    const outra = entra('c2', 'ANA')
    expect(outra.result.reclaimed).toBeUndefined()
    const players = s.listPlayers(mundo)
    expect(players.map((p) => [p.name, p.tokenIds])).toEqual([
      ['Ana', ['lirio']],
      ['ANA (2)', []],
    ])
  })

  it('ficha que o mestre já deu a outro, ou que sumiu do mapa, não volta', () => {
    const { s, entra } = mesa([{ name: 'Ana', tokenIds: ['lirio', 'sumiu', 'vela'], visionRadius: null, sceneKey: null }])
    const carla = entra('c1', 'Carla')
    s.assignToken(carla.playerId, 'vela')
    const ana = entra('c2', 'Ana')
    expect(ana.result.reclaimed?.tokenIds).toEqual(['lirio'])
    expect(s.listPlayers(mundo).map((p) => [p.name, p.tokenIds])).toEqual([
      ['Carla', ['vela']],
      ['Ana', ['lirio']],
    ])
  })

  it('assento sem ficha que sobre não entrega nada: a pessoa entra sem personagem', () => {
    const { s, entra } = mesa([{ name: 'Ana', tokenIds: ['sumiu'], visionRadius: 900, sceneKey: null }])
    const ana = entra('c1', 'Ana')
    expect(ana.result.reclaimed).toBeUndefined()
    expect(s.listPlayers(mundo)[0]).toMatchObject({ status: 'waiting', tokenIds: [], visionRadius: 700 })
  })

  it('a cena guardada desempata quem tinha ficha em duas cenas', () => {
    const { entra } = mesa([{ name: 'Ana', tokenIds: ['lirio', 'grog'], visionRadius: null, sceneKey: 'm-cripta' }])
    const snapshot = entra('c1', 'Ana').result.outbound[1]?.msg
    if (snapshot?.type !== 'snapshot') throw new Error('esperava snapshot')
    expect(snapshot.map.id).toBe('m-cripta')
    expect(snapshot.map.tokens.map((t) => t.id)).toEqual(['grog'])
  })

  it('Desfazer: a ficha sai, o raio volta ao padrão, a pessoa volta a esperar e o assento fica para a Ana de verdade', () => {
    const { s, entra } = mesa()
    const falsa = entra('c1', 'Ana')
    const desfeito = s.undoReclaim(falsa.playerId)
    expect(desfeito.outbound).toEqual([{ clientId: 'c1', msg: { type: 'lobby.waiting' } }])
    expect(s.listPlayers(mundo)[0]).toMatchObject({ status: 'waiting', tokenIds: [], visionRadius: 700 })
    // Desfazer de novo não faz nada.
    expect(s.undoReclaim(falsa.playerId).outbound).toEqual([])
    s.kick('c1')
    const verdadeira = entra('c2', 'Ana')
    expect(verdadeira.result.reclaimed?.tokenIds).toEqual(['lirio'])
  })

  it('Desfazer só tira as fichas devolvidas: a que o mestre deu depois fica', () => {
    const { s, entra } = mesa()
    const ana = entra('c1', 'Ana')
    s.assignToken(ana.playerId, 'vela')
    expect(s.undoReclaim(ana.playerId).outbound).toEqual([])
    expect(s.listPlayers(mundo)[0]).toMatchObject({ status: 'playing', tokenIds: ['vela'] })
  })

  it('savedSeats: o que gravar — quem está com ficha e quem ainda não voltou', () => {
    const { s, entra } = mesa()
    expect(s.savedSeats()).toEqual(ASSENTOS)
    const ana = entra('c1', 'Ana')
    const carla = entra('c2', 'Carla')
    s.setVisionRadius(carla.playerId, 400)
    // Carla sem ficha não entra na mesa gravada.
    expect(s.savedSeats().map((seat) => seat.name)).toEqual(['Ana', 'Bruno'])
    // O mestre dá a ficha do Bruno à Carla: o assento do Bruno fica sem nada e sai.
    s.assignToken(carla.playerId, 'grog')
    s.listPlayers(mundo)
    expect(s.savedSeats()).toEqual([
      { name: 'Ana', tokenIds: ['lirio'], visionRadius: 350, sceneKey: 'm-salao' },
      { name: 'Carla', tokenIds: ['grog'], visionRadius: 400, sceneKey: 'm-cripta' },
    ])
    expect(ana.playerId).not.toBe(carla.playerId)
  })

  it('sem mesa guardada, a sala é a de hoje', () => {
    const s = createHostSession({ code: CODE, visionRadius: 700 })
    const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, mundo)
    expect(r.reclaimed).toBeUndefined()
    expect(r.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
    expect(s.savedSeats()).toEqual([])
  })
})
