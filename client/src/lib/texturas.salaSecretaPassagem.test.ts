/**
 * PINCEL DE TEXTURAS PELA SALA SECRETA FECHADA (FX-NEVOA2-062). A sala secreta
 * fechada é chão aberto para o jogador: o caminho pintado que a atravessa sai
 * inteiro, na tela dele e na imagem exportada para os jogadores, como o rio, o
 * Ambiente pintado e o desenho; o que mora nela (a maioria dos pontos lá
 * dentro, pincel ou borracha) continua escondido.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, PinceladaDeTextura, Region, RegionPoint, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { mapForImageExport } from './mapImageExport'

const GRID = 50
const POSSE: Record<string, string[]> = { ana: ['ryoko'] }
const VISAO = 12 * GRID
const SEM_O_MESTRE = { grid: false, masterOnly: false }

const P = (x: number, y: number): RegionPoint => ({ x: x * GRID, y: y * GRID })
const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
const ficha = (x: number, y: number): Token => ({ id: 'ryoko', characterId: null, name: 'Ryoko', x: x * GRID, y: y * GRID, size: 1, image: null })

/** A sala secreta fechada S (12..16 x 6..11), com as quatro paredes dela. */
function salaSecreta(): { regions: Region[]; walls: Wall[] } {
  const pts = rect(12, 6, 16, 11)
  const region: Region = { id: 'S', points: pts, tag: 'region', fillColor: '#4d2f05', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Cofre' }, secret: true }
  const walls = pts.map((a, i): Wall => {
    const b = pts[(i + 1) % pts.length]
    return { id: `sw${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: true, blocksMove: true, door: null, regionId: 'S', regionEdgeIndex: i }
  })
  return { regions: [region], walls }
}

/** A estrada de terra atravessa S de oeste a leste (3 de 7 pontos dentro); areia e borracha moram nela. A ficha a oeste. */
function cena(comSala: boolean): MapData {
  const estrada: PinceladaDeTextura = { id: 'estrada', tipo: 'pincel', textura: 'terra', forca: 1, raio: GRID / 2, pontos: [P(6, 8.5), P(9, 8.5), P(11, 8.5), P(13, 8.5), P(14, 8.5), P(15, 8.5), P(19, 8.5)] }
  const areia: PinceladaDeTextura = { id: 'areia', tipo: 'pincel', textura: 'areia', forca: 1, raio: GRID / 2, pontos: [P(12.8, 7), P(13.6, 7.4), P(14.4, 7)] }
  const borracha: PinceladaDeTextura = { id: 'borracha', tipo: 'borracha', forca: 1, raio: GRID / 2, pontos: [P(13.6, 8.2), P(14, 8.6), P(14.4, 9)] }
  const sala = comSala ? salaSecreta() : { regions: [], walls: [] }
  return {
    ...createEmptyMap('m', 'M', 30, 20, GRID),
    ...sala,
    texturas: comSala ? [estrada, areia, borracha] : [estrada],
    tokens: [ficha(9, 8.5)],
  }
}

/** Os pedaços do pincel que o jogador recebe: id e pontos, para comparar com e sem a sala. */
const pedacos = (map: MapData): string[] => (map.texturas ?? []).map((t) => `${t.id} ${'pontos' in t ? t.pontos.map((p) => `${p.x},${p.y}`).join(' ') : ''}`)

describe('o pincel de Texturas que atravessa a sala secreta fechada', () => {
  it('chega ao jogador igual a sem a sala; o pincel e a borracha que moram nela não chegam', () => {
    const comSala = pedacos(filterMapForPlayer(cena(true), 'ana', POSSE, VISAO).map)
    const semSala = pedacos(filterMapForPlayer(cena(false), 'ana', POSSE, VISAO).map)
    expect(semSala.length, 'controle: a estrada chega sem a sala').toBeGreaterThan(0)
    expect(comSala).toEqual(semSala)
  })

  it('sai inteiro na imagem exportada para os jogadores; o pincel e a borracha que moram nela não saem', () => {
    expect(mapForImageExport(cena(true), SEM_O_MESTRE).texturas?.map((t) => t.id)).toEqual(['estrada'])
    expect(mapForImageExport(cena(false), SEM_O_MESTRE).texturas?.map((t) => t.id), 'controle sem a sala').toEqual(['estrada'])
  })
})
