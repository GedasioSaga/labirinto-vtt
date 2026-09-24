import { describe, expect, it } from 'vitest'
import type { ConcealZone, Light, MapData, Prop, Region, RegionPoint, Token, Wall } from '../types/map'
import { pointInRing } from './floorContour'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * CENA ESCURA e SALA ESCURA, lado da REDE. A pergunta é o que o jogador
 * RECEBE: no escuro ele vê a casa em volta da ficha e o que uma Luz ilumina na
 * linha de visão dele (mesmo além do raio), e nada mais sai no pacote.
 *
 * Geometria (px de mundo, grade 40, sem chão para só as paredes barrarem):
 *   PORÃO     Carla em (100,100); caldeira acesa em (700,100), raio 80;
 *             corredor entre as duas, escuro; parede y=300 de ponta a ponta e,
 *             atrás dela, um lampião aceso com um guarda do lado.
 *   QUARTO    sala escura 400..700 x 400..700 numa cena clara, sem paredes;
 *             Duda na soleira, do lado de fora, em (550,370).
 */
const RADIUS = 600

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function light(id: string, x: number, y: number, radius: number, extra: Partial<Light> = {}): Light {
  return { id, x, y, radius, color: '#ffcc66', intensity: 1, ...extra }
}

function prop(id: string, x: number, y: number): Prop {
  return { id, x, y, width: 40, height: 40, src: `${id}.png`, linkedMapPath: null }
}

const inVision = (vision: RegionPoint[][], point: RegionPoint): boolean => vision.some((ring) => ring.length >= 3 && pointInRing(point, ring))
const ids = (items: readonly { id: string }[]): string[] => items.map((i) => i.id).sort()

function porao(extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m-porao', 'Porão da mansão', 1000, 1000, 40),
    dark: true,
    walls: [wall('parede-do-fundo', 0, 300, 1000, 300)],
    lights: [light('caldeira', 700, 100, 80), light('lampiao', 100, 500, 80)],
    tokens: [
      token('carla', 100, 100),
      token('vizinho', 130, 100),
      token('rato', 400, 100),
      token('foguista', 700, 140),
      token('guarda', 100, 520),
    ],
    props: [prop('caixa-no-corredor', 400, 140), prop('pa-da-caldeira', 690, 90)],
    ...extra,
  }
}

const CARLA = { p1: ['carla'] }

describe('cena escura: só se vê onde há luz', () => {
  it('Porão escuro: Carla vê a casa dela e a caldeira de longe; o corredor entre elas não sai', () => {
    const view = filterMapForPlayer(porao(), 'p1', CARLA, RADIUS)
    expect(ids(view.map.tokens)).toEqual(['carla', 'foguista', 'vizinho'])
    expect(ids(view.map.props)).toEqual(['pa-da-caldeira'])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('rato')
    expect(json).not.toContain('caixa-no-corredor')
    // A visão enviada acende a casa dela e a caldeira, e o corredor fica preto.
    expect(inVision(view.vision, { x: 100, y: 100 })).toBe(true)
    expect(inVision(view.vision, { x: 700, y: 100 })).toBe(true)
    expect(inVision(view.vision, { x: 400, y: 100 })).toBe(false)
    expect(inVision(view.vision, { x: 250, y: 100 })).toBe(false)
  })

  it('a caldeira fica além do raio de visão e ainda assim é vista', () => {
    // Raio de 300 px: a caldeira em x=700 está a 600 px, o dobro.
    const view = filterMapForPlayer(porao(), 'p1', CARLA, 300)
    expect(ids(view.map.tokens)).toContain('foguista')
    expect(ids(view.map.lights)).toContain('caldeira')
    expect(inVision(view.vision, { x: 700, y: 120 })).toBe(true)
  })

  it('atrás de parede nada: nem o lampião aceso, nem quem está do lado dele', () => {
    const view = filterMapForPlayer(porao(), 'p1', CARLA, RADIUS)
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('guarda')
    expect(json).not.toContain('lampiao')
    expect(ids(view.map.lights)).toEqual(['caldeira'])
    expect(inVision(view.vision, { x: 100, y: 500 })).toBe(false)
    expect(inVision(view.vision, { x: 100, y: 320 })).toBe(false)
  })

  it('controle: a mesma cena clara mostra o corredor inteiro', () => {
    const view = filterMapForPlayer(porao({ dark: undefined }), 'p1', CARLA, RADIUS)
    // O foguista está a 601 px: fora do raio de 600, e sem escuro não há luz que o traga.
    expect(ids(view.map.tokens)).toEqual(['carla', 'rato', 'vizinho'])
    expect(inVision(view.vision, { x: 400, y: 100 })).toBe(true)
  })

  it('tocha presa num NPC que o mestre esconde não acende nada para o jogador', () => {
    const map = porao({
      lights: [light('tocha-do-npc', 400, 100, 80, { attachedTokenId: 'npc' })],
      tokens: [token('carla', 100, 100), token('npc', 400, 100, { hidden: true }), token('rato', 420, 110)],
    })
    const view = filterMapForPlayer(map, 'p1', CARLA, RADIUS)
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('rato')
    expect(json).not.toContain('npc')
    expect(inVision(view.vision, { x: 400, y: 100 })).toBe(false)
    expect(inVision(view.vision, { x: 100, y: 100 })).toBe(true)
  })

  it('"escura" é regra do mestre: o campo não sai no pacote', () => {
    const view = filterMapForPlayer(porao(), 'p1', CARLA, RADIUS)
    expect(view.map.dark).toBeUndefined()
    expect(JSON.stringify(view.map)).not.toContain('"dark"')
  })
})

