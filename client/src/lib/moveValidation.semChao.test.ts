/**
 * Ficha que ficou sem chão debaixo dela (o mestre apagou ou mudou o chão).
 * Antes, todo trajeto partia de um ponto fora do chão e era recusado com
 * `outside_floor` para sempre: a ficha ficava presa. Agora o primeiro arrasto
 * leva a ficha ao chão mais próximo que ela alcança — sem atravessar parede e
 * sem cair em zona oculta, sala secreta ou sala de teto fechado (o jogador
 * não pode descobrir por ali que existe chão escondido) — e o resultado diz
 * que foi isso que aconteceu, para a tela do jogador explicar.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, FloorPiece, MapData, Token, Wall } from '../types/map'
import { compileFloor } from './floorSdf'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove } from './moveValidation'

const GRID = 40

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function chao(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

function zona(id: string, minX: number, minY: number, maxX: number, maxY: number): ConcealZone {
  return {
    id,
    name: 'Tesouro',
    revealed: false,
    points: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  }
}

function mapa(heroi: Token, patch: Partial<MapData>): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, GRID), tokens: [heroi], ...patch }
}

const posse = { p1: ['heroi'] }

function mover(map: MapData, x: number, y: number) {
  return validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x, y }, posse)
}

function noChao(map: MapData, x: number, y: number): boolean {
  return compileFloor(map.floor).sample(x, y) <= 0
}

describe('ficha sem chão debaixo dela', () => {
  it('primeiro arrasto leva a ficha ao chão mais próximo e avisa que foi isso', () => {
    // Chão só à direita (x 340..460); a ficha ficou em x=100, no vazio.
    const map = mapa(ficha('heroi', 100, 100), { floor: [chao('sala', 400, 100, 120, 120)] })
    const r = mover(map, 150, 100)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.landing).toBe('nearest_floor')
    expect(noChao(map, r.x, r.y)).toBe(true)
    // Entrou pela borda mais perto (esquerda da sala), não foi parar no meio dela.
    expect(r.x).toBeGreaterThanOrEqual(340)
    expect(r.x).toBeLessThanOrEqual(360)
    expect(r.y).toBeGreaterThanOrEqual(90)
    expect(r.y).toBeLessThanOrEqual(110)
  })

  it('depois de resgatada, a ficha volta a andar normal pelo chão', () => {
    const map = mapa(ficha('heroi', 100, 100), { floor: [chao('sala', 400, 100, 120, 120)] })
    const resgate = mover(map, 150, 100)
    if (!resgate.ok) throw new Error('esperava resgate')
    const depois = mapa(ficha('heroi', resgate.x, resgate.y), { floor: map.floor })
    expect(mover(depois, 420, 120)).toEqual({ ok: true, x: 420, y: 120 })
  })

  it('ficha no chão continua igual: movimento normal não leva aviso', () => {
    const map = mapa(ficha('heroi', 400, 100), { floor: [chao('sala', 400, 100, 120, 120)] })
    const r = mover(map, 420, 110)
    expect(r).toEqual({ ok: true, x: 420, y: 110 })
    expect('landing' in r).toBe(false)
  })

  it('não atravessa parede: o chão mais perto atrás de uma parede é pulado', () => {
    // Sala A (x 150..250) fica a 50 px, mas atrás da parede em x=270; sala B (x 450..550) a 150 px.
    const map = mapa(ficha('heroi', 300, 500), {
      floor: [chao('a', 200, 500, 100, 100), chao('b', 500, 500, 100, 100)],
      walls: [parede('w', 270, 0, 270, 1000)],
    })
    const r = mover(map, 310, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.landing).toBe('nearest_floor')
    expect(r.x).toBeGreaterThanOrEqual(450)
    expect(noChao(map, r.x, r.y)).toBe(true)
  })

  it('não cai em zona oculta: o chão escondido pelo mestre não é revelado pelo resgate', () => {
    const oculta = zona('z', 140, 440, 260, 560)
    const map = mapa(ficha('heroi', 300, 500), {
      floor: [chao('a', 200, 500, 100, 100), chao('b', 500, 500, 100, 100)],
      concealZones: [oculta],
    })
    const r = mover(map, 310, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.x).toBeGreaterThanOrEqual(450)
    // O ponto devolvido ao jogador nunca é de dentro da zona.
    expect(r.x > 140 && r.x < 260 && r.y > 440 && r.y < 560).toBe(false)
  })

  it('não cai em sala secreta', () => {
    const map = mapa(ficha('heroi', 300, 500), {
      floor: [chao('a', 200, 500, 100, 100), chao('b', 500, 500, 100, 100)],
      regions: [
        {
          id: 'cofre',
          tag: '',
          fillColor: '#445566',
          fillPattern: 'solid',
          data: {},
          secret: true,
          room: { shape: 'rect', name: 'Cofre' },
          points: [
            { x: 140, y: 440 },
            { x: 260, y: 440 },
            { x: 260, y: 560 },
            { x: 140, y: 560 },
          ],
        },
      ],
    })
    const r = mover(map, 310, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.x).toBeGreaterThanOrEqual(450)
  })

  it('ficha que já está dentro da zona oculta pode ser resgatada para o chão dela', () => {
    const map = mapa(ficha('heroi', 300, 500), {
      floor: [chao('a', 200, 500, 100, 100), chao('b', 500, 500, 100, 100)],
      concealZones: [zona('z', 100, 400, 320, 600)],
    })
    const r = mover(map, 310, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.x).toBeGreaterThanOrEqual(150)
    expect(r.x).toBeLessThanOrEqual(250)
  })

  it('cercada por paredes, sem chão alcançável: continua recusada com outside_floor', () => {
    const map = mapa(ficha('heroi', 500, 500), {
      floor: [chao('longe', 100, 100, 100, 100)],
      walls: [parede('n', 450, 450, 550, 450), parede('l', 550, 450, 550, 550), parede('s', 550, 550, 450, 550), parede('o', 450, 550, 450, 450)],
    })
    expect(mover(map, 510, 500)).toEqual({ ok: false, reason: 'outside_floor' })
  })

  it('pedido para fora do mapa continua outside_map, mesmo sem chão debaixo', () => {
    const map = mapa(ficha('heroi', 100, 100), { floor: [chao('sala', 400, 100, 120, 120)] })
    expect(mover(map, -5, 100)).toEqual({ ok: false, reason: 'outside_map' })
  })
})
