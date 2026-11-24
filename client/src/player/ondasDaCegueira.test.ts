import { describe, expect, it } from 'vitest'
import { anelDaOnda, casarOndas, ONDA_ANEIS, ONDA_CICLO_MS, ONDA_ESCALA_INICIAL, type OndaViva } from './ondasDaCegueira'

/** A onda da Cegueira (protótipo aprovado em 23/11/2026): a conta que o Pixi aplica. */
describe('onda da cegueira', () => {
  it('cada anel abre em linha reta de 0,18 a 1 e some no fim; sempre há um anel visível', () => {
    const passo = 50
    const escalas: number[] = []
    let menorPico = Infinity
    for (let t = 0; t < ONDA_CICLO_MS; t += passo) {
      escalas.push(anelDaOnda(t, 0, 0).escala)
      const pico = Math.max(...Array.from({ length: ONDA_ANEIS }, (_, i) => anelDaOnda(t, 0, i).alfa))
      menorPico = Math.min(menorPico, pico)
    }
    expect(escalas[0]).toBeCloseTo(ONDA_ESCALA_INICIAL, 5)
    // Linha reta: o mesmo tanto a cada passo (com ease-out o anel parava na borda).
    const passos = escalas.slice(1).map((e, i) => e - (escalas[i] ?? 0))
    for (const d of passos) expect(d).toBeCloseTo(passos[0] ?? 0, 6)
    expect(anelDaOnda(ONDA_CICLO_MS - 1, 0, 0).alfa).toBeLessThan(0.01)
    expect(menorPico).toBeGreaterThan(0.5)
  })

  it('a onda que andou guarda fase e chave; a nova nasce agora; a que sumiu sai', () => {
    let n = 10
    const antes: OndaViva[] = [{ chave: 1, x: 100, y: 100, fase: 333, nasceu: 0 }, { chave: 2, x: 900, y: 900, fase: 444, nasceu: 0 }]
    const depois = casarOndas(antes, [{ x: 130, y: 100 }, { x: 400, y: 400 }], 50, 5000, () => (n += 1))
    expect(depois).toEqual([
      { chave: 1, x: 130, y: 100, fase: 333, nasceu: 0 },
      expect.objectContaining({ chave: 11, x: 400, y: 400, nasceu: 5000 }),
    ])
  })
})
