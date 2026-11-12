import { describe, expect, it } from 'vitest'
import type { AlvoDoBalde, MapData, Region, Token, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * TEXTURA NA ÁREA FECHADA POR PAREDES (balde de um clique, 30f2b315): o passo
 * guarda o contorno da área, só os cantos. Num salão grande de paredes soltas,
 * o jogador no meio com visão curta não via nenhum canto, e o chão saía sem a
 * textura. Agora a área sai quando a visão dele ENTRA nela, ou quando ele já
 * explorou um ponto de dentro — a mesma régua do desenho com área.
 *
 * Geometria (px de mundo, mapa 3000x1000, grade 40): salão 100..2900 x
 * 100..900 de quatro paredes soltas; a ficha em (2200, 500), visão de 150.
 */
const SALAO: AlvoDoBalde = {
  tipo: 'area',
  pontos: [
    { x: 100, y: 100 },
    { x: 2900, y: 100 },
    { x: 2900, y: 900 },
    { x: 100, y: 900 },
  ],
}
const parede = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({ id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null })
const PAREDES = [parede('n', 100, 100, 2900, 100), parede('l', 2900, 100, 2900, 900), parede('s', 2900, 900, 100, 900), parede('o', 100, 900, 100, 100)]
const RAIO = 150
const POSSE = { p1: ['heroi'] }
const heroi = (x: number, y: number): Token => ({ id: 'heroi', characterId: null, name: 'heroi', x, y, size: 1, image: null })

function cena(ficha: Token, alvo: AlvoDoBalde = SALAO, extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'M', 3000, 1000, 40),
    walls: PAREDES,
    texturas: [{ id: 'lajotas', tipo: 'balde', textura: 'lajotas', forca: 1, alvo }],
    tokens: [ficha],
    ...extra,
  }
}

const passos = (m: MapData): string[] => (m.texturas ?? []).map((t) => t.id)

describe('textura na área de paredes soltas', () => {
  it('o jogador no meio do salão, sem ver canto nenhum, recebe a textura da área; o explorado de dentro também a traz', () => {
    expect(passos(filterMapForPlayer(cena(heroi(2200, 500)), 'p1', POSSE, RAIO).map), 'a visão está dentro da área e a textura não veio').toEqual(['lajotas'])

    // Explorou um pedaço do meio e agora está fora do salão, sem ver nada dele.
    const explorado = createExploration(cena(heroi(0, 0)))
    markRings(explorado, [[{ x: 1800, y: 400 }, { x: 2000, y: 400 }, { x: 2000, y: 600 }, { x: 1800, y: 600 }]])
    expect(passos(filterMapForPlayer(cena(heroi(1500, 980)), 'p1', POSSE, 10, explorado).map)).toEqual(['lajotas'])
  })

  it('SEGURANÇA: fora do salão sem ter explorado não sai; a área que contorna sala secreta não sai pela regra nova', () => {
    expect(passos(filterMapForPlayer(cena(heroi(1500, 980)), 'p1', POSSE, 10).map)).toEqual([])

    // O contorno da área segue as paredes da sala secreta no pé do salão: levaria a silhueta dela.
    const cofre: Region = {
      id: 'cofre',
      points: [
        { x: 1400, y: 820 },
        { x: 1600, y: 820 },
        { x: 1600, y: 900 },
        { x: 1400, y: 900 },
      ],
      tag: '',
      fillColor: '#123',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'cofre' },
      secret: true,
    }
    const comEntalhe: AlvoDoBalde = {
      tipo: 'area',
      pontos: [{ x: 100, y: 100 }, { x: 2900, y: 100 }, { x: 2900, y: 900 }, { x: 1600, y: 900 }, { x: 1600, y: 820 }, { x: 1400, y: 820 }, { x: 1400, y: 900 }, { x: 100, y: 900 }],
    }
    expect(passos(filterMapForPlayer(cena(heroi(2200, 500), comEntalhe, { regions: [cofre] }), 'p1', POSSE, RAIO).map)).toEqual([])
    // Controle: a mesma sala, não secreta, deixa a regra nova valer.
    expect(passos(filterMapForPlayer(cena(heroi(2200, 500), comEntalhe, { regions: [{ ...cofre, secret: false }] }), 'p1', POSSE, RAIO).map)).toEqual(['lajotas'])
  })
})
