import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapData, Token, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove } from './moveValidation'

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function rect(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

function baseMap(patch: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), tokens: [token('t1', 100, 100), token('t2', 300, 100)], ...patch }
}

const ownership = { p1: ['t1'], p2: ['t2'] }

describe('validateTokenMove', () => {
  it('movimento livre do próprio token passa', () => {
    expect(validateTokenMove(baseMap(), { playerId: 'p1', tokenId: 't1', x: 150, y: 120 }, ownership)).toEqual({ ok: true, x: 150, y: 120 })
  })

  it('token inexistente => unknown_token', () => {
    expect(validateTokenMove(baseMap(), { playerId: 'p1', tokenId: 'nada', x: 0, y: 0 }, ownership)).toEqual({ ok: false, reason: 'unknown_token' })
  })

  it('token alheio => not_owner; jogador sem entrada de posse também', () => {
    expect(validateTokenMove(baseMap(), { playerId: 'p1', tokenId: 't2', x: 0, y: 0 }, ownership)).toEqual({ ok: false, reason: 'not_owner' })
    expect(validateTokenMove(baseMap(), { playerId: 'px', tokenId: 't1', x: 0, y: 0 }, {})).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('token travado => locked para jogador; host ignora trava e posse', () => {
    const map = baseMap({ tokens: [token('t1', 100, 100, { locked: true })] })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 120, y: 100 }, ownership)).toEqual({ ok: false, reason: 'locked' })
    expect(validateTokenMove(map, { playerId: 'host', tokenId: 't1', x: 120, y: 100 }, {}, { isHost: true })).toEqual({ ok: true, x: 120, y: 100 })
  })

  it('parede no caminho => wall, inclusive para o host', () => {
    const map = baseMap({ walls: [wall('w', 200, 0, 200, 400)] })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 250, y: 100 }, ownership)).toEqual({ ok: false, reason: 'wall' })
    expect(validateTokenMove(map, { playerId: 'h', tokenId: 't1', x: 250, y: 100 }, {}, { isHost: true })).toEqual({ ok: false, reason: 'wall' })
  })

  it('porta aberta passa; porta fechada bloqueia', () => {
    const door = { open: true, locked: false, kind: 'normal' as const }
    const open = baseMap({ walls: [wall('w', 200, 0, 200, 400, { door })] })
    expect(validateTokenMove(open, { playerId: 'p1', tokenId: 't1', x: 250, y: 100 }, ownership)).toEqual({ ok: true, x: 250, y: 100 })
    const closed = baseMap({ walls: [wall('w', 200, 0, 200, 400, { door: { ...door, open: false } })] })
    expect(validateTokenMove(closed, { playerId: 'p1', tokenId: 't1', x: 250, y: 100 }, ownership)).toEqual({ ok: false, reason: 'wall' })
  })

  it('destino fora do chão => outside_floor', () => {
    const map = baseMap({ floor: [rect('f', 100, 100, 200, 200)] })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 150, y: 150 }, ownership)).toEqual({ ok: true, x: 150, y: 150 })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 400, y: 100 }, ownership)).toEqual({ ok: false, reason: 'outside_floor' })
  })

  it('trajeto que atravessa vão entre duas salas => outside_floor mesmo com destino no chão', () => {
    const map = baseMap({ floor: [rect('a', 100, 100, 120, 120), rect('b', 400, 100, 120, 120)] })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 400, y: 100 }, ownership)).toEqual({ ok: false, reason: 'outside_floor' })
  })

  it.each([
    ['1.7e308', 1.7e308, 1.7e308],
    ['-1e20', -1e20, 100],
    ['NaN', Number.NaN, 100],
    ['além da borda direita', 1000 * 40 + 1, 100],
  ])('destino %s fora do retângulo do mapa => outside_map, sem travar, com e sem chão', (_label, x, y) => {
    const started = performance.now()
    const semChao = baseMap()
    const comChao = baseMap({ floor: [rect('f', 100, 100, 200, 200)] })
    expect(validateTokenMove(semChao, { playerId: 'p1', tokenId: 't1', x, y }, ownership)).toEqual({ ok: false, reason: 'outside_map' })
    expect(validateTokenMove(comChao, { playerId: 'p1', tokenId: 't1', x, y }, ownership)).toEqual({ ok: false, reason: 'outside_map' })
    expect(validateTokenMove(comChao, { playerId: 'h', tokenId: 't1', x, y }, {}, { isHost: true })).toEqual({ ok: false, reason: 'outside_map' })
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('borda do mapa (0 e width*grid) é aceita', () => {
    expect(validateTokenMove(baseMap(), { playerId: 'p1', tokenId: 't1', x: 0, y: 0 }, ownership)).toEqual({ ok: true, x: 0, y: 0 })
  })

  it('trajeto enorme dentro do mapa respeita o teto de amostras', () => {
    const map = { ...baseMap({ floor: [rect('f', 100, 100, 200, 200)] }), width: 1e9, height: 1e9, grid: 1 }
    const started = performance.now()
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 9e8, y: 9e8 }, ownership)).toEqual({ ok: false, reason: 'outside_floor' })
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('peças de chão todas ocultas não restringem movimento', () => {
    const map = baseMap({ floor: [{ ...rect('f', 100, 100, 50, 50), hidden: true }] })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 700, y: 700 }, ownership)).toEqual({ ok: true, x: 700, y: 700 })
  })
})
