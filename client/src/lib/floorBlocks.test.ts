import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import {
  areaFechadaAPartirDe,
  blocoNoPonto,
  blocosBounds,
  blocosDistance,
  blocosDoPincel,
  blocosDoTraco,
  buildBlocosShape,
  centroDoBloco,
  chaveDoBloco,
  clampTamanhoDePincel,
  moveBlocos,
  tirarBlocosDasPecas,
  type Bloco,
} from './floorBlocks'
import { apagarBlocosDoChao, baldeNoPonto } from './floorTool'
import { compileFloor } from './floorSdf'

const CELL = 64

function blocos(shapeCells: [number, number][]): Bloco[] {
  return shapeCells.map(([col, row]) => ({ col, row }))
}

function forma(cells: [number, number][], cell = CELL) {
  const shape = buildBlocosShape(cell, blocos(cells))
  if (!shape) throw new Error('forma sem célula nenhuma')
  return shape
}

describe('pincel de blocos — quais células o gesto toca', () => {
  it('a célula sai do ponto BRUTO, não do centro: o canto da célula pinta igual ao meio', () => {
    // É o que separa "preso à grade" de "fita centrada no ponteiro": dois
    // pontos bem distantes um do outro dentro da mesma célula dão a mesma.
    expect(blocoNoPonto(6 * CELL + 1, 5 * CELL + 1, CELL)).toEqual({ col: 6, row: 5 })
    expect(blocoNoPonto(6 * CELL + 63, 5 * CELL + 63, CELL)).toEqual({ col: 6, row: 5 })
    // CONTROLE POSITIVO: 1px depois da borda já é a célula seguinte.
    expect(blocoNoPonto(7 * CELL, 5 * CELL, CELL)).toEqual({ col: 7, row: 5 })
  })

  it('tamanho 1 pinta só a célula sob o ponteiro; 3 pinta o quadrado 3×3 em volta dela', () => {
    expect(blocosDoPincel(6.5 * CELL, 5.5 * CELL, CELL, 1)).toEqual([{ col: 6, row: 5 }])

    const tres = blocosDoPincel(6.5 * CELL, 5.5 * CELL, CELL, 3)
    expect(tres).toHaveLength(9)
    expect(tres).toContainEqual({ col: 5, row: 4 })
    expect(tres).toContainEqual({ col: 6, row: 5 })
    expect(tres).toContainEqual({ col: 7, row: 6 })
    // CONTROLE POSITIVO: o 3×3 não vaza para a quarta coluna.
    expect(tres).not.toContainEqual({ col: 8, row: 5 })
  })

  it('tamanho 2 não tem centro possível: a célula do ponteiro é o canto de cima à esquerda', () => {
    const dois = blocosDoPincel(6.5 * CELL, 5.5 * CELL, CELL, 2)
    expect(dois).toHaveLength(4)
    expect(dois).toContainEqual({ col: 6, row: 5 })
    expect(dois).toContainEqual({ col: 7, row: 6 })
    expect(dois).not.toContainEqual({ col: 5, row: 5 })
  })

  it('o traço entre dois pointermove distantes não deixa buraco', () => {
    // 6 células de distância num salto só — é o que um arrasto rápido entrega.
    const tocadas = blocosDoTraco({ x: 6.5 * CELL, y: 5.5 * CELL }, { x: 12.5 * CELL, y: 5.5 * CELL }, CELL, 1)
    const colunas = new Set(tocadas.map((b) => b.col))
    for (let col = 6; col <= 12; col += 1) expect(colunas.has(col), `coluna ${col} ficou sem chão`).toBe(true)
    // CONTROLE POSITIVO: o traço não inventa coluna além do fim nem linha vizinha.
    expect(colunas.has(13)).toBe(false)
    expect(new Set(tocadas.map((b) => b.row))).toEqual(new Set([5]))
  })

  it('o tamanho do pincel é sempre 1, 2 ou 3, venha o que vier do arquivo salvo', () => {
    expect(clampTamanhoDePincel(0)).toBe(1)
    expect(clampTamanhoDePincel(2)).toBe(2)
    expect(clampTamanhoDePincel(2.6)).toBe(3)
    expect(clampTamanhoDePincel(99)).toBe(3)
  })
})

describe('distância assinada da união de blocos', () => {
  it('é negativa dentro, positiva fora e ZERO só na borda externa — nunca na divisa entre duas células cheias', () => {
    const shape = forma([
      [0, 0],
      [1, 0],
    ])
    // A divisa interna fica em x = 64. Se ela valesse 0, o marching squares
    // (dentro = valor < 0) desenharia uma costura no meio do chão.
    expect(blocosDistance(shape, CELL, 0.5 * CELL)).toBeLessThan(0)
    expect(blocosDistance(shape, CELL, 0.5 * CELL)).toBeCloseTo(-CELL / 2, 5)
    // Borda externa de verdade: zero em cima dela, positivo depois.
    expect(blocosDistance(shape, 2 * CELL, 0.5 * CELL)).toBeCloseTo(0, 5)
    expect(blocosDistance(shape, 2 * CELL + 10, 0.5 * CELL)).toBeCloseTo(10, 5)
    expect(blocosDistance(shape, -10, 0.5 * CELL)).toBeCloseTo(10, 5)
  })

  it('o retângulo da peça é o das células, sem folga', () => {
    expect(blocosBounds(forma([[2, 3]]))).toEqual({ minX: 128, minY: 192, maxX: 192, maxY: 256 })
  })

  it('mover anda em célula INTEIRA: meia célula de arrasto move uma, e a peça nunca sai da grade', () => {
    const shape = forma([[2, 3]])
    expect(moveBlocos(shape, CELL, -2 * CELL).cells).toEqual([{ col: 3, row: 1 }])
    expect(moveBlocos(shape, CELL * 0.6, 0).cells).toEqual([{ col: 3, row: 3 }])
    // CONTROLE POSITIVO: arrasto curto demais não move — e devolve a MESMA
    // referência, para o cache por referência do render não recalcular à toa.
    expect(moveBlocos(shape, 4, 4)).toBe(shape)
  })
})

