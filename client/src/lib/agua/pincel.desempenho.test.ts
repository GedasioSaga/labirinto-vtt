import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../../types/map'
import { aguaComPincel } from './pincel'

/** MAR MAIS FÁCIL (13/11/2026): o pincel Mais/Menos água no mar enorme cabe numa tarefa curta (teto de 200 ms). */
const G = 40
const casa = (x: number, y: number): RegionPoint => ({ x: x * G, y: y * G })

describe('pincel Mais água / Menos água, tempo', () => {
  it('o mar enorme (200 x 200 casas) sai em menos de 200 ms', () => {
    const borda = { minX: 0, minY: 0, maxX: 200 * G, maxY: 200 * G }
    // Contorno à mão: um círculo torto com um ponto a cada meia casa.
    const contorno: number[] = []
    for (let i = 0; i < 1800; i += 1) {
      const t = (i / 1800) * Math.PI * 2
      const r = (90 + 4 * Math.sin(t * 7)) * G
      contorno.push(100 * G + r * Math.cos(t), 100 * G + r * Math.sin(t))
    }
    const traco = Array.from({ length: 120 }, (_, k) => casa(10 + k * 1.5, 100))
    const inicio = performance.now()
    const r = aguaComPincel(contorno, traco, 3 * G, false, G, borda, 2000)
    const ms = performance.now() - inicio
    expect(r.pontos).not.toBeNull()
    expect((r.pontos ?? []).length).toBeLessThanOrEqual(2000)
    expect(ms).toBeLessThan(200)
  })
})
