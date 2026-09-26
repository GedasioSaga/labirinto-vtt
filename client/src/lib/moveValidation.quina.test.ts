import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { describeBlockedMove, validateTokenMove } from './moveValidation'

// Os dois caminhos de movimento — o pedido do jogador que o host valida
// (`validateTokenMove`, hostSession) e o arrasto do mestre no editor
// (`describeBlockedMove`, mapStore) — raspam a ponta da parede do mesmo jeito.

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

const pontaSolta = wall('ponta', 64, 0, 64, 64)
const continuacao = wall('continua', 64, 64, 64, 128)

function mapa(walls: Wall[]): MapData {
  return { ...createEmptyMap('m', 'M', 20, 20, 64), tokens: [token('t1', 32, 96)], walls }
}

const ownership = { p1: ['t1'] }

describe('passar rente à quina: pedido do jogador', () => {
  it('diagonal raspando a ponta solta é aceita', () => {
    expect(validateTokenMove(mapa([pontaSolta]), { playerId: 'p1', tokenId: 't1', x: 96, y: 32 }, ownership)).toEqual({ ok: true, x: 96, y: 32 })
  })

  it('parede que continua depois da quina recusa com wall', () => {
    expect(validateTokenMove(mapa([pontaSolta, continuacao]), { playerId: 'p1', tokenId: 't1', x: 96, y: 32 }, ownership)).toEqual({ ok: false, reason: 'wall' })
  })
})

describe('passar rente à quina: soltura real do jogador (sem encaixe no centro da casa)', () => {
  it('soltar 1 px para dentro da diagonal é aceito', () => {
    expect(validateTokenMove(mapa([pontaSolta]), { playerId: 'p1', tokenId: 't1', x: 95, y: 31 }, ownership)).toEqual({ ok: true, x: 95, y: 31 })
  })

  it('soltar alguns px para dentro, perto do centro da casa, é aceito', () => {
    expect(validateTokenMove(mapa([pontaSolta]), { playerId: 'p1', tokenId: 't1', x: 90, y: 30 }, ownership)).toEqual({ ok: true, x: 90, y: 30 })
  })

  it('com a parede continuando depois da quina, soltar fora do pixel exato recusa com wall', () => {
    for (const [x, y] of [[95, 31], [97, 33], [90, 30]]) {
      expect(validateTokenMove(mapa([pontaSolta, continuacao]), { playerId: 'p1', tokenId: 't1', x, y }, ownership)).toEqual({ ok: false, reason: 'wall' })
    }
  })
})

describe('passar rente à quina: emenda desenhada à mão não vira passagem', () => {
  // A parede de baixo da sala passa 8 px da parede do lado: o canto não é exato.
  const lado = wall('lado', 64, 0, 64, 72)
  const baixo = wall('baixo', 56, 64, 192, 64)

  it('pedido do jogador atravessando a parede de baixo perto do canto recusa com wall', () => {
    const map = { ...mapa([lado, baixo]), tokens: [token('t1', 70, 32)] }
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 't1', x: 70, y: 96 }, ownership)).toEqual({ ok: false, reason: 'wall' })
  })

  it('arrasto do mestre atravessando a parede de baixo perto do canto barra', () => {
    const blocked = describeBlockedMove({ x: 70, y: 32 }, { x: 70, y: 96 }, [lado, baixo], 64)
    expect(blocked?.reason).toBe('wall')
    expect(['lado', 'baixo']).toContain(blocked?.wallId)
  })
})

describe('passar rente à quina: arrasto do mestre', () => {
  it('ponta solta não barra o arrasto', () => {
    expect(describeBlockedMove({ x: 32, y: 96 }, { x: 96, y: 32 }, [pontaSolta], 64)).toBeNull()
  })

  it('emenda na quina barra e diz qual parede', () => {
    const blocked = describeBlockedMove({ x: 32, y: 96 }, { x: 96, y: 32 }, [pontaSolta, continuacao], 64)
    expect(blocked?.reason).toBe('wall')
    expect(['ponta', 'continua']).toContain(blocked?.wallId)
  })
})
