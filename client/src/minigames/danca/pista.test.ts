import { describe, expect, it } from 'vitest'
import type { NotaEmJogo } from './partida'
import { anelDoEfeito, avancarCursorDeDesenho, centroDaTrilha, linhasDeBatida, medirPista, pixelsPorSegundo, type LayoutDaPista } from './pista'

function layout(w: number, h: number, dpr = 1): LayoutDaPista {
  const l = medirPista(w, h, dpr)
  if (l === null) throw new Error(`layout nulo para ${w}x${h}`)
  return l
}

const nota = (t: number, len = 0): NotaEmJogo => ({ t, lane: 0, len, sub: 4, julg: null, segurando: false, fimOk: null, delta: null })

describe('layout da pista', () => {
  it('trilhas de até 88 px, centradas, receptores a 14 px do fundo', () => {
    const L = layout(400, 600, 3)
    expect(L.dpr).toBe(2)
    expect(L.lw).toBe(88)
    expect(L.x0).toBe(24)
    expect(L.tam).toBe(70)
    expect(L.ry).toBe(600 - 35 - 14)
    expect(L.larguraPx).toBe(800)
    expect(L.alturaPx).toBe(1200)
  })

  it('no celular as trilhas encolhem para caber com 8 px de cada lado', () => {
    const L = layout(200, 500)
    expect(L.lw).toBe(46)
    expect(L.x0).toBe(8)
    expect(centroDaTrilha(L, 0)).toBe(31)
    expect(centroDaTrilha(L, 3)).toBe(169)
  })

  it('sem tamanho ainda, sem layout; DPR inválido vira 1', () => {
    expect(medirPista(5, 600, 1)).toBeNull()
    expect(medirPista(400, 0, 1)).toBeNull()
    expect(layout(400, 600, 0).dpr).toBe(1)
  })
})

describe('movimento das setas', () => {
  it('a seta cruza a pista no tempo de queda: 1,9 s na Diversão, 1,25 s no Expert', () => {
    const L = layout(400, 600)
    expect((L.ry + L.tam) / pixelsPorSegundo(L, 'diversao')).toBeCloseTo(1.9, 9)
    expect((L.ry + L.tam) / pixelsPorSegundo(L, 'expert')).toBeCloseTo(1.25, 9)
  })

  it('linhas de batida acima dos receptores, espaçadas de uma batida, forte no começo do compasso', () => {
    const L = layout(400, 600)
    const pps = pixelsPorSegundo(L, 'diversao')
    const linhas = linhasDeBatida(L, 10, { batidaS: 0.5, grade0: 0, fase4: 1 }, pps)
    expect(linhas[0].y).toBeCloseTo(L.ry, 9)
    for (let i = 1; i < linhas.length; i += 1) expect(linhas[i - 1].y - linhas[i].y).toBeCloseTo(0.5 * pps, 6)
    for (const l of linhas) expect(l.y).toBeGreaterThanOrEqual(-4)
    // 1,9 s de queda / 0,5 s por batida: 4 linhas na tela.
    expect(linhas).toHaveLength(4)
    // st = 10 s é a batida 20; fase4 = 1: a próxima cabeça de compasso é a batida 21.
    expect(linhas.map((l) => l.forte)).toEqual([false, true, false, false])
  })

  it('sem batida válida, sem linhas (nunca laço infinito)', () => {
    const L = layout(400, 600)
    expect(linhasDeBatida(L, 0, { batidaS: 0, grade0: 0, fase4: 0 }, 100)).toEqual([])
    expect(linhasDeBatida(L, 0, { batidaS: 0.5, grade0: 0, fase4: 0 }, 0)).toEqual([])
  })

  it('o cursor de desenho pula o que acabou há mais de 0,8 s, contando a cauda', () => {
    const notas = [nota(1), nota(2, 3), nota(4)]
    expect(avancarCursorDeDesenho(notas, 0, 1.79)).toBe(0)
    expect(avancarCursorDeDesenho(notas, 0, 1.81)).toBe(1)
    expect(avancarCursorDeDesenho(notas, 0, 5.5)).toBe(1)
    expect(avancarCursorDeDesenho(notas, 1, 5.81)).toBe(3)
    expect(avancarCursorDeDesenho(notas, 3, 0)).toBe(3)
  })
})

describe('anel do julgamento', () => {
  it('cresce 32% e some em 180 ms', () => {
    expect(anelDoEfeito(0, false)).toEqual({ escala: 1, alfa: 0.9 })
    const fim = anelDoEfeito(179, false)
    expect(fim?.escala).toBeGreaterThan(1.3)
    expect(fim?.alfa).toBeLessThan(0.01)
    expect(anelDoEfeito(180, false)).toBeNull()
    expect(anelDoEfeito(-1, false)).toBeNull()
  })

  it('com movimento reduzido não cresce e dura 120 ms', () => {
    expect(anelDoEfeito(60, true)).toEqual({ escala: 1, alfa: 0.45 })
    expect(anelDoEfeito(120, true)).toBeNull()
  })
})
