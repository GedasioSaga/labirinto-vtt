import { describe, expect, it } from 'vitest'
import { seatTokenCenter, selectedTokenSize, TOKEN_SIZE_DEFAULT, tokenSizeInSquares } from './tokenSize'

const GRID = 64

/** Centro de célula na grade de 64: 32 + 64k — é o que `snapToGridCenter` devolve. */
const CENTRO_DA_CELULA = { x: 736, y: 416 }

function token(size: unknown): { size?: unknown } {
  return { size }
}

describe('tokenSizeInSquares', () => {
  it('devolve o tamanho gravado', () => {
    expect(tokenSizeInSquares(token(2))).toBe(2)
    expect(tokenSizeInSquares(token(1.37))).toBe(1.37)
  })

  it('CAMPO AUSENTE: token sem size (mapa antigo, token montado por spec) sai com o tamanho de fábrica', () => {
    // `{}` é o que chega de um arquivo salvo antes deste campo, e `undefined`
    // é o `find()` que não achou o token arrastado.
    expect(tokenSizeInSquares({})).toBe(TOKEN_SIZE_DEFAULT)
    expect(tokenSizeInSquares(undefined)).toBe(TOKEN_SIZE_DEFAULT)
  })

  it('size corrompido (texto, NaN, zero, negativo) cai no de fábrica em vez de virar raio NaN no Pixi', () => {
    expect(tokenSizeInSquares(token('2'))).toBe(TOKEN_SIZE_DEFAULT)
    expect(tokenSizeInSquares(token(Number.NaN))).toBe(TOKEN_SIZE_DEFAULT)
    expect(tokenSizeInSquares(token(0))).toBe(TOKEN_SIZE_DEFAULT)
    expect(tokenSizeInSquares(token(-3))).toBe(TOKEN_SIZE_DEFAULT)
  })
})

describe('selectedTokenSize', () => {
  it('marca o botão do painel quando o tamanho é um dos três', () => {
    expect(selectedTokenSize(token(1))).toBe(1)
    expect(selectedTokenSize(token(2))).toBe(2)
    expect(selectedTokenSize(token(3))).toBe(3)
  })

  it('não marca nada quando a ficha foi esticada pela alça de canto', () => {
    expect(selectedTokenSize(token(1.37))).toBeNull()
    expect(selectedTokenSize(token(4))).toBeNull()
  })
})

describe('seatTokenCenter — onde a ficha grande assenta', () => {
  it('lado ÍMPAR continua no centro da célula: devolve o ponto já snapado, intacto', () => {
    const snapped = { ...CENTRO_DA_CELULA }
    expect(seatTokenCenter({ x: 730, y: 410 }, snapped, GRID, 1)).toEqual(CENTRO_DA_CELULA)
    expect(seatTokenCenter({ x: 730, y: 410 }, snapped, GRID, 3)).toEqual(CENTRO_DA_CELULA)
  })

  it('lado PAR vai para a LINHA da grade, e cobre 2 células inteiras para cada lado', () => {
    const assentado = seatTokenCenter({ x: 730, y: 410 }, { ...CENTRO_DA_CELULA }, GRID, 2)
    expect(assentado).toEqual({ x: 704, y: 384 })
    // A prova de que "assenta em quadrado": as bordas do disco caem em linha
    // de grade, não no meio de célula nenhuma.
    expect((assentado.x - (GRID * 2) / 2) % GRID).toBe(0)
    expect((assentado.y + (GRID * 2) / 2) % GRID).toBe(0)
  })

  it('o lado PAR sai do ponto CRU, não do já-snapado: snapar duas vezes empurraria sempre meia célula para o mesmo lado', () => {
    // O centro de célula (736) fica exatamente no meio entre 704 e 768;
    // arredondá-lo iria sempre para 768, longe do ponteiro em 730.
    expect(seatTokenCenter({ x: 730, y: 410 }, { x: 736, y: 416 }, GRID, 2).x).toBe(704)
    expect(seatTokenCenter({ x: 745, y: 410 }, { x: 736, y: 416 }, GRID, 2).x).toBe(768)
  })

  it('tamanho fracionário não é par nem ímpar: segue o snap de sempre', () => {
    expect(seatTokenCenter({ x: 730, y: 410 }, { ...CENTRO_DA_CELULA }, GRID, 1.37)).toEqual(CENTRO_DA_CELULA)
  })

  it('grade de lado zero não divide por zero: devolve o snap recebido', () => {
    expect(seatTokenCenter({ x: 730, y: 410 }, { ...CENTRO_DA_CELULA }, 0, 2)).toEqual(CENTRO_DA_CELULA)
  })
})
