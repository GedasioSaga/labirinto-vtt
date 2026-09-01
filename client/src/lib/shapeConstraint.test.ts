import { describe, expect, it } from 'vitest'
import { constrainDraft } from './shapeConstraint'

const noShift = { shift: false, alt: false }
const shift = { shift: true, alt: false }

describe('constrainDraft — sem Shift', () => {
  it('devolve o ponto atual intacto (mesma referência), qualquer ferramenta', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 40, y: 10 }
    expect(constrainDraft(inicio, atual, 'rect', noShift)).toBe(atual)
    expect(constrainDraft(inicio, atual, 'ellipse', noShift)).toBe(atual)
    expect(constrainDraft(inicio, atual, 'room', noShift)).toBe(atual)
    expect(constrainDraft(inicio, atual, 'circle', noShift)).toBe(atual)
  })
})

describe('constrainDraft — rect com Shift (quadrado)', () => {
  it('X mais longo: trava Y no mesmo comprimento de X, preservando sinal', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 80, y: 20 }
    expect(constrainDraft(inicio, atual, 'rect', shift)).toEqual({ x: 80, y: 80 })
  })

  it('Y mais longo: trava X no mesmo comprimento de Y, preservando sinal', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 20, y: 80 }
    expect(constrainDraft(inicio, atual, 'rect', shift)).toEqual({ x: 80, y: 80 })
  })

  it('arrasto para cima-esquerda (dx/dy negativos) continua no mesmo quadrante', () => {
    const inicio = { x: 100, y: 100 }
    const atual = { x: 40, y: 70 }
    // dx=-60, dy=-30 → lado = 60, sinais preservados
    expect(constrainDraft(inicio, atual, 'rect', shift)).toEqual({ x: 40, y: 40 })
  })

  it('quadrantes opostos (dx negativo, dy positivo) tratados de forma independente', () => {
    const inicio = { x: 100, y: 100 }
    const atual = { x: 50, y: 150 }
    // dx=-50, dy=50 → lado = 50, cada eixo com seu próprio sinal
    expect(constrainDraft(inicio, atual, 'rect', shift)).toEqual({ x: 50, y: 150 })
  })

  it('arrasto puramente vertical (dx=0): X fica preso em inicio.x, degenerado como nos editores de referência', () => {
    const inicio = { x: 10, y: 10 }
    const atual = { x: 10, y: 60 }
    expect(constrainDraft(inicio, atual, 'rect', shift)).toEqual({ x: 10, y: 60 })
  })

  it('sem arrasto (inicio === atual): devolve inicio', () => {
    const inicio = { x: 5, y: 5 }
    expect(constrainDraft(inicio, { x: 5, y: 5 }, 'rect', shift)).toEqual({ x: 5, y: 5 })
  })
})

describe('constrainDraft — room com Shift (sala quadrada)', () => {
  it('mesma trava de proporção do rect — item 14 cobre "retângulo/sala" juntos', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 30, y: 90 }
    expect(constrainDraft(inicio, atual, 'room', shift)).toEqual({ x: 90, y: 90 })
  })
})

describe('constrainDraft — ellipse com Shift (círculo)', () => {
  it('rx mais longo (dx>dy): trava ry no mesmo raio de rx', () => {
    const center = { x: 200, y: 200 }
    const atual = { x: 260, y: 220 }
    // dx=60, dy=20 → lado=60
    expect(constrainDraft(center, atual, 'ellipse', shift)).toEqual({ x: 260, y: 260 })
  })

  it('ry mais longo (dy>dx): trava rx no mesmo raio de ry', () => {
    const center = { x: 200, y: 200 }
    const atual = { x: 210, y: 280 }
    // dx=10, dy=80 → lado=80
    expect(constrainDraft(center, atual, 'ellipse', shift)).toEqual({ x: 280, y: 280 })
  })
})

describe('constrainDraft — ferramentas já regulares por construção (Shift é no-op)', () => {
  it('circle (Desenho): raio vem de Math.hypot, não existe rx/ry pra travar', () => {
    const center = { x: 0, y: 0 }
    const atual = { x: 33, y: 91 }
    expect(constrainDraft(center, atual, 'circle', shift)).toBe(atual)
  })

  it('roomCircle (Sala Circular): mesmo motivo do circle', () => {
    const center = { x: 0, y: 0 }
    const atual = { x: 15, y: 47 }
    expect(constrainDraft(center, atual, 'roomCircle', shift)).toBe(atual)
  })

  it('roomPolygon (Polígono Regular): raio único, ângulo livre — já é regular', () => {
    const center = { x: 0, y: 0 }
    const atual = { x: 71, y: 8 }
    expect(constrainDraft(center, atual, 'roomPolygon', shift)).toBe(atual)
  })
})

describe('constrainDraft — ferramentas fora do escopo do item 14', () => {
  it('wall: Shift não faz nada (parede usa Ctrl para ângulo, não Shift para proporção)', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 30, y: 90 }
    expect(constrainDraft(inicio, atual, 'wall', shift)).toBe(atual)
  })

  it('line: mesmo motivo do wall', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 30, y: 90 }
    expect(constrainDraft(inicio, atual, 'line', shift)).toBe(atual)
  })

  it('polygon (livre): não tem noção de proporção de dois pontos', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 30, y: 90 }
    expect(constrainDraft(inicio, atual, 'polygon', shift)).toBe(atual)
  })
})

describe('constrainDraft — modificador alt reservado mas não lido (ver comentário no módulo)', () => {
  it('alt:true sem shift continua devolvendo atual intacto', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 80, y: 20 }
    expect(constrainDraft(inicio, atual, 'rect', { shift: false, alt: true })).toBe(atual)
  })

  it('alt:true junto com shift não muda o resultado do shift sozinho', () => {
    const inicio = { x: 0, y: 0 }
    const atual = { x: 80, y: 20 }
    const comAlt = constrainDraft(inicio, atual, 'rect', { shift: true, alt: true })
    const semAlt = constrainDraft(inicio, atual, 'rect', { shift: true, alt: false })
    expect(comAlt).toEqual(semAlt)
  })
})
