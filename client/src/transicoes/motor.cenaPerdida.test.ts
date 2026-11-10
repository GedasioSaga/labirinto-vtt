import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esquecerAberturasDeBatalhaDeFora, registrarAberturaDeBatalha } from './aberturasDeBatalha'
import { tocarAberturaDeBatalha } from './motor'

/**
 * CENA PERDIDA: a mesa não espera para sempre por uma tela. Se a cena inteira
 * passou para a mesa com o motor (`three`) desta tela ainda descendo, o
 * jogador volta ao jogo na hora em que a cena acabou, em vez de ficar na tela
 * preta até o download terminar.
 */

// O `three` que nunca termina de baixar (rede lenta).
vi.mock('three', () => new Promise(() => undefined))

const DURACAO_S = 3

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('WebGLRenderingContext', class {})
  registrarAberturaDeBatalha({ id: 'duelo', nome: 'Duelo', duracaoNaturalS: DURACAO_S, quadroDaMiniaturaS: 1, criar: () => ({}) })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  esquecerAberturasDeBatalhaDeFora()
})

describe('motor: cena perdida', () => {
  it('a mesa largou e a cena acabou com o motor ainda descendo: avisa o fim no fim da cena, não antes', async () => {
    const onFim = vi.fn()
    void tocarAberturaDeBatalha({ canvas: document.createElement('canvas'), id: 'duelo', volume: 0, reduzirMovimento: true, largada: Promise.resolve(performance.now()), onFim })
    await vi.advanceTimersByTimeAsync(DURACAO_S * 1000 - 100)
    expect(onFim).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(onFim).toHaveBeenCalledTimes(1)
  })

  it('a mesa ainda não largou: a tela segue esperando o motor, sem desistir da cena', async () => {
    const onFim = vi.fn()
    void tocarAberturaDeBatalha({ canvas: document.createElement('canvas'), id: 'duelo', volume: 0, reduzirMovimento: true, largada: new Promise<number>(() => undefined), onFim })
    await vi.advanceTimersByTimeAsync(DURACAO_S * 1000 * 4)
    expect(onFim).not.toHaveBeenCalled()
  })
})
