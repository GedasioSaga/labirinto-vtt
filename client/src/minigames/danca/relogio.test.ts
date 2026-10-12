import { describe, expect, it } from 'vitest'
import { criarRelogio, posicaoNaMusica, type ContextoDoRelogio } from './relogio'

/** Contexto de mentira cujo carimbo de saída o teste muda à mão. */
function contextoComCarimbo(carimbo: { contextTime: number; performanceTime: number }): ContextoDoRelogio {
  return { currentTime: 99, getOutputTimestamp: () => ({ ...carimbo }) }
}

describe('relógio do áudio', () => {
  it('leva o instante do toque para o tempo de contexto ouvido, pelo carimbo de saída', () => {
    // O alto-falante tocava 10 s de contexto em performance 5000 ms: deslocamento de 5 s.
    const r = criarRelogio(contextoComCarimbo({ contextTime: 10, performanceTime: 5000 }))
    expect(r.ouvidoEm(5000)).toBeCloseTo(10, 9)
    expect(r.ouvidoEm(5250)).toBeCloseTo(10.25, 9)
  })

  it('tremor pequeno entra só 8% por leitura; salto maior que 40 ms é adotado na hora', () => {
    const carimbo = { contextTime: 10, performanceTime: 5000 }
    const r = criarRelogio(contextoComCarimbo(carimbo))
    expect(r.ouvidoEm(0)).toBeCloseTo(5, 9)
    carimbo.contextTime = 10.01
    expect(r.ouvidoEm(0)).toBeCloseTo(5 + 0.01 * 0.08, 9)
    carimbo.contextTime = 10.2
    expect(r.ouvidoEm(0)).toBeCloseTo(5.2, 9)
  })

  it('reiniciar esquece o deslocamento suavizado', () => {
    const carimbo = { contextTime: 10, performanceTime: 5000 }
    const r = criarRelogio(contextoComCarimbo(carimbo))
    r.ouvidoEm(0)
    carimbo.contextTime = 10.03
    expect(r.ouvidoEm(0)).not.toBeCloseTo(5.03, 6)
    r.reiniciar()
    expect(r.ouvidoEm(0)).toBeCloseTo(5.03, 9)
  })

  it('sem carimbo, usa o tempo atual menos a latência de saída', () => {
    const r = criarRelogio({ currentTime: 3, outputLatency: 0.05, baseLatency: 0.01 }, () => 1000)
    // deslocamento = 3 − 0,05 − 1 = 1,95
    expect(r.ouvidoEm(1000)).toBeCloseTo(2.95, 9)
  })

  it('latência de saída 0 é "não sei": cai para a latência base', () => {
    const r = criarRelogio({ currentTime: 3, outputLatency: 0, baseLatency: 0.01 }, () => 0)
    expect(r.ouvidoEm(0)).toBeCloseTo(2.99, 9)
    const semNada = criarRelogio({ currentTime: 3 }, () => 0)
    expect(semNada.ouvidoEm(0)).toBeCloseTo(3, 9)
  })

  it('carimbo zerado (contexto ainda parado) não vale: usa o tempo atual', () => {
    const r = criarRelogio({ currentTime: 2, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }, () => 0)
    expect(r.ouvidoEm(0)).toBeCloseTo(2, 9)
  })

  it('posição na música desconta o início e o atraso do jogador', () => {
    const r = criarRelogio(contextoComCarimbo({ contextTime: 10, performanceTime: 5000 }))
    // Ouvido 10 s; música começou em 8 s; toques dele chegam 40 ms atrasados.
    expect(posicaoNaMusica(r, 5000, 8, 40)).toBeCloseTo(1.96, 9)
    expect(posicaoNaMusica(r, 5000, 8, -40)).toBeCloseTo(2.04, 9)
  })
})
