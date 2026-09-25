import { describe, expect, it } from 'vitest'
import type { ConcealZone, DoorState, MapData, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { pointInRing } from './floorContour'
import { createEmptyMap } from './mapFactory'

/**
 * PORTA SECRETA INDISTINGUÍVEL DA PAREDE LISA, pela rede. O que o jogador
 * recebe com a porta secreta no meio da parede tem de ser EXATAMENTE o que
 * receberia se ali houvesse a parede inteira, sem porta: nem o id da porta,
 * nem as pontas dela — nas paredes e na visão.
 *
 * As pontas da porta são as de `addDoorOnWall` (projeção do clique na reta,
 * número quebrado), então aqui também: a porta vai de x 437.123 a 487.123.
 *
 * Antes, a junção rodava só no pacote final: a visão era calculada com os três
 * pedaços (o polígono ganhava vértices nas pontas da porta), e o recorte do
 * pincel amostrava cada pedaço a partir da ponta dele — a borda do trecho
 * pintado caía em posições que denunciavam onde a porta começa, e o pedaço
 * da porta sozinho no pincel saía com o id dela.
 */
const DOOR_START = 437.123
const DOOR_END = 487.123

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

const SECRETA: DoorState = { open: false, locked: false, kind: 'normal', secret: true }

/** Faixa y 400..600 com o pincel pintado nas colunas col0..col1 da linha da parede (células de 10 px). */
function zonaPintada(col0: number, col1: number): ConcealZone {
  const unveiledCells: string[] = []
  for (let col = col0; col <= col1; col += 1) for (const row of [49, 50]) unveiledCells.push(`${col},${row}`)
  return {
    id: 'z',
    name: 'Ala',
    revealed: false,
    points: [
      { x: 0, y: 400 },
      { x: 1000, y: 400 },
      { x: 1000, y: 600 },
      { x: 0, y: 600 },
    ],
    unveiledCells,
  }
}

function corredor(walls: Wall[], zonas: ConcealZone[]): MapData {
  return {
    ...createEmptyMap('m', 'Corredor', 1000, 1000, 50),
    walls,
    concealZones: zonas,
    // Gabi de frente para a porta; o raio (400) não alcança as pontas da parede.
    tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 462, y: 540, size: 1, image: null }],
  }
}

const comPortaSecreta = (zonas: ConcealZone[] = []): MapData =>
  corredor([parede('n1', 0, 500, DOOR_START, 500), parede('pn', DOOR_START, 500, DOOR_END, 500, { door: SECRETA }), parede('n2', DOOR_END, 500, 1000, 500)], zonas)

const paredeLisa = (zonas: ConcealZone[] = []): MapData => corredor([parede('n1', 0, 500, 1000, 500)], zonas)

const doJogador = (map: MapData) => filterMapForPlayer(map, 'p', { p: ['t'] }, 400)

/** Algum vértice da visão cai numa ponta da porta. */
const marcaPontaDaPorta = (vision: readonly { x: number; y: number }[][]): boolean =>
  vision.flat().some((p) => Math.abs(p.y - 500) < 0.01 && (Math.abs(p.x - DOOR_START) < 0.01 || Math.abs(p.x - DOOR_END) < 0.01))

