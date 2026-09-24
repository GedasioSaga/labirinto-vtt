import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Region, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * MOBÍLIA DESENHADA, lado da REDE. O móvel (catre, mesa, baú) é um objeto sem
 * imagem com o TIPO dito (`Prop.mobilia`), e o tipo é o desenho que a tela do
 * jogador pinta por cima da silhueta. Esta bateria mede que o tipo chega só
 * junto do móvel que o jogador enxerga agora, e que o móvel escondido — pela
 * parede, pelo "Oculto para jogadores", pelo teto fechado, pela zona oculta ou
 * pela sala secreta — não manda nem o id nem o tipo.
 *
 * Mapa (1000x1000, grade 40), parede cega em x=500: dormitório à esquerda,
 * onde a Ana está; corredor à direita, onde o Bruno está. Catre em (250, 200).
 */

const RAIO = 700
const POSSE = { ana: ['ficha-ana'], bruno: ['ficha-bruno'] }

const CATRE_DA_ANA: Prop = { id: 'movel-catre', src: '', x: 250, y: 200, width: 40, height: 80, linkedMapPath: null, mobilia: 'catre' }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, regionId?: string): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...(regionId === undefined ? {} : { regionId }) }
}

function dormitorio(extra: Partial<Region> = {}, room: Partial<NonNullable<Region['room']>> = {}): Region {
  return {
    id: 'dormitorio',
    points: [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 400 },
      { x: 100, y: 400 },
    ],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Dormitório', ...room },
    ...extra,
  }
}

function mapa(extraDoCatre: Partial<Prop> = {}, extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m-quartel', 'Quartel', 25, 25, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000)],
    regions: [dormitorio()],
    tokens: [ficha('ficha-ana', 250, 350), ficha('ficha-bruno', 800, 350)],
    props: [{ ...CATRE_DA_ANA, locked: true, ...extraDoCatre }],
    ...extra,
  }
}

/** O pacote não diz que existe móvel, de que tipo, nem o id dele. */
function semRastroDoMovel(out: MapData): void {
  expect(out.props).toEqual([])
  const json = JSON.stringify(out)
  expect(json).not.toContain('movel-catre')
  expect(json).not.toContain('mobilia')
  expect(json).not.toContain('catre')
}

describe('filterMapForPlayer — mobília desenhada', () => {
  it('Ana, no dormitório, recebe o catre com o tipo, e nada do estado de edição do mestre', () => {
    const { map: out } = filterMapForPlayer(mapa(), 'ana', POSSE, RAIO)
    expect(out.props).toEqual([CATRE_DA_ANA])
    expect(Object.keys(out.props[0] ?? {}).sort()).toEqual(['height', 'id', 'linkedMapPath', 'mobilia', 'src', 'width', 'x', 'y'])
  })

  it('cada tipo do catálogo chega como é', () => {
    for (const mobilia of ['catre', 'mesa', 'bau'] as const) {
      const { map: out } = filterMapForPlayer(mapa({ mobilia }), 'ana', POSSE, RAIO)
      expect(out.props[0]?.mobilia, mobilia).toBe(mobilia)
    }
  })

  it('objeto comum continua saindo sem o campo', () => {
    const { map: out } = filterMapForPlayer(mapa({ mobilia: undefined }), 'ana', POSSE, RAIO)
    expect(out.props).toHaveLength(1)
    expect(out.props[0]).not.toHaveProperty('mobilia')
  })

  it('Bruno, do outro lado da parede, não recebe nem o id nem o tipo', () => {
    semRastroDoMovel(filterMapForPlayer(mapa(), 'bruno', POSSE, RAIO).map)
  })

  it('"Oculto para jogadores" e "Oculto no editor" tiram o catre da Ana', () => {
    semRastroDoMovel(filterMapForPlayer(mapa({ secret: true }), 'ana', POSSE, RAIO).map)
    semRastroDoMovel(filterMapForPlayer(mapa({ hidden: true }), 'ana', POSSE, RAIO).map)
  })

  it('teto fechado com a Ana fora: o catre não sai', () => {
    const fora = mapa({}, { walls: [], regions: [dormitorio({}, { roof: true })], tokens: [ficha('ficha-ana', 250, 600)] })
    semRastroDoMovel(filterMapForPlayer(fora, 'ana', POSSE, RAIO).map)
  })

  it('zona oculta do mestre em cima do catre: não sai', () => {
    const zona = { id: 'z', name: 'emboscada', revealed: false, points: [{ x: 180, y: 120 }, { x: 320, y: 120 }, { x: 320, y: 280 }, { x: 180, y: 280 }] }
    semRastroDoMovel(filterMapForPlayer(mapa({}, { concealZones: [zona] }), 'ana', POSSE, RAIO).map)
  })

  it('dormitório secreto: o catre sai do pacote da Ana, mesmo com a porta aberta', () => {
    // Dormitório secreto (300..600 x 100..400), porta aberta a oeste; a Ana no corredor, de frente para ela.
    const doQuarto = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => parede(id, x1, y1, x2, y2, 'dormitorio')
    const secreto = (secret: boolean): MapData => ({
      ...createEmptyMap('m-quartel', 'Quartel', 25, 25, 40),
      walls: [
        doQuarto('n', 300, 100, 600, 100),
        doQuarto('l', 600, 100, 600, 400),
        doQuarto('s', 600, 400, 300, 400),
        doQuarto('o1', 300, 100, 300, 220),
        { ...doQuarto('porta', 300, 220, 300, 280), door: { open: true, locked: false, kind: 'normal' } },
        doQuarto('o2', 300, 280, 300, 400),
      ],
      regions: [dormitorio({ secret, points: [{ x: 300, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 400 }, { x: 300, y: 400 }] })],
      tokens: [ficha('ficha-ana', 150, 250)],
      props: [{ ...CATRE_DA_ANA, x: 450, y: 250, width: 40, height: 40 }],
    })
    // Sem o segredo o catre chega: o cenário mede o que diz medir.
    expect(filterMapForPlayer(secreto(false), 'ana', POSSE, RAIO).map.props).toEqual([{ ...CATRE_DA_ANA, x: 450, y: 250, width: 40, height: 40 }])
    semRastroDoMovel(filterMapForPlayer(secreto(true), 'ana', POSSE, RAIO).map)
  })
})
