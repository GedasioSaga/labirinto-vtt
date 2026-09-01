import { describe, expect, it } from 'vitest'
import {
  computeAlignedGridLines,
  computeGridFromCount,
  detectGridCountFromFilename,
  MAX_DETECTED_DIMENSION,
  wrapGridOffset,
} from './gridAlign'

describe('computeGridFromCount', () => {
  it('deriva cellSize da média entre largura/cols e altura/rows, offset em (0,0)', () => {
    // 1920/30 = 64, 1200/20 = 60 -> média 62
    expect(computeGridFromCount(1920, 1200, 30, 20)).toEqual({ cellSize: 62, offset: { x: 0, y: 0 } })
  })

  it('produz o mesmo cellSize nos dois eixos quando a imagem é perfeitamente quadriculada', () => {
    expect(computeGridFromCount(1280, 960, 20, 15)).toEqual({ cellSize: 64, offset: { x: 0, y: 0 } })
  })

  it.each([
    ['largura zero', 0, 100, 10, 10],
    ['altura negativa', 100, -1, 10, 10],
    ['cols zero', 100, 100, 0, 10],
    ['rows negativo', 100, 100, 10, -5],
  ])('devolve null para entrada inválida: %s', (_label, w, h, cols, rows) => {
    expect(computeGridFromCount(w, h, cols, rows)).toBeNull()
  })
})

describe('detectGridCountFromFilename', () => {
  it('detecta "49x28" em "taverna_49x28.png" — cols=49, rows=28', () => {
    expect(detectGridCountFromFilename('taverna_49x28.png')).toEqual({ cols: 49, rows: 28 })
  })

  it('detecta "30x20" em "mapa 30x20.jpg", com espaço em volta do x', () => {
    expect(detectGridCountFromFilename('mapa 30x20.jpg')).toEqual({ cols: 30, rows: 20 })
  })

  it('aceita "X" maiúsculo e "×" (sinal de multiplicação)', () => {
    expect(detectGridCountFromFilename('cripta_12X9.webp')).toEqual({ cols: 12, rows: 9 })
    expect(detectGridCountFromFilename('cripta_12×9.webp')).toEqual({ cols: 12, rows: 9 })
  })

  it('NÃO confunde resolução de imagem (1920x1080) com dimensão de grade', () => {
    expect(detectGridCountFromFilename('cenario_1920x1080.png')).toBeNull()
  })

  it('rejeita par que passa no lookaround mas estoura MAX_DETECTED_DIMENSION', () => {
    expect(detectGridCountFromFilename('banner_800x600.jpg')).toBeNull()
    expect(MAX_DETECTED_DIMENSION).toBe(200)
  })

  it('devolve null quando não há padrão NxM no nome', () => {
    expect(detectGridCountFromFilename('mapa-da-masmorra-final.png')).toBeNull()
  })

  it('devolve null para string vazia', () => {
    expect(detectGridCountFromFilename('')).toBeNull()
  })
})

describe('wrapGridOffset', () => {
  it('mantém offset já dentro de [0, cellSize) inalterado', () => {
    expect(wrapGridOffset({ x: 10, y: 20 }, 64)).toEqual({ x: 10, y: 20 })
  })

  it('enrola offset positivo maior que cellSize para dentro da faixa', () => {
    expect(wrapGridOffset({ x: 70, y: 130 }, 64)).toEqual({ x: 6, y: 2 })
  })

  it('enrola offset negativo para o lado positivo (sem sobrar resto negativo do "%")', () => {
    expect(wrapGridOffset({ x: -10, y: -64 }, 64)).toEqual({ x: 54, y: 0 })
  })

  it('devolve o offset sem tocar quando cellSize <= 0', () => {
    expect(wrapGridOffset({ x: 999, y: -999 }, 0)).toEqual({ x: 999, y: -999 })
  })
})

describe('computeAlignedGridLines', () => {
  const viewport = { left: 0, top: 0, right: 100, bottom: 100 }

  it('com offset (0,0) produz as mesmas posições que a grade sem offset (0, 50, 100, ...)', () => {
    const lines = computeAlignedGridLines(50, { x: 0, y: 0 }, viewport)
    const xPositions = lines.filter((l) => l.axis === 'x').map((l) => l.position)
    expect(xPositions).toEqual([0, 50, 100])
  })

  it('desloca as linhas pelo offset informado', () => {
    const lines = computeAlignedGridLines(50, { x: 10, y: 0 }, viewport)
    const xPositions = lines.filter((l) => l.axis === 'x').map((l) => l.position)
    // Mesmo over-render de margem que computeVisibleGridLines (grid.ts): o
    // laço vai até viewport.right + cellSize independente do offset, então
    // aqui a última linha alinhada antes desse teto é 110 (-40 + 3*50) —
    // 10px além de viewport.right=100, ainda dentro de uma célula de folga.
    // Sem offset o lattice cai exatamente em 100 (múltiplo de 50) e não sobra
    // linha extra; com offset=10 o lattice desloca e 110 entra na folga.
    expect(xPositions).toEqual([-40, 10, 60, 110])
  })

  it('cellSize <= 0 devolve lista vazia, mesma guarda de computeVisibleGridLines', () => {
    expect(computeAlignedGridLines(0, { x: 0, y: 0 }, viewport)).toEqual([])
    expect(computeAlignedGridLines(-5, { x: 0, y: 0 }, viewport)).toEqual([])
  })
})
