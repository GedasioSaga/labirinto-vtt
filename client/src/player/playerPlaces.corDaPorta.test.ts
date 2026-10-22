import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { sceneArt } from '../components/sceneOverviewArt'
import type { DoorState, MapData } from '../types/map'
import { placeSketch } from './playerPlaces'

/**
 * COR DA PORTA (fatia 22) nos desenhos que não passam por `drawDoors`: a
 * miniatura dos Lugares do jogador e a miniatura da cena do mestre. Sem cor, o
 * creme de sempre; cor torta (o recorte vem da rede) nunca vira atributo.
 */
function mapaCom(door: DoorState): MapData {
  return {
    ...createEmptyMap('m', 'M', 10, 10, 50),
    walls: [{ id: 'p', x1: 100, y1: 100, x2: 200, y2: 100, blocksLight: true, blocksMove: true, door }],
  }
}

describe('miniaturas: cor da porta', () => {
  it('Lugares do jogador: a porta leva a cor dela; sem cor ou torta, nada', () => {
    expect(placeSketch(mapaCom({ open: false, locked: false, kind: 'normal', cor: '#79A9CC' })).walls[0]?.doorColor).toBe('#79a9cc')
    expect(placeSketch(mapaCom({ open: false, locked: false, kind: 'normal' })).walls[0]).not.toHaveProperty('doorColor')
    expect(placeSketch(mapaCom({ open: false, locked: false, kind: 'normal', cor: '"/><script>' })).walls[0]).not.toHaveProperty('doorColor')
  })

  it('miniatura da cena: a cor própria vence o creme e o vermelho da trancada', () => {
    expect(sceneArt(mapaCom({ open: false, locked: true, kind: 'normal', cor: '#79a9cc' }))?.doors.map((d) => d.color)).toEqual(['#79a9cc'])
    expect(sceneArt(mapaCom({ open: false, locked: true, kind: 'normal' }))?.doors.map((d) => d.color)).toEqual(['#e2645a'])
    expect(sceneArt(mapaCom({ open: true, locked: false, kind: 'normal' }))?.doors.map((d) => d.color)).toEqual(['#d9d2c0'])
  })
})
