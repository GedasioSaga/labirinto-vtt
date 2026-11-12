import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Region, Token } from '../types/map'
import { createExploration, markRings } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * A VISÃO ENTRA NO DESENHO (modo teste do mestre, 12/11/2026): a ficha em cima
 * do cais de madeira, com a visão curta da noite, via o chão cinza da sala e
 * não o cais. As amostras do polígono ficam junto do contorno, todas fora do
 * anel de visão, e o desenho (com a textura Convés do balde) não saía. Agora
 * sai quando a visão ENTRA nele, como a Sala (`ringEntersRegion`), e também
 * quando o explorado tem ponto dentro dele.
 *
 * Geometria (px de mundo, mapa 3000x1000, grade 40, sem parede):
 *   cais  100..2900 x 100..900, polígono com a textura Convés;
 *   ficha (2200, 500), em cima do cais, visão de 150: nenhum canto à vista.
 */
const CAIS: Drawing = {
  id: 'cais',
  kind: 'polygon',
  points: [
    { x: 100, y: 100 },
    { x: 2900, y: 100 },
    { x: 2900, y: 900 },
    { x: 100, y: 900 },
  ],
  color: '#38210c',
  width: 0,
  filled: true,
  fillAlpha: 1,
}
const RAIO = 150
const POSSE = { p1: ['ryoko'] }
const ryoko = (x: number, y: number): Token => ({ id: 'ryoko', characterId: null, name: 'Ryoko', x, y, size: 1, image: null })

function cena(ficha: Token, extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'M', 3000, 1000, 40),
    drawings: [CAIS],
    texturas: [{ id: 'convés', tipo: 'balde', textura: 'conves', forca: 0.8, alvo: { tipo: 'desenho', id: 'cais' } }],
    tokens: [ficha],
    ...extra,
  }
}

const ids = (m: MapData) => ({ desenhos: m.drawings.map((d) => d.id), texturas: (m.texturas ?? []).map((t) => t.id) })

describe('a visão entra no desenho com área', () => {
  it('a ficha no meio do cais vê o cais e a textura dele; o explorado do meio também traz o cais', () => {
    const visto = filterMapForPlayer(cena(ryoko(2200, 500)), 'p1', POSSE, RAIO).map
    expect(ids(visto), 'a ficha está em cima do cais e não recebeu o cais').toEqual({ desenhos: ['cais'], texturas: ['convés'] })

    // Explorou só o meio do cais e saiu dele (ficha fora, longe): o explorado de dentro conta.
    const explorado = createExploration(cena(ryoko(0, 0)))
    markRings(explorado, [[{ x: 1800, y: 400 }, { x: 2000, y: 400 }, { x: 2000, y: 600 }, { x: 1800, y: 600 }]])
    const lembrado = filterMapForPlayer(cena(ryoko(1500, 980)), 'p1', POSSE, 10, explorado).map
    expect(ids(lembrado).desenhos, 'o meio do cais explorado não trouxe o cais').toEqual(['cais'])
  })

  it('SEGURANÇA: fora do cais sem ter explorado não sai; o cais que encosta em sala secreta não sai pela regra nova', () => {
    const fora = filterMapForPlayer(cena(ryoko(1500, 980)), 'p1', POSSE, 10).map
    expect(ids(fora)).toEqual({ desenhos: [], texturas: [] })

    // Sala secreta com um canto em cima da borda do cais: o contorno do cais desenharia a silhueta dela.
    const cofre: Region = {
      id: 'cofre',
      points: [
        { x: 1400, y: 900 },
        { x: 1600, y: 900 },
        { x: 1600, y: 990 },
        { x: 1400, y: 990 },
      ],
      tag: '',
      fillColor: '#123',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'cofre' },
      secret: true,
    }
    const caisDoCofre: Drawing = { ...CAIS, points: [...CAIS.points.slice(0, 2), { x: 2900, y: 900 }, { x: 1600, y: 900 }, { x: 1400, y: 900 }, { x: 100, y: 900 }] }
    const secreta = filterMapForPlayer(cena(ryoko(2200, 500), { regions: [cofre], drawings: [caisDoCofre] }), 'p1', POSSE, RAIO).map
    expect(ids(secreta)).toEqual({ desenhos: [], texturas: [] })
    // Controle: a mesma sala, não secreta, deixa a regra nova valer (o teste acima não passa por outro motivo).
    const comum = filterMapForPlayer(cena(ryoko(2200, 500), { regions: [{ ...cofre, secret: false }], drawings: [caisDoCofre] }), 'p1', POSSE, RAIO).map
    expect(ids(comum).desenhos).toEqual(['cais'])
  })
})
