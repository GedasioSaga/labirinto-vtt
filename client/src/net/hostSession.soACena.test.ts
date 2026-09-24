/**
 * HOST RECALCULA SÓ A CENA QUE MUDOU — um passo (ou o arrasto de um NPC pelo
 * mestre) numa cena não refaz o recorte de quem está nas outras. O host só
 * refiltra o jogador cuja cena mudou (ou uma cena onde ele tem ficha, que
 * entra na lista "minhas fichas em outras cenas"), ou quando algo DELE mudou
 * na sessão: raio de visão, fichas, planta revelada ou escondida, "Quem vê".
 *
 * "Mudou" = o `MapData` da cena é outro objeto: as stores do mestre (mapStore
 * e o cache da aventura) nunca editam um mapa no lugar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fogFilter from '../lib/fogFilter'
import { createEmptyMap, setTokenPosition } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

vi.mock('../lib/fogFilter', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/fogFilter')>()
  return { ...real, filterMapForPlayer: vi.fn(real.filterMapForPlayer) }
})

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, tokens: Token[], pins: Pin[] = []): MapData {
  return { ...createEmptyMap(id, id, 30, 10, 50), tokens, pins }
}

/**
 * Salão (aberta): 'heroi' de Ana e o NPC 'guarda'. Cripta (fundo): 'rival' de
 * Bruno e 'batedor' de Ana (a ficha dela em outra cena). Torre (fundo): 'vigia'
 * de Caio.
 */
function mundoInicial(): HostWorld {
  return {
    open: { sceneId: 's-salao', name: 'Salao', map: mapa('m-salao', [ficha('heroi', 100, 100), ficha('guarda', 300, 100)]) },
    background: [
      { sceneId: 's-cripta', name: 'Cripta', map: mapa('m-cripta', [ficha('rival', 100, 100), ficha('batedor', 400, 100)]) },
      { sceneId: 's-torre', name: 'Torre', map: mapa('m-torre', [ficha('vigia', 100, 100)]) },
    ],
  }
}

function mesa(mundo: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const resumes = new Map<string, string>()
  const entra = (clientId: string, name: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    resumes.set(welcome.playerId, welcome.resumeToken)
    return welcome.playerId
  }
  const ana = entra('c-ana', 'Ana')
  const bruno = entra('c-bruno', 'Bruno')
  const caio = entra('c-caio', 'Caio')
  s.assignToken(ana, 'heroi')
  s.assignToken(ana, 'batedor')
  s.assignToken(bruno, 'rival')
  s.assignToken(caio, 'vigia')
  return { s, ana, bruno, caio, resumeDe: (playerId: string) => resumes.get(playerId) ?? '' }
}

/** Quem recebeu snapshot neste envio, em ordem de conexão. */
function comSnapshot(r: HostResult): string[] {
  return r.outbound.filter((o) => o.msg.type === 'snapshot').map((o) => o.clientId)
}

const filtro = vi.mocked(fogFilter.filterMapForPlayer)

/** Para quem o host refez o recorte (`filterMapForPlayer`) desde o último `mockClear`. */
function refiltrados(): string[] {
  return [...new Set(filtro.mock.calls.map((call) => call[1]))].sort()
}

/** Troca o mapa de uma cena por um NOVO objeto, como fazem as stores do mestre. */
function comCena(mundo: HostWorld, mapId: string, muda: (map: MapData) => MapData): HostWorld {
  if (mundo.open.map.id === mapId) return { ...mundo, open: { ...mundo.open, map: muda(mundo.open.map) } }
  return { ...mundo, background: mundo.background.map((cena) => (cena.map.id === mapId ? { ...cena, map: muda(cena.map) } : cena)) }
}

/**
 * A mesa "parada": o primeiro envio explora o chão que cada um vê; o segundo
 * refaz o recorte já com esse explorado (é o que os testes de SEGURANÇA do
 * explorado exigem) e, sem chão novo, o recorte de todos assenta.
 */
function assenta(s: ReturnType<typeof mesa>['s'], mundo: HostWorld): void {
  s.broadcast(mundo)
  s.broadcast(mundo)
}

beforeEach(() => {
  filtro.mockClear()
})

