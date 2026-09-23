import { describe, expect, it } from 'vitest'
import { formatarQuadrados, rotuloDeQuadradosAndados, MINIMO_DE_QUADRADOS_PARA_MOSTRAR } from './tokenDragDistance'
import { measureCells } from './measurement'

const GRID = 64

describe('formatarQuadrados', () => {
  it('inteiro sai sem casa decimal e no plural', () => {
    expect(formatarQuadrados(5)).toBe('5 quadrados')
    expect(formatarQuadrados(12)).toBe('12 quadrados')
  })

  it('um quadrado sai no singular', () => {
    expect(formatarQuadrados(1)).toBe('1 quadrado')
  })

  it('fração usa vírgula decimal (pt-BR) e uma casa', () => {
    expect(formatarQuadrados(1.5)).toBe('1,5 quadrados')
    expect(formatarQuadrados(2.44)).toBe('2,4 quadrados')
  })

  it('zero continua no plural — "0 quadrado" seria errado em português', () => {
    expect(formatarQuadrados(0)).toBe('0 quadrados')
  })

  it('não põe separador de milhar num mapa gigante', () => {
    expect(formatarQuadrados(1500)).toBe('1500 quadrados')
  })
})

describe('rotuloDeQuadradosAndados', () => {
  it('5 células à direita, grade quadrada, dá "5 quadrados"', () => {
    expect(rotuloDeQuadradosAndados({ x: 416, y: 672 }, { x: 736, y: 672 }, GRID, 'square', 'chessboard')).toBe(
      '5 quadrados',
    )
  })

  it('1 célula à direita dá "1 quadrado" — o caso que a jornada compara com o de 5', () => {
    expect(rotuloDeQuadradosAndados({ x: 672, y: 672 }, { x: 736, y: 672 }, GRID, 'square', 'chessboard')).toBe(
      '1 quadrado',
    )
  })

  it('ficha parada não mostra nada, em vez de escrever "0 quadrados" por cima do gesto', () => {
    expect(rotuloDeQuadradosAndados({ x: 736, y: 672 }, { x: 736, y: 672 }, GRID, 'square', 'chessboard')).toBeNull()
  })

  it('tremida dentro da mesma célula continua escondida', () => {
    expect(rotuloDeQuadradosAndados({ x: 736, y: 672 }, { x: 741, y: 675 }, GRID, 'square', 'chessboard')).toBeNull()
  })

  it('logo acima do mínimo já aparece', () => {
    const andou = MINIMO_DE_QUADRADOS_PARA_MOSTRAR * GRID + 1
    expect(rotuloDeQuadradosAndados({ x: 0, y: 0 }, { x: andou, y: 0 }, GRID, 'square', 'chessboard')).not.toBeNull()
  })

  it('grade sem tamanho não inventa distância (mesma guarda de measureCells)', () => {
    expect(rotuloDeQuadradosAndados({ x: 0, y: 0 }, { x: 320, y: 0 }, 0, 'square', 'chessboard')).toBeNull()
  })

  it('NÃO escreve uma segunda regra de distância: o número é o de measureCells', () => {
    const origem = { x: 100, y: 40 }
    const atual = { x: 420, y: 296 }
    for (const modo of ['chessboard', 'alternating', 'euclidean', 'manhattan'] as const) {
      const esperado = measureCells(origem, atual, GRID, 'square', modo)
      expect(rotuloDeQuadradosAndados(origem, atual, GRID, 'square', modo)).toBe(formatarQuadrados(esperado))
    }
  })

  it('respeita o modo da mesa: 3.5e (5-10-5) cobra a diagonal diferente de 5e', () => {
    const origem = { x: 0, y: 0 }
    const atual = { x: GRID * 3, y: GRID * 3 }
    expect(rotuloDeQuadradosAndados(origem, atual, GRID, 'square', 'chessboard')).toBe('3 quadrados')
    expect(rotuloDeQuadradosAndados(origem, atual, GRID, 'square', 'alternating')).toBe('4 quadrados')
  })

  it('grade hexagonal usa a distância de hex, não a de quadrado', () => {
    const origem = { x: 0, y: 0 }
    const atual = { x: 300, y: 120 }
    expect(rotuloDeQuadradosAndados(origem, atual, GRID, 'hex', 'hex')).toBe(
      formatarQuadrados(measureCells(origem, atual, GRID, 'hex', 'hex')),
    )
  })
})
