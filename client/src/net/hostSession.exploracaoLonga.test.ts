/**
 * O EXPLORADO NÃO SE PERDE numa aventura longa: o host lembra ao menos 32
 * cenas por jogador, nunca esquece a cena onde ele ainda tem ficha, e aumentar
 * o mapa com a mesma grade leva a memória junto (no mesmo lugar; a faixa nova
 * nasce preta). Nada disso abre a névoa: o que o jogador não viu continua sem
 * chegar pela rede.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored, type Exploration } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, MapLine, Token } from '../types/map'
import type { HostMessage } from './protocol'
import { createHostSession, MAX_SCENE_MEMORIES_PER_PLAYER, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const RAIO = 300
const GRADE = 50
/** Canto da Mina que a Carla explora antes de ir embora. */
const CANTO = { x: 150, y: 250 }
/** Onde a Carla fica depois: longe do canto (mais que o raio). */
const LONGE = { x: 1300, y: 250 }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function linha(id: string, x1: number, y1: number, x2: number, y2: number): MapLine {
  return { id, points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], closed: false, dotted: false, color: '#ddd', width: 2 }
}

function mina(largura: number, tokens: Token[], grade = GRADE, lines: MapLine[] = []): MapData {
  return { ...createEmptyMap('mapa-mina', 'Mina Funda', largura, 10, grade), tokens, lines }
}

function cena(i: number, tokens: Token[]): HostScene {
  return { sceneId: `cena-${i}`, name: `Cena ${i}`, map: { ...createEmptyMap(`mapa-${i}`, `Cena ${i}`, 30, 10, GRADE), tokens } }
}

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

function exploradoDe(r: HostResult): Exploration {
  const exp = decodeExploration(snapshotDe(r, 'c1').explored)
  if (exp === null) throw new Error('explorado ilegível')
  return exp
}

/** Carla na Mina (cena aberta), dona de `fichas`. */
function mesa(fichas: string[]) {
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: (() => {
    let n = 0
    return () => `id-${(n += 1)}`
  })() })
  const inicio: HostWorld = { open: { sceneId: 'cena-mina', name: 'Mina Funda', map: mina(30, []) }, background: [] }
  const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Carla' }, inicio)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  for (const id of fichas) s.assignToken(welcome.playerId, id)
  return s
}

const naMina = (map: MapData): HostScene => ({ sceneId: 'cena-mina', name: 'Mina Funda', map })

