/**
 * CARIMBO ESCONDIDO NÃO TAPA O OLHAR (auditoria de 16/11/2026, a regra de ouro de
 * `propsQueTapam`): o carimbo com "Tapa a visão" que o recorte nunca entrega ao
 * jogador (pé em zona oculta ativa ou em sala secreta, camada escondida dele) não
 * existe para ele. Antes a pegada seguia em `mapaDaVisao` e fazia sombra: o guarda
 * atrás sumia do pacote como atrás de um carimbo à vista, e a sombra contava que
 * havia algo ali. O carimbo à vista continua tapando. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { Carimbo, MapData, Region, RegionPoint, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const SO_ANA: Record<string, string[]> = { ana: ['ryoko'] }
const DIA = 12 * GRID

const P = (x: number, y: number): RegionPoint => ({ x: x * GRID, y: y * GRID })
const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
const ficha = (id: string, x: number, y: number): Token => ({ id, characterId: null, name: `nome-${id}`, x: x * GRID, y: y * GRID, size: 1, image: null })

/** Pegada de 2 células (meia pegada = 0,25 do tamanho) entre a Ryoko (3; 5) e o guarda (12; 5). */
const rochedo: Carimbo = { id: 'rochedo', tipo: 'pinheiro', x: 8 * GRID, y: 5 * GRID, tamanho: 4 * GRID, giro: 0, tapaVisao: true }

const COFRE: Region = { id: 'cofre', tag: 'region', fillColor: '#444444', fillPattern: 'solid', data: {}, secret: true, room: { shape: 'rect', name: 'Cofre' }, points: rect(7, 4, 9, 6) }

type Esconderijo = 'nenhum' | 'zona' | 'sala-secreta'

function cena(comCarimbo: boolean, esconderijo: Esconderijo): MapData {
  return {
    ...createEmptyMap('mata', 'Mata', 30, 10, GRID),
    externa: true,
    tokens: [ficha('ryoko', 3, 5), ficha('guarda', 12, 5)],
    carimbos: comCarimbo ? [rochedo] : [],
    concealZones: esconderijo === 'zona' ? [{ id: 'zona', name: 'Mata', revealed: false, points: rect(7, 4, 9, 6) }] : [],
    regions: esconderijo === 'sala-secreta' ? [COFRE] : [],
  }
}

function pacote(map: MapData) {
  const view = filterMapForPlayer(map, 'ana', SO_ANA, DIA)
  return { vision: view.vision, tokens: view.map.tokens.map((t) => t.id).sort(), carimbos: (view.map.carimbos ?? []).map((c) => c.id) }
}

describe('carimbo com "Tapa a visão" escondido do jogador', () => {
  it('controle: o carimbo à vista tapa, e o guarda atrás dele não vem no pacote', () => {
    expect(pacote(cena(false, 'nenhum')).tokens).toContain('guarda')
    const com = pacote(cena(true, 'nenhum'))
    expect(com.tokens).not.toContain('guarda')
    expect(com.vision).not.toEqual(pacote(cena(false, 'nenhum')).vision)
  })

  it('em zona oculta ou em sala secreta, não tapa: o pacote e a visão são os da cena sem ele', () => {
    for (const esconderijo of ['zona', 'sala-secreta'] as const) {
      const com = pacote(cena(true, esconderijo))
      expect(com.carimbos).toEqual([])
      expect(com.tokens).toContain('guarda')
      expect(com).toEqual(pacote(cena(false, esconderijo)))
    }
  })
})
