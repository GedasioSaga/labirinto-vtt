import { describe, expect, it, vi } from 'vitest'
import { fireLongPress } from './playerLongPress'

describe('fireLongPress (toque longo no mapa do jogador)', () => {
  it('com as ações no ponto, abre o menu no ponto com o dedo onde está e NÃO sinaliza sozinho', () => {
    const onSignal = vi.fn()
    const onLongPress = vi.fn()
    fireLongPress({ x: 120, y: 130 }, { x: 200, y: 150 }, { onSignal, onLongPress })
    expect(onLongPress).toHaveBeenCalledWith(120, 130, 200, 150)
    // O sinal para os colegas é escolha do menu (Sinalizar), não efeito do gesto.
    expect(onSignal).not.toHaveBeenCalled()
  })

  it('sem menu montado, o gesto é o sinal de sempre', () => {
    const onSignal = vi.fn()
    fireLongPress({ x: 1, y: 2 }, { x: 3, y: 4 }, { onSignal, onLongPress: undefined })
    expect(onSignal).toHaveBeenCalledWith(1, 2)
  })
})
