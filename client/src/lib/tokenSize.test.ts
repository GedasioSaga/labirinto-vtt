import { describe, expect, it } from 'vitest'
import {
  formatarTamanho,
  lerTamanhoDigitado,
  limitarTamanho,
  nomeDoTamanho,
  passoDoTamanho,
  seatTokenCenter,
  selectedTokenSize,
  TOKEN_SIZE_DEFAULT,
  tokenSizeInSquares,
} from './tokenSize'

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

  it('0,5 e 1,5 digitados assentam NO MEIO DA CASA: a borda do disco fica à mesma distância das duas linhas da casa', () => {
    for (const lado of [0.5, 1.5]) {
      const assentado = seatTokenCenter({ x: 745, y: 400 }, { ...CENTRO_DA_CELULA }, GRID, lado)
      expect(assentado).toEqual(CENTRO_DA_CELULA)
      const raio = (GRID * lado) / 2
      // Meia casa: 16 px de folga de cada lado dentro da casa. Casa e meia: 16 px para dentro de cada vizinha.
      expect(Math.abs(assentado.x - raio - 704)).toBe(Math.abs(768 - (assentado.x + raio)))
    }
    // E o lado que vira inteiro depois do arredondamento do campo (2,00) volta à regra do par: linha da grade.
    expect(seatTokenCenter({ x: 730, y: 410 }, { ...CENTRO_DA_CELULA }, GRID, limitarTamanho(2.001).casas)).toEqual({ x: 704, y: 384 })
  })

  it('grade de lado zero não divide por zero: devolve o snap recebido', () => {
    expect(seatTokenCenter({ x: 730, y: 410 }, { ...CENTRO_DA_CELULA }, 0, 2)).toEqual(CENTRO_DA_CELULA)
  })
})

describe('o campo do tamanho (pedido de 12/11/2026: "eu quero dizer o quanto tem que mudar")', () => {
  it('lê vírgula e ponto, mostra com vírgula, e o que sai de 0,25 a 6 casas vira o limite com um aviso curto', () => {
    expect(lerTamanhoDigitado('1,5')).toBe(1.5)
    expect(lerTamanhoDigitado(' 0.5 ')).toBe(0.5)
    expect(lerTamanhoDigitado(',5')).toBe(0.5)
    expect(lerTamanhoDigitado('2 casas')).toBe(2)
    for (const lixo of ['', 'dois', '1,5,2', '1..5', '--1']) expect(lerTamanhoDigitado(lixo), lixo).toBeNull()

    expect(formatarTamanho(1.5)).toBe('1,5')
    expect(formatarTamanho(0.25)).toBe('0,25')
    expect(formatarTamanho(2)).toBe('2')
    expect(formatarTamanho(1.3712)).toBe('1,37')
    expect([0.5, 1, 1.5, 2, 2.5].map(nomeDoTamanho)).toEqual(['0,5 casa', '1 casa', '1,5 casa', '2 casas', '2,5 casas'])

    expect(limitarTamanho(1.5)).toEqual({ casas: 1.5, aviso: null })
    expect(limitarTamanho(0.7 + 0.1)).toEqual({ casas: 0.8, aviso: null })
    expect(limitarTamanho(10)).toEqual({ casas: 6, aviso: 'Ficou 6 casas, o maior tamanho.' })
    expect(limitarTamanho(0.1)).toEqual({ casas: 0.25, aviso: 'Ficou 0,25 casa, o menor tamanho.' })
    expect(limitarTamanho(-1).casas).toBe(0.25)
  })

  it('− e + andam 0,1 casa; do 1,37 da alça vão ao décimo vizinho; nos limites param com o aviso', () => {
    expect(passoDoTamanho(1, 1)).toEqual({ casas: 1.1, aviso: null })
    expect(passoDoTamanho(1.5, -1)).toEqual({ casas: 1.4, aviso: null })
    expect(passoDoTamanho(0.7, 1).casas).toBe(0.8)
    expect(passoDoTamanho(1.37, 1).casas).toBe(1.4)
    expect(passoDoTamanho(1.37, -1).casas).toBe(1.3)
    expect(passoDoTamanho(0.25, 1).casas).toBe(0.3)
    expect(passoDoTamanho(0.3, -1)).toEqual({ casas: 0.25, aviso: 'Ficou 0,25 casa, o menor tamanho.' })
    expect(passoDoTamanho(6, 1)).toEqual({ casas: 6, aviso: 'Ficou 6 casas, o maior tamanho.' })
  })
})
