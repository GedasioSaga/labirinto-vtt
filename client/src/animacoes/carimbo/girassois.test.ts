import { describe, expect, it } from 'vitest'
import { QUADRO_DA_BIBLIOTECA } from '../../carimbos/arte'
import { PALETA_DO_GIRASSOL } from './_girassol'
import desenharGirassol from './girassol'
import desenharGirassois from './girassois'

/**
 * Girassol e Girassóis seguem a régua da biblioteca (`carimbos/embutidos.test.ts`):
 * cor sem estourar, desenho dentro do quadro e oito giros que não saem iguais.
 */

function saturacao([r, g, b]: readonly number[]): number {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  if (max === min) return 0
  return (max - min) / (1 - Math.abs(max + min - 1))
}

/** Contexto 2D de mentira: anota os pontos dos caminhos e os comandos; o resto não faz nada. */
function contextoFalso(): { g: CanvasRenderingContext2D; pontos: Array<[number, number]>; comandos: string[] } {
  const pontos: Array<[number, number]> = []
  const comandos: string[] = []
  const alvo: Record<string, unknown> = {
    moveTo: (x: number, y: number) => pontos.push([x, y]),
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => pontos.push([cx, cy], [x, y]),
  }
  const g = new Proxy(alvo, {
    get: (t, nome: string) => (...args: unknown[]) => {
      comandos.push(`${nome}(${args.map((a) => (typeof a === 'number' ? a.toFixed(3) : '')).join(',')})`)
      const f = t[nome]
      return typeof f === 'function' ? (f as (...a: unknown[]) => unknown)(...args) : undefined
    },
    set: () => true,
  })
  return { g: g as unknown as CanvasRenderingContext2D, pontos, comandos }
}

describe('carimbos de girassol', () => {
  it('nenhuma cor estourada: canal até 245 e saturação até 0,72', () => {
    for (const cor of PALETA_DO_GIRASSOL) {
      expect(Math.max(...cor)).toBeLessThanOrEqual(245)
      expect(saturacao(cor)).toBeLessThanOrEqual(0.72)
    }
  })

  for (const [nome, desenhar] of [
    ['Girassol', desenharGirassol],
    ['Girassóis', desenharGirassois],
  ] as const) {
    it(`${nome}: oito giros sem erro, dentro do quadro e diferentes entre si`, () => {
      const q = QUADRO_DA_BIBLIOTECA
      const desenhos = new Set<string>()
      for (let v = 0; v < 8; v++) {
        const { g, pontos, comandos } = contextoFalso()
        desenhar(g, (v * Math.PI) / 4, v)
        expect(pontos.length).toBeGreaterThan(0)
        for (const [x, y] of pontos) {
          expect(x).toBeGreaterThanOrEqual(q.esquerda)
          expect(x).toBeLessThanOrEqual(q.esquerda + q.lado)
          expect(y).toBeGreaterThanOrEqual(q.topo)
          expect(y).toBeLessThanOrEqual(q.topo + q.lado)
        }
        desenhos.add(comandos.join(' '))
      }
      expect(desenhos.size).toBeGreaterThanOrEqual(4)
    })
  }
})
