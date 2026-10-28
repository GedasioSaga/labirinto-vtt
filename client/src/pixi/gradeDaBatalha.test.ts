import { Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { batalhaCabeNaGrade, criarGradeDaBatalha, recorteNoMapa, ROTULO_DA_GRADE_DA_BATALHA, type MapaDaGrade } from './gradeDaBatalha'

/** MODO BATALHA (B5): a grade de batalha só com a batalha ligada, nunca em triangular, e barata no pan. */

const QUADRADO: MapaDaGrade = { width: 40, height: 30, grid: 50, gridShape: 'square', gridOffset: { x: 0, y: 0 } }
const VISTA = { left: 0, top: 0, right: 800, bottom: 600 }

function tracos(grade: ReturnType<typeof criarGradeDaBatalha>): number {
  return grade.camada.children.reduce((soma, filho) => soma + (filho instanceof Graphics ? filho.context.instructions.length : 0), 0)
}

describe('grade de batalha', () => {
  it('nasce escondida, com o rótulo da faixa e sem receber toque', () => {
    const grade = criarGradeDaBatalha()
    expect(grade.camada.label).toBe(ROTULO_DA_GRADE_DA_BATALHA)
    expect(grade.camada.visible).toBe(false)
    expect(grade.camada.eventMode).toBe('none')
  })

  it('só aparece com a batalha ligada; desligar apaga o traço', () => {
    const grade = criarGradeDaBatalha()
    grade.ajustarAVista(VISTA, 1, 1)
    grade.definir(false, QUADRADO)
    expect(grade.camada.visible).toBe(false)
    expect(tracos(grade)).toBe(0)
    grade.definir(true, QUADRADO)
    expect(grade.camada.visible).toBe(true)
    expect(tracos(grade)).toBeGreaterThan(0)
    grade.definir(false, QUADRADO)
    expect(grade.camada.visible).toBe(false)
    expect(tracos(grade)).toBe(0)
  })

  it('mapa triangular nunca tem grade de batalha (decisão 7); hex tem', () => {
    expect(batalhaCabeNaGrade('triangle')).toBe(false)
    expect(batalhaCabeNaGrade('square')).toBe(true)
    expect(batalhaCabeNaGrade('hex')).toBe(true)
    const tri = criarGradeDaBatalha()
    tri.ajustarAVista(VISTA, 1, 1)
    tri.definir(true, { ...QUADRADO, gridShape: 'triangle' })
    expect(tri.camada.visible).toBe(false)
    const hex = criarGradeDaBatalha()
    hex.ajustarAVista(VISTA, 1, 1)
    hex.definir(true, { ...QUADRADO, gridShape: 'hex' })
    expect(hex.camada.visible).toBe(true)
    expect(tracos(hex)).toBeGreaterThan(0)
  })

  it('pan dentro da folga não redesenha; sair dela ou mudar o zoom redesenha uma vez', () => {
    const grade = criarGradeDaBatalha()
    grade.ajustarAVista(VISTA, 1, 1)
    grade.definir(true, QUADRADO)
    const depoisDeLigar = grade.desenhos()
    for (let dx = 1; dx <= 300; dx += 1) grade.ajustarAVista({ left: dx, top: 0, right: 800 + dx, bottom: 600 }, 1, 1)
    expect(grade.desenhos()).toBe(depoisDeLigar)
    grade.ajustarAVista({ left: 900, top: 0, right: 1700, bottom: 600 }, 1, 1)
    expect(grade.desenhos()).toBe(depoisDeLigar + 1)
    grade.ajustarAVista({ left: 900, top: 0, right: 1700, bottom: 600 }, 2, 1)
    expect(grade.desenhos()).toBe(depoisDeLigar + 2)
  })

  it('definir de novo com a mesma batalha e a mesma grade não redesenha', () => {
    const grade = criarGradeDaBatalha()
    grade.ajustarAVista(VISTA, 1, 1)
    grade.definir(true, QUADRADO)
    const antes = grade.desenhos()
    grade.definir(true, { ...QUADRADO })
    expect(grade.desenhos()).toBe(antes)
  })

  it('o recorte fica dentro do mapa; vista toda fora do mapa não tem recorte', () => {
    expect(recorteNoMapa({ left: -100, top: -100, right: 500, bottom: 400 }, QUADRADO)).toEqual({ left: 0, top: 0, right: 500, bottom: 400 })
    expect(recorteNoMapa({ left: 1800, top: 0, right: 2600, bottom: 600 }, QUADRADO)).toEqual({ left: 1800, top: 0, right: 2000, bottom: 600 })
    expect(recorteNoMapa({ left: 2100, top: 0, right: 2900, bottom: 600 }, QUADRADO)).toBeNull()
  })

  it('exportar imagem (vista nula) esconde a grade', () => {
    const grade = criarGradeDaBatalha()
    grade.ajustarAVista(VISTA, 1, 1)
    grade.definir(true, QUADRADO)
    grade.ajustarAVista(null, 1, 1)
    expect(grade.camada.visible).toBe(false)
  })
})
