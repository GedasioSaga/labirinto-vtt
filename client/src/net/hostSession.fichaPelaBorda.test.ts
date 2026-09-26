/**
 * FICHA VISTA PELA BORDA, lado do FIO: o guarda com meio corpo no vão chega no
 * pacote da Fabi (snapshot a cada broadcast); o mesmo guarda secreto, ou com o
 * centro em zona oculta, não chega — nem o id, nem o nome.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { ConcealZone, MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'BORDA1'
const NOME_DE_TRABALHO = 'Guarda 3 (suborno aceito)'
const GUARDA_NO_VAO = { x: 1035, y: 600 }

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function guarda(extra: Partial<Token> = {}): Token {
  return { id: 'guarda', characterId: null, name: NOME_DE_TRABALHO, x: GUARDA_NO_VAO.x, y: GUARDA_NO_VAO.y, size: 1, image: null, ...extra }
}

function corredor(g: Token, extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m-corredor', 'Corredor A01', 40, 20, 50),
    walls: [parede('norte', 1000, 0, 1000, 450), parede('sul', 1000, 550, 1000, 1000)],
    tokens: [{ id: 'fabi', characterId: null, name: 'Fabi', x: 700, y: 250, size: 1, image: null }, g],
    ...extra,
  }
}

function mesaCom(source: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Fabi' }, source)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'fabi')
  return s
}

function fichasNoFio(r: HostResult): Token[] {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error('esperava o mapa da Fabi')
  return msg.map.tokens
}

function fioDaFabi(r: HostResult): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))
}

describe('fio da Fabi: ficha vista pela borda', () => {
  it('guarda com meio corpo no vão chega, com o nome para os jogadores', () => {
    const map = corredor(guarda({ publicName: 'Guarda da Repartição' }))
    const r = mesaCom(map).broadcast(map)
    expect(fichasNoFio(r).map((t) => t.id).sort()).toEqual(['fabi', 'guarda'])
    expect(fichasNoFio(r).find((t) => t.id === 'guarda')?.name).toBe('Guarda da Repartição')
    expect(fioDaFabi(r)).not.toContain(NOME_DE_TRABALHO)
  })

  it('o mesmo guarda secreto não chega: nem o id, nem o nome', () => {
    const map = corredor(guarda({ secret: true }))
    const r = mesaCom(map).broadcast(map)
    expect(fichasNoFio(r).map((t) => t.id)).toEqual(['fabi'])
    expect(fioDaFabi(r)).not.toContain(NOME_DE_TRABALHO)
  })

  it('o mesmo guarda com o centro em zona oculta não chega', () => {
    const { x, y } = GUARDA_NO_VAO
    const zona: ConcealZone = {
      id: 'z1',
      name: 'Emboscada',
      revealed: false,
      points: [
        { x: x - 10, y: y - 10 },
        { x: x + 10, y: y - 10 },
        { x: x + 10, y: y + 10 },
        { x: x - 10, y: y + 10 },
      ],
    }
    const map = corredor(guarda(), { concealZones: [zona] })
    const r = mesaCom(map).broadcast(map)
    expect(fichasNoFio(r).map((t) => t.id)).toEqual(['fabi'])
    expect(fioDaFabi(r)).not.toContain(NOME_DE_TRABALHO)
  })
})
