import { beforeEach, describe, expect, it } from 'vitest'
import type { Region } from '../types/map'
import { definirChamine, definirVistaDosMoveis } from '../lib/mapFactory'
import { useMapStore } from './mapStore'

/**
 * MEIO-TERMO, RETOQUE Q (MT9), lado do HISTÓRICO: a chaminé da Sala e a vista
 * dos móveis da cena são decisões do mestre como qualquer outra. Ligar grava,
 * Ctrl+Z desfaz devolvendo o mapa EXATAMENTE como estava (sem o campo, não com
 * `false`), e clicar no que já está no lugar não gasta entrada de histórico.
 */
const SALA: Region = {
  id: 'sala',
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  tag: '',
  fillColor: '#123',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Casa', roof: true },
}

const sala = () => useMapStore.getState().map.regions[0]

describe('mapStore: definirChamine', () => {
  beforeEach(() => {
    const { vistaDosMoveis: _vista, ...mapa } = useMapStore.getState().map
    useMapStore.setState({ map: { ...mapa, regions: [SALA], tokens: [], walls: [], lights: [] }, selection: [], past: [], future: [] })
  })

  it('liga a chaminé; o undo devolve a Sala sem o campo; o redo volta', () => {
    useMapStore.getState().definirChamine('sala', true)
    expect(sala()?.room?.chamine).toBe(true)
    useMapStore.getState().undo()
    expect(sala()?.room).toEqual(SALA.room)
    expect('chamine' in (sala()?.room ?? {})).toBe(false)
    useMapStore.getState().redo()
    expect(sala()?.room?.chamine).toBe(true)
  })

  it('desligar TIRA o campo (não grava false)', () => {
    useMapStore.getState().definirChamine('sala', true)
    useMapStore.getState().definirChamine('sala', false)
    expect('chamine' in (sala()?.room ?? {})).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(2)
  })

  it('valor igual, região comum e id inexistente não gastam entrada de histórico', () => {
    useMapStore.getState().definirChamine('sala', false)
    useMapStore.getState().definirChamine('nao-existe', true)
    expect(useMapStore.getState().past).toHaveLength(0)
    useMapStore.setState({ map: { ...useMapStore.getState().map, regions: [{ ...SALA, room: undefined }] } })
    useMapStore.getState().definirChamine('sala', true)
    expect(sala()?.room).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})

describe('mapStore: definirVistaDosMoveis', () => {
  beforeEach(() => {
    const { vistaDosMoveis: _vista, ...mapa } = useMapStore.getState().map
    useMapStore.setState({ map: mapa, selection: [], past: [], future: [] })
  })

  it('3/4 grava; o undo devolve o mapa sem o campo; voltar a "de cima" tira o campo', () => {
    useMapStore.getState().definirVistaDosMoveis('tres-quartos')
    expect(useMapStore.getState().map.vistaDosMoveis).toBe('tres-quartos')
    useMapStore.getState().undo()
    expect('vistaDosMoveis' in useMapStore.getState().map).toBe(false)
    useMapStore.getState().redo()
    useMapStore.getState().definirVistaDosMoveis(undefined)
    expect('vistaDosMoveis' in useMapStore.getState().map).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(2)
  })

  it('a mesma vista não gasta entrada de histórico', () => {
    useMapStore.getState().definirVistaDosMoveis(undefined)
    expect(useMapStore.getState().past).toHaveLength(0)
    useMapStore.getState().definirVistaDosMoveis('tres-quartos')
    useMapStore.getState().definirVistaDosMoveis('tres-quartos')
    expect(useMapStore.getState().past).toHaveLength(1)
  })
})

describe('mapFactory: mesmo mapa quando nada muda', () => {
  it('definirChamine e definirVistaDosMoveis devolvem a mesma referência', () => {
    const mapa = useMapStore.getState().map
    expect(definirVistaDosMoveis(mapa, mapa.vistaDosMoveis)).toBe(mapa)
    const room: Region['room'] = { shape: 'rect', name: 'Casa', chamine: true }
    const comSala = { ...mapa, regions: [{ ...SALA, room }] }
    expect(definirChamine(comSala, 'sala', true)).toBe(comSala)
  })
})
