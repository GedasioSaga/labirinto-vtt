/**
 * GATILHO DE ÁREA no RECORTE DO JOGADOR. O gatilho é do mestre: o objeto
 * `gatilhos` NUNCA vai no mapa do recorte, nem o id, nem o tipo de um gatilho
 * escondido. Só quando o mestre REVELA — e só se o jogador já conhece a área
 * (ela saiu no recorte) — vão o tipo e o polígono.
 */
import { describe, expect, it } from 'vitest'
import type { AreaTrigger, ConcealZone, MapData } from '../types/map'
import { ficha, sala, torre } from './__fixtures__/hazardTower'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'

const DONOS = { p1: ['ana'] }
const RAIO = 700

function comGatilhos(map: MapData, gatilhos: AreaTrigger[]): MapData {
  return { ...map, gatilhos }
}

const armadilha = (regionId: string, revealed: boolean, id = 'g-armadilha-secreta'): AreaTrigger => ({ id, kind: 'armadilha', regionId, revealed })

describe('filterMapForPlayer — gatilho de área', () => {
  it('gatilho NÃO revelado: nada sai — nem o campo, nem o id, nem o tipo', () => {
    const map = comGatilhos(torre({ tokens: [ficha('ana', 250, 200)] }), [armadilha('sala-a', false)])
    const view = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    expect('gatilhos' in view.map).toBe(false)
    expect(view.gatilhos).toEqual([])
    const pacote = JSON.stringify(view)
    expect(pacote).not.toContain('g-armadilha-secreta')
    expect(pacote).not.toContain('armadilha')
  })

  it('revelado na sala onde Ana está: chega só o tipo e o polígono', () => {
    const map = comGatilhos(torre({ tokens: [ficha('ana', 250, 200)] }), [armadilha('sala-a', true)])
    const view = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    expect(view.gatilhos).toEqual([{ kind: 'armadilha', points: map.regions[0]?.points }])
    expect('gatilhos' in view.map).toBe(false)
    expect(JSON.stringify(view)).not.toContain('g-armadilha-secreta')
  })

  it('revelado numa sala que Ana nunca viu (atrás da porta fechada): não sai', () => {
    const map = comGatilhos(torre({ tokens: [ficha('ana', 250, 200)] }), [armadilha('sala-c', true)])
    const view = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    expect(view.gatilhos).toEqual([])
    expect(JSON.stringify(view)).not.toContain('armadilha')
  })

  it('revelado em sala "Oculta para jogadores": não sai', () => {
    const regions = [sala('sala-a', 0, 500), sala('sala-b', 500, 1000, { secret: true }), sala('sala-c', 1000, 1500)]
    const map = comGatilhos(torre({ tokens: [ficha('ana', 250, 200)], regions }), [armadilha('sala-b', true)])
    expect(filterMapForPlayer(map, 'p1', DONOS, RAIO).gatilhos).toEqual([])
  })

  it('revelado em sala tocada por zona oculta ativa: não sai; zona revelada, sai', () => {
    const oculta = (revealed: boolean): ConcealZone => ({
      id: 'zona',
      name: 'zona',
      revealed,
      points: [{ x: 600, y: 20 }, { x: 700, y: 20 }, { x: 700, y: 120 }, { x: 600, y: 120 }],
    })
    const base = comGatilhos(torre({ tokens: [ficha('ana', 250, 200)] }), [armadilha('sala-b', true)])
    expect(filterMapForPlayer({ ...base, concealZones: [oculta(false)] }, 'p1', DONOS, RAIO).gatilhos).toEqual([])
    expect(filterMapForPlayer({ ...base, concealZones: [oculta(true)] }, 'p1', DONOS, RAIO).gatilhos.map((g) => g.kind)).toEqual(['armadilha'])
  })

  it('tela da mesa (grupo): mesma regra — escondido não sai, revelado sai', () => {
    const escondido = comGatilhos(torre({ tokens: [ficha('ana', 250, 200)] }), [armadilha('sala-a', false)])
    const grupo = filterMapForGroup(escondido, [{ tokenIds: ['ana'], visionRadius: RAIO }])
    expect('gatilhos' in grupo.map).toBe(false)
    expect(grupo.gatilhos).toEqual([])
    const revelado = comGatilhos(torre({ tokens: [ficha('ana', 250, 200)] }), [armadilha('sala-a', true)])
    expect(filterMapForGroup(revelado, [{ tokenIds: ['ana'], visionRadius: RAIO }]).gatilhos.map((g) => g.kind)).toEqual(['armadilha'])
  })
})
