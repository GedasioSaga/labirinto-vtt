/**
 * MARCA "OLHEM AQUI" no host. O sinal sai na cor da FICHA de quem sinaliza (o
 * vermelho do Bruno, e não uma cor sorteada que se repete com 7 jogadores). A
 * marca "vamos para cá" fica até o dono tirar: o mestre vê sempre, quem está
 * na MESMA cena vê se já conhece o ponto; quem está em outra cena, ou não
 * conhece o ponto, ou o ponto está em zona oculta, não recebe nada.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const COR_ELISA = '#3cff00'
const COR_BRUNO = '#e53935'

function ficha(id: string, x: number, y: number, color?: string): Token {
  const base: Token = { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
  return color === undefined ? base : { ...base, color }
}

function mapa(id: string, nome: string, tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens, ...extra }
}

/** Salão (aberto no editor): Elisa (verde) e Caio; Cripta (de fundo): Bruno (vermelho). */
function mundoCom(salaoExtra: Partial<MapData> = {}, salaoTokens?: Token[]): HostWorld {
  const salao: HostScene = {
    sceneId: 's-salao',
    name: 'Salao Norte',
    map: mapa('m-salao', 'Salao Norte', salaoTokens ?? [ficha('lanterna', 100, 100, COR_ELISA), ficha('adaga', 300, 100)], salaoExtra),
  }
  const cripta: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100, COR_BRUNO)]) }
  return { open: salao, background: [cripta] }
}

function mesa(mundo: HostWorld = mundoCom()) {
  let clock = 0
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 5000, now: () => clock, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return welcome.playerId
  }
  const elisa = entra('c1', 'Elisa')
  const bruno = entra('c2', 'Bruno')
  const caio = entra('c3', 'Caio')
  s.assignToken(elisa, 'lanterna')
  s.assignToken(bruno, 'machado')
  s.assignToken(caio, 'adaga')
  // Snapshot de todo mundo: é ele que diz o que cada um já conhece.
  s.broadcast(mundo)
  return { s, mundo, elisa, bruno, caio, entra, advance: (ms: number) => (clock += ms) }
}

const para = (r: HostResult, clientId: string) => r.outbound.filter((o) => o.clientId === clientId)
const marcasDe = (r: HostResult, clientId: string) => para(r, clientId).filter((o) => o.msg.type === 'destinations')

describe('hostSession: sinal na cor da ficha', () => {
  it('Bruno (ficha vermelha) sinaliza: o mestre e o eco saem vermelhos, com o nome dele', () => {
    const t = mesa()
    const r = t.s.handleMessage('c2', { type: 'signal', x: 200, y: 200 }, t.mundo)
    expect(r.signal).toMatchObject({ playerId: t.bruno, name: 'Bruno', color: COR_BRUNO })
    expect(para(r, 'c2')).toEqual([{ clientId: 'c2', msg: { type: 'signal', x: 200, y: 200, from: 'Bruno', color: COR_BRUNO } }])
  })

  it('o colega da mesma cena recebe o sinal de Elisa na cor da ficha dela', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'signal', x: 200, y: 300 }, t.mundo)
    expect(para(r, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'signal', x: 200, y: 300, from: 'Elisa', color: COR_ELISA } }])
  })
})

