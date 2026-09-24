/**
 * CARAVANA NO MAPA-MUNDI — o recorte do jogador. Numa cena marcada como
 * mapa-mundi o grupo é UMA ficha só: o jogador recebe a caravana e nada das
 * fichas de ninguém (nome, foto, vida, mochila, id — nem da própria), e a
 * visão sai do ponto da caravana, não de onde cada ficha ficou esquecida.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, RegionPoint, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { allPlayerTokens, filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { pointInRing } from './floorContour'
import { CARAVAN_TOKEN_ID } from './caravan'

const RAIO = 300

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

const ANA = ficha('ficha-ana-7f', 'Ana Guerreira', 100, 100, {
  imageData: 'data:image/png;base64,QU5BRk9UTw==',
  health: { current: 3, max: 10, shownToPlayers: true },
  mochila: [{ id: 'it-1', nome: 'Chave de Rubi' }],
})
// Ficou esquecida longe: quem enxerga é a caravana, não ela.
const BIA = ficha('ficha-bia-3c', 'Bia Arqueira', 1200, 400)
const NPC_PERTO = ficha('npc-perto', 'Mercador', 200, 100)
const NPC_LONGE = ficha('npc-longe', 'Bandido', 1300, 400)

const OWNERSHIP = { p1: [ANA.id], p2: [BIA.id] }

function mundo(worldMap: boolean): MapData {
  const base: MapData = { ...createEmptyMap('m-mundo', 'Continente', 30, 10, 50), tokens: [ANA, BIA, NPC_PERTO, NPC_LONGE] }
  return worldMap ? { ...base, worldMap: true } : base
}

const vê = (vision: RegionPoint[][], point: RegionPoint): boolean => vision.some((ring) => ring.length >= 3 && pointInRing(point, ring))

describe('mapa-mundi: o jogador recebe a caravana, e só ela', () => {
  it('as fichas do grupo viram UMA ficha "caravana" no ponto da primeira; o NPC visível continua', () => {
    const view = filterMapForPlayer(mundo(true), 'p1', OWNERSHIP, RAIO)
    expect(view.map.tokens.map((t) => t.id)).toEqual([CARAVAN_TOKEN_ID, 'npc-perto'])
    expect(view.map.tokens[0]).toEqual({ id: CARAVAN_TOKEN_ID, characterId: null, name: 'Caravana', x: 100, y: 100, size: 1, image: null })
    expect(view.map.worldMap).toBe(true)
  })

  it('nada de ficha nenhuma atravessa: nome, id, foto, vida e mochila ficam no mestre', () => {
    const texto = JSON.stringify(filterMapForPlayer(mundo(true), 'p1', OWNERSHIP, RAIO).map)
    for (const segredo of ['ficha-ana-7f', 'Ana Guerreira', 'QU5BRk9UTw==', 'Chave de Rubi', 'ficha-bia-3c', 'Bia Arqueira', 'Continente']) {
      expect(texto).not.toContain(segredo)
    }
    expect(texto).not.toContain('"health"')
    expect(texto).not.toContain('"mochila"')
  })

  it('a visão sai da caravana: a ficha esquecida longe não enxerga o bandido ao lado dela', () => {
    const view = filterMapForPlayer(mundo(true), 'p2', OWNERSHIP, RAIO)
    expect(view.map.tokens.map((t) => t.id)).toEqual([CARAVAN_TOKEN_ID, 'npc-perto'])
    expect(vê(view.vision, { x: 110, y: 110 })).toBe(true)
    expect(vê(view.vision, { x: 1250, y: 400 })).toBe(false)
    expect(JSON.stringify(view.map)).not.toContain('Bandido')
  })

  it('tela da mesa (grupo) recebe a mesma caravana única', () => {
    const view = filterMapForGroup(mundo(true), [{ tokenIds: [BIA.id], visionRadius: RAIO }], undefined, undefined, allPlayerTokens(OWNERSHIP))
    expect(view.map.tokens.map((t) => t.id)).toEqual([CARAVAN_TOKEN_ID, 'npc-perto'])
  })

  it('cena comum (sem a marca) continua como sempre: a própria ficha vai, com o nome', () => {
    const view = filterMapForPlayer(mundo(false), 'p1', OWNERSHIP, RAIO)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['ficha-ana-7f', 'npc-perto'])
    expect(view.map.worldMap).toBeUndefined()
  })

  it('mapa-mundi sem ficha do grupo: nenhuma caravana inventada, e a marca continua', () => {
    const vazio: MapData = { ...mundo(true), tokens: [NPC_PERTO] }
    const view = filterMapForPlayer(vazio, 'p1', OWNERSHIP, RAIO)
    expect(view.map.tokens).toEqual([])
    expect(view.map.worldMap).toBe(true)
  })
})
