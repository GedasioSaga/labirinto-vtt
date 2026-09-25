import { describe, expect, it } from 'vitest'
import { PIN_TRAVEL_MAX_TOKENS, parsePlayerMessage } from './protocol'

/**
 * ESCOLHER FICHAS NO PINO no fio: o pedido de passagem ganha `tokenIds`
 * (quais fichas do jogador passam). Aditivo — sem o campo, o pedido é o de
 * sempre. Lista torta recusa a mensagem inteira: cair calado na ficha mais
 * perto levaria justamente quem o jogador NÃO escolheu.
 */
describe('protocol: pin.travel.request com tokenIds', () => {
  it('sem tokenIds, o pedido de sempre (o cliente antigo continua valendo)', () => {
    expect(parsePlayerMessage({ type: 'pin.travel.request', pinId: 'p1' })).toEqual({ type: 'pin.travel.request', pinId: 'p1' })
  })

  it('com tokenIds, a lista chega na ordem, junto da saída escolhida', () => {
    expect(parsePlayerMessage({ type: 'pin.travel.request', pinId: 'p1', exitId: 's2', tokenIds: ['rufo', 'enzo'] })).toEqual({
      type: 'pin.travel.request',
      pinId: 'p1',
      exitId: 's2',
      tokenIds: ['rufo', 'enzo'],
    })
  })

  it('lista vazia, repetida, com item que não é texto ou maior que o teto: a mensagem inteira não vale', () => {
    const acima = Array.from({ length: PIN_TRAVEL_MAX_TOKENS + 1 }, (_, i) => `f${i}`)
    expect(parsePlayerMessage({ type: 'pin.travel.request', pinId: 'p1', tokenIds: [] })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.travel.request', pinId: 'p1', tokenIds: ['a', 'a'] })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.travel.request', pinId: 'p1', tokenIds: ['a', 7] })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.travel.request', pinId: 'p1', tokenIds: 'a' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.travel.request', pinId: 'p1', tokenIds: acima })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.travel.request', pinId: 'p1', tokenIds: acima.slice(0, PIN_TRAVEL_MAX_TOKENS) })).toEqual({
      type: 'pin.travel.request',
      pinId: 'p1',
      tokenIds: acima.slice(0, PIN_TRAVEL_MAX_TOKENS),
    })
  })
})
