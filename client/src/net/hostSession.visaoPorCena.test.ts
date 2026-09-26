/**
 * VISÃO POR CENA (backlog da simulação de 7 jogadores, 22/09): a cena diz
 * quantos quadrados se enxerga nela e cada jogador tem um fator próprio. Na
 * mina (6 quadrados) a Eva, com x1,5, vê mais longe que o Oto; no mapa-mundi
 * os dois enxergam a cidade seguinte sem o mestre mexer em nada.
 *
 * O que muda na rede é só o recorte: o alcance da cena e o fator de cada um
 * são do mestre e não viajam no snapshot.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const CASA = 64
/** Centro de um mapa de 60 x 60 casas: longe da borda em toda direção. */
const CENTRO = 30 * CASA

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, tokens: Token[], visionCells?: number): MapData {
  const base: MapData = { ...createEmptyMap(id, `Cena ${id}`, 60, 60, CASA), tokens }
  return visionCells === undefined ? base : { ...base, visionCells }
}

/** Oto (c1, ficha 'oto') e Eva (c2, ficha 'eva'), raio global de fábrica 700 px. */
function mesa(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, nome: string, tokenId: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, source)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  const oto = entra('c1', 'Oto', 'oto')
  const eva = entra('c2', 'Eva', 'eva')
  return { s, oto, eva }
}

function snapshotDe(r: HostResult, clientId: string) {
  // Quem mudou de cena sem passar pela sessão recebe antes o `scene.changed`.
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

/** Até onde vai o círculo de visão da própria ficha, em px de mundo. */
function alcance(ring: RegionPoint[] | undefined, origem: { x: number; y: number }): number {
  if (ring === undefined) return 0
  return Math.round(Math.max(...ring.map((p) => Math.hypot(p.x - origem.x, p.y - origem.y))))
}

describe('raio de visão por cena', () => {
  it('mina com 6 quadrados: Oto (x1,0) vê 6 casas, Eva (x1,5) vê 9', () => {
    const mina = mapa('mina', [ficha('oto', CENTRO, CENTRO), ficha('eva', CENTRO, CENTRO)], 6)
    const { s, eva } = mesa(mina)
    s.setVisionFactor(eva, 1.5)
    const r = s.broadcast(mina)
    const doOto = alcance(snapshotDe(r, 'c1').vision[0], { x: CENTRO, y: CENTRO })
    const daEva = alcance(snapshotDe(r, 'c2').vision[0], { x: CENTRO, y: CENTRO })
    expect(doOto).toBe(6 * CASA)
    expect(daEva).toBe(9 * CASA)
    expect(daEva).toBeGreaterThan(doOto)
  })

  it('cena sem valor: o raio de hoje (global, ou o do mestre em px), vezes o fator', () => {
    const salao = mapa('salao', [ficha('oto', CENTRO, CENTRO), ficha('eva', CENTRO, CENTRO)])
    const { s, oto, eva } = mesa(salao)
    s.setVisionRadius(oto, 250)
    s.setVisionFactor(eva, 1.5)
    const r = s.broadcast(salao)
    expect(alcance(snapshotDe(r, 'c1').vision[0], { x: CENTRO, y: CENTRO })).toBe(250)
    expect(alcance(snapshotDe(r, 'c2').vision[0], { x: CENTRO, y: CENTRO })).toBe(1050)
  })

  it('mapa-mundi: os dois veem a cidade a 25 casas sem o mestre mexer; na mina a mesma distância some', () => {
    // A cidade seguinte é uma ficha do mestre (NPC) 25 casas ao leste.
    const cidade = ficha('cidade', CENTRO + 25 * CASA, CENTRO)
    const mundi = mapa('mundi', [ficha('oto', CENTRO, CENTRO), ficha('eva', CENTRO, CENTRO + CASA), cidade], 30)
    const mina = mapa('mina', [cidade], 6)
    const mundo: HostWorld = { open: { sceneId: 's-mundi', name: 'Mapa-mundi', map: mundi }, background: [{ sceneId: 's-mina', name: 'Mina', map: mina }] }
    const { s } = mesa(mundo)
    const r = s.broadcast(mundo)
    expect(snapshotDe(r, 'c1').map.tokens.map((t) => t.id)).toContain('cidade')
    expect(snapshotDe(r, 'c2').map.tokens.map((t) => t.id)).toContain('cidade')

    // Os dois descem para a mina: a mesma cidade, à mesma distância, já não chega.
    const naMina: HostWorld = {
      open: { sceneId: 's-mundi', name: 'Mapa-mundi', map: { ...mundi, tokens: [cidade] } },
      background: [{ sceneId: 's-mina', name: 'Mina', map: { ...mina, tokens: [ficha('oto', CENTRO, CENTRO), ficha('eva', CENTRO, CENTRO + CASA), cidade] } }],
    }
    const depois = s.broadcast(naMina)
    // Um vê o outro (uma casa de distância); a cidade, a 25, não.
    expect(snapshotDe(depois, 'c1').map.tokens.map((t) => t.id)).toEqual(['oto', 'eva'])
    expect(snapshotDe(depois, 'c2').map.tokens.map((t) => t.id)).toEqual(['oto', 'eva'])
  })

  it('nada do alcance viaja ao jogador: nem o valor da cena, nem o fator de ninguém', () => {
    const mina = mapa('mina', [ficha('oto', CENTRO, CENTRO), ficha('eva', CENTRO, CENTRO)], 6)
    const { s, eva } = mesa(mina)
    s.setVisionFactor(eva, 1.7)
    const r = s.broadcast(mina)
    for (const clientId of ['c1', 'c2']) {
      const msg = snapshotDe(r, clientId)
      expect(msg.map.visionCells).toBeUndefined()
      const texto = JSON.stringify(msg)
      expect(texto).not.toContain('visionCells')
      expect(texto).not.toContain('visionFactor')
      expect(texto).not.toContain('sceneVisionCells')
    }
  })

  it('painel do mestre: fator de cada um e o alcance da cena onde ele está', () => {
    const mina = mapa('mina', [ficha('eva', CENTRO, CENTRO)], 6)
    const salao = mapa('salao', [ficha('oto', CENTRO, CENTRO)])
    const mundo: HostWorld = { open: { sceneId: 's-salao', name: 'Salão', map: salao }, background: [{ sceneId: 's-mina', name: 'Mina', map: mina }] }
    const { s, eva } = mesa(mundo)
    s.setVisionFactor(eva, 1.5)
    const lista = s.listPlayers(mundo)
    expect(lista.map((p) => [p.name, p.visionFactor, p.sceneVisionCells])).toEqual([
      ['Oto', 1, undefined],
      ['Eva', 1.5, 6],
    ])
  })

  it('setVisionFactor: faixa, null volta a x1,0, lixo e jogador desconhecido são ignorados, kick esquece', () => {
    const salao = mapa('salao', [ficha('oto', CENTRO, CENTRO), ficha('eva', CENTRO, CENTRO)])
    const { s, oto, eva } = mesa(salao)
    const fatores = () => s.listPlayers().map((p) => p.visionFactor)
    s.setVisionFactor(oto, 99)
    s.setVisionFactor(eva, 0)
    expect(fatores()).toEqual([3, 0.5])
    s.setVisionFactor(oto, Number.NaN)
    s.setVisionFactor('fantasma', 2)
    expect(fatores()).toEqual([3, 0.5])
    s.setVisionFactor(oto, null)
    expect(fatores()).toEqual([1, 0.5])
    s.kick('c2')
    expect(fatores()).toEqual([1])
  })
})
