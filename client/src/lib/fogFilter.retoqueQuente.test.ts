import { describe, expect, it } from 'vitest'
import type { CamadaId, MapData, Prop, Region, Token, Wall } from '../types/map'
import { alternarOlhoDosJogadores } from './camadas/estado'
import { criarCamadaLivre } from './camadas/modelo'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * MEIO-TERMO, RETOQUE Q (MT9), lado da REDE: `vistaDosMoveis`, `chamine`,
 * `grade` e `mobiliaDesenho` chegam ao jogador SÓ junto do que ele já recebe
 * (o móvel à vista, o telhado fechado, a janela à vista) e nada sai de item
 * escondido pela parede, pelo teto aberto, pela camada escondida dos
 * jogadores ou com valor torto (o mapa do mestre é forjado à mão aqui: colar,
 * acervo e a cópia de recuperação não passam pela leitura do arquivo).
 *
 * Mapa 1000 x 1000 (grade 40), parede cega em x = 500. Ana em (250, 650), à
 * esquerda; a Casa (100..400 x 100..400) tem teto; do outro lado da parede, um
 * baú e uma cela que ela não vê.
 */

const RAIO = 700
const POSSE = { ana: ['ficha-ana'] }
const FORA = { x: 250, y: 650 }
const DENTRO = { x: 250, y: 250 }

function ficha(x: number, y: number): Token {
  return { id: 'ficha-ana', characterId: null, name: 'Ana', x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function movel(id: string, x: number, y: number, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x, y, width: 40, height: 40, linkedMapPath: null, mobilia: 'mesa', mobiliaDesenho: 'linhas', ...extra }
}

function casa(room: Partial<NonNullable<Region['room']>> = {}): Region {
  return {
    id: 'casa',
    points: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Casa', roof: true, chamine: true, ...room },
  }
}

const CELA = parede('cela', 100, 900, 300, 900, { janela: true, grade: true })
const MURO = parede('muro', 50, 500, 50, 700, { grade: true })
const CELA_DO_OUTRO_LADO = parede('cela-longe', 700, 900, 900, 900, { janela: true, grade: true })

function mapa(extra: Partial<MapData> = {}, ana = FORA): MapData {
  return {
    ...createEmptyMap('m-vila', 'Vila', 25, 25, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000), CELA, MURO, CELA_DO_OUTRO_LADO],
    regions: [casa()],
    tokens: [ficha(ana.x, ana.y)],
    props: [movel('mesa', 250, 800), movel('bau', 800, 800, { mobilia: 'bau' })],
    vistaDosMoveis: 'tres-quartos',
    ...extra,
  }
}

function recorte(map: MapData): MapData {
  // Pela rede: o que não sobrevive ao JSON não chega.
  const view: { map: MapData } = JSON.parse(JSON.stringify(filterMapForPlayer(map, 'ana', POSSE, RAIO)))
  return view.map
}

/** Camada livre nova, já escondida dos jogadores. */
function comLivreEscondida(map: MapData): { map: MapData; id: CamadaId } {
  const criada = criarCamadaLivre(map, {})
  if (criada === null) throw new Error('não criou a camada')
  return { map: alternarOlhoDosJogadores(criada.map, criada.id), id: criada.id }
}

describe('recorte do jogador — mobiliaDesenho', () => {
  it('o móvel à vista leva o desenho; o de trás da parede não vai, nem o id', () => {
    const r = recorte(mapa())
    expect(r.props.find((p) => p.id === 'mesa')?.mobiliaDesenho).toBe('linhas')
    expect(r.props.some((p) => p.id === 'bau')).toBe(false)
  })

  it('valor torto, ou desenho num objeto sem tipo de móvel, não atravessa', () => {
    const tortos: unknown[] = ['Linhas', 'pontilhado', true, 1, null, {}]
    for (const torto of tortos) {
      // FORJADO: o tipo do arquivo não deixaria, o mapa em memória pode.
      const props = [{ ...movel('mesa', 250, 800), mobiliaDesenho: torto }] as Prop[] // forjado de propósito: o teste é o valor fora do tipo
      expect('mobiliaDesenho' in (recorte(mapa({ props })).props[0] ?? {})).toBe(false)
    }
    const semTipo = recorte(mapa({ props: [movel('img', 250, 800, { mobilia: undefined })] })).props[0]
    expect(semTipo !== undefined && 'mobiliaDesenho' in semTipo).toBe(false)
  })

  it('móvel numa camada escondida dos jogadores: nem o móvel, nem o desenho', () => {
    const { map, id } = comLivreEscondida(mapa())
    const r = recorte({ ...map, props: map.props.map((p) => (p.id === 'mesa' ? { ...p, camada: id } : p)) })
    expect(r.props.some((p) => p.id === 'mesa')).toBe(false)
    expect(JSON.stringify(r)).not.toContain('linhas')
  })
})