describe('o host recalcula só a cena que mudou', () => {
  it('o primeiro envio refaz o recorte de todos e manda a cada um a sua cena', () => {
    const mundo = mundoInicial()
    const { s, ana, bruno, caio } = mesa(mundo)
    filtro.mockClear()
    const r = s.broadcast(mundo)
    expect(comSnapshot(r)).toEqual(['c-ana', 'c-bruno', 'c-caio'])
    expect(refiltrados()).toEqual([ana, bruno, caio].sort())
  })

  it('quem explorou chão novo é refeito uma vez no envio seguinte; depois, parado, ninguém', () => {
    const mundo = mundoInicial()
    const { s, ana, bruno, caio } = mesa(mundo)
    s.broadcast(mundo)
    filtro.mockClear()
    expect(comSnapshot(s.broadcast(mundo))).toEqual(['c-ana', 'c-bruno', 'c-caio'])
    expect(refiltrados()).toEqual([ana, bruno, caio].sort())
    filtro.mockClear()
    expect(comSnapshot(s.broadcast(mundo))).toEqual([])
    expect(filtro.mock.calls.length).toBe(0)
  })

  it('o mestre arrasta o NPC no Salão: só Ana é refiltrada e recebe; Bruno e Caio, nada', () => {
    const mundo = mundoInicial()
    const { s, ana } = mesa(mundo)
    assenta(s, mundo)
    filtro.mockClear()
    const depois = comCena(mundo, 'm-salao', (map) => setTokenPosition(map, 'guarda', 350, 100))
    const r = s.broadcast(depois)
    expect(comSnapshot(r)).toEqual(['c-ana'])
    expect(refiltrados()).toEqual([ana])
    const snap = r.outbound.find((o) => o.clientId === 'c-ana' && o.msg.type === 'snapshot')?.msg
    expect(snap?.type === 'snapshot' ? snap.map.tokens.find((t) => t.id === 'guarda')?.x : null).toBe(350)
  })

  it('um passo na Cripta refaz Bruno (está lá) e Ana (tem ficha lá), nunca Caio da Torre', () => {
    const mundo = mundoInicial()
    const { s, ana, bruno } = mesa(mundo)
    assenta(s, mundo)
    filtro.mockClear()
    const depois = comCena(mundo, 'm-cripta', (map) => setTokenPosition(map, 'rival', 150, 100))
    const r = s.broadcast(depois)
    expect(comSnapshot(r)).toEqual(['c-ana', 'c-bruno'])
    expect(refiltrados()).toEqual([ana, bruno].sort())
  })

  it('nada mudou: o envio não refiltra ninguém nem manda snapshot repetido', () => {
    const mundo = mundoInicial()
    const { s } = mesa(mundo)
    assenta(s, mundo)
    filtro.mockClear()
    const r = s.broadcast({ ...mundo, background: [...mundo.background] })
    expect(r.outbound.length).toBe(0)
    expect(filtro.mock.calls.length).toBe(0)
  })

  it('a cena muda de novo depois de pular um envio: o snapshot sai com rev maior que o anterior', () => {
    const mundo = mundoInicial()
    const { s } = mesa(mundo)
    const primeiro = s.broadcast(mundo).outbound.find((o) => o.clientId === 'c-caio')?.msg
    s.broadcast(comCena(mundo, 'm-salao', (map) => setTokenPosition(map, 'guarda', 350, 100)))
    const r = s.broadcast(comCena(mundo, 'm-torre', (map) => setTokenPosition(map, 'vigia', 150, 100)))
    const segundo = r.outbound.find((o) => o.clientId === 'c-caio')?.msg
    expect(primeiro?.type).toBe('snapshot')
    expect(segundo?.type).toBe('snapshot')
    const revs = primeiro?.type === 'snapshot' && segundo?.type === 'snapshot' ? [primeiro.rev, segundo.rev] : []
    expect(revs.length).toBe(2)
    expect(revs[1]).toBeGreaterThan(revs[0] ?? Infinity)
  })
})

