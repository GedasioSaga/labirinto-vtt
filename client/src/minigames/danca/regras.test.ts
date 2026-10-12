import { describe, expect, it } from 'vitest'
import {
  contarJulgamento,
  contarSegurada,
  DIF,
  julgar,
  letraDe,
  novoPlacar,
  ordemLetra,
  passouDaNota,
  pontosDe,
  precisaoDe,
  totalDeItens,
  VIDA,
  type Julgamento,
} from './regras'
import { DIFICULDADES_DANCA } from './tipos'

describe('julgar nas bordas exatas das janelas', () => {
  for (const dif of DIFICULDADES_DANCA) {
    it(dif, () => {
      const d = DIF[dif]
      const j = d.janelas
      // Mesma lista de casos do protótipo (provas/gerar-provas.cjs).
      const casos: [number, Julgamento | null][] = [
        [0, 'perfeito'],
        [j.perfeito, 'perfeito'],
        [-j.perfeito, 'perfeito'],
        [j.perfeito + 0.01, 'bom'],
        [j.bom, 'bom'],
        [-(j.bom + 0.01), 'ok'],
        [j.ok, 'ok'],
        [-j.ok, 'ok'],
        [j.ok + 0.01, null],
        [-(j.ok + 0.01), dif === 'expert' ? 'errou' : null],
        [-Math.max(d.errouCedo, j.ok) - 0.01, null],
      ]
      for (const [ms, esperado] of casos) expect(julgar(ms, dif), `${ms} ms`).toBe(esperado)
    })
  }

  it('usa os números finais do README', () => {
    expect(DIF.diversao.janelas).toEqual({ perfeito: 60, bom: 110, ok: 160 })
    expect(DIF.expert.janelas).toEqual({ perfeito: 30, bom: 60, ok: 100 })
    expect(DIF.diversao.errouCedo).toBe(0)
    expect(DIF.expert.errouCedo).toBe(160)
    expect(DIF.diversao.tela).toBe(1.9)
    expect(DIF.expert.tela).toBe(1.25)
    expect(DIF.diversao.vida).toBe(false)
    expect(DIF.expert.vida).toBe(true)
  })

  it('no Expert, toque até 160 ms cedo é Errou; depois disso é ignorado', () => {
    expect(julgar(-160, 'expert')).toBe('errou')
    expect(julgar(-160.01, 'expert')).toBeNull()
    expect(julgar(-130, 'expert')).toBe('errou')
    expect(julgar(-130, 'diversao')).toBe('ok')
  })
})

describe('letra pela precisão', () => {
  it('corta em S 95, A 88, B 78, C 65', () => {
    expect(letraDe(1)).toBe('S')
    expect(letraDe(0.95)).toBe('S')
    expect(letraDe(0.9499)).toBe('A')
    expect(letraDe(0.88)).toBe('A')
    expect(letraDe(0.8799)).toBe('B')
    expect(letraDe(0.78)).toBe('B')
    expect(letraDe(0.7799)).toBe('C')
    expect(letraDe(0.65)).toBe('C')
    expect(letraDe(0.6499)).toBe('D')
    expect(letraDe(0)).toBe('D')
  })

  it('passa da nota mínima com ela ou melhor', () => {
    expect(ordemLetra('S')).toBe(0)
    expect(ordemLetra('D')).toBe(4)
    expect(passouDaNota('B', 'B')).toBe(true)
    expect(passouDaNota('S', 'B')).toBe(true)
    expect(passouDaNota('C', 'B')).toBe(false)
  })
})

describe('placar', () => {
  it('precisão divide pelo julgado ao vivo e pelo total no fim', () => {
    const p = novoPlacar()
    expect(precisaoDe(p)).toBe(0)
    p.peso = 175
    p.julgadas = 2
    expect(precisaoDe(p)).toBeCloseTo(0.875)
    expect(precisaoDe(p, 4)).toBeCloseTo(0.4375)
  })

  it('pontos vão até 1.000.000 e nunca dividem por zero', () => {
    const p = novoPlacar()
    p.peso = 300
    expect(pontosDe(p, 3)).toBe(1000000)
    expect(pontosDe(p, 6)).toBe(500000)
    expect(pontosDe(novoPlacar(), 0)).toBe(0)
  })

  it('segurada vale 2 itens', () => {
    expect(totalDeItens([{ len: 0 }, { len: 0.5 }, { len: 0 }])).toBe(4)
    expect(totalDeItens([])).toBe(0)
  })

  it('Expert: vida começa em 60, Perfeito +2, Bom +1, Ok 0, Errou −9, limitada a 0-100', () => {
    const p = novoPlacar()
    expect(p.vida).toBe(VIDA.inicio)
    contarJulgamento(p, 'perfeito', 'expert', false)
    expect(p.vida).toBe(62)
    contarJulgamento(p, 'bom', 'expert', false)
    expect(p.vida).toBe(63)
    contarJulgamento(p, 'ok', 'expert', false)
    expect(p.vida).toBe(63)
    contarJulgamento(p, 'errou', 'expert', false)
    expect(p.vida).toBe(54)
    expect(p.combo).toBe(0)
    expect(p.comboMax).toBe(3)
    for (let i = 0; i < 40; i += 1) contarJulgamento(p, 'perfeito', 'expert', false)
    expect(p.vida).toBe(100)
    for (let i = 0; i < 20; i += 1) contarJulgamento(p, 'errou', 'expert', false)
    expect(p.vida).toBe(0)
  })

  it('Diversão: Errou zera o combo e não mexe na vida', () => {
    const p = novoPlacar()
    contarJulgamento(p, 'perfeito', 'diversao', false)
    contarJulgamento(p, 'errou', 'diversao', false)
    expect(p.vida).toBe(VIDA.inicio)
    expect(p.combo).toBe(0)
    expect(p.peso).toBe(100)
    expect(p.julgadas).toBe(2)
  })

  it('Errou numa segurada perde a cauda junto (2 itens julgados)', () => {
    const p = novoPlacar()
    contarJulgamento(p, 'errou', 'expert', true)
    expect(p.julgadas).toBe(2)
    expect(p.segTotal).toBe(1)
    expect(p.segOk).toBe(0)
  })

  it('segurada inteira vale 100; solta zera o combo e tira 6 de vida no Expert', () => {
    const p = novoPlacar()
    contarJulgamento(p, 'perfeito', 'expert', true)
    contarSegurada(p, true, 'expert')
    expect(p.peso).toBe(200)
    expect(p.segOk).toBe(1)
    expect(p.julgadas).toBe(2)
    contarJulgamento(p, 'perfeito', 'expert', true)
    const vida = p.vida
    contarSegurada(p, false, 'expert')
    expect(p.combo).toBe(0)
    expect(p.vida).toBe(vida + VIDA.soltou)
    expect(p.segTotal).toBe(2)
    const q = novoPlacar()
    contarSegurada(q, false, 'diversao')
    expect(q.vida).toBe(VIDA.inicio)
  })
})
