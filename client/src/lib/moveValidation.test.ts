import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapData, Token, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { describeBlockedMove, validateTokenMove } from './moveValidation'

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

  it('iniciativa na cena: só a ficha da vez move; posse e trava vêm antes; o host ignora a vez', () => {
    const map = baseMap()
    const vezDeT2 = { turnTokenId: 't2' }
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 150, y: 120 }, ownership, vezDeT2)).toEqual({ ok: false, reason: 'not_your_turn' })
    expect(validateTokenMove(map, { playerId: 'p2', tokenId: 't2', x: 320, y: 120 }, ownership, vezDeT2)).toEqual({ ok: true, x: 320, y: 120 })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't2', x: 320, y: 120 }, ownership, vezDeT2)).toEqual({ ok: false, reason: 'not_owner' })
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 150, y: 120 }, ownership, { turnTokenId: null })).toEqual({ ok: true, x: 150, y: 120 })
    const travado = baseMap({ tokens: [token('t1', 100, 100, { locked: true })] })
    expect(validateTokenMove(travado, { playerId: 'p1', tokenId: 't1', x: 120, y: 100 }, ownership, vezDeT2)).toEqual({ ok: false, reason: 'locked' })
    expect(validateTokenMove(map, { playerId: 'host', tokenId: 't1', x: 150, y: 120 }, {}, { isHost: true, turnTokenId: 't2' })).toEqual({ ok: true, x: 150, y: 120 })
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

describe('describeBlockedMove', () => {
  const FROM = { x: 100, y: 100 }
  const TO = { x: 300, y: 100 }
  const SLACK = 40
  const fechada = { open: false, locked: false, kind: 'normal' as const }

  /** Lado de sala partido em 3, com o pedaço do meio (y 80..120) na altura do traço. */
  function ladoComPorta(door: Wall['door']): Wall[] {
    return [
      wall('acima', 200, 0, 200, 80),
      wall('vao', 200, 80, 200, 120, { door }),
      wall('abaixo', 200, 120, 200, 400),
    ]
  }

  it('caminho livre => null (mesma resposta de resolveTokenMove: passou)', () => {
    expect(describeBlockedMove(FROM, TO, [], SLACK)).toBeNull()
    expect(describeBlockedMove(FROM, TO, [wall('longe', 200, 300, 200, 400)], SLACK)).toBeNull()
  })

  it('parede que não bloqueia movimento não barra', () => {
    expect(describeBlockedMove(FROM, TO, [wall('vidro', 200, 0, 200, 400, { blocksMove: false })], SLACK)).toBeNull()
  })

  it('parede sólida => wall, com o id de quem barrou', () => {
    expect(describeBlockedMove(FROM, TO, [wall('w', 200, 0, 200, 400)], SLACK)).toEqual({
      reason: 'wall',
      wallId: 'w',
      opensPath: false,
    })
  })

  it('porta aberta e destrancada deixa passar => null', () => {
    const walls = ladoComPorta({ ...fechada, open: true })
    expect(describeBlockedMove(FROM, TO, walls, SLACK)).toBeNull()
  })

  it('porta fechada sozinha no caminho => door_closed com opensPath (abrir ELA resolve)', () => {
    expect(describeBlockedMove(FROM, TO, ladoComPorta(fechada), SLACK)).toEqual({
      reason: 'door_closed',
      wallId: 'vao',
      opensPath: true,
    })
  })

  it('porta fechada + outra parede atrás => door_closed sem opensPath (abrir não adiantaria)', () => {
    const walls = [...ladoComPorta(fechada), wall('atras', 250, 0, 250, 400)]
    expect(describeBlockedMove(FROM, TO, walls, SLACK)).toEqual({
      reason: 'door_closed',
      wallId: 'vao',
      opensPath: false,
    })
  })

  it('porta trancada => door_locked, nunca opensPath (trancada não abre por movimento)', () => {
    const walls = ladoComPorta({ ...fechada, locked: true })
    expect(describeBlockedMove(FROM, TO, walls, SLACK)).toEqual({
      reason: 'door_locked',
      wallId: 'vao',
      opensPath: false,
    })
    // Aberta E trancada é estado de mapa antigo: continua trancada, continua barrando.
    const abertaETrancada = ladoComPorta({ ...fechada, open: true, locked: true })
    expect(describeBlockedMove(FROM, TO, abertaETrancada, SLACK)).toMatchObject({ reason: 'door_locked' })
  })

  it('porta secreta => door_secret, mesmo destrancada: ligar "Aberta" não resolve, revelar a passagem sim', () => {
    const secreta = { ...fechada, secret: true }
    expect(describeBlockedMove(FROM, TO, ladoComPorta(secreta), SLACK)).toEqual({ reason: 'door_secret', wallId: 'vao', opensPath: false })
    // Aberta e secreta continua barrando (isDoorPassable): o aviso não pode mandar abrir.
    expect(describeBlockedMove(FROM, TO, ladoComPorta({ ...secreta, open: true }), SLACK)).toEqual({ reason: 'door_secret', wallId: 'vao', opensPath: false })
    // Trancada e secreta: revelar vem primeiro; o cadeado só aparece para quem já vê a porta.
    expect(describeBlockedMove(FROM, TO, ladoComPorta({ ...secreta, locked: true }), SLACK)).toMatchObject({ reason: 'door_secret' })
  })

  it('porta comum fechada ganha da secreta no mesmo traço: abrir ela é o gesto mais curto', () => {
    const walls = [...ladoComPorta({ ...fechada, secret: true }).map((w) => ({ ...w, id: `s-${w.id}` })), ...ladoComPorta(fechada)]
    expect(describeBlockedMove(FROM, TO, walls, SLACK)).toMatchObject({ reason: 'door_closed', wallId: 'vao' })
  })

  it('com parede e porta cruzando o mesmo traço, a porta é a explicação escolhida', () => {
    // A parede sólida vem primeiro na lista de propósito: a escolha é por
    // utilidade para quem lê o aviso, não pela ordem do array.
    const walls = [wall('solida', 150, 0, 150, 400), ...ladoComPorta(fechada)]
    expect(describeBlockedMove(FROM, TO, walls, SLACK)).toMatchObject({ reason: 'door_closed', wallId: 'vao' })
  })
})