describe('recorte do jogador — vistaDosMoveis', () => {
  it('com um móvel à vista, a vista da cena chega', () => {
    expect(recorte(mapa()).vistaDosMoveis).toBe('tres-quartos')
  })

  it('sem móvel à vista (só o baú de trás da parede), a vista não vai', () => {
    const r = recorte(mapa({ props: [movel('bau', 800, 800, { mobilia: 'bau' })] }))
    expect(r.props).toEqual([])
    expect('vistaDosMoveis' in r).toBe(false)
  })

  it('só objeto comum (imagem) à vista: a vista não vai', () => {
    const r = recorte(mapa({ props: [movel('img', 250, 800, { mobilia: undefined, mobiliaDesenho: undefined })] }))
    expect(r.props).toHaveLength(1)
    expect('vistaDosMoveis' in r).toBe(false)
  })

  it('Objetos escondida dos jogadores: nem o móvel, nem a vista', () => {
    const r = recorte(alternarOlhoDosJogadores(mapa(), 'objetos'))
    expect(r.props).toEqual([])
    expect(JSON.stringify(r)).not.toContain('tres-quartos')
  })

  it('valor torto não atravessa; "de cima" (ausente) não vira campo', () => {
    // FORJADO: vista fora do tipo, como chegaria de um mapa editado à mão sem a leitura.
    const torta = { ...mapa(), vistaDosMoveis: 'quatro-quartos' } as unknown as MapData // forjado de propósito: o teste é o valor fora do tipo
    expect('vistaDosMoveis' in recorte(torta)).toBe(false)
    const { vistaDosMoveis: _vista, ...deCima } = mapa()
    expect('vistaDosMoveis' in recorte(deCima)).toBe(false)
  })
})

describe('recorte do jogador — chaminé', () => {
  const casaDoRecorte = (map: MapData) => recorte(map).regions.find((r) => r.id === 'casa')?.room

  it('teto FECHADO: a chaminé chega junto do telhado', () => {
    const room = casaDoRecorte(mapa())
    expect(room?.roof).toBe(true)
    expect(room?.chamine).toBe(true)
  })

  it('teto ABERTO (Ana dentro): a chaminé some com o roof', () => {
    const room = casaDoRecorte(mapa({}, DENTRO))
    expect(room?.roof).toBeUndefined()
    expect(room !== undefined && 'chamine' in room).toBe(false)
  })

  it('teto desligado com chaminé guardada: não sai', () => {
    const room = casaDoRecorte(mapa({ regions: [casa({ roof: false })] }))
    expect(room !== undefined && 'chamine' in room).toBe(false)
  })

  it('valor torto não atravessa', () => {
    // FORJADO: chaminé fora do tipo.
    const regions = [casa({ chamine: 'sim' as unknown as true })] // forjado de propósito: o teste é o valor fora do tipo
    const room = casaDoRecorte(mapa({ regions }))
    expect(room?.roof).toBe(true)
    expect(room !== undefined && 'chamine' in room).toBe(false)
  })

  it('Telhados escondida dos jogadores, ou o telhado numa livre escondida: a chaminé não vai', () => {
    const semTelhados = casaDoRecorte(alternarOlhoDosJogadores(mapa(), 'telhados'))
    expect(semTelhados !== undefined && 'chamine' in semTelhados).toBe(false)
    const { map, id } = comLivreEscondida(mapa())
    const naLivre = { ...map, regions: [casa({ camadaDoTelhado: id })] }
    expect(JSON.stringify(recorte(naLivre))).not.toContain('chamine')
  })
})

describe('recorte do jogador — grade', () => {
  const paredeDoRecorte = (map: MapData, id: string) => recorte(map).walls.find((w) => w.id === id)

  it('a janela à vista leva a grade; a do outro lado da parede não vai', () => {
    expect(paredeDoRecorte(mapa(), 'cela')?.grade).toBe(true)
    expect(paredeDoRecorte(mapa(), 'cela-longe')).toBeUndefined()
  })

  it('grade numa parede que não é janela: a parede chega sem ela', () => {
    const muro = paredeDoRecorte(mapa(), 'muro')
    expect(muro).toBeDefined()
    expect(muro !== undefined && 'grade' in muro).toBe(false)
  })

  it('porta secreta cortada de uma cela: chega parede comum, sem janela e sem grade', () => {
    const secreta = parede('secreta', 100, 900, 300, 900, { janela: true, grade: true, door: { open: false, locked: false, kind: 'normal', secret: true } })
    const w = paredeDoRecorte(mapa({ walls: [parede('divisoria', 500, 0, 500, 1000), secreta] }), 'secreta')
    expect(w?.door).toBeNull()
    expect(w !== undefined && ('grade' in w || 'janela' in w)).toBe(false)
  })

  it('valor torto não atravessa; cela numa camada escondida não vai', () => {
    // FORJADO: grade fora do tipo.
    const torta = { ...CELA, grade: 'sim' } as unknown as Wall // forjado de propósito: o teste é o valor fora do tipo
    const w = paredeDoRecorte(mapa({ walls: [parede('divisoria', 500, 0, 500, 1000), torta] }), 'cela')
    expect(w !== undefined && 'grade' in w).toBe(false)
    const { map, id } = comLivreEscondida(mapa())
    const r = recorte({ ...map, walls: map.walls.map((x) => (x.id === 'cela' ? { ...x, camada: id } : x)) })
    expect(r.walls.some((x) => x.id === 'cela')).toBe(false)
  })
})
