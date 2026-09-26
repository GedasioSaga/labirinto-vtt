/**
 * MOVIMENTO IMPOSTO no RECORTE DO JOGADOR. A esteira é regra do mestre: a sala,
 * a direção, o passo e o id nunca vão no mapa do jogador — nem para quem está
 * em cima dela. O que ele recebe é a própria ficha onde a esteira a largou.
 */
import { describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { ficha, torre } from './__fixtures__/hazardTower'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'

const DONOS = { p1: ['ana'] }
const RAIO = 700

const COM_ESTEIRA: MapData = {
  ...torre({ tokens: [ficha('ana', 125, 75)] }),
  conveyors: [{ id: 'esteira-do-mestre', roomId: 'sala-a', direction: 'sul', stepCells: 4 }],
}

describe('filterMapForPlayer — esteira', () => {
  it('Ana em cima da esteira: o mapa dela chega sem o campo e sem nada da esteira', () => {
    const view = filterMapForPlayer(COM_ESTEIRA, 'p1', DONOS, RAIO)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['ana'])
    expect('conveyors' in view.map).toBe(false)
    const pacote = JSON.stringify(view)
    expect(pacote).not.toContain('esteira-do-mestre')
    expect(pacote).not.toContain('"sul"')
  })

  it('o recorte do grupo também não leva a esteira', () => {
    const view = filterMapForGroup(COM_ESTEIRA, [{ tokenIds: ['ana'], visionRadius: RAIO }])
    expect('conveyors' in view.map).toBe(false)
    expect(JSON.stringify(view)).not.toContain('esteira-do-mestre')
  })
})
