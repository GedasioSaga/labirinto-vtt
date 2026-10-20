import { describe, expect, it } from 'vitest'
import type { MapData, Region, RoomMeta, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * MODELO E COR DO TELHADO no recorte do jogador: o jogador pinta o telhado com
 * eles (`pixi/telhadosRenderer.ts`), então com o teto FECHADO os dois
 * atravessam junto do polígono. Com o teto aberto (a ficha entrou) eles somem
 * com o `roof`: a sala volta a desenhar como sempre desenhou.
 */
const CASA: Region['points'] = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
]
const FORA = { x: 250, y: 600 }
const DENTRO = { x: 250, y: 300 }
const OWNERSHIP = { p1: ['heroi'] }
const RAIO = 700

function mapa(room: Partial<RoomMeta>, heroi: { x: number; y: number }): MapData {
  const casa: Region = { id: 'casa', points: CASA, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Casa', ...room } }
  const tokens: Token[] = [{ id: 'heroi', characterId: null, name: 'heroi', x: heroi.x, y: heroi.y, size: 1, image: null }]
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), regions: [casa], tokens }
}

function casaDoJogador(map: MapData): RoomMeta | undefined {
  return filterMapForPlayer(map, 'p1', OWNERSHIP, RAIO).map.regions.find((r) => r.id === 'casa')?.room
}

describe('filterMapForPlayer — modelo e cor do telhado', () => {
  it('teto FECHADO: modelo e cor chegam ao jogador junto do polígono', () => {
    const room = casaDoJogador(mapa({ roof: true, modeloDoTeto: 'madeira', corDoTeto: '#4d5f4f' }, FORA))
    expect(room?.roof).toBe(true)
    expect(room?.modeloDoTeto).toBe('madeira')
    expect(room?.corDoTeto).toBe('#4d5f4f')
  })

  it('teto fechado sem estilo: nada inventado (o jogador usa a telha barro)', () => {
    const room = casaDoJogador(mapa({ roof: true }, FORA))
    expect(room?.roof).toBe(true)
    expect(room !== undefined && 'modeloDoTeto' in room).toBe(false)
    expect(room !== undefined && 'corDoTeto' in room).toBe(false)
  })

  it('teto ABERTO (ficha dentro): o estilo some com o roof', () => {
    const room = casaDoJogador(mapa({ roof: true, modeloDoTeto: 'madeira', corDoTeto: '#4d5f4f' }, DENTRO))
    expect(room?.roof).toBe(undefined)
    expect(room !== undefined && 'modeloDoTeto' in room).toBe(false)
    expect(room !== undefined && 'corDoTeto' in room).toBe(false)
  })

  it('teto desligado com estilo guardado: o estilo não sai', () => {
    const room = casaDoJogador(mapa({ roof: false, modeloDoTeto: 'madeira', corDoTeto: '#4d5f4f' }, FORA))
    expect(room !== undefined && 'modeloDoTeto' in room).toBe(false)
    expect(room !== undefined && 'corDoTeto' in room).toBe(false)
  })
})