describe('exploração em aventura longa', () => {
  it('o teto de memória é de ao menos 32 cenas por jogador', () => {
    expect(MAX_SCENE_MEMORIES_PER_PLAYER).toBeGreaterThanOrEqual(32)
    expect(Number.isInteger(MAX_SCENE_MEMORIES_PER_PLAYER)).toBe(true)
  })

  it('Carla passa por 10 cenas e volta à Mina: o canto explorado continua lá', () => {
    const s = mesa(['carla'])
    s.broadcast({ open: naMina(mina(30, [ficha('carla', CANTO.x, CANTO.y)])), background: [] })
    for (let i = 0; i < 10; i += 1) s.broadcast({ open: cena(i, [ficha('carla', 200, 200)]), background: [] })
    const volta = exploradoDe(s.broadcast({ open: naMina(mina(30, [ficha('carla', LONGE.x, LONGE.y)])), background: [] }))
    expect(isPointExplored(volta, CANTO)).toBe(true)
    // O resto da Mina, que ela nunca viu, segue preto.
    expect(isPointExplored(volta, { x: 700, y: 250 })).toBe(false)
  })

  it('a cena onde ela ainda tem ficha nunca é esquecida, nem depois de passar do teto', () => {
    // A Carla tem duas fichas. Ela explora o canto da Mina e segue viagem; o
    // mestre põe o cachorro dela na Mina (cena de fundo) enquanto ela viaja.
    const s = mesa(['carla', 'cachorro'])
    s.broadcast({ open: naMina(mina(30, [ficha('carla', CANTO.x, CANTO.y)])), background: [] })
    s.broadcast({ open: cena(0, [ficha('carla', 200, 200)]), background: [] })
    const minaComCachorro = naMina(mina(30, [ficha('cachorro', LONGE.x, LONGE.y)]))
    for (let i = 1; i < MAX_SCENE_MEMORIES_PER_PLAYER + 3; i += 1) {
      const r = s.broadcast({ open: cena(i, [ficha('carla', 200, 200)]), background: [minaComCachorro] })
      expect(snapshotDe(r, 'c1').map.id).toBe(`mapa-${i}`)
    }
    // A Carla sai de cena (o mestre tira a ficha dela): a tela volta ao cachorro, na Mina.
    const volta = s.broadcast({ open: minaComCachorro, background: [] })
    expect(snapshotDe(volta, 'c1').map.id).toBe('mapa-mina')
    expect(isPointExplored(exploradoDe(volta), CANTO)).toBe(true)
  })

  it('sem ficha lá, a cena mais antiga ainda sai depois do teto: a memória do host não cresce sem limite', () => {
    const s = mesa(['carla'])
    s.broadcast({ open: naMina(mina(30, [ficha('carla', CANTO.x, CANTO.y)])), background: [] })
    for (let i = 0; i < MAX_SCENE_MEMORIES_PER_PLAYER; i += 1) s.broadcast({ open: cena(i, [ficha('carla', 200, 200)]), background: [] })
    const volta = exploradoDe(s.broadcast({ open: naMina(mina(30, [ficha('carla', LONGE.x, LONGE.y)])), background: [] }))
    expect(isPointExplored(volta, CANTO)).toBe(false)
  })

  it('Mina +20 quadrados: explorado no mesmo lugar, faixa nova preta, e a planta da faixa nova não chega', () => {
    const s = mesa(['carla'])
    s.broadcast({ open: naMina(mina(30, [ficha('carla', CANTO.x, CANTO.y)])), background: [] })
    s.broadcast({ open: naMina(mina(30, [ficha('carla', LONGE.x, LONGE.y)])), background: [] })
    // O mestre aumenta a Mina 20 quadrados para a direita e desenha um túnel lá, no escuro.
    const TUNEL_NOVO = linha('tunel-novo', 2200, 100, 2400, 100)
    const CORREDOR_DO_CANTO = linha('corredor-canto', 100, 250, 200, 250)
    const maior = mina(50, [ficha('carla', LONGE.x, LONGE.y)], GRADE, [TUNEL_NOVO, CORREDOR_DO_CANTO])
    const r = s.broadcast({ open: naMina(maior), background: [] })
    const snap = snapshotDe(r, 'c1')
    const exp = exploradoDe(r)
    expect(exp.cols * exp.cell).toBe(50 * GRADE)
    expect(isPointExplored(exp, CANTO)).toBe(true)
    expect(isPointExplored(exp, { x: 2000, y: 250 })).toBe(false)
    expect(isPointExplored(exp, { x: 2300, y: 100 })).toBe(false)
    // O corredor do canto que ela conhece chega; o túnel novo no escuro, não.
    expect(snap.map.lines.map((l) => l.id)).toEqual(['corredor-canto'])
    expect(JSON.stringify(r.outbound)).not.toContain('tunel-novo')
  })

  it('trocar a grade é outro mapa: a memória recomeça do zero', () => {
    const s = mesa(['carla'])
    s.broadcast({ open: naMina(mina(30, [ficha('carla', CANTO.x, CANTO.y)])), background: [] })
    s.broadcast({ open: naMina(mina(30, [ficha('carla', LONGE.x, LONGE.y)])), background: [] })
    const outraGrade = mina(40, [ficha('carla', LONGE.x, LONGE.y)], 40)
    const exp = exploradoDe(s.broadcast({ open: naMina(outraGrade), background: [] }))
    expect(exp.cols * exp.cell).toBe(40 * 40)
    expect(isPointExplored(exp, CANTO)).toBe(false)
  })
})
