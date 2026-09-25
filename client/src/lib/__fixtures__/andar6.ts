import type { MapData, Region, Token } from '../../types/map'
import { createEmptyMap } from '../mapFactory'

/**
 * ANDAR 6 da cidade-torre, para os testes de FACÇÃO E ALERTA: três distritos
 * lado a lado e duas salas dentro do Distrito Norte.
 *
 *   Distrito Norte (Guarda Carmesim)      | Mercado (sem facção)
 *     Quartel (herda a Guarda)            |
 *     Esconderijo (Sindicato das Cinzas)  |
 *   Distrito Sul (Sindicato das Cinzas)   |
 *
 * A ficha do jogador `p1` está no Mercado. A cena está em CAÇADA.
 */
export const GUARDA = 'Guarda Carmesim'
export const SINDICATO = 'Sindicato das Cinzas'

export function salaRet(id: string, nome: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

function comFaccao(region: Region, faccao: string): Region {
  return region.room === undefined ? region : { ...region, room: { ...region.room, faccao } }
}

export const fichaDoJogador: Token = { id: 'f-p1', characterId: null, name: 'Vigia', x: 1500, y: 600, size: 1, image: null }

export function andar6(): MapData {
  return {
    ...createEmptyMap('m-andar6', 'Andar 6', 40, 24, 50),
    regions: [
      comFaccao(salaRet('d-norte', 'Distrito Norte', 0, 0, 1000, 600), GUARDA),
      salaRet('s-quartel', 'Quartel', 100, 100, 400, 400, { parentId: 'd-norte' }),
      comFaccao(salaRet('s-esconderijo', 'Esconderijo', 600, 100, 900, 400, { parentId: 'd-norte' }), SINDICATO),
      comFaccao(salaRet('d-sul', 'Distrito Sul', 0, 600, 1000, 1200), SINDICATO),
      salaRet('d-mercado', 'Mercado', 1000, 0, 2000, 1200),
      // Região comum (sem `room`): não tem facção nem entra no filtro.
      { ...salaRet('r-praca', '', 1200, 200, 1400, 400), room: undefined },
    ],
    tokens: [fichaDoJogador],
    alerta: 'cacada',
  }
}
