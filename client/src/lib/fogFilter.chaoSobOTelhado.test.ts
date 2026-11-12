import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Region, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * CHÃO QUE PASSA POR BAIXO DO TELHADO (modo teste do mestre, 12/11/2026: o
 * cais de madeira sumia da tela do jogador). O cais é um Polígono do Desenho
 * com a textura Convés no balde, e as casas de teto fechado ficam em cima dele.
 * Três das 72 amostras do cais caíam sob os telhados, e uma amostra bastava
 * para o desenho inteiro (e a textura junto) ficar de fora.
 *
 * Geometria (px de mundo, mapa 1000x1000, grade 40, sem parede):
 *   casa  100..400 x 100..400, teto fechado;
 *   cais  50..950 x 120..500, com vértices na borda de cima que puxados para
 *         dentro caem dentro da casa (3 das 7 amostras), como no mapa do mestre;
 *   ficha (250, 600), na rua, vendo tudo.
 */
const CASA: Region['points'] = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
]
const CAIS: Drawing = {
  id: 'cais',
  kind: 'polygon',
  points: [
    { x: 50, y: 120 },
    { x: 200, y: 120 },
    { x: 350, y: 120 },
    { x: 950, y: 120 },
    { x: 950, y: 500 },
    { x: 50, y: 500 },
  ],
  color: '#38210c',
  width: 0,
  filled: true,
  fillAlpha: 1,
}
const MOBILIA: Drawing = { id: 'mobilia', kind: 'rect', x: 150, y: 150, w: 100, h: 60, color: '#ff00ff', width: 4, filled: true, fillAlpha: 1 }
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 250, y: 600, size: 1, image: null }

function mapa(casa: Partial<Region>): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    regions: [{ id: 'casa', points: CASA, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'casa' }, ...casa }],
    drawings: [CAIS, MOBILIA],
    texturas: [{ id: 'convés', tipo: 'balde', textura: 'conves', forca: 0.8, alvo: { tipo: 'desenho', id: 'cais' } }],
    tokens: [HEROI],
  }
}

const recorte = (m: MapData) => filterMapForPlayer(m, 'p1', { p1: ['heroi'] }, 700).map

describe('chão grande que passa por baixo de um teto fechado', () => {
  it('o cais sai para o jogador, com a textura dele; a mobília de dentro da casa continua de fora', () => {
    const visto = recorte(mapa({ room: { shape: 'rect', name: 'casa', roof: true } }))
    expect(visto.drawings.map((d) => d.id), 'o cais sumiu porque uma ponta dele passa sob o telhado').toEqual(['cais'])
    expect((visto.texturas ?? []).map((t) => t.id)).toEqual(['convés'])
  })

  it('SEGURANÇA: pela sala secreta continua valendo qualquer amostra (sem telhado, nada cobre o formato dela)', () => {
    const visto = recorte(mapa({ secret: true }))
    expect(visto.drawings).toEqual([])
    expect(visto.texturas ?? []).toEqual([])
  })
})
