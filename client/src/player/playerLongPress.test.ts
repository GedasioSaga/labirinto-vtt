import { describe, expect, it, vi } from 'vitest'
import { fireLongPress } from './playerLongPress'

describe('fireLongPress (toque longo no mapa do jogador)', () => {
  it('dispara o sinal e abre as ações no ponto no mesmo ponto, com o dedo onde está', () => {
    const onSignal = vi.fn()
    const onLongPress = vi.fn()
    fireLongPress({ x: 120, y: 130 }, { x: 200, y: 150 }, { onSignal, onLongPress })
    expect(onSignal).toHaveBeenCalledWith(120, 130)
    expect(onLongPress).toHaveBeenCalledWith(120, 130, 200, 150)
  })

  it('sem menu montado, o sinal sai igual', () => {
    const onSignal = vi.fn()
    fireLongPress({ x: 1, y: 2 }, { x: 3, y: 4 }, { onSignal, onLongPress: undefined })
    expect(onSignal).toHaveBeenCalledWith(1, 2)
  })
})
