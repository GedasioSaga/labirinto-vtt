import { describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap, setRoomDark, setSceneDark } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * CENA ESCURA e SALA ESCURA, lado do ARQUIVO e da edição: o campo liga e
 * desliga sem inventar valor em mapa antigo, e volta do disco só como `true`.
 */
function quarto(extra: Partial<NonNullable<Region['room']>> = {}): Region {
  return {
    id: 'quarto',
    points: [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
    ],
    tag: '',
    fillColor: '#223',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Quarto', ...extra },
  }
}

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'Porão', 10, 10, 40), regions: [quarto()], ...extra }
}

describe('setSceneDark', () => {
  it('liga com true; desligar tira o campo; valor igual devolve o mesmo mapa', () => {
    const clara = mapa()
    const escura = setSceneDark(clara, true)
    expect(escura.dark).toBe(true)
    expect(setSceneDark(escura, true)).toBe(escura)
    const deVolta = setSceneDark(escura, false)
    expect('dark' in deVolta).toBe(false)
    expect(setSceneDark(clara, false)).toBe(clara)
  })
})

describe('setRoomDark', () => {
  it('liga na Sala; desligar tira o campo; região comum e id inexistente não mudam nada', () => {
    const clara = mapa()
    const escura = setRoomDark(clara, 'quarto', true)
    expect(escura.regions[0].room?.dark).toBe(true)
    expect(setRoomDark(escura, 'quarto', true)).toBe(escura)
    const deVolta = setRoomDark(escura, 'quarto', false)
    expect(deVolta.regions[0].room).toEqual({ shape: 'rect', name: 'Quarto' })
    expect('dark' in (deVolta.regions[0].room ?? {})).toBe(false)
    expect(setRoomDark(clara, 'nao-existe', true)).toBe(clara)
    const comum = mapa({ regions: [{ ...quarto(), room: undefined }] })
    expect(setRoomDark(comum, 'quarto', true)).toBe(comum)
  })
})

describe('arquivo', () => {
  it('cena e sala escuras voltam do disco', () => {
    const salvo = serializeMap(setRoomDark(setSceneDark(mapa(), true), 'quarto', true))
    const aberto = deserializeMap(salvo)
    expect(aberto.dark).toBe(true)
    expect(aberto.regions[0].room?.dark).toBe(true)
  })

  it('mapa antigo abre claro, sem o campo', () => {
    const aberto = deserializeMap(serializeMap(mapa()))
    expect(aberto.dark).toBeUndefined()
    expect(aberto.regions[0].room).toEqual({ shape: 'rect', name: 'Quarto' })
  })

  it('valor torto (arquivo editado à mão) volta claro', () => {
    const json = JSON.parse(serializeMap(mapa())) as Record<string, unknown> // as: saída de serializeMap é sempre objeto JSON; o teste só sobrescreve dois campos
    json.dark = 'sim'
    json.regions = [{ ...quarto(), room: { shape: 'rect', name: 'Quarto', dark: 1 } }]
    const aberto = deserializeMap(JSON.stringify(json))
    expect(aberto.dark).toBeUndefined()
    expect(aberto.regions[0].room).toEqual({ shape: 'rect', name: 'Quarto' })
    expect('dark' in (aberto.regions[0].room ?? {})).toBe(false)
  })
})
