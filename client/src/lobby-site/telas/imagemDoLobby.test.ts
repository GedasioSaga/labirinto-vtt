import { describe, expect, it } from 'vitest'
import { resolverDoLobby } from './imagemDoLobby'

const ID = `${'ab'.repeat(32)}.webp`
const EMBUTIDA = 'data:image/png;base64,iVBORw0KGgo='

describe('resolverDoLobby (os retratos midia: das fichas no site)', () => {
  it('midia: vira a rota de mídia da campanha; data: passa; o resto é recusado', () => {
    const resolver = resolverDoLobby('camp_ed35115d-f34f-497e-bf1f-dac7a8cabdf6', false)
    expect(resolver(`midia:${ID}`)).toBe(`/api/c/camp_ed35115d-f34f-497e-bf1f-dac7a8cabdf6/midia/${ID}`)
    expect(resolver(EMBUTIDA)).toBe(EMBUTIDA)
    expect(resolver('https://example.com/retrato.webp')).toBeNull()
    expect(resolver(`midia:../${ID}`)).toBeNull()
    expect(resolver('C:/fotos/retrato.webp')).toBeNull()
    expect(resolver(null)).toBeNull()
    // Na demo, e fora de uma mesa, só a embutida: não há servidor a quem pedir.
    expect(resolverDoLobby('rota-das-ilhas', true)(`midia:${ID}`)).toBeNull()
    expect(resolverDoLobby(null, false)(`midia:${ID}`)).toBeNull()
    expect(resolverDoLobby('rota-das-ilhas', true)(EMBUTIDA)).toBe(EMBUTIDA)
  })
})