describe('hostSession: marca "vamos para cá"', () => {
  it('Elisa marca: ela e Caio (mesma cena, conhece o ponto) recebem a marca na cor dela; Bruno, em outra cena, nada', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'destination', x: 200, y: 300 }, t.mundo)
    expect(marcasDe(r, 'c1')).toEqual([{ clientId: 'c1', msg: { type: 'destinations', marks: [{ x: 200, y: 300, from: 'Elisa', color: COR_ELISA, mine: true }] } }])
    expect(marcasDe(r, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'destinations', marks: [{ x: 200, y: 300, from: 'Elisa', color: COR_ELISA, mine: false }] } }])
    expect(para(r, 'c2')).toEqual([])
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId === 'c2'))).not.toContain('Elisa')
  })

  it('a marca fica: 10 s depois o mestre ainda a vê, e quem chega à cena depois recebe', () => {
    const t = mesa()
    t.s.handleMessage('c1', { type: 'destination', x: 200, y: 300 }, t.mundo)
    t.advance(10_000)
    const depois = t.s.broadcast(t.mundo)
    // Nada mudou para quem já tem a marca: não repete.
    expect(marcasDe(depois, 'c3')).toEqual([])
    const elisa = t.s.listPlayers(t.mundo).find((p) => p.playerId === t.elisa)
    expect(elisa?.destination).toEqual({ x: 200, y: 300, color: COR_ELISA })
    // Dani entra agora e ganha uma ficha no Salão: a marca de Elisa chega com o mapa.
    const mundo = mundoCom({}, [ficha('lanterna', 100, 100, COR_ELISA), ficha('adaga', 300, 100), ficha('arco', 250, 100)])
    const dani = t.entra('c4', 'Dani')
    t.s.assignToken(dani, 'arco')
    const chegada = t.s.broadcast(mundo)
    expect(marcasDe(chegada, 'c4')).toEqual([{ clientId: 'c4', msg: { type: 'destinations', marks: [{ x: 200, y: 300, from: 'Elisa', color: COR_ELISA, mine: false }] } }])
  })

  it('segurança: o mestre vê a marca de quem está em cena de fundo, e ela não vai a ninguém de outra cena', () => {
    const t = mesa()
    const r = t.s.handleMessage('c2', { type: 'destination', x: 400, y: 200 }, t.mundo)
    expect(marcasDe(r, 'c2')).toHaveLength(1)
    expect(para(r, 'c1')).toEqual([])
    expect(para(r, 'c3')).toEqual([])
    const bruno = t.s.listPlayers(t.mundo).find((p) => p.playerId === t.bruno)
    expect(bruno).toMatchObject({ sceneId: 's-cripta', destination: { x: 400, y: 200, color: COR_BRUNO } })
  })

  it('segurança: ponto que Caio nunca viu (atrás da parede) não chega a ele; do lado dele, chega', () => {
    const parede: Wall = { id: 'div', x1: 500, y1: 0, x2: 500, y2: 500, blocksLight: true, blocksMove: true, door: null }
    const t = mesa(mundoCom({ walls: [parede] }, [ficha('lanterna', 100, 100, COR_ELISA), ficha('adaga', 700, 100)]))
    const escondido = t.s.handleMessage('c1', { type: 'destination', x: 200, y: 300 }, t.mundo)
    expect(marcasDe(escondido, 'c1')).toHaveLength(1)
    expect(para(escondido, 'c3')).toEqual([])
    t.advance(1_000)
    const visto = t.s.handleMessage('c1', { type: 'destination', x: 800, y: 300 }, t.mundo)
    expect(marcasDe(visto, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'destinations', marks: [{ x: 800, y: 300, from: 'Elisa', color: COR_ELISA, mine: false }] } }])
  })

  it('segurança: marca dentro de zona oculta ativa não vai a Caio, que vê o lugar; o mestre vê', () => {
    const zona = [{ x: 400, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 400 }, { x: 400, y: 400 }]
    const t = mesa(mundoCom({ concealZones: [{ id: 'z', name: 'cofre', revealed: false, points: zona }] }))
    const r = t.s.handleMessage('c1', { type: 'destination', x: 500, y: 300 }, t.mundo)
    expect(para(r, 'c3')).toEqual([])
    expect(JSON.stringify(r.outbound)).not.toContain('"c3"')
    expect(t.s.listPlayers(t.mundo).find((p) => p.playerId === t.elisa)?.destination).toEqual({ x: 500, y: 300, color: COR_ELISA })
  })

  it('"Tirar marca" some nas três telas: Elisa, Caio e o mestre', () => {
    const t = mesa()
    t.s.handleMessage('c1', { type: 'destination', x: 200, y: 300 }, t.mundo)
    const tirou = t.s.handleMessage('c1', { type: 'destination', clear: true }, t.mundo)
    expect(marcasDe(tirou, 'c1')).toEqual([{ clientId: 'c1', msg: { type: 'destinations', marks: [] } }])
    expect(marcasDe(tirou, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'destinations', marks: [] } }])
    expect(para(tirou, 'c2')).toEqual([])
    const elisa = t.s.listPlayers(t.mundo).find((p) => p.playerId === t.elisa)
    expect(elisa).toBeDefined()
    expect(elisa?.destination).toBeUndefined()
  })

  it('marcar de novo move a marca (uma por jogador), e o limite de ritmo segura quem martela', () => {
    const t = mesa()
    t.s.handleMessage('c1', { type: 'destination', x: 200, y: 300 }, t.mundo)
    const cedo = t.s.handleMessage('c1', { type: 'destination', x: 250, y: 300 }, t.mundo)
    expect(cedo.outbound).toEqual([])
    t.advance(1_000)
    const r = t.s.handleMessage('c1', { type: 'destination', x: 250, y: 300 }, t.mundo)
    expect(marcasDe(r, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'destinations', marks: [{ x: 250, y: 300, from: 'Elisa', color: COR_ELISA, mine: false }] } }])
  })

  it('Elisa desce para a Cripta: a marca do Salão some para Caio e não aparece para Bruno', () => {
    const t = mesa()
    t.s.handleMessage('c1', { type: 'destination', x: 200, y: 300 }, t.mundo)
    const desceu: HostWorld = {
      open: { ...t.mundo.open, map: { ...t.mundo.open.map, tokens: [ficha('adaga', 300, 100)] } },
      background: t.mundo.background.map((cena) => ({ ...cena, map: { ...cena.map, tokens: [ficha('machado', 200, 100, COR_BRUNO), ficha('lanterna', 250, 100, COR_ELISA)] } })),
    }
    const r = t.s.broadcast(desceu)
    expect(marcasDe(r, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'destinations', marks: [] } }])
    expect(JSON.stringify(marcasDe(r, 'c2'))).not.toContain('Elisa')
    expect(t.s.listPlayers(desceu).find((p) => p.playerId === t.elisa)?.destination).toBeUndefined()
  })

  it('ponto fora do mapa ou de quem não joga é descartado em silêncio', () => {
    const t = mesa()
    expect(t.s.handleMessage('c1', { type: 'destination', x: -5, y: 300 }, t.mundo).outbound).toEqual([])
    const sem = t.entra('c5', 'Sem')
    expect(t.s.handleMessage('c5', { type: 'destination', x: 200, y: 300 }, t.mundo).outbound).toEqual([])
    expect(t.s.listPlayers(t.mundo).find((p) => p.playerId === sem)?.destination).toBeUndefined()
  })
})
