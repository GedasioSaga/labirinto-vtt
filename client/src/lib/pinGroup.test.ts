import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { snapPointForTarget } from '../pixi/tokenInteraction'
import { companionSpots, TRAVEL_GROUP_CELLS, travelCandidates } from './pinGroup'

/**
 * ESCOLHER FICHAS NO PINO — a conta compartilhada pelo host (validar a lista
 * que o jogador manda) e pela tela do jogador (quais caixas o cartão mostra).
 */

const GRID = 50

function ficha(id: string, x: number, y: number, size = 1): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, door: null, blocksMove: true, blocksLight: true }
}

describe('travelCandidates', () => {
  it('a mais perto e quem está a até TRAVEL_GROUP_CELLS casas além dela, da mais perto para a mais longe', () => {
    const pino = { x: 300, y: 200 }
    const enzo = ficha('enzo', 240, 200) // 60 px
    const rufo = ficha('rufo', 270, 200) // 30 px: a mais perto
    const longe = ficha('longe', 300 + 30 + TRAVEL_GROUP_CELLS * GRID + 1, 200) // 1 px além da folga
    const naBorda = ficha('borda', 300, 200 + 30 + TRAVEL_GROUP_CELLS * GRID) // exatamente na folga
    expect(travelCandidates([enzo, longe, rufo, naBorda], pino, GRID).map((t) => t.id)).toEqual(['rufo', 'enzo', 'borda'])
  })

  it('sem fichas não há candidatas; uma ficha só é sempre a candidata, esteja onde estiver', () => {
    expect(travelCandidates([], { x: 0, y: 0 }, GRID)).toEqual([])
    const sozinha = ficha('so', 1900, 450)
    expect(travelCandidates([sozinha], { x: 0, y: 0 }, GRID)).toEqual([sozinha])
  })
})