describe('botão direito do pincel — apagar', () => {
  const pecaDeBlocos: FloorPiece = {
    id: 'traco',
    shape: forma([
      [6, 5],
      [7, 5],
      [8, 5],
    ]),
    op: 'add',
    modifiers: {},
  }

  it('tira as células da peça de blocos e some com a peça que fica vazia', () => {
    const sobrou = tirarBlocosDasPecas([pecaDeBlocos], blocos([[7, 5]]), CELL)
    expect(sobrou).not.toBeNull()
    expect(sobrou?.[0].shape).toMatchObject({ kind: 'blocos', cells: [{ col: 6, row: 5 }, { col: 8, row: 5 }] })

    const nada = tirarBlocosDasPecas([pecaDeBlocos], blocos([[6, 5], [7, 5], [8, 5]]), CELL)
    expect(nada).toEqual([])
  })

  it('apagar onde não havia chão devolve `null` — o gesto não gasta um Ctrl+Z', () => {
    expect(tirarBlocosDasPecas([pecaDeBlocos], blocos([[20, 20]]), CELL)).toBeNull()
    expect(apagarBlocosDoChao([pecaDeBlocos], blocos([[20, 20]]), CELL, () => 'novo')).toBeNull()
  })

  it('chão que veio de OUTRA forma (retângulo) só sai com um buraco', () => {
    const retangulo: FloorPiece = {
      id: 'sala',
      shape: { kind: 'rect', cx: 6.5 * CELL, cy: 5.5 * CELL, w: CELL, h: CELL },
      op: 'add',
      modifiers: {},
    }
    const centro = centroDoBloco({ col: 6, row: 5 }, CELL)
    // CONTROLE POSITIVO: antes de apagar, ali tem chão.
    expect(compileFloor([retangulo]).sample(centro.x, centro.y)).toBeLessThan(0)

    const depois = apagarBlocosDoChao([retangulo], blocos([[6, 5]]), CELL, () => 'buraco')
    expect(depois).not.toBeNull()
    expect(depois?.[1]).toMatchObject({ id: 'buraco', op: 'subtract', shape: { kind: 'blocos' } })
    expect(compileFloor(depois ?? []).sample(centro.x, centro.y)).toBeGreaterThan(0)
  })
})

describe('balde — só enche área fechada', () => {
  /** Anel de blocos: colunas 6..11 e linhas 4..9, miolo vazio. */
  function anel(): FloorPiece {
    const cells: [number, number][] = []
    for (let col = 6; col <= 11; col += 1) {
      cells.push([col, 4], [col, 9])
    }
    for (let row = 5; row <= 8; row += 1) {
      cells.push([6, row], [11, row])
    }
    return { id: 'anel', shape: forma(cells), op: 'add', modifiers: {} }
  }

  const mapa = (floor: FloorPiece[]) => ({ floor, grid: CELL, width: 30, height: 20 })

  it('clicar no miolo do anel enche o miolo inteiro e NADA fora dele', () => {
    const piece = baldeNoPonto(mapa([anel()]), centroDoBloco({ col: 8, row: 6 }, CELL), () => 'enchido')
    expect(piece).not.toBeNull()
    const compilado = compileFloor([anel(), ...(piece ? [piece] : [])])
    for (const [col, row] of [[7, 5], [8, 6], [10, 8]] as [number, number][]) {
      const c = centroDoBloco({ col, row }, CELL)
      expect(compilado.sample(c.x, c.y), `o balde não chegou em ${col},${row}`).toBeLessThan(0)
    }
    // CONTROLE POSITIVO: fora do anel continua vazio.
    for (const [col, row] of [[13, 6], [8, 11]] as [number, number][]) {
      const c = centroDoBloco({ col, row }, CELL)
      expect(compilado.sample(c.x, c.y), `o balde vazou para ${col},${row}`).toBeGreaterThan(0)
    }
  })

  it('clicar FORA do anel não enche nada: a área escapa pela borda do mapa', () => {
    expect(baldeNoPonto(mapa([anel()]), centroDoBloco({ col: 20, row: 15 }, CELL), () => 'x')).toBeNull()
  })

  it('clicar em cima de chão que já existe não enche nada', () => {
    expect(baldeNoPonto(mapa([anel()]), centroDoBloco({ col: 6, row: 4 }, CELL), () => 'x')).toBeNull()
  })

  it('a busca por área fechada para na borda do mapa, e não na primeira célula vazia', () => {
    // Sem nenhum chão, TUDO escapa — o teto de células nunca chega a ser testado.
    expect(areaFechadaAPartirDe(() => false, { col: 5, row: 5 }, 30, 20)).toBeNull()
    // Um buraco de 1 célula cercado por chão é a menor área fechada possível.
    const cercado = areaFechadaAPartirDe((col, row) => !(col === 5 && row === 5), { col: 5, row: 5 }, 30, 20)
    expect(cercado).toEqual([{ col: 5, row: 5 }])
  })
})

describe('chave de célula', () => {
  it('coluna e linha negativas não colidem com as positivas', () => {
    expect(chaveDoBloco(-1, 2)).not.toBe(chaveDoBloco(1, 2))
    expect(chaveDoBloco(1, -2)).not.toBe(chaveDoBloco(1, 2))
  })
})
