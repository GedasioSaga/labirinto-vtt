import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Region, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * OBJETOS COMO SILHUETA, lado da REDE. A tela do jogador desenha cada móvel
 * como um retângulo chapado no lugar dele (`pixi/drawPropSilhouettes.ts`).
 * Esta bateria mede o que o PACOTE leva para isso: a geometria (posição,
 * tamanho e rotação) do objeto que o jogador enxerga agora — e mais nada.
 *
 * Mapa (px de mundo, 1000x1000, grade 40), parede cega em x=500:
 *   Quarto do prefeito  à esquerda, onde a Ana está;
 *   corredor            à direita, onde o Bruno está, sem visão do quarto;
 *   cama                (250, 180), 80x40 girada 90°, com a imagem, o mapa
 *                       ligado e uma anotação do mestre que nenhuma tela usa.
 */

const RAIO = 700
const POSSE = { ana: ['ficha-ana'], bruno: ['ficha-bruno'] }
const CAMINHO_DA_IMAGEM = 'C:\\Users\\mestre\\AppData\\Roaming\\labirinto\\props\\cama.png'
const CAMINHO_DO_MAPA_LIGADO = 'C:\\Users\\mestre\\mapas\\porao-secreto.json'

/** O que a Ana tem de receber: o retângulo, sem imagem e sem mapa ligado. */
const SILHUETA_DA_CAMA: Prop = { id: 'cama', x: 250, y: 180, width: 80, height: 40, rotation: 90, src: '', linkedMapPath: null }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function quarto(extra: Partial<NonNullable<Region['room']>> = {}): Region {
  return {
    id: 'quarto',
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
    room: { shape: 'rect', name: 'Quarto do prefeito', ...extra },
  }
}

/**
 * A cama como o mestre a tem: trancada para edição, com imagem e mapa ligado no
 * disco dele, e um campo que o app não conhece (arquivo de versão futura ou
 * editado à mão) — nenhum dos três pode chegar ao jogador.
 */
function cama(extra: Partial<Prop> = {}): Prop {
  const doMestre = {
    id: 'cama',
    src: CAMINHO_DA_IMAGEM,
    x: 250,
    y: 180,
    width: 80,
    height: 40,
    rotation: 90,
    linkedMapPath: CAMINHO_DO_MAPA_LIGADO,
    locked: true,
    anotacao: 'veneno debaixo do colchão',
    ...extra,
  }
  return doMestre as Prop
}

function mapa(extraDaCama: Partial<Prop> = {}, extra: Partial<MapData> = {}): MapData {
  return {
    // 25 x 25 casas de 40 px: 1000 x 1000 px de mundo.
    ...createEmptyMap('m-prefeitura', 'Prefeitura', 25, 25, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000)],
    regions: [quarto()],
    tokens: [ficha('ficha-ana', 250, 350), ficha('ficha-bruno', 800, 350)],
    props: [cama(extraDaCama)],
    ...extra,
  }
}

describe('filterMapForPlayer — objetos como silhueta', () => {
  it('Ana, no quarto, recebe a cama como silhueta: posição, tamanho e rotação do mestre, e nada mais', () => {
    const { map: out } = filterMapForPlayer(mapa(), 'ana', POSSE, RAIO)

    // Igualdade EXATA: qualquer campo a mais (a trava de edição, a anotação,
    // o que uma versão futura do arquivo trouxer) reprova aqui.
    expect(out.props).toEqual([SILHUETA_DA_CAMA])
    expect(Object.keys(out.props[0] ?? {}).sort()).toEqual(['height', 'id', 'linkedMapPath', 'rotation', 'src', 'width', 'x', 'y'])

    const json = JSON.stringify(out)
    expect(json).not.toContain('veneno')
    expect(json).not.toContain('porao-secreto')
    expect(json).not.toContain('C:\\\\')
  })

  it('o mapa do mestre não é mutado pelo recorte', () => {
    const doMestre = mapa()
    filterMapForPlayer(doMestre, 'ana', POSSE, RAIO)
    expect(doMestre.props[0]).toMatchObject({ src: CAMINHO_DA_IMAGEM, linkedMapPath: CAMINHO_DO_MAPA_LIGADO, locked: true })
  })

  it('Bruno, do outro lado da parede, não recebe nada da cama', () => {
    const { map: out } = filterMapForPlayer(mapa(), 'bruno', POSSE, RAIO)
    expect(out.props).toEqual([])
    expect(JSON.stringify(out)).not.toContain('cama')
  })

  it('fora do alcance da lanterna a cama continua fora, mesmo na mesma sala', () => {
    // Ana a 170 px do centro da cama, com lanterna de 100 px.
    const { map: out } = filterMapForPlayer(mapa(), 'ana', POSSE, 100)
    expect(out.props).toEqual([])
    expect(JSON.stringify(out)).not.toContain('cama')
  })

  it('"Oculto para jogadores" tira a cama da Ana', () => {
    const { map: out } = filterMapForPlayer(mapa({ secret: true }), 'ana', POSSE, RAIO)
    expect(out.props).toEqual([])
    expect(JSON.stringify(out)).not.toContain('cama')
  })

  it('"Oculto no editor" também não sai', () => {
    const { map: out } = filterMapForPlayer(mapa({ hidden: true }), 'ana', POSSE, RAIO)
    expect(out.props).toEqual([])
    expect(JSON.stringify(out)).not.toContain('cama')
  })

  it('camada Objetos escondida pelo mestre: a cama não sai', () => {
    const { map: out } = filterMapForPlayer(mapa({}, { hiddenLayers: ['objetos'] }), 'ana', POSSE, RAIO)
    expect(out.props).toEqual([])
    expect(JSON.stringify(out)).not.toContain('cama')
  })

  it('objeto da camada Decoração leva a camada junto: a tela do jogador filtra por ela', () => {
    const { map: out } = filterMapForPlayer(mapa({ layer: 'decoracao' }), 'ana', POSSE, RAIO)
    expect(out.props).toEqual([{ ...SILHUETA_DA_CAMA, layer: 'decoracao' }])
  })

  it('objeto sem rotação sai sem o campo, como o mestre o tem', () => {
    const { map: out } = filterMapForPlayer(mapa({ rotation: undefined }), 'ana', POSSE, RAIO)
    expect(out.props).toEqual([{ id: 'cama', x: 250, y: 180, width: 80, height: 40, src: '', linkedMapPath: null }])
    expect(out.props[0]).not.toHaveProperty('rotation')
  })

  describe('teto de construção', () => {
    /** Sem a parede: a Ana de fora enxerga o quarto, e só o teto pode esconder a cama. */
    function mapaComTeto(ana: { x: number; y: number }): MapData {
      return mapa({}, { walls: [], regions: [quarto({ roof: true })], tokens: [ficha('ficha-ana', ana.x, ana.y)] })
    }

    it('teto fechado com a Ana fora: nada da cama', () => {
      const { map: out } = filterMapForPlayer(mapaComTeto({ x: 250, y: 600 }), 'ana', POSSE, RAIO)
      expect(out.props).toEqual([])
      expect(JSON.stringify(out)).not.toContain('cama')
    })

    it('a Ana entra, o teto abre e a silhueta chega', () => {
      const { map: out } = filterMapForPlayer(mapaComTeto({ x: 250, y: 300 }), 'ana', POSSE, RAIO)
      expect(out.props).toEqual([SILHUETA_DA_CAMA])
    })
  })
})
