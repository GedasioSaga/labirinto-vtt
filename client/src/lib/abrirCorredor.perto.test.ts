import { describe, expect, it, vi } from 'vitest'
import { corredoresDaSala } from './abrirCorredor'
import { buildRoomFromDraft } from './drawingFactory'
import { addRoom, createEmptyMap } from './mapFactory'
import { pointOnPolygonBorder } from './roomNesting'
import type { MapData, Wall } from '../types/map'

/**
 * A conta do "Abrir para o corredor" roda a cada quadro do arrasto da Sala
 * selecionada: o painel lê `selectCorredoresParaAbrir`, e o mapa muda a cada
 * pointermove. Medida num mapa de 14 mil paredes soltas, a régua da borda em
 * TODA parede custava ~8 ms por quadro numa Sala de 4 lados e ~55 ms numa
 * redonda de 32. Parede longe da Sala não encosta nem esticada: nem é medida.
 */

// Conta as chamadas da régua da borda sem mudar o que ela responde.
vi.mock('./roomNesting', async (importOriginal) => {
  const real = await importOriginal<typeof import('./roomNesting')>()
  return { ...real, pointOnPolygonBorder: vi.fn(real.pointOnPolygonBorder) }
})
const reguaDaBorda = vi.mocked(pointOnPolygonBorder)

const PAREDES_LONGE = 2000
/** As duas linhas do corredor e a sobra do traço: um punhado de medidas, nunca uma por parede do mapa. */
const MEDIDAS_PERTO_MAX = 50

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** A "Sala 3": retângulo 0..600 × 0..500. */
function salaCom(linhas: Wall[], grade: number): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 600, y: 500 }, undefined, undefined, 'Sala 3')
  const comSala = addRoom(createEmptyMap('m_perto', 'Perto', 30, 30, grade), region, walls)
  return { ...comSala, walls: [...comSala.walls, ...linhas] }
}

// Imagem 4: A entra pela borda de cima, B pela lateral esquerda — um corredor só.
const A = parede('A', -200, -200, 150, 50)
const B = parede('B', -300, -100, 50, 180)

describe('corredoresDaSala só mede as paredes perto da Sala', () => {
  it('2000 paredes soltas longe da Sala nem passam pela régua da borda', () => {
    const longe = Array.from({ length: PAREDES_LONGE }, (_, i) => parede(`L${i}`, 5000 + i * 3, 5000, 5000 + i * 3, 5200))
    const map = salaCom([A, B, ...longe], 64)
    reguaDaBorda.mockClear()
    expect(corredoresDaSala(map, 'sala').map((c) => c.linhas.map((l) => l.paredeId).sort())).toEqual([['A', 'B']])
    expect(reguaDaBorda.mock.calls.length).toBeLessThan(MEDIDAS_PERTO_MAX)
  })

  it('a vizinhança não perde a linha que parou logo antes da borda: 12 px com grade 50 (1/4 de célula = 12,5 px)', () => {
    const map = salaCom([parede('D1', 250, 800, 250, 512), parede('D2', 350, 800, 350, 512)], 50)
    expect(corredoresDaSala(map, 'sala').map((c) => c.linhas.map((l) => l.paredeId).sort())).toEqual([['D1', 'D2']])
  })
})