describe('companionSpots', () => {
  const vazio = (): MapData => createEmptyMap('m', 'Beiral', 40, 10, GRID)
  /** A primeira ficha, a que chega no pino par (a posição dela é a de ANTES da viagem). */
  const lider = (size = 1): Token => ficha('lider', 9999, 9999, size)
  const companheiras = (n: number, size = 1): Token[] => Array.from({ length: n }, (_, i) => ficha(`c${i}`, 9999, 9999, size))

  it('cada companheira cai numa casa vizinha da chegada, uma por casa, nenhuma em cima da primeira', () => {
    const chegada = { x: 525, y: 225 }
    const spots = companionSpots(vazio(), lider(), chegada, companheiras(3))
    expect(spots).toHaveLength(3)
    const chaves = new Set(spots.map((p) => `${p.x},${p.y}`))
    expect(chaves.size).toBe(3)
    expect(chaves.has('525,225')).toBe(false)
    for (const p of spots) expect(Math.max(Math.abs(p.x - chegada.x), Math.abs(p.y - chegada.y))).toBe(GRID)
  })

  it('não atravessa parede: a casa do outro lado da parede fica de fora', () => {
    const chegada = { x: 525, y: 225 }
    // Parede vertical colada à direita da chegada, de ponta a ponta do mapa: bloqueia o leste inteiro (E, NE, SE).
    const mapa: MapData = { ...vazio(), walls: [parede('w', 550, 0, 550, 500)] }
    const spots = companionSpots(mapa, lider(), chegada, companheiras(5))
    expect(spots).toHaveLength(5)
    expect(new Set(spots.map((p) => `${p.x},${p.y}`)).size).toBe(5)
    for (const p of spots) {
      expect(p.x).toBeLessThan(550)
      expect(p.x).toBeGreaterThanOrEqual(chegada.x - GRID)
    }
  })

  it('não cai em cima de ficha que já está na cena de destino nem fora do mapa', () => {
    const canto = { x: 25, y: 25 }
    const mapa: MapData = { ...vazio(), tokens: [ficha('bia', 75, 25)] }
    const spots = companionSpots(mapa, lider(), canto, companheiras(2))
    expect(spots).toHaveLength(2)
    for (const p of spots) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(`${p.x},${p.y}`).not.toBe('75,25')
    }
  })

  it('nenhuma companheira: lista vazia', () => {
    expect(companionSpots(vazio(), lider(), { x: 525, y: 225 }, [])).toEqual([])
  })

  it('grade hexagonal: cada companheira cai no centro de um hexágono vizinho, não a uma casa quadrada da chegada', () => {
    const mapa: MapData = { ...vazio(), gridShape: 'hex' }
    const chegada = snapPointForTarget('token', 'hex', 525, 225, GRID)
    const spots = companionSpots(mapa, lider(), chegada, companheiras(3))
    expect(spots).toHaveLength(3)
    expect(new Set(spots.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBe(3)
    // Centro de hexágono: o snap não o move, e fica a pelo menos um vizinho (sqrt(3) × grade) da chegada.
    const vizinho = Math.sqrt(3) * GRID
    for (const p of spots) {
      const centro = snapPointForTarget('token', 'hex', p.x, p.y, GRID)
      expect(p.x).toBeCloseTo(centro.x, 6)
      expect(p.y).toBeCloseTo(centro.y, 6)
      expect(Math.hypot(p.x - chegada.x, p.y - chegada.y)).toBeGreaterThanOrEqual(vizinho - 0.001)
    }
  })

  it('grade quadrada: ficha de 2 casas senta na quina (linha da grade) e não cobre a primeira', () => {
    const chegada = { x: 525, y: 225 }
    const [spot] = companionSpots(vazio(), lider(), chegada, companheiras(1, 2))
    expect(spot).toBeDefined()
    if (spot === undefined) return
    expect(spot.x % GRID).toBe(0)
    expect(spot.y % GRID).toBe(0)
    // Sem sobrepor: centros a pelo menos (1 + 2) / 2 casas, com a mesma folga do "Reunir o grupo".
    expect(Math.hypot(spot.x - chegada.x, spot.y - chegada.y)).toBeGreaterThanOrEqual(1.5 * GRID * 0.9)
  })

  it('primeira ficha de 2 casas: as companheiras de 1 casa caem no centro da casa, fora do disco dela', () => {
    const chegada = { x: 500, y: 200 } // quina: onde a ficha de 2 casas assenta
    const spots = companionSpots(vazio(), lider(2), chegada, companheiras(3))
    expect(spots).toHaveLength(3)
    for (const p of spots) {
      expect(p.x % GRID).toBe(GRID / 2)
      expect(p.y % GRID).toBe(GRID / 2)
      expect(Math.hypot(p.x - chegada.x, p.y - chegada.y)).toBeGreaterThanOrEqual(1.5 * GRID * 0.9)
    }
  })

  it('ficha que o mestre esconde (oculta, secreta ou na camada Fichas escondida) não empurra a companheira: nada vaza pela casa pulada', () => {
    const chegada = { x: 525, y: 225 }
    const escondidas: MapData = {
      ...vazio(),
      // Todas as casas do primeiro anel, nas duas ordens possíveis de busca.
      tokens: [
        { ...ficha('oculta', 475, 225), hidden: true },
        { ...ficha('secreta', 525, 175), secret: true },
        { ...ficha('oculta2', 525, 275), hidden: true },
        { ...ficha('secreta2', 575, 225), secret: true },
      ],
    }
    const semNada = companionSpots(vazio(), lider(), chegada, companheiras(4))
    expect(companionSpots(escondidas, lider(), chegada, companheiras(4))).toEqual(semNada)
    const camadaOculta: MapData = { ...vazio(), hiddenLayers: ['tokens'], tokens: [ficha('a', 475, 225), ficha('b', 525, 175)] }
    expect(companionSpots(camadaOculta, lider(), chegada, companheiras(4))).toEqual(semNada)
  })

  it('pino par na mesma cena: a casa de onde as viajantes saem não conta como ocupada', () => {
    const chegada = { x: 525, y: 225 }
    const [c0] = companheiras(1)
    if (c0 === undefined) return
    const viajanteAqui = { ...c0, x: 525, y: 175 }
    const mapa: MapData = { ...vazio(), tokens: [viajanteAqui] }
    expect(companionSpots(mapa, lider(), chegada, [viajanteAqui])).toEqual(companionSpots(vazio(), lider(), chegada, [viajanteAqui]))
  })
})
