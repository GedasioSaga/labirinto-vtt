import { describe, expect, it, vi } from 'vitest'
import { TEXTURAS_EMBUTIDAS } from './embutidas'
import { LADO_DA_MINIATURA, pixelsDoLadrilho, pixelsEmFatias } from './ladrilhos'

/**
 * O ladrilho EM FATIAS: a miniatura do painel (96 px, 2×2 amostras) custava
 * até ~170 ms numa tarefa só (a Serra), e a abertura do painel somava ~750 ms
 * de travadas. Em fatias ela sai igual, dando a vez ao navegador entre elas.
 */

const serra = TEXTURAS_EMBUTIDAS.find((t) => t.id === 'pedra')
if (serra === undefined) throw new Error('a Serra sumiu da biblioteca')

describe('pixelsEmFatias', () => {
  it('com 2×2 amostras sai igual ao ladrilho inteiro de uma vez (a miniatura)', async () => {
    const lado = 16
    const fatiado = await pixelsEmFatias(serra.cor, lado, () => false, 8, 2)
    expect(fatiado).toEqual(pixelsDoLadrilho(serra.cor, lado, 2))
  })

  it('dá a vez ao navegador entre as fatias, também na miniatura', async () => {
    const ceder = vi.spyOn(globalThis, 'setTimeout')
    // Fatia de 0 ms: uma linha por vez, então cede entre cada uma.
    const pixels = await pixelsEmFatias(serra.cor, LADO_DA_MINIATURA, () => false, 0, 2)
    expect(pixels).not.toBeNull()
    expect(ceder.mock.calls.length).toBeGreaterThanOrEqual(LADO_DA_MINIATURA - 1)
    ceder.mockRestore()
  })

  it('cor de fora que lança: null, sem erro solto', async () => {
    const quebrada = () => {
      throw new Error('cor do pacote quebrada')
    }
    await expect(pixelsEmFatias(quebrada, 8, () => false, 8, 2)).resolves.toBeNull()
  })
})
