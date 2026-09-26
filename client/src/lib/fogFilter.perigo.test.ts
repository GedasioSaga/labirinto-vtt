import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Perigo } from '../types/map'
import { createExploration, markAll } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { ADEGA, casa, CORREDOR, COZINHA, DESPENSA, ficha } from './perigoPlanta.fixture'

/**
 * PERIGO QUE SE ALASTRA no recorte do jogador. Ele vê o fogo (ou a água) SÓ
 * nas salas que enxerga AGORA — regra de visível, não de explorado: o fogo
 * muda a cada avanço do mestre, e a memória viraria espionagem. Nunca recebe
 * o id do perigo do mestre, sala tomada atrás de porta fechada, sala secreta.
 */
const ID_DO_MESTRE = 'perigo_segredo_do_mestre'
const RADIUS = 2000
const ownership = { p1: ['gabi'] }

function fogo(salas: string[], cinzas?: string[]): Perigo {
  return { id: ID_DO_MESTRE, tipo: 'fogo', salas, ...(cinzas === undefined ? {} : { cinzas }) }
}

describe('recorte do jogador: perigo só onde ele vê agora', () => {
  it('fogo no Corredor à vista e na Adega atrás da porta fechada: só o Corredor chega, sem o id do mestre', () => {
    const map = casa({ perigos: [fogo([CORREDOR, ADEGA], [COZINHA])], tokens: [ficha('gabi', 150, 150)] })
    const { map: recorte } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(recorte.perigos).toEqual([{ id: 'fogo', tipo: 'fogo', salas: [CORREDOR], cinzas: [COZINHA] }])
    const json = JSON.stringify(recorte)
    expect(json).not.toContain(ID_DO_MESTRE)
    expect(json).not.toContain(ADEGA)
  })

  it('explorado não basta: com tudo explorado, a Adega fora da visão continua sem fogo', () => {
    const map = casa({ perigos: [fogo([ADEGA])], tokens: [ficha('gabi', 150, 150)] })
    const explorado = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    markAll(explorado)
    const { map: recorte } = filterMapForPlayer(map, 'p1', ownership, RADIUS, explorado)
    // A Adega sai (planta explorada), o fogo dela não.
    expect(recorte.regions.some((r) => r.id === ADEGA)).toBe(true)
    expect('perigos' in recorte).toBe(false)
  })

  it('sala secreta tomada pelo fogo, com a porta aberta e à vista: nem a sala nem o fogo saem', () => {
    const map = casa({ perigos: [fogo([DESPENSA])], despensaSecreta: true, tokens: [ficha('gabi', 150, 250)] })
    const { map: recorte } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect('perigos' in recorte).toBe(false)
    expect(JSON.stringify(recorte)).not.toContain(DESPENSA)
  })

  it('sala sob teto fechado, vista pela porta aberta: o fogo não sai; com a ficha dentro (teto aberto), sai', () => {
    const comTeto = (map: MapData): MapData => ({
      ...map,
      regions: map.regions.map((r) => (r.id === CORREDOR && r.room !== undefined ? { ...r, room: { ...r.room, roof: true } } : r)),
    })
    // A visão é só das paredes: da Cozinha ela entra no Corredor pela porta aberta.
    const fora = comTeto(casa({ perigos: [fogo([CORREDOR])], tokens: [ficha('gabi', 150, 150)] }))
    const { map: recorte } = filterMapForPlayer(fora, 'p1', ownership, RADIUS)
    expect(recorte.regions.some((r) => r.id === CORREDOR)).toBe(true)
    expect('perigos' in recorte).toBe(false)

    const dentro = comTeto(casa({ perigos: [fogo([CORREDOR])], tokens: [ficha('gabi', 450, 150)] }))
    expect(filterMapForPlayer(dentro, 'p1', ownership, RADIUS).map.perigos).toEqual([{ id: 'fogo', tipo: 'fogo', salas: [CORREDOR] }])
  })

  it('sala dentro de zona oculta, à vista pela porta aberta: o fogo não sai; zona revelada, sai', () => {
    const zona = (revealed: boolean): ConcealZone => ({
      id: 'zona-1',
      name: 'Zona do mestre',
      revealed,
      points: [
        { x: 290, y: -10 },
        { x: 610, y: -10 },
        { x: 610, y: 310 },
        { x: 290, y: 310 },
      ],
    })
    const map = (revealed: boolean): MapData => ({
      ...casa({ perigos: [fogo([CORREDOR])], tokens: [ficha('gabi', 150, 150)] }),
      concealZones: [zona(revealed)],
    })
    const { map: recorte } = filterMapForPlayer(map(false), 'p1', ownership, RADIUS)
    expect('perigos' in recorte).toBe(false)
    expect(JSON.stringify(recorte)).not.toContain(ID_DO_MESTRE)
    expect(filterMapForPlayer(map(true), 'p1', ownership, RADIUS).map.perigos).toEqual([{ id: 'fogo', tipo: 'fogo', salas: [CORREDOR] }])
  })

  it('zona oculta sobre a parte à vista do Corredor, o resto só explorado: o fogo não sai pela parte escondida', () => {
    // O cone que passa pela porta cobre o miolo do Corredor (y ~75-225); a zona
    // cobre esse miolo. As faixas de cima e de baixo estão exploradas, não à vista.
    const zonaNoMiolo: ConcealZone = {
      id: 'zona-miolo',
      name: 'Miolo',
      revealed: false,
      points: [
        { x: 290, y: 60 },
        { x: 610, y: 60 },
        { x: 610, y: 240 },
        { x: 290, y: 240 },
      ],
    }
    const map: MapData = { ...casa({ perigos: [fogo([CORREDOR])], tokens: [ficha('gabi', 150, 150)] }), concealZones: [zonaNoMiolo] }
    const explorado = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    markAll(explorado)
    const { map: recorte } = filterMapForPlayer(map, 'p1', ownership, RADIUS, explorado)
    // A planta do Corredor sai (faixas exploradas fora da zona); o fogo dele, não.
    expect(recorte.regions.some((r) => r.id === CORREDOR)).toBe(true)
    expect('perigos' in recorte).toBe(false)
  })

  it('dois perigos do mesmo tipo chegam juntos, um por tipo; mapa sem perigo não ganha o campo', () => {
    const agua: Perigo = { id: 'agua_do_mestre', tipo: 'agua', salas: [COZINHA] }
    const map = casa({ perigos: [fogo([CORREDOR]), { id: 'outro_fogo', tipo: 'fogo', salas: [DESPENSA] }, agua], tokens: [ficha('gabi', 150, 150)] })
    const { map: recorte } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(recorte.perigos).toEqual([
      { id: 'fogo', tipo: 'fogo', salas: [CORREDOR, DESPENSA] },
      { id: 'agua', tipo: 'agua', salas: [COZINHA] },
    ])
    expect(JSON.stringify(recorte)).not.toContain('outro_fogo')
    const semPerigo = filterMapForPlayer(casa({ tokens: [ficha('gabi', 150, 150)] }), 'p1', ownership, RADIUS)
    expect('perigos' in semPerigo.map).toBe(false)
  })
})
