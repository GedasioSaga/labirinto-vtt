/**
 * Ficha que ficou sem chão debaixo dela (o mestre apagou ou mudou o chão).
 * Antes, todo trajeto partia de um ponto fora do chão e era recusado com
 * `outside_floor` para sempre: a ficha ficava presa. Agora o primeiro arrasto
 * leva a ficha ao chão mais próximo que ela alcança — sem atravessar parede e
 * sem cair em zona oculta ou sala secreta (o jogador não pode descobrir por ali
 * que existe chão escondido), mas podendo entrar em sala com teto, como o
 * movimento normal pode — e o resultado diz que foi isso que aconteceu, para a
 * tela do jogador explicar.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, FloorPiece, MapData, Region, Token, Wall } from '../types/map'
import { findTokenPath } from './collision'
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

  it('chão escondido no caminho não esconde o chão livre logo atrás dele', () => {
    // Sala 'a' (x 150..250) dentro da zona oculta cobre todo o ângulo até a sala 'b' (x 300..400):
    // cada raio que chega em 'b' passa antes pelo chão escondido de 'a'.
    const map = mapa(ficha('heroi', 100, 500), {
      floor: [chao('a', 200, 500, 100, 100), chao('b', 350, 500, 100, 100)],
      concealZones: [zona('z', 140, 440, 260, 560)],
    })
    const r = mover(map, 110, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.landing).toBe('nearest_floor')
    expect(noChao(map, r.x, r.y)).toBe(true)
    expect(r.x).toBeGreaterThanOrEqual(300)
    expect(r.x > 140 && r.x < 260 && r.y > 440 && r.y < 560).toBe(false)
  })

  it('sala com teto é destino permitido, como no movimento normal (entrar é o que abre o teto)', () => {
    // Corredor sem chão entre duas salas com teto; o mestre apagou o chão debaixo da ficha.
    const salaComTeto = (id: string, minX: number, maxX: number): Region => ({
      id,
      tag: '',
      fillColor: '#445566',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: id, roof: true },
      points: [
        { x: minX, y: 440 },
        { x: maxX, y: 440 },
        { x: maxX, y: 560 },
        { x: minX, y: 560 },
      ],
    })
    const map = mapa(ficha('heroi', 300, 500), {
      floor: [chao('a', 200, 500, 100, 100), chao('b', 400, 500, 100, 100)],
      regions: [salaComTeto('A', 140, 260), salaComTeto('B', 340, 460)],
    })
    const r = mover(map, 310, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.landing).toBe('nearest_floor')
    expect(noChao(map, r.x, r.y)).toBe(true)
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

  it('sala secreta no caminho não esconde o chão livre logo atrás dela', () => {
    // A sala secreta cobre a sala 'a' inteira; o chão livre 'b' só é alcançado atravessando-a.
    const map = mapa(ficha('heroi', 100, 500), {
      floor: [chao('a', 200, 500, 100, 100), chao('b', 350, 500, 100, 100)],
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
    const r = mover(map, 110, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.landing).toBe('nearest_floor')
    expect(noChao(map, r.x, r.y)).toBe(true)
    expect(r.x).toBeGreaterThanOrEqual(300)
  })

  it('chão escondido comprido no caminho: a marcha atravessa a zona inteira até o chão livre', () => {
    // Zona oculta sobre 6000 px de chão (150 células) entre a ficha e o único chão livre.
    // A marcha andava amostra por amostra pelo chão escondido e desistia antes de sair dele.
    const map = mapa(ficha('heroi', 100, 500), {
      floor: [chao('escondido', 3150, 500, 6000, 100), chao('livre', 6400, 500, 200, 100)],
      concealZones: [zona('z', 140, 440, 6160, 560)],
    })
    const r = mover(map, 110, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.landing).toBe('nearest_floor')
    expect(noChao(map, r.x, r.y)).toBe(true)
    expect(r.x).toBeGreaterThanOrEqual(6300)
    expect(r.x > 140 && r.x < 6160 && r.y > 440 && r.y < 560).toBe(false)
  })

  it('várias zonas ocultas enfileiradas: atravessa todas e para no primeiro chão livre', () => {
    const map = mapa(ficha('heroi', 100, 500), {
      floor: [chao('a', 200, 500, 100, 100), chao('b', 350, 500, 100, 100), chao('c', 500, 500, 100, 100), chao('d', 650, 500, 100, 100)],
      concealZones: [zona('z1', 140, 440, 260, 560), zona('z2', 290, 440, 410, 560), zona('z3', 440, 440, 560, 560)],
    })
    const r = mover(map, 110, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(noChao(map, r.x, r.y)).toBe(true)
    // Entra pela borda esquerda da sala 'd' (x 600..700), a primeira fora de zona.
    expect(r.x).toBeGreaterThanOrEqual(600)
    expect(r.x).toBeLessThanOrEqual(620)
  })

  it('sala apagada com vão estreito na parede: o resgate sai pelo vão até o chão do outro lado', () => {
    // Sala murada (x 100..1800, y 100..900) sem chão nenhum; a única saída é um
    // vão de 1 célula na parede direita (y 560..600), a 1600 px da ficha. O vão
    // cabe entre dois raios vizinhos das direções fixas (0° e 5,6°): todos
    // batiam em parede e a ficha continuava presa com outside_floor.
    const map = mapa(ficha('heroi', 200, 500), {
      floor: [chao('corredor', 1900, 500, 200, 800)],
      walls: [
        parede('topo', 100, 100, 1800, 100),
        parede('baixo', 100, 900, 1800, 900),
        parede('esquerda', 100, 100, 100, 900),
        parede('direita-cima', 1800, 100, 1800, 560),
        parede('direita-baixo', 1800, 600, 1800, 900),
      ],
    })
    const r = mover(map, 210, 500)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.landing).toBe('nearest_floor')
    expect(noChao(map, r.x, r.y)).toBe(true)
    expect(r.x).toBeGreaterThanOrEqual(1800)
    // Saiu pelo vão: o trajeto reto até o ponto não cruza parede nenhuma.
    expect(findTokenPath({ x: 200, y: 500 }, { x: r.x, y: r.y }, map.walls, GRID)).toEqual([
      { x: 200, y: 500 },
      { x: r.x, y: r.y },
    ])
  })

  it('pedido para fora do mapa continua outside_map, mesmo sem chão debaixo', () => {
    const map = mapa(ficha('heroi', 100, 100), { floor: [chao('sala', 400, 100, 120, 120)] })
    expect(mover(map, -5, 100)).toEqual({ ok: false, reason: 'outside_map' })
  })
})
