import { describe, expect, it } from 'vitest'
import type { ConcealZone, DoorState, MapData, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
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

  it('porta revelada volta a chegar partida, com as pontas dela', () => {
    const revelada = doJogador(
      corredor([parede('n1', 0, 500, DOOR_START, 500), parede('pn', DOOR_START, 500, DOOR_END, 500, { door: { open: false, locked: false, kind: 'normal' } }), parede('n2', DOOR_END, 500, 1000, 500)], []),
    )
    expect(revelada.map.walls.map((w) => w.id)).toEqual(['n1', 'pn', 'n2'])
    expect(revelada.visibleDoorIds).toEqual(['pn'])
  })
})
