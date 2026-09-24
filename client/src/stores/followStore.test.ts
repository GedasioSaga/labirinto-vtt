import { beforeEach, describe, expect, it } from 'vitest'
import { useFollowStore } from './followStore'

describe('followStore', () => {
  beforeEach(() => {
    useFollowStore.setState({ playerId: null })
  })

  it('"Seguir" liga; em outro jogador troca (um por vez); no mesmo desliga', () => {
    const { toggle } = useFollowStore.getState()
    toggle('ana')
    expect(useFollowStore.getState().playerId).toBe('ana')
    toggle('bruno')
    expect(useFollowStore.getState().playerId).toBe('bruno')
    toggle('bruno')
    expect(useFollowStore.getState().playerId).toBeNull()
  })

  it('a câmera que o próprio app pede (o centro do seguir) NÃO desliga o seguir', () => {
    useFollowStore.getState().toggle('ana')
    useFollowStore.getState().cameraApplied('pedido')
    expect(useFollowStore.getState().playerId).toBe('ana')
  })

  it('"Ir lá" em outro jogador desliga o seguir; no seguido, ou sem ninguém seguido, não muda nada', () => {
    useFollowStore.getState().toggle('ana')
    useFollowStore.getState().irAteJogador('ana')
    expect(useFollowStore.getState().playerId).toBe('ana')
    useFollowStore.getState().irAteJogador('bruno')
    expect(useFollowStore.getState().playerId).toBeNull()
    useFollowStore.getState().irAteJogador('bruno')
    expect(useFollowStore.getState().playerId).toBeNull()
  })

  it('o gesto do mestre na vista desliga o seguir', () => {
    useFollowStore.getState().toggle('ana')
    useFollowStore.getState().cameraApplied('gesto')
    expect(useFollowStore.getState().playerId).toBeNull()
  })
})
