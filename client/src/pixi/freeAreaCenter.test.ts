import { describe, expect, it } from 'vitest'
import { freeAreaCenter } from './freeAreaCenter'

describe('freeAreaCenter', () => {
  const tela = { width: 1280, height: 800 }

  it('sem painel por cima: o centro do canvas', () => {
    expect(freeAreaCenter(tela, () => true)).toEqual({ x: 640, y: 400 })
  })

  it('painel cobrindo os 320 px da esquerda: o centro vai para o meio do que sobra', () => {
    const centro = freeAreaCenter(tela, (x) => x >= 320)
    expect(centro).toEqual({ x: 800, y: 400 })
  })

  it('tudo coberto: null, e quem chama fica com o centro do canvas', () => {
    expect(freeAreaCenter(tela, () => false)).toBeNull()
  })
})
