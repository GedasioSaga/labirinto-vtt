import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { companionSpots, TRAVEL_GROUP_CELLS, travelCandidates } from './pinGroup'

/**
 * ESCOLHER FICHAS NO PINO — a conta compartilhada pelo host (validar a lista
 * que o jogador manda) e pela tela do jogador (quais caixas o cartão mostra).
 */

const GRID = 50

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
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

  it('cada companheira cai numa casa vizinha da chegada, uma por casa, nenhuma em cima da primeira', () => {
    const chegada = { x: 525, y: 225 }
    const spots = companionSpots(vazio(), chegada, 3)
    expect(spots).toHaveLength(3)
    const chaves = new Set(spots.map((p) => `${p.x},${p.y}`))
    expect(chaves.size).toBe(3)
    expect(chaves.has('525,225')).toBe(false)
    for (const p of spots) expect(Math.max(Math.abs(p.x - chegada.x), Math.abs(p.y - chegada.y))).toBe(GRID)
  })

  it('não atravessa parede: a casa do outro lado da parede fica de fora', () => {
    const chegada = { x: 525, y: 225 }
    // Parede vertical colada à direita da chegada: bloqueia o leste inteiro (E, NE, SE).
    const mapa: MapData = { ...vazio(), walls: [parede('w', 550, 0, 550, 500)] }
    const spots = companionSpots(mapa, chegada, 5)
    expect(spots).toHaveLength(5)
    for (const p of spots) expect(p.x).toBeLessThan(550)
  })

  it('não cai em cima de ficha que já está na cena de destino nem fora do mapa', () => {
    const canto = { x: 25, y: 25 }
    const mapa: MapData = { ...vazio(), tokens: [ficha('bia', 75, 25)] }
    const spots = companionSpots(mapa, canto, 2)
    expect(spots).toHaveLength(2)
    for (const p of spots) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(`${p.x},${p.y}`).not.toBe('75,25')
    }
  })

  it('nenhuma companheira: lista vazia', () => {
    expect(companionSpots(vazio(), { x: 525, y: 225 }, 0)).toEqual([])
  })
})
