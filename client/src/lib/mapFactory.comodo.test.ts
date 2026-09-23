import { describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap, setRoomComodo, setRoomRoof } from './mapFactory'
import { roomIsComodo } from './roomOps'

/** CÔMODO LEMBRADO — liga/desliga o modo na Sala, sem histórico vazio, e nunca junto com o teto. */

function sala(extra: Partial<Region['room']> = {}): Region {
  return {
    id: 'quarto',
    points: [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
    ],
    tag: '',
    fillColor: '#123',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Quarto', ...extra },
  }
}

function mapa(region: Region): MapData {
  return { ...createEmptyMap('m', 'M', 10, 10, 40), regions: [region] }
}

describe('setRoomComodo', () => {
  it('liga o modo na Sala', () => {
    const out = setRoomComodo(mapa(sala()), 'quarto', true)
    expect(out.regions[0].room?.comodo).toBe(true)
    expect(roomIsComodo(out.regions[0].room)).toBe(true)
  })

  it('valor igual, id inexistente ou região comum devolve o MESMO mapa (sem entrada de histórico vazia)', () => {
    const ligado = mapa(sala({ comodo: true }))
    expect(setRoomComodo(ligado, 'quarto', true)).toBe(ligado)
    const desligado = mapa(sala())
    expect(setRoomComodo(desligado, 'quarto', false)).toBe(desligado)
    expect(setRoomComodo(desligado, 'nao-existe', true)).toBe(desligado)
    const area: Region = { ...sala(), room: undefined }
    const comArea = mapa(area)
    expect(setRoomComodo(comArea, 'quarto', true)).toBe(comArea)
  })

  it('ligar o Cômodo desliga o teto, e ligar o teto desliga o Cômodo: os dois nunca ficam juntos', () => {
    const comodo = setRoomComodo(mapa(sala({ roof: true })), 'quarto', true)
    expect(comodo.regions[0].room?.roof).toBe(false)
    expect(comodo.regions[0].room?.comodo).toBe(true)

    const teto = setRoomRoof(comodo, 'quarto', true)
    expect(teto.regions[0].room?.roof).toBe(true)
    expect(teto.regions[0].room?.comodo).toBe(false)
  })

  it('roomIsComodo: só `true` liga (o modo revela o cômodo inteiro); teto ligado vence', () => {
    expect(roomIsComodo(undefined)).toBe(false)
    expect(roomIsComodo(sala().room)).toBe(false)
    expect(roomIsComodo(sala({ comodo: true }).room)).toBe(true)
    expect(roomIsComodo(sala({ comodo: true, roof: true }).room)).toBe(false)
  })
})
