/**
 * TEXTO DA SALA no arquivo e na fábrica: os dois campos novos são opcionais,
 * atravessam o salvar/abrir, e lixo de arquivo editado à mão sai em vez de
 * virar texto na tela do jogador.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap, setRoomTexts } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { clampRoomText, hasEnterText, ROOM_TEXT_MAX_LENGTH } from './roomText'
import type { MapData, Region } from '../types/map'

function cozinha(room: Record<string, unknown> = {}): Region {
  return {
    id: 'cozinha',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Cozinha', ...room },
  }
}

function mapa(regions: Region[]): MapData {
  return { ...createEmptyMap('m', 'Casa', 10, 10, 50), regions }
}

describe('texto da sala no arquivo', () => {
  it('salvar e abrir mantém os dois textos', () => {
    const map = mapa([cozinha({ textoAoEntrar: 'Pão.', notaDoMestre: 'Mímico.' })])
    const aberto = deserializeMap(serializeMap(map))
    expect(aberto.regions[0]?.room?.textoAoEntrar).toBe('Pão.')
    expect(aberto.regions[0]?.room?.notaDoMestre).toBe('Mímico.')
  })

  it('mapa de antes (sem os campos) abre sem eles, sem inventar campo', () => {
    const aberto = deserializeMap(serializeMap(mapa([cozinha()])))
    expect(aberto.regions[0]?.room).not.toHaveProperty('textoAoEntrar')
    expect(aberto.regions[0]?.room).not.toHaveProperty('notaDoMestre')
  })

  it('valor que não é texto sai', () => {
    const json = serializeMap(mapa([cozinha({ textoAoEntrar: 42, notaDoMestre: { x: 1 } })]))
    const room = deserializeMap(json).regions[0]?.room
    expect(room).not.toHaveProperty('textoAoEntrar')
    expect(room).not.toHaveProperty('notaDoMestre')
  })
})

describe('setRoomTexts', () => {
  it('grava o que veio e devolve o mesmo mapa quando nada muda', () => {
    const map = mapa([cozinha()])
    const com = setRoomTexts(map, 'cozinha', { textoAoEntrar: 'Pão.' })
    expect(com.regions[0]?.room?.textoAoEntrar).toBe('Pão.')
    expect(setRoomTexts(com, 'cozinha', { textoAoEntrar: 'Pão.' })).toBe(com)
    const nota = setRoomTexts(com, 'cozinha', { notaDoMestre: 'Mímico.' })
    expect(nota.regions[0]?.room).toMatchObject({ textoAoEntrar: 'Pão.', notaDoMestre: 'Mímico.' })
  })

  it('região comum ou id que não existe: mesmo mapa', () => {
    const comum: Region = { ...cozinha(), room: undefined }
    const map = mapa([comum])
    expect(setRoomTexts(map, 'cozinha', { textoAoEntrar: 'x' })).toBe(map)
    expect(setRoomTexts(map, 'nao-existe', { textoAoEntrar: 'x' })).toBe(map)
  })
})

describe('roomText', () => {
  it('hasEnterText: só texto com letra conta', () => {
    expect(hasEnterText(undefined)).toBe(false)
    expect(hasEnterText({ shape: 'rect', name: 'x' })).toBe(false)
    expect(hasEnterText({ shape: 'rect', name: 'x', textoAoEntrar: '  ' })).toBe(false)
    expect(hasEnterText({ shape: 'rect', name: 'x', textoAoEntrar: 'Pão.' })).toBe(true)
  })

  it('clampRoomText corta no teto sem partir emoji', () => {
    expect(clampRoomText('x'.repeat(ROOM_TEXT_MAX_LENGTH + 10))).toHaveLength(ROOM_TEXT_MAX_LENGTH)
    expect(clampRoomText(`${'y'.repeat(ROOM_TEXT_MAX_LENGTH - 1)}\u{1F600}`)).toBe('y'.repeat(ROOM_TEXT_MAX_LENGTH - 1))
    expect(clampRoomText('curto')).toBe('curto')
  })
})