describe('o que é do jogador na sessão ainda refaz o recorte dele', () => {
  it('raio de visão só de Bruno: só ele é refiltrado', () => {
    const mundo = mundoInicial()
    const { s, bruno } = mesa(mundo)
    assenta(s, mundo)
    filtro.mockClear()
    s.setVisionRadius(bruno, 100)
    const r = s.broadcast(mundo)
    expect(comSnapshot(r)).toEqual(['c-bruno'])
    expect(refiltrados()).toEqual([bruno])
  })

  it('ficha nova para Caio: só ele é refiltrado', () => {
    const mundo = comCena(mundoInicial(), 'm-torre', (map) => ({ ...map, tokens: [...map.tokens, ficha('corvo', 200, 100)] }))
    const { s, caio } = mesa(mundo)
    assenta(s, mundo)
    filtro.mockClear()
    s.assignToken(caio, 'corvo')
    const r = s.broadcast(mundo)
    expect(comSnapshot(r)).toEqual(['c-caio'])
    expect(refiltrados()).toEqual([caio])
  })

  it('revelar e esconder a planta de Caio: ele é refiltrado nas duas', () => {
    const mundo = mundoInicial()
    const { s, caio } = mesa(mundo)
    assenta(s, mundo)
    s.revealPlan(caio, mundo)
    expect(comSnapshot(s.broadcast(mundo))).toEqual(['c-caio'])
    s.hidePlan(caio, mundo)
    expect(comSnapshot(s.broadcast(mundo))).toEqual(['c-caio'])
    s.hidePlan(caio)
    filtro.mockClear()
    expect(comSnapshot(s.broadcast(mundo))).toEqual(['c-caio'])
    expect(refiltrados()).toEqual([caio])
  })

  it('"Quem vê" de um pino muda: todos são refiltrados', () => {
    const mundo = mundoInicial()
    const { s, ana, bruno, caio } = mesa(mundo)
    assenta(s, mundo)
    filtro.mockClear()
    s.setPinAudience('qualquer-pino', [ana])
    const r = s.broadcast(mundo)
    expect(comSnapshot(r)).toEqual(['c-ana', 'c-bruno', 'c-caio'])
    expect(refiltrados()).toEqual([ana, bruno, caio].sort())
  })

  it('foto recusada pelo limite de tempo: o próximo envio devolve a tela de Caio ao que o mestre tem', () => {
    const mundo = mundoInicial()
    const { s } = mesa(mundo)
    assenta(s, mundo)
    expect(s.handleMessage('c-caio', { type: 'token.edit', tokenId: 'vigia', image: null }, mundo).applyTokenEdit?.tokenId).toBe('vigia')
    // Segunda foto dentro da janela: recusada em silêncio. A tela dele pôs a foto na hora (otimista).
    const recusada = s.handleMessage('c-caio', { type: 'token.edit', tokenId: 'vigia', image: null }, mundo)
    expect(recusada.applyTokenEdit).toBeUndefined()
    expect(comSnapshot(s.broadcast(mundo))).toEqual(['c-caio'])
  })

  it('Bruno cai e volta pelo resume: a volta traz a cena, e o envio seguinte sem mudança não repete', () => {
    const mundo = mundoInicial()
    const { s, bruno, resumeDe } = mesa(mundo)
    assenta(s, mundo)
    s.disconnect('c-bruno')
    const volta = s.handleMessage('c-bruno-2', { type: 'join', code: CODE, name: 'Bruno', resume: resumeDe(bruno) }, mundo)
    expect(comSnapshot(volta)).toEqual(['c-bruno-2'])
    expect(comSnapshot(s.broadcast(mundo))).toEqual([])
    // A cena dele muda depois da volta: o snapshot vai para a conexão NOVA.
    expect(comSnapshot(s.broadcast(comCena(mundo, 'm-cripta', (map) => setTokenPosition(map, 'rival', 150, 100))))).toEqual(['c-ana', 'c-bruno-2'])
  })
})

describe('a ficha sai e volta: o jogador sai da espera', () => {
  it('o mestre tira a única ficha de Caio e devolve a mesma: o envio seguinte leva a Torre a ele', () => {
    const mundo = mundoInicial()
    const { s, caio } = mesa(mundo)
    assenta(s, mundo)
    const saida = s.unassignToken(caio, 'vigia')
    expect(saida.outbound.map((o) => [o.clientId, o.msg.type])).toEqual([['c-caio', 'lobby.waiting']])
    expect(comSnapshot(s.broadcast(mundo))).toEqual([])
    s.assignToken(caio, 'vigia')
    filtro.mockClear()
    const r = s.broadcast(mundo)
    expect(comSnapshot(r)).toEqual(['c-caio'])
    expect(refiltrados()).toEqual([caio])
    const snap = r.outbound.find((o) => o.clientId === 'c-caio' && o.msg.type === 'snapshot')?.msg
    expect(snap?.type === 'snapshot' ? snap.map.id : null).toBe('m-torre')
  })

  it('a ficha de Caio passa para Bruno e volta para Caio: Caio recebe a Torre de novo', () => {
    const mundo = mundoInicial()
    const { s, bruno, caio } = mesa(mundo)
    assenta(s, mundo)
    const tirada = s.assignToken(bruno, 'vigia')
    expect(tirada.outbound.map((o) => [o.clientId, o.msg.type])).toEqual([['c-caio', 'lobby.waiting']])
    s.broadcast(mundo)
    s.assignToken(caio, 'vigia')
    const r = s.broadcast(mundo)
    expect(comSnapshot(r)).toContain('c-caio')
    const snap = r.outbound.find((o) => o.clientId === 'c-caio' && o.msg.type === 'snapshot')?.msg
    expect(snap?.type === 'snapshot' ? snap.map.id : null).toBe('m-torre')
  })
})
