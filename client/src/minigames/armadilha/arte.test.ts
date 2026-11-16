// @vitest-environment node
/**
 * Arte das armadilhas sem navegador: um contexto 2D falso (Proxy que grava
 * cada chamada) recebe o desenho. Prova que tudo desenha sem quebrar e que o
 * movimento reduzido não mexe a imagem nem pisca.
 */
import { describe, expect, it } from 'vitest'
import { desenharFlash, desenharSusto, tremorDoSusto } from './arte'
import { criarSusto, passoSusto, type Bicho, type Susto } from './sim'

type Chamada = [string, ...unknown[]]

function contextoFalso(): { g: CanvasRenderingContext2D; log: Chamada[] } {
  const log: Chamada[] = []
  const alvo: Record<string, unknown> = { globalAlpha: 1 }
  const g = new Proxy(alvo, {
    get(o, nome: string) {
      if (nome in o) return o[nome]
      return (...args: unknown[]) => { log.push([nome, ...args]) }
    },
    set(o, nome: string, v) {
      o[nome] = v
      log.push(['=' + nome, v])
      return true
    },
  })
  return { g: g as unknown as CanvasRenderingContext2D, log } // falso de teste: o Proxy grava o que a arte chama; o resto da interface nunca é usado
}

const BOCA: readonly [number, number] = [120, 62]

function susto(bicho: Bicho, reduzido: boolean, t: number): Susto {
  const s = criarSusto(bicho, reduzido, BOCA)
  while (s.t < t - 1e-9 && !s.fim) passoSusto(s)
  return s
}

describe('desenho do susto', () => {
  it('desenha a cobra e a aranha em toda a linha do tempo, nas duas versões', () => {
    for (const bicho of ['cobra', 'aranha'] as const) {
      for (const reduzido of [false, true]) {
        for (const t of [0, 0.05, 0.12, 0.3, 0.5, 0.7, 0.79, 1.0, 1.19]) {
          const { g, log } = contextoFalso()
          expect(() => desenharSusto(g, susto(bicho, reduzido, t))).not.toThrow()
          if (t < 0.7) expect(log.filter(([n]) => n === 'fillRect').length).toBeGreaterThan(20)
        }
      }
    }
  })
  it('cobra no reduzido: o desenho é o mesmo em 0,1 s e em 0,5 s (nada se mexe)', () => {
    const a = contextoFalso(), b = contextoFalso()
    desenharSusto(a.g, susto('cobra', true, 0.1))
    desenharSusto(b.g, susto('cobra', true, 0.5))
    expect(a.log).toEqual(b.log)
  })
  it('cobra no normal: o desenho muda entre 0,02 s e 0,3 s (o salto)', () => {
    const a = contextoFalso(), b = contextoFalso()
    desenharSusto(a.g, susto('cobra', false, 0.02))
    desenharSusto(b.g, susto('cobra', false, 0.3))
    expect(a.log).not.toEqual(b.log)
  })
  it('a aranha é recortada na boca do recipiente (sai de dentro)', () => {
    const { g, log } = contextoFalso()
    desenharSusto(g, susto('aranha', false, 0.1))
    expect(log.some(([n]) => n === 'clip')).toBe(true)
    expect(log.some(([n]) => n === 'restore')).toBe(true)
  })
})

describe('flash e tremor', () => {
  it('no reduzido não há flash nem tremor em instante nenhum', () => {
    for (const t of [0, 0.01, 0.04, 0.08, 0.2]) {
      const { g, log } = contextoFalso()
      const s = susto('cobra', true, t)
      desenharFlash(g, s)
      expect(log.length).toBe(0)
      expect(tremorDoSusto(s)).toEqual([0, 0])
    }
  })
  it('no normal o flash pinta a tela inteira só no comecinho do bote', () => {
    const cedo = contextoFalso(), tarde = contextoFalso()
    desenharFlash(cedo.g, susto('cobra', false, 0.02))
    desenharFlash(tarde.g, susto('cobra', false, 0.3))
    expect(cedo.log.some(([n, x, y, w, h]) => n === 'fillRect' && x === 0 && y === 0 && w === 240 && h === 135)).toBe(true)
    expect(tarde.log.length).toBe(0)
  })
  it('a aranha nunca pisca', () => {
    const { g, log } = contextoFalso()
    desenharFlash(g, susto('aranha', false, 0.02))
    expect(log.length).toBe(0)
  })
})
