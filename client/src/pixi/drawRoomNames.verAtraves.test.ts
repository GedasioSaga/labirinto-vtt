import { describe, expect, it } from 'vitest'
import type { Region, RoomMeta } from '../types/map'
import { roomLabelText, SEE_THROUGH_MARK } from './drawRoomNames'

/**
 * MARCA DO MESTRE de "ver através das paredes": a etiqueta da Sala ganha o
 * olho quando um dos dois interruptores está ligado. O jogador nunca recebe os
 * campos (`lib/fogFilter.ts`), então na tela dele a etiqueta é só o nome.
 */
function sala(room: Partial<RoomMeta>): Region {
  return { id: 's', points: [], tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Vitrine', ...room } }
}

describe('roomLabelText — marca de ver através das paredes', () => {
  it('sem interruptor, só o nome; sala sem nome não tem etiqueta', () => {
    expect(roomLabelText(sala({}))).toBe('Vitrine')
    expect(roomLabelText(sala({ name: '  ' }))).toBe('')
  })

  it('com qualquer um dos dois ligado, o nome ganha a marca; sem nome, sai só a marca', () => {
    expect(roomLabelText(sala({ dentroVeFora: true }))).toBe(`Vitrine ${SEE_THROUGH_MARK}`)
    expect(roomLabelText(sala({ foraVeDentro: true }))).toBe(`Vitrine ${SEE_THROUGH_MARK}`)
    expect(roomLabelText(sala({ name: '', foraVeDentro: true }))).toBe(SEE_THROUGH_MARK)
  })
})
