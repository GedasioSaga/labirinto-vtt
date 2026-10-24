import { beforeEach, describe, expect, it } from 'vitest'
import type { Wall } from '../types/map'
import { definirGrade } from './mapFactory'
import { useMapStore } from '../stores/mapStore'

/**
 * GRADE DE PRISÃO, lado do MAPA e do HISTÓRICO (MT10): só numa parede
 * `janela` sem porta (a regra da MT9). Ligar grava `true`; desligar TIRA o
 * campo; o mesmo valor, parede comum, porta ou id inexistente devolvem o
 * MESMO mapa (sem entrada inútil no Ctrl+Z).
 */

const JANELA: Wall = { id: 'j', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, janela: true }
const COMUM: Wall = { id: 'c', x1: 0, y1: 50, x2: 100, y2: 50, blocksLight: true, blocksMove: true, door: null }
const PORTA: Wall = { id: 'p', x1: 0, y1: 90, x2: 100, y2: 90, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' }, janela: true }

function mapaCom(walls: Wall[]) {
  return { ...useMapStore.getState().map, walls, regions: [], tokens: [], lights: [] }
}

describe('definirGrade (mapFactory)', () => {
  it('liga só na janela sem porta; desligar tira o campo', () => {
    const mapa = mapaCom([JANELA, COMUM, PORTA])
    const ligado = definirGrade(mapa, 'j', true)
    expect(ligado.walls[0]).toEqual({ ...JANELA, grade: true })
    const desligado = definirGrade(ligado, 'j', false)
    expect(desligado.walls[0]).toEqual(JANELA)
    expect('grade' in desligado.walls[0]).toBe(false)
  })

  it('parede comum, porta, id inexistente e o mesmo valor devolvem o mesmo mapa', () => {
    const mapa = mapaCom([JANELA, COMUM, PORTA])
    expect(definirGrade(mapa, 'c', true)).toBe(mapa)
    expect(definirGrade(mapa, 'p', true)).toBe(mapa)
    expect(definirGrade(mapa, 'nada', true)).toBe(mapa)
    expect(definirGrade(mapa, 'j', false)).toBe(mapa)
    const ligado = definirGrade(mapa, 'j', true)
    expect(definirGrade(ligado, 'j', true)).toBe(ligado)
  })
})

describe('definirGrade (store, com histórico)', () => {
  beforeEach(() => {
    useMapStore.setState({ map: mapaCom([JANELA, COMUM]), selection: [], past: [], future: [] })
  })

  it('liga; o Ctrl+Z devolve a janela sem o campo; o refazer volta', () => {
    useMapStore.getState().definirGrade('j', true)
    expect(useMapStore.getState().map.walls[0]?.grade).toBe(true)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.walls[0]).toEqual(JANELA)
    useMapStore.getState().redo()
    expect(useMapStore.getState().map.walls[0]?.grade).toBe(true)
  })

  it('o que não muda nada não gasta histórico', () => {
    useMapStore.getState().definirGrade('c', true)
    useMapStore.getState().definirGrade('j', false)
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
