import { describe, expect, it } from 'vitest'
import { parsePlayerMessage } from './protocol'

/** O que o jogador manda para trancar porta ou passagem: forma exata, ou a mensagem inteira cai. */
describe('parsePlayerMessage: trancar porta ou passagem', () => {
  it('aceita door.bar e pin.bar, devolvendo só os campos conhecidos', () => {
    expect(parsePlayerMessage({ type: 'door.bar', wallId: 'porta', on: true, extra: 'x' })).toEqual({ type: 'door.bar', wallId: 'porta', on: true })
    expect(parsePlayerMessage(JSON.stringify({ type: 'pin.bar', pinId: 'fundo', on: false }))).toEqual({ type: 'pin.bar', pinId: 'fundo', on: false })
  })

  it('recusa id vazio, id gigante e "on" que não é booleano', () => {
    expect(parsePlayerMessage({ type: 'door.bar', wallId: '', on: true })).toBeNull()
    expect(parsePlayerMessage({ type: 'door.bar', wallId: 'x'.repeat(65), on: true })).toBeNull()
    expect(parsePlayerMessage({ type: 'door.bar', wallId: 'porta', on: 'sim' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.bar', pinId: 'fundo' })).toBeNull()
  })
})
