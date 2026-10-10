/**
 * O ruído de gradiente guarda os gradientes de cada grade (`tabelaDeGradientes`)
 * para o ladrilho de 512 px não pedir o mesmo seno milhões de vezes. A tabela
 * não pode mudar o desenho: o valor tem de ser o mesmo da conta na hora,
 * bit a bit, senão a textura já pintada no mapa mudaria sozinha.
 */
import { describe, expect, it } from 'vitest'
import { gradiente, hash, mod } from './ruido'

function gradienteNaHora(x: number, y: number, periodo: number, semente: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const canto = (cx: number, cy: number, dx: number, dy: number) => {
    const angulo = hash(mod(cx, periodo), mod(cy, periodo), semente) * Math.PI * 2
    return Math.cos(angulo) * dx + Math.sin(angulo) * dy
  }
  const suave = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const sx = suave(fx)
  return lerp(lerp(canto(x0, y0, fx, fy), canto(x0 + 1, y0, fx - 1, fy), sx), lerp(canto(x0, y0 + 1, fx, fy - 1), canto(x0 + 1, y0 + 1, fx - 1, fy - 1), sx), suave(fy))
}

describe('gradiente com a tabela guardada', () => {
  it('dá o mesmo número da conta na hora, com tabela (período pequeno) e sem ela (período grande)', () => {
    for (const periodo of [3, 8, 72, 300]) {
      for (let k = 0; k < 400; k += 1) {
        const x = ((k * 0.7548776662) % 1) * periodo * 2 - periodo / 2
        const y = ((k * 0.5698402910) % 1) * periodo * 2 - periodo / 2
        expect(gradiente(x, y, periodo, 81)).toBe(gradienteNaHora(x, y, periodo, 81))
      }
    }
  })
})