const QUARTO: Region['points'] = [
  { x: 400, y: 400 },
  { x: 700, y: 400 },
  { x: 700, y: 700 },
  { x: 400, y: 700 },
]

function quartoEscuro(duda: RegionPoint, extra: Partial<MapData> = {}): MapData {
  const quarto: Region = {
    id: 'quarto',
    points: QUARTO,
    tag: '',
    fillColor: '#223',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Quarto', dark: true },
  }
  return {
    ...createEmptyMap('m-casa', 'Casa', 1000, 1000, 40),
    regions: [quarto],
    tokens: [token('duda', duda.x, duda.y), token('na-soleira', 550, 405), token('no-fundo', 550, 650), token('no-corredor', 200, 370)],
    ...extra,
  }
}

const DUDA = { p1: ['duda'] }

describe('sala escura numa cena clara', () => {
  it('Quarto escuro: Duda na porta vê só a soleira; o fundo do quarto não sai, o corredor claro sai', () => {
    const view = filterMapForPlayer(quartoEscuro({ x: 550, y: 370 }), 'p1', DUDA, RADIUS)
    expect(ids(view.map.tokens)).toEqual(['duda', 'na-soleira', 'no-corredor'])
    expect(JSON.stringify(view.map)).not.toContain('no-fundo')
    expect(inVision(view.vision, { x: 550, y: 405 })).toBe(true)
    expect(inVision(view.vision, { x: 550, y: 600 })).toBe(false)
    expect(inVision(view.vision, { x: 200, y: 370 })).toBe(true)
  })

  it('vela acesa no fundo do quarto: Duda da porta vê quem está junto da vela, e só', () => {
    const map = quartoEscuro({ x: 550, y: 370 }, {
      lights: [light('vela', 650, 650, 40)],
      tokens: [token('duda', 550, 370), token('junto-da-vela', 660, 660), token('no-fundo', 450, 650)],
    })
    const view = filterMapForPlayer(map, 'p1', DUDA, RADIUS)
    expect(ids(view.map.tokens)).toEqual(['duda', 'junto-da-vela'])
    expect(inVision(view.vision, { x: 650, y: 650 })).toBe(true)
    expect(inVision(view.vision, { x: 550, y: 550 })).toBe(false)
  })

  it('de dentro do quarto escuro: a casa dela e o corredor claro lá fora, nada do quarto', () => {
    const view = filterMapForPlayer(quartoEscuro({ x: 550, y: 550 }), 'p1', DUDA, RADIUS)
    expect(ids(view.map.tokens)).toEqual(['duda', 'no-corredor'])
    expect(inVision(view.vision, { x: 550, y: 550 })).toBe(true)
    expect(inVision(view.vision, { x: 550, y: 650 })).toBe(false)
    expect(inVision(view.vision, { x: 450, y: 450 })).toBe(false)
  })

  it('"Sala escura" é regra do mestre: a sala sai sem o campo', () => {
    // Duda no meio do quarto: a casa dela é o interior, então a sala sai.
    const view = filterMapForPlayer(quartoEscuro({ x: 550, y: 550 }), 'p1', DUDA, RADIUS)
    const quarto = view.map.regions.find((r) => r.id === 'quarto')
    expect(quarto?.room?.name).toBe('Quarto')
    expect(quarto?.room?.dark).toBeUndefined()
    expect(JSON.stringify(view.map)).not.toContain('"dark"')
  })

  it('sala escura secreta não recorta a visão: o formato dela não vai no desenho da visão', () => {
    const secreta = quartoEscuro({ x: 550, y: 370 })
    const map: MapData = { ...secreta, regions: secreta.regions.map((r) => ({ ...r, secret: true })) }
    const clara: MapData = { ...map, regions: map.regions.map((r) => (r.room ? { ...r, room: { ...r.room, dark: undefined } } : r)) }
    const escura = filterMapForPlayer(map, 'p1', DUDA, RADIUS)
    expect(escura.vision).toEqual(filterMapForPlayer(clara, 'p1', DUDA, RADIUS).vision)
    expect(escura.vision.length).toBe(1)
  })
})