describe('porta secreta: o jogador recebe o mesmo que receberia da parede lisa', () => {
  it('SEGURANÇA: a visão enviada não tem vértice nas pontas da porta', () => {
    const secreta = doJogador(comPortaSecreta())
    const lisa = doJogador(paredeLisa())
    expect(marcaPontaDaPorta(secreta.vision)).toBe(false)
    expect(secreta.vision).toEqual(lisa.vision)
    expect(secreta.map.walls).toEqual(lisa.map.walls)
  })

  it('SEGURANÇA: pincel só em cima da porta não entrega o pedaço com o id dela', () => {
    // Colunas 44..47 (x 440..480): só a porta cai no pintado, as vizinhas não.
    const secreta = doJogador(comPortaSecreta([zonaPintada(44, 47)]))
    const lisa = doJogador(paredeLisa([zonaPintada(44, 47)]))
    expect(secreta.map.walls).toEqual(lisa.map.walls)
    expect(secreta.map.walls.map((w) => w.id)).toEqual(['n1~pincel0'])
    expect(JSON.stringify(secreta.map)).not.toContain('pn')
  })

  it('SEGURANÇA: com a borda do pintado fora da porta, as pontas do trecho são as da parede lisa', () => {
    // Colunas 40..60 (x 400..610): o trecho pintado atravessa a porta inteira.
    const secreta = doJogador(comPortaSecreta([zonaPintada(40, 60)]))
    const lisa = doJogador(paredeLisa([zonaPintada(40, 60)]))
    expect(secreta.map.walls).toEqual(lisa.map.walls)
    expect(secreta.vision).toEqual(lisa.vision)
    expect(marcaPontaDaPorta(secreta.vision)).toBe(false)
  })

  it('SEGURANÇA: zona SEM pincel no meio da parede (pontas e meio fora dela) não deixa sair o trecho de dentro', () => {
    // A emenda deixa a parede comprida (x 0..1000) e as 3 amostras de antes
    // (x 0, 500, 1000) ficavam fora da zona (x 600..800): a parede saía inteira,
    // atravessando a zona. A parede longe da zona segue saindo inteira.
    const zona: ConcealZone = {
      id: 'z',
      name: 'Ala',
      revealed: false,
      points: [
        { x: 600, y: 400 },
        { x: 800, y: 400 },
        { x: 800, y: 600 },
        { x: 600, y: 600 },
      ],
    }
    const longe = parede('w-longe', 0, 800, 400, 800)
    const mapa = (walls: Wall[]): MapData => ({ ...corredor([...walls, longe], [zona]), tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 300, y: 540, size: 1, image: null }] })
    const secreta = doJogador(mapa([parede('n1', 0, 500, 680, 500), parede('pn', 680, 500, 730, 500, { door: SECRETA }), parede('n2', 730, 500, 1000, 500)]))
    const lisa = doJogador(mapa([parede('n1', 0, 500, 1000, 500)]))
    const comum = doJogador(mapa([parede('n1', 0, 500, 680, 500), parede('pn', 680, 500, 730, 500, { door: { open: false, locked: false, kind: 'normal' } }), parede('n2', 730, 500, 1000, 500)]))
    // Sai só o que fica FORA da zona (x 0..600 e 800..1000), nunca o trecho de dentro.
    expect(secreta.map.walls.map((w) => w.id)).toEqual(['n1~pincel0', 'n1~pincel1', 'w-longe'])
    expect(lisa.map.walls.map((w) => w.id)).toEqual(['n1~pincel0', 'n1~pincel1', 'w-longe'])
    expect(comum.map.walls.map((w) => w.id)).toEqual(['n1~pincel0', 'n2~pincel0', 'w-longe'])
    for (const view of [secreta, lisa, comum]) {
      expect(view.map.walls.filter((w) => w.y1 === 500).every((w) => Math.max(w.x1, w.x2) <= 600 || Math.min(w.x1, w.x2) >= 800)).toBe(true)
    }
    expect(secreta.map.walls).toEqual(lisa.map.walls)
    expect(secreta.vision).toEqual(lisa.vision)
    expect(JSON.stringify(secreta.map)).not.toContain('pn')
  })

  it('parede lisa que só atravessa a zona sai nos trechos de fora dela, sem e com pincel', () => {
    // Regressão: recortar só no pintado apagava também o trecho de FORA da zona,
    // e a parede sumia para o jogador enquanto seguia segurando a visão.
    const zona = (unveiledCells?: string[]): ConcealZone => ({
      id: 'z',
      name: 'Ala',
      revealed: false,
      points: [
        { x: 600, y: 400 },
        { x: 800, y: 400 },
        { x: 800, y: 600 },
        { x: 600, y: 600 },
      ],
      ...(unveiledCells === undefined ? {} : { unveiledCells }),
    })
    const mapa = (z: ConcealZone): MapData => ({ ...corredor([parede('n1', 0, 500, 1000, 500)], [z]), tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 300, y: 540, size: 1, image: null }] })
    const trechos = (z: ConcealZone) => doJogador(mapa(z)).map.walls.map((w) => ({ x1: w.x1, x2: w.x2, y: w.y1 }))

    // Sem pincel: os dois trechos de fora, colados na borda da zona (um passo de 2,5 px no máximo).
    const semPincel = trechos(zona())
    expect(semPincel).toHaveLength(2)
    expect(semPincel[0].x1).toBe(0)
    expect(semPincel[0].x2).toBeGreaterThanOrEqual(597.5)
    expect(semPincel[0].x2).toBeLessThanOrEqual(600)
    expect(semPincel[1].x1).toBeGreaterThanOrEqual(800)
    expect(semPincel[1].x1).toBeLessThanOrEqual(802.5)
    expect(semPincel[1].x2).toBe(1000)
    expect(semPincel.every((t) => t.y === 500)).toBe(true)

    // Pincel nas colunas 65..69 (x 650..700): sai também o pintado, e o resto de dentro não.
    const cells: string[] = []
    for (let col = 65; col <= 69; col += 1) for (const row of [49, 50]) cells.push(`${col},${row}`)
    const comPincel = trechos(zona(cells))
    expect(comPincel).toHaveLength(3)
    expect(comPincel[0].x1).toBe(0)
    expect(comPincel[2].x2).toBe(1000)
    expect(comPincel[1].x1).toBeGreaterThanOrEqual(650)
    expect(comPincel[1].x2).toBeLessThanOrEqual(700)
    expect(comPincel[1].x2 - comPincel[1].x1).toBeGreaterThan(40)
  })

  it('SEGURANÇA: parede com as 3 amostras na zona mas trecho fora dela continua segurando a visão enviada', () => {
    // Zona em pente: três dentes (x 0..100, 450..550, 900..1000) presos por
    // uma faixa em y 600..700. Pontas e meio da parede caem nos dentes; x 250
    // não. Tirar a parede da visão enviada deixava o jogador "ver" através
    // dela FORA da zona, onde a autoridade não vê.
    const pente: ConcealZone = {
      id: 'pente',
      name: 'Pente',
      revealed: false,
      points: [
        { x: 0, y: 400 },
        { x: 100, y: 400 },
        { x: 100, y: 600 },
        { x: 450, y: 600 },
        { x: 450, y: 400 },
        { x: 550, y: 400 },
        { x: 550, y: 600 },
        { x: 900, y: 600 },
        { x: 900, y: 400 },
        { x: 1000, y: 400 },
        { x: 1000, y: 700 },
        { x: 0, y: 700 },
      ],
    }
    const mapa: MapData = { ...corredor([parede('n1', 10, 500, 990, 500)], [pente]), tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 250, y: 540, size: 1, image: null }] }
    const view = doJogador(mapa)
    const alemDaParede = { x: 250, y: 450 }
    const aquem = { x: 250, y: 560 }
    expect(view.vision.some((anel) => anel.length >= 3 && pointInRing(aquem, anel))).toBe(true)
    expect(view.vision.some((anel) => anel.length >= 3 && pointInRing(alemDaParede, anel))).toBe(false)
  })

  it('porta revelada volta a chegar partida, com as pontas dela', () => {
    const revelada = doJogador(
      corredor([parede('n1', 0, 500, DOOR_START, 500), parede('pn', DOOR_START, 500, DOOR_END, 500, { door: { open: false, locked: false, kind: 'normal' } }), parede('n2', DOOR_END, 500, 1000, 500)], []),
    )
    expect(revelada.map.walls.map((w) => w.id)).toEqual(['n1', 'pn', 'n2'])
    expect(revelada.visibleDoorIds).toEqual(['pn'])
  })
})
