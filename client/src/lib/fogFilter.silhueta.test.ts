import { describe, expect, it } from 'vitest'
import type { DoorState, MapData, Prop, Region, Token, Wall } from '../types/map'
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

    it('carroça com o centro no pátio e a frente 20 px dentro do prédio fechado não sai; encostada por fora, sai', () => {
      // A Ana está no pátio, ao sul do quarto (a parede sul é y = 400).
      const carroca = (y: number): Prop => ({ id: 'carroca', src: CAMINHO_DA_IMAGEM, x: 250, y, width: 60, height: 60, linkedMapPath: null })
      const noPatio = (y: number): MapData => ({ ...mapaComTeto({ x: 250, y: 600 }), props: [carroca(y)] })

      // y 380..440: o centro está fora, mas a frente entra no prédio.
      const { map: atravessada } = filterMapForPlayer(noPatio(410), 'ana', POSSE, RAIO)
      expect(atravessada.props).toEqual([])
      expect(JSON.stringify(atravessada)).not.toContain('carroca')

      // y 400..460: rente à parede, do lado de fora. É do pátio, e a Ana a vê.
      const { map: encostada } = filterMapForPlayer(noPatio(430), 'ana', POSSE, RAIO)
      expect(encostada.props).toEqual([{ id: 'carroca', x: 250, y: 430, width: 60, height: 60, src: '', linkedMapPath: null }])
    })
  })

  describe('sala "Oculta para jogadores" (sala secreta)', () => {
    /**
     * O cofre do prefeito: sala secreta (300..600 x 100..400) com as 6 paredes
     * ligadas a ela e a porta ABERTA no meio da parede oeste (y 220..280). A
     * Ana está no corredor, em (150, 250), de frente para a porta: pela porta
     * aberta a lanterna dela alcança o baú, em (450, 250).
     *
     * O recorte já tira do pacote a sala, as paredes e o chão dela. O que
     * sobrasse do cofre seria pintado no VAZIO — um retângulo solto dizendo
     * que ali existe um cômodo, e o que tem dentro dele.
     */
    const COFRE = 'sala-secreta'
    const PORTA_ABERTA: DoorState = { open: true, locked: false, kind: 'normal' }

    function paredeDoCofre(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
      return { ...parede(id, x1, y1, x2, y2), door, regionId: COFRE }
    }

    const PAREDES_DO_COFRE: Wall[] = [
      paredeDoCofre('cofre-norte', 300, 100, 600, 100),
      paredeDoCofre('cofre-leste', 600, 100, 600, 400),
      paredeDoCofre('cofre-sul', 600, 400, 300, 400),
      paredeDoCofre('cofre-oeste-1', 300, 100, 300, 220),
      paredeDoCofre('cofre-porta', 300, 220, 300, 280, PORTA_ABERTA),
      paredeDoCofre('cofre-oeste-2', 300, 280, 300, 400),
    ]

    function cofre(secreta: boolean): Region {
      return {
        id: COFRE,
        points: [
          { x: 300, y: 100 },
          { x: 600, y: 100 },
          { x: 600, y: 400 },
          { x: 300, y: 400 },
        ],
        tag: '',
        fillColor: '#654',
        fillPattern: 'solid',
        data: {},
        room: { shape: 'rect', name: 'Cofre do prefeito' },
        secret: secreta,
      }
    }

    /** Objeto como o mestre o tem, com a imagem no disco dele. */
    function objeto(id: string, x: number, y: number, width: number, height: number, rotation?: number): Prop {
      return { id, src: CAMINHO_DA_IMAGEM, x, y, width, height, linkedMapPath: null, ...(rotation === undefined ? {} : { rotation }) }
    }

    /** O mesmo objeto como o jogador o recebe: a geometria, sem a imagem. */
    function silhueta(prop: Prop): Prop {
      return { ...prop, src: '' }
    }

    const BAU = objeto('bau-do-cofre', 450, 250, 60, 40)

    function mapaDoCofre(props: Prop[], opcoes: { secreta?: boolean; paredes?: Wall[] } = {}): MapData {
      return {
        ...createEmptyMap('m-cofre', 'Prefeitura', 25, 25, 40),
        walls: opcoes.paredes ?? PAREDES_DO_COFRE,
        regions: [cofre(opcoes.secreta ?? true)],
        tokens: [ficha('ficha-ana', 150, 250)],
        props,
      }
    }

    function propsDaAna(map: MapData): Prop[] {
      return filterMapForPlayer(map, 'ana', POSSE, RAIO).map.props
    }

    it('sem o segredo, a Ana enxerga o baú pela porta aberta: o cenário mede o que diz medir', () => {
      expect(propsDaAna(mapaDoCofre([BAU], { secreta: false }))).toEqual([silhueta(BAU)])
    })

    it('com o segredo, o baú não sai no pacote, embora a lanterna da Ana alcance lá dentro', () => {
      const { map: out } = filterMapForPlayer(mapaDoCofre([BAU]), 'ana', POSSE, RAIO)
      expect(out.props).toEqual([])
      expect(JSON.stringify(out)).not.toContain('bau-do-cofre')
    })

    it('sem parede nenhuma, o segredo continua levando o baú junto', () => {
      expect(propsDaAna(mapaDoCofre([BAU], { paredes: [] }))).toEqual([])
    })

    it('armário com o centro no corredor e a ponta dentro do cofre não sai: a silhueta pintaria a ponta no vazio', () => {
      // x 220..320: o centro fica 30 px antes da porta, e 20 px do armário passam para dentro.
      const armario = objeto('armario', 270, 250, 100, 40)
      expect(propsDaAna(mapaDoCofre([armario], { secreta: false }))).toEqual([silhueta(armario)])
      expect(propsDaAna(mapaDoCofre([armario]))).toEqual([])
    })

    it('a rotação conta: o banco em pé ao lado da porta sai; o mesmo banco atravessado nela, não', () => {
      const emPe = objeto('banco', 270, 250, 120, 20, 90) // x 260..280: não chega à parede do cofre
      const atravessado = objeto('banco', 270, 250, 120, 20, 0) // x 210..330: 30 px dentro do cofre
      expect(propsDaAna(mapaDoCofre([emPe]))).toEqual([silhueta(emPe)])
      expect(propsDaAna(mapaDoCofre([atravessado]))).toEqual([])
    })

    it('a estante rente à parede do cofre, do lado de fora, continua na tela: a borda da sala não conta como dentro', () => {
      // A estante que esconde a passagem: x 270..300, encostada na parede oeste do cofre.
      const estante = objeto('estante', 285, 160, 30, 60)
      expect(propsDaAna(mapaDoCofre([estante]))).toEqual([silhueta(estante)])
    })
  })
})
