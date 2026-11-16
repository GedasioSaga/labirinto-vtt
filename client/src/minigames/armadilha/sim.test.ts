// @vitest-environment node
/**
 * Gráfico do movimento das armadilhas (METAS.md, seção 2): a linha do tempo
 * amostrada sem desenhar. A cada 0,1 s, como pede a meta, e a cada passo
 * (1/120 s) onde a propriedade é mais curta que 0,1 s (o salto de 0,12 s e o
 * flash de 0,09 s caberiam entre duas amostras).
 */
import { describe, expect, it } from 'vitest'
import { COBRA, criarSusto, passoSusto, simularSusto, type Bicho } from './sim'

const BOCA: readonly [number, number] = [120, 62]
const fino = (bicho: Bicho, reduzido: boolean) => simularSusto(bicho, reduzido, BOCA, 1)
const decimo = (bicho: Bicho, reduzido: boolean) => simularSusto(bicho, reduzido, BOCA, 12)

describe('cobra, movimento normal', () => {
  it('o susto dura 0,8 s (± 0,05)', () => {
    const a = fino('cobra', false)
    expect(a[a.length - 1].t).toBeGreaterThan(0.75)
    expect(a[a.length - 1].t).toBeLessThan(0.85)
  })
  it('a tela treme no bote e para de tremer antes do fim', () => {
    const a = decimo('cobra', false)
    expect(a[0].v.tremor).toBeGreaterThan(0)
    expect(a[a.length - 1].v.tremor).toBe(0)
    // Depois que zera, não volta.
    const zerou = a.findIndex((x) => x.t > COBRA.tremorQueda)
    for (const x of a.slice(zerou)) expect(x.v.tremor).toBe(0)
  })
  it('o flash tem um pico só (nunca mais de 3 piscadas por segundo)', () => {
    const a = fino('cobra', false)
    let picos = 0
    for (let i = 0; i < a.length; i++) {
      const antes = i > 0 ? a[i - 1].v.flash : 0
      const depois = i + 1 < a.length ? a[i + 1].v.flash : 0
      if (a[i].v.flash > 0 && a[i].v.flash >= antes && a[i].v.flash > depois) picos++
    }
    expect(picos).toBe(1)
    expect(Math.max(...a.map((x) => x.v.flash))).toBeLessThanOrEqual(COBRA.flashAlfa)
  })
  it('salta: chega ao tamanho cheio em até 0,15 s', () => {
    const a = fino('cobra', false)
    const cheio = a.find((x) => x.v.escala >= 0.99)
    expect(cheio?.t ?? Infinity).toBeLessThanOrEqual(0.15)
    expect(a[0].v.escala).toBeLessThan(0.3)
  })
})

describe('cobra, movimento reduzido', () => {
  it('tremor e flash ficam em 0 em todas as amostras (0,1 s e passo a passo)', () => {
    for (const a of [decimo('cobra', true), fino('cobra', true)]) {
      for (const x of a) {
        expect(x.v.tremor).toBe(0)
        expect(x.v.flash).toBe(0)
      }
    }
  })
  it('a imagem aparece inteira, sem salto: tamanho e lugar fixos', () => {
    const a = fino('cobra', true)
    for (const x of a) {
      expect(x.v.escala).toBe(1)
      expect(x.v.x).toBe(a[0].v.x)
      expect(x.v.y).toBe(a[0].v.y)
    }
    expect(a[0].v.opacidade).toBe(1)
  })
  it('dura o mesmo 0,8 s (o som é o mesmo)', () => {
    const a = fino('cobra', true)
    expect(a[a.length - 1].t).toBeGreaterThan(0.75)
    expect(a[a.length - 1].t).toBeLessThan(0.85)
  })
})

describe('aranha', () => {
  it('nunca treme e nunca pisca, nas duas versões', () => {
    for (const reduzido of [false, true]) {
      for (const x of fino('aranha', reduzido)) {
        expect(x.v.tremor).toBe(0)
        expect(x.v.flash).toBe(0)
        expect(x.v.escala).toBe(1)
      }
    }
  })
  it('no reduzido não desce nem sobe: posição fixa', () => {
    const a = fino('aranha', true)
    for (const x of a) {
      expect(x.v.x).toBe(a[0].v.x)
      expect(x.v.y).toBe(a[0].v.y)
    }
  })
  it('no normal sobe da boca e volta para dentro', () => {
    const a = decimo('aranha', false)
    const ys = a.map((x) => x.v.y)
    expect(Math.min(...ys)).toBeLessThan(BOCA[1])
    expect(ys[0]).toBeGreaterThan(BOCA[1])
    expect(ys[ys.length - 1]).toBeGreaterThan(BOCA[1])
  })
})

describe('linha do tempo', () => {
  it('mesma entrada, mesmas amostras', () => {
    expect(decimo('cobra', false)).toEqual(decimo('cobra', false))
    expect(decimo('aranha', false)).toEqual(decimo('aranha', false))
  })
  it('o som sai só no primeiro passo', () => {
    const s = criarSusto('cobra', false, BOCA)
    const nomes: string[] = []
    while (!passoSusto(s)) nomes.push(...s.eventos.map((e) => e.nome))
    expect(nomes).toEqual(['bote'])
  })
})
