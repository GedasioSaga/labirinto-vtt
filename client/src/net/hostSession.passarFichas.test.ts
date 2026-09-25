/**
 * REMOVER QUEM SAIU E PASSAR FICHAS E MAPA, lado do host.
 *
 * No fim da sessão o painel do mestre juntava fantasmas: jogador que foi
 * embora e continuava dono de ficha. "Passar fichas e mapa a…"
 * (`handOverPlayer`) tira quem está FORA da mesa e entrega a outro jogador as
 * fichas dele e o que ele já tinha explorado.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

const HALL: HostScene = { sceneId: 's-hall', name: 'Hall de Entrada', map: mapa('m-hall', 'Hall de Entrada', [ficha('lirio', 100, 100), ficha('escudo', 300, 100)]) }
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 777, 333)]) }
const mundo: HostWorld = { open: HALL, background: [CRIPTA] }

/** O canto do Hall que só a planta revelada à Ana marca: longe de toda ficha. */
const CANTO = { x: 1400, y: 450 }

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 5_000, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, resume?: string) => {
    const r = s.handleMessage(clientId, resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return { playerId: welcome.playerId, resumeToken: welcome.resumeToken, name: welcome.name, result: r }
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  const carla = entra('c3', 'Carla')
  s.assignToken(ana.playerId, 'lirio')
  s.assignToken(bruno.playerId, 'machado')
  s.setVisionRadius(ana.playerId, 400)
  s.revealPlan(ana.playerId, mundo)
  s.broadcast(mundo)
  return { s, ana, bruno, carla, entra }
}

/** O snapshot que saiu para `clientId` em `result`. */
function snapshotPara(result: HostResult, clientId: string) {
  const msg = result.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

function exploradoNoCanto(result: HostResult, clientId: string): boolean {
  const explorado = decodeExploration(snapshotPara(result, clientId).explored)
  if (explorado === null) throw new Error('explorado ilegível')
  return isPointExplored(explorado, CANTO)
}

describe('hostSession: passar fichas e mapa de quem saiu', () => {
  it('Ana foi embora: a Carla, que aguardava, fica com o Lírio e com o que a Ana explorou; a Ana sai da mesa', () => {
    const m = mesa()
    m.s.disconnect('c1')
    const r = m.s.handOverPlayer(m.ana.playerId, m.carla.playerId)
    expect(r).not.toBeNull()
    expect(r?.handedTokens).toEqual(['lirio'])
    const lista = m.s.listPlayers(mundo)
    expect(lista.map((p) => p.name)).toEqual(['Bruno', 'Carla'])
    expect(lista.find((p) => p.name === 'Carla')).toMatchObject({ status: 'playing', tokenIds: ['lirio'] })
    const b = m.s.broadcast(mundo)
    expect(snapshotPara(b, 'c3').ownTokens).toEqual(['lirio'])
    // O mapa da Ana veio junto: o canto que só a planta dela marcava.
    expect(exploradoNoCanto(b, 'c3')).toBe(true)
    // O resume velho não ressuscita a Ana: entra alguém novo, sem ficha.
    const volta = m.entra('c7', 'Ana', m.ana.resumeToken)
    expect(volta.playerId).not.toBe(m.ana.playerId)
    expect(volta.result.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
  })

  it('quem recebe já conhecia a cena: soma o explorado dos dois e fica com as duas fichas', () => {
    const m = mesa()
    m.s.assignToken(m.carla.playerId, 'escudo')
    const antes = m.s.broadcast(mundo)
    // A Carla ainda não conhece o canto: está fora do raio do Escudo.
    expect(exploradoNoCanto(antes, 'c3')).toBe(false)
    m.s.disconnect('c1')
    expect(m.s.handOverPlayer(m.ana.playerId, m.carla.playerId)?.handedTokens).toEqual(['lirio'])
    const b = m.s.broadcast(mundo)
    expect(snapshotPara(b, 'c3').ownTokens).toEqual(['escudo', 'lirio'])
    expect(exploradoNoCanto(b, 'c3')).toBe(true)
  })

  it('o Lírio emprestado à Carla passa ao Bruno: o empréstimo acaba, a Carla volta à espera e o Bruno joga como dono', () => {
    const m = mesa()
    m.s.disconnect('c1')
    expect(m.s.lendTokens(m.ana.playerId, m.carla.playerId, mundo).lent).toEqual(['lirio'])
    const r = m.s.handOverPlayer(m.ana.playerId, m.bruno.playerId)
    expect(r?.handedTokens).toEqual(['lirio'])
    expect(r?.outbound).toEqual([{ clientId: 'c3', msg: { type: 'lobby.waiting' } }])
    const lista = m.s.listPlayers(mundo)
    expect(lista.find((p) => p.name === 'Carla')?.tokenIds).toEqual([])
    const bruno = lista.find((p) => p.name === 'Bruno')
    expect(bruno?.tokenIds).toEqual(['machado', 'lirio'])
    expect(bruno?.borrowedFrom).toBeUndefined()
  })

  it('o Lírio emprestado à própria Carla: fica com ela, agora dela, sem ela passar pela espera', () => {
    const m = mesa()
    m.s.disconnect('c1')
    m.s.lendTokens(m.ana.playerId, m.carla.playerId, mundo)
    const r = m.s.handOverPlayer(m.ana.playerId, m.carla.playerId)
    // Nada de "lobby.waiting" para a Carla no meio do caminho.
    expect(r?.outbound.filter((o) => o.clientId === 'c3')).toEqual([])
    const carla = m.s.listPlayers(mundo).find((p) => p.name === 'Carla')
    expect(carla).toMatchObject({ status: 'playing', tokenIds: ['lirio'] })
    expect(carla?.borrowedFrom).toBeUndefined()
  })

  it('a ficha que a Ana jogava emprestada é do dono: não passa à Carla', () => {
    const m = mesa()
    m.s.assignToken(m.bruno.playerId, 'escudo')
    m.s.disconnect('c2')
    // O Escudo do Bruno está no Hall, a cena da Ana: é ela quem o joga.
    expect(m.s.lendTokens(m.bruno.playerId, m.ana.playerId, mundo).lent).toEqual(['escudo'])
    m.s.disconnect('c1')
    const r = m.s.handOverPlayer(m.ana.playerId, m.carla.playerId)
    expect(r?.handedTokens).toEqual(['lirio'])
    const lista = m.s.listPlayers(mundo)
    expect(lista.find((p) => p.name === 'Carla')?.tokenIds).toEqual(['lirio'])
    expect(lista.find((p) => p.name === 'Bruno')?.tokenIds).toEqual(['machado', 'escudo'])
  })

  it('recusa sem mudar nada: Ana conectada, passar a si mesma ou a quem não existe', () => {
    const m = mesa()
    expect(m.s.handOverPlayer(m.ana.playerId, m.carla.playerId)).toBeNull()
    m.s.disconnect('c1')
    expect(m.s.handOverPlayer(m.ana.playerId, m.ana.playerId)).toBeNull()
    expect(m.s.handOverPlayer(m.ana.playerId, 'ninguem')).toBeNull()
    expect(m.s.handOverPlayer('ninguem', m.carla.playerId)).toBeNull()
    const lista = m.s.listPlayers(mundo)
    expect(lista.map((p) => p.name)).toEqual(['Ana', 'Bruno', 'Carla'])
    expect(lista.find((p) => p.name === 'Ana')?.tokenIds).toEqual(['lirio'])
    expect(lista.find((p) => p.name === 'Carla')?.tokenIds).toEqual([])
  })
})
