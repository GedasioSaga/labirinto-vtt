/**
 * Quem chega escolhe a própria ficha: `seat.claim` (jogador -> mestre) é
 * hostil e passa pelo `parsePlayerMessage`; `seat.options` (mestre -> jogador)
 * vai para a tela e passa pelo `parseSeatOptions`.
 */
import { describe, expect, it } from 'vitest'
import { parsePlayerMessage, parseSeatOptions, SEAT_OPTION_NAME_MAX_LENGTH, SEAT_OPTIONS_MAX } from './protocol'

describe('seat.claim', () => {
  it('aceita só o id da ficha, e devolve cópia sem campo estranho', () => {
    expect(parsePlayerMessage({ type: 'seat.claim', tokenId: 't-kael', ownerId: 'p9' })).toEqual({ type: 'seat.claim', tokenId: 't-kael' })
    expect(parsePlayerMessage(JSON.stringify({ type: 'seat.claim', tokenId: 't-kael' }))).toEqual({ type: 'seat.claim', tokenId: 't-kael' })
  })

  it('recusa id vazio, longo demais ou que não é texto', () => {
    expect(parsePlayerMessage({ type: 'seat.claim', tokenId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'seat.claim', tokenId: 'x'.repeat(65) })).toBeNull()
    expect(parsePlayerMessage({ type: 'seat.claim', tokenId: 7 })).toBeNull()
    expect(parsePlayerMessage({ type: 'seat.claim' })).toBeNull()
  })
})

describe('parseSeatOptions', () => {
  it('aceita a lista e devolve só id e nome', () => {
    const msg = { type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael', x: 10, sceneName: 'Cripta' }] }
    expect(parseSeatOptions(msg)).toEqual({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    expect(parseSeatOptions({ type: 'seat.options', tokens: [] })).toEqual({ type: 'seat.options', tokens: [] })
  })

  it('recusa a lista inteira com item malformado, acima do teto ou de outro tipo', () => {
    const ok = { tokenId: 't-kael', name: 'Kael' }
    expect(parseSeatOptions({ type: 'seat.options', tokens: [ok, { ...ok, name: '' }] })).toBeNull()
    expect(parseSeatOptions({ type: 'seat.options', tokens: [ok, { ...ok, name: 'x'.repeat(SEAT_OPTION_NAME_MAX_LENGTH + 1) }] })).toBeNull()
    expect(parseSeatOptions({ type: 'seat.options', tokens: [ok, { ...ok, tokenId: '' }] })).toBeNull()
    expect(parseSeatOptions({ type: 'seat.options', tokens: [ok, 'Kael'] })).toBeNull()
    expect(parseSeatOptions({ type: 'seat.options', tokens: 'Kael' })).toBeNull()
    expect(parseSeatOptions({ type: 'seat.options', tokens: Array.from({ length: SEAT_OPTIONS_MAX + 1 }, () => ok) })).toBeNull()
    expect(parseSeatOptions({ type: 'party.update', tokens: [ok] })).toBeNull()
  })
})