function square(x1: number, y1: number, x2: number, y2: number): RegionPoint[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

function zona(id: string, points: RegionPoint[], extra: Partial<ConcealZone> = {}): ConcealZone {
  return { id, points, name: `zona-${id}`, revealed: false, ...extra }
}

function salaEscura(id: string, points: RegionPoint[]): Region {
  return { id, points, tag: '', fillColor: '#223', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: id, dark: true } }
}

const EDGE_STEPS = 50

/**
 * A BORDA da visão enviada passa estritamente por dentro do retângulo? Mede
 * cada lado do anel em `EDGE_STEPS` pontos, não só os vértices: um lado reto
 * pode atravessar a zona inteira sem nenhum vértice dentro dela.
 */
const borderCrosses = (vision: RegionPoint[][], x1: number, y1: number, x2: number, y2: number): boolean =>
  vision.some((ring) =>
    ring.some((a, i) => {
      const b = ring[(i + 1) % ring.length]
      for (let s = 0; s <= EDGE_STEPS; s += 1) {
        const x = a.x + ((b.x - a.x) * s) / EDGE_STEPS
        const y = a.y + ((b.y - a.y) * s) / EDGE_STEPS
        if (x > x1 && x < x2 && y > y1 && y < y2) return true
      }
      return false
    }),
  )

/**
 * SALA ESCURA com ZONA OCULTA. A zona esconde um pedaço da sala; o resto da
 * sala continua escuro. Porão 100..700 numa cena clara, Carla no canto
 * (150,150), o rato no escuro do outro lado (600,150) e uma alcova oculta
 * 350..450 no meio — em cima do centro da sala.
 */
function poraoComAlcova(alcova: ConcealZone): MapData {
  return {
    ...createEmptyMap('m-porao-alcova', 'Porão', 1000, 1000, 40),
    regions: [salaEscura('porao', square(100, 100, 700, 700))],
    concealZones: [alcova],
    tokens: [token('carla', 150, 150), token('rato', 600, 150), token('no-pintado', 365, 365)],
  }
}

describe('sala escura com zona oculta', () => {
  it('uma alcova oculta no meio não acende a sala: o rato no escuro não sai', () => {
    const view = filterMapForPlayer(poraoComAlcova(zona('alcova', square(350, 350, 450, 450))), 'p1', { p1: ['carla'] }, RADIUS)
    expect(ids(view.map.tokens)).toEqual(['carla'])
    expect(JSON.stringify(view.map)).not.toContain('rato')
    expect(inVision(view.vision, { x: 150, y: 150 })).toBe(true)
    expect(inVision(view.vision, { x: 600, y: 150 })).toBe(false)
  })

  it('pincel de revelar: o pedaço pintado aparece, e o resto da sala continua escuro', () => {
    // Célula 36,36 = 360..370 (`REVEAL_BRUSH_CELL` 10): a alcova ainda esconde o centro da sala.
    const alcova = zona('alcova', square(350, 350, 450, 450), { unveiledCells: ['36,36'] })
    const view = filterMapForPlayer(poraoComAlcova(alcova), 'p1', { p1: ['carla'] }, RADIUS)
    expect(ids(view.map.tokens)).toEqual(['carla', 'no-pintado'])
    expect(JSON.stringify(view.map)).not.toContain('rato')
    expect(inVision(view.vision, { x: 600, y: 150 })).toBe(false)
  })

  it('o corte da visão segue a borda da zona, nunca a parede da sala que a zona cobre', () => {
    // Nicho oculto 600..800 x 450..650 cobre a parede leste do Quarto (x=700) nesse trecho.
    // A lanterna acesa no quarto ilumina até a borda do nicho, e nenhum ponto da visão cai dentro dele.
    const map: MapData = {
      ...createEmptyMap('m-quarto-nicho', 'Casa', 1000, 1000, 40),
      regions: [salaEscura('quarto', QUARTO)],
      concealZones: [zona('nicho', square(600, 450, 800, 650))],
      lights: [light('lanterna', 560, 560, 200)],
      tokens: [token('duda', 550, 370), token('junto-da-lanterna', 570, 570), token('no-nicho', 690, 560)],
    }
    const view = filterMapForPlayer(map, 'p1', DUDA, RADIUS)
    expect(ids(view.map.tokens)).toEqual(['duda', 'junto-da-lanterna'])
    expect(inVision(view.vision, { x: 560, y: 560 })).toBe(true)
    // Sem o véu, o claro da lanterna ia até a parede leste (x=700) e desenhava esse trecho dela dentro do nicho.
    expect(inVision(view.vision, { x: 650, y: 560 })).toBe(false)
    expect(borderCrosses(view.vision, 601, 451, 799, 649)).toBe(false)
  })
})
