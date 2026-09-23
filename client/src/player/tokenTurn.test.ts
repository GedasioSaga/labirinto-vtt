import { describe, expect, it } from 'vitest'
import { TOKEN_TURN_MS, createTokenTurns, shortestTurn, stepTurns, syncTurn } from './tokenTurn'

const GRAU = Math.PI / 180

describe('shortestTurn: a ficha vira pelo lado mais curto', () => {
  it('de 350 para 10 graus gira 20 no sentido horário, e não 340 para trás', () => {
    expect(shortestTurn(350 * GRAU, 10 * GRAU)).toBeCloseTo(20 * GRAU, 9)
    expect(shortestTurn(10 * GRAU, 350 * GRAU)).toBeCloseTo(-20 * GRAU, 9)
    expect(shortestTurn(0, 0)).toBe(0)
  })

  it('voltas inteiras a mais não contam, e o giro nunca passa de meia volta', () => {
    expect(shortestTurn(90 * GRAU, 90 * GRAU + 4 * Math.PI)).toBeCloseTo(0, 9)
    expect(Math.abs(shortestTurn(0, Math.PI))).toBeCloseTo(Math.PI, 9)
    for (const [de, para] of [
      [0, 5],
      [-3, 3],
      [10, -10],
    ]) {
      const giro = shortestTurn(de, para)
      expect(Math.abs(giro)).toBeLessThanOrEqual(Math.PI + 1e-12)
      // O giro leva de fato ao alvo (o mesmo ângulo, a menos de voltas inteiras).
      expect(Math.cos(de + giro)).toBeCloseTo(Math.cos(para), 9)
      expect(Math.sin(de + giro)).toBeCloseTo(Math.sin(para), 9)
    }
    expect(Number.isFinite(shortestTurn(1, 2))).toBe(true)
  })
})

describe('syncTurn e stepTurns: o bico gira até a frente nova em vez de saltar', () => {
  it('bico que não estava na tela aparece já na frente certa, sem giro', () => {
    const turns = createTokenTurns()
    expect(syncTurn(turns, 'guarda', { shown: null, target: 1.2, now: 0, animate: true })).toBe(1.2)
    expect(turns.size).toBe(0)
  })

  it('sem animação (troca de cena, movimento reduzido) vai direto à frente nova', () => {
    const turns = createTokenTurns()
    expect(syncTurn(turns, 'guarda', { shown: 0, target: Math.PI / 2, now: 0, animate: false })).toBe(Math.PI / 2)
    expect(turns.size).toBe(0)
  })

  it('frente nova parte de onde o bico está e chega nela em TOKEN_TURN_MS, pelo lado curto', () => {
    const turns = createTokenTurns()
    const de = 350 * GRAU
    const para = 10 * GRAU
    expect(syncTurn(turns, 'guarda', { shown: de, target: para, now: 1000, animate: true })).toBe(de)
    const [meio] = stepTurns(turns, 1000 + TOKEN_TURN_MS / 2)
    expect(meio.id).toBe('guarda')
    // No meio do caminho curto (350 → 360 → 10), nunca passando por 180.
    expect(meio.angle).toBeGreaterThan(de)
    expect(meio.angle).toBeLessThan(de + 20 * GRAU)
    const [fim] = stepTurns(turns, 1000 + TOKEN_TURN_MS)
    expect(fim.angle).toBe(para)
    expect(turns.size).toBe(0)
  })

  it('a mesma frente chegando de novo não recomeça o giro', () => {
    const turns = createTokenTurns()
    syncTurn(turns, 'guarda', { shown: 0, target: Math.PI / 2, now: 0, animate: true })
    const noMeio = syncTurn(turns, 'guarda', { shown: 0.3, target: Math.PI / 2, now: TOKEN_TURN_MS / 2, animate: true })
    expect(noMeio).toBeGreaterThan(0)
    expect(noMeio).toBeLessThan(Math.PI / 2)
    expect(turns.get('guarda')?.start).toBe(0)
  })

  it('frente nova no meio do giro parte do ângulo desenhado, sem voltar ao começo', () => {
    const turns = createTokenTurns()
    syncTurn(turns, 'guarda', { shown: 0, target: Math.PI / 2, now: 0, animate: true })
    const [meio] = stepTurns(turns, TOKEN_TURN_MS / 2)
    expect(syncTurn(turns, 'guarda', { shown: meio.angle, target: Math.PI, now: TOKEN_TURN_MS / 2, animate: true })).toBe(meio.angle)
    expect(turns.get('guarda')).toEqual({ from: meio.angle, to: Math.PI, start: TOKEN_TURN_MS / 2 })
  })

  it('diferença de menos de meio grau não anima: o bico já está lá', () => {
    const turns = createTokenTurns()
    expect(syncTurn(turns, 'guarda', { shown: 1, target: 1 + 0.2 * GRAU, now: 0, animate: true })).toBe(1 + 0.2 * GRAU)
    expect(turns.size).toBe(0)
  })

  it('giro curto: menos de 300 ms, começando devagar (ease-in-out), e nada a fazer sem giro em curso', () => {
    expect(TOKEN_TURN_MS).toBeGreaterThan(0)
    expect(TOKEN_TURN_MS).toBeLessThan(300)
    const turns = createTokenTurns()
    expect(stepTurns(turns, 0)).toEqual([])
    syncTurn(turns, 'guarda', { shown: 0, target: 1, now: 0, animate: true })
    const [cedo] = stepTurns(turns, TOKEN_TURN_MS / 10)
    // Ease-in-out: no primeiro décimo do tempo anda menos que um décimo do caminho.
    expect(cedo.angle).toBeGreaterThan(0)
    expect(cedo.angle).toBeLessThan(0.1)
  })
})
