import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../types/map'
import {
  countExploredCells,
  createExploration,
  decodeExploration,
  encodeExploration,
  forEachExploredRun,
  isPointExplored,
  isShapeExplored,
  markAll,
  markRings,
  MAX_EXPLORED_CELLS,
  MAX_MEMORY_VERTICES,
  ringTouchesRect,
  type Exploration,
} from './exploration'

function square(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/** Círculo de `sides` lados: anel de visão de verdade tem dezenas de vértices, quadrado não exercita a simplificação. */
function circle(cx: number, cy: number, radius: number, sides = 48): RegionPoint[] {
  return Array.from({ length: sides }, (_unused, i) => {
    const angle = (i / sides) * Math.PI * 2
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
  })
}

/** Só o BITSET: as regras de célula inteira são cobradas aqui, sem passar pelo contorno lembrado. */
function celulaMarcada(exp: Exploration, x: number, y: number): boolean {
  const col = Math.floor(x / exp.cell)
  const row = Math.floor(y / exp.cell)
  let marcada = false
  forEachExploredRun(exp, (r, colStart, colEnd) => {
    if (r === row && col >= colStart && col < colEnd) marcada = true
  })
  return marcada
}

describe('markRings com zona oculta (A5)', () => {
  it('SEGURANÇA: célula que toca zona ativa nunca é marcada, mesmo inteira na visão', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 }) // célula 10
    const zone = square(100, 100, 200, 200)
    markRings(exp, [square(0, 0, 400, 400)], [zone])
    // Dentro, na borda de dentro e encostando por fora (célula 90..100 toca x=100): nada marcado.
    expect(isPointExplored(exp, { x: 150, y: 150 })).toBe(false)
    expect(isPointExplored(exp, { x: 105, y: 105 })).toBe(false)
    expect(isPointExplored(exp, { x: 95, y: 150 })).toBe(false)
    // Longe da zona continua marcado.
    expect(isPointExplored(exp, { x: 50, y: 50 })).toBe(true)
    expect(isPointExplored(exp, { x: 85, y: 150 })).toBe(true)
    expect(isPointExplored(exp, { x: 350, y: 350 })).toBe(true)
    // 40×40 células; a zona com a borda de 1 célula para cada lado ocupa 12×12.
    expect(countExploredCells(exp)).toBe(40 * 40 - 12 * 12)
  })

  it('sem zona, marca igual a antes', () => {
    const a = createExploration({ width: 400, height: 400, grid: 40 })
    const b = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(a, [square(0, 0, 400, 400)])
    markRings(b, [square(0, 0, 400, 400)], [])
    expect(Array.from(b.bits)).toEqual(Array.from(a.bits))
  })

  it('ringTouchesRect: cruza, contém, está contido e fica de fora', () => {
    expect(ringTouchesRect(square(0, 0, 100, 100), 90, 90, 110, 110)).toBe(true) // aresta cruza
    expect(ringTouchesRect(square(0, 0, 100, 100), 40, 40, 50, 50)).toBe(true) // retângulo dentro
    expect(ringTouchesRect(square(40, 40, 50, 50), 0, 0, 100, 100)).toBe(true) // polígono dentro
    expect(ringTouchesRect(square(0, 0, 100, 100), 101, 0, 120, 20)).toBe(false) // separado
  })
})

describe('markAll (B3, Revelar planta)', () => {
  it('marca todas as células, até as da borda do mapa', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    markAll(exp)
    expect(countExploredCells(exp)).toBe(40 * 40)
  })

  it('SEGURANÇA: pula célula que toca zona ativa, igual ao markRings', () => {
    const viaAll = createExploration({ width: 400, height: 400, grid: 40 })
    const viaRings = createExploration({ width: 400, height: 400, grid: 40 })
    const zone = square(100, 100, 200, 200)
    markAll(viaAll, [zone])
    markRings(viaRings, [square(0, 0, 400, 400)], [zone])
    expect(isPointExplored(viaAll, { x: 150, y: 150 })).toBe(false)
    expect(Array.from(viaAll.bits)).toEqual(Array.from(viaRings.bits))
  })
})

describe('createExploration', () => {
  it('célula = grid/4, com mínimo de 8 px', () => {
    expect(createExploration({ width: 1000, height: 500, grid: 40 })).toMatchObject({ cell: 10, cols: 100, rows: 50 })
    expect(createExploration({ width: 100, height: 100, grid: 20 })).toMatchObject({ cell: 8, cols: 13, rows: 13 })
  })

  it('mapa gigante engrossa a célula para caber no teto de células', () => {
    const exp = createExploration({ width: 200_000, height: 200_000, grid: 40 })
    expect(exp.cols * exp.rows).toBeLessThanOrEqual(MAX_EXPLORED_CELLS)
    expect(exp.bits.length).toBe(Math.ceil((exp.cols * exp.rows) / 8))
  })

  it('começa sem nada explorado', () => {
    expect(countExploredCells(createExploration({ width: 400, height: 400, grid: 40 }))).toBe(0)
  })
})

describe('markRings', () => {
  it('marca só as células inteiras dentro do anel', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, [square(100, 100, 200, 200)])
    expect(countExploredCells(exp)).toBe(100)
    expect(isPointExplored(exp, { x: 150, y: 150 })).toBe(true)
    expect(isPointExplored(exp, { x: 100, y: 100 })).toBe(true)
    expect(isPointExplored(exp, { x: 205, y: 150 })).toBe(false)
    expect(isPointExplored(exp, { x: 95, y: 150 })).toBe(false)
  })

  it('célula com centro dentro mas canto fora do anel não é marcada NO BITSET', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    // Anel de 104 a 196: as células das bordas (100-110 e 190-200) têm o centro dentro, mas não inteiras.
    markRings(exp, [square(104, 104, 196, 196)])
    expect(countExploredCells(exp)).toBe(64)
    expect(celulaMarcada(exp, 105, 150)).toBe(false)
    expect(celulaMarcada(exp, 150, 195)).toBe(false)
    expect(celulaMarcada(exp, 115, 150)).toBe(true)
    // A faixa que o bitset perde continua explorada pelo contorno lembrado: é o que o jogador viu.
    expect(isPointExplored(exp, { x: 105, y: 150 })).toBe(true)
    expect(isPointExplored(exp, { x: 150, y: 195 })).toBe(true)
    expect(isPointExplored(exp, { x: 102, y: 150 })).toBe(false)
  })

  it('triângulo: célula cortada pela hipotenusa não é marcada NO BITSET', () => {
    const exp = createExploration({ width: 100, height: 100, grid: 40 })
    markRings(exp, [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }]])
    // Célula [40,50]x[40,50]: canto (50,50) está sobre a hipotenusa x+y=100, os demais dentro; (45,45) dentro.
    expect(celulaMarcada(exp, 45, 45)).toBe(true)
    // Célula [50,60]x[40,50]: centro (55,45) dentro, canto (60,50) fora.
    expect(celulaMarcada(exp, 55, 45)).toBe(false)
    // Mas (54,45) está dentro do triângulo que ele viu: o contorno lembra.
    expect(celulaMarcada(exp, 54, 45)).toBe(false)
    expect(isPointExplored(exp, { x: 54, y: 45 })).toBe(true)
    expect(isPointExplored(exp, { x: 60, y: 45 })).toBe(false)
  })

  it('acumula anéis e ignora anel degenerado ou fora do mapa', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, [square(0, 0, 50, 50), [{ x: 1, y: 1 }, { x: 2, y: 2 }]])
    markRings(exp, [square(500, 500, 550, 550), square(2000, 2000, 3000, 3000)])
    expect(countExploredCells(exp)).toBe(50)
    expect(isPointExplored(exp, { x: 25, y: 25 })).toBe(true)
    expect(isPointExplored(exp, { x: 525, y: 525 })).toBe(true)
  })

  it('polígono côncavo (L) não marca o vão', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    const ele = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ]
    markRings(exp, [ele])
    expect(isPointExplored(exp, { x: 25, y: 75 })).toBe(true)
    expect(isPointExplored(exp, { x: 75, y: 25 })).toBe(true)
    expect(isPointExplored(exp, { x: 75, y: 75 })).toBe(false)
  })
})

describe('isPointExplored / isShapeExplored', () => {
  it('fora do mapa ou coordenada não finita é falso', () => {
    const exp = createExploration({ width: 100, height: 100, grid: 40 })
    markRings(exp, [square(0, 0, 100, 100)])
    expect(isPointExplored(exp, { x: -1, y: 10 })).toBe(false)
    expect(isPointExplored(exp, { x: 10, y: 100 })).toBe(false)
    expect(isPointExplored(exp, { x: Number.NaN, y: 10 })).toBe(false)
  })

  it('forma explorada se algum ponto amostrado estiver explorado', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, [square(0, 0, 100, 100)])
    expect(isShapeExplored(exp, [{ x: 900, y: 900 }, { x: 50, y: 50 }])).toBe(true)
    expect(isShapeExplored(exp, [{ x: 900, y: 900 }])).toBe(false)
    expect(isShapeExplored(exp, [])).toBe(false)
  })
})

describe('contorno lembrado (memória com a mesma borda que o jogador viu)', () => {
  /** Ponto na faixa que o bitset perde: dentro do anel, mas na célula que ele corta. */
  const NA_FRANJA = { x: 200, y: 113 }

  it('guarda o contorno do anel e a franja da borda conta como explorada', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 }) // célula 10
    markRings(exp, [circle(200, 200, 90)])
    expect(exp.rings.length).toBe(1)
    expect(celulaMarcada(exp, NA_FRANJA.x, NA_FRANJA.y)).toBe(false)
    expect(isPointExplored(exp, NA_FRANJA)).toBe(true)
    // Fora do anel continua fora, e fora do mapa também.
    expect(isPointExplored(exp, { x: 200, y: 105 })).toBe(false)
    expect(isPointExplored(exp, { x: 200, y: 400 })).toBe(false)
  })

  it('SEGURANÇA: anel que encosta em área proibida não vira contorno; vale só o bitset conservador', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(exp, [circle(200, 200, 90)], [square(250, 250, 340, 340)])
    expect(exp.rings).toEqual([])
    expect(isPointExplored(exp, NA_FRANJA)).toBe(false)
    expect(isPointExplored(exp, { x: 200, y: 200 })).toBe(true)
    // Zona longe do anel não atrapalha: o contorno volta a ser guardado.
    const longe = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(longe, [circle(100, 100, 40)], [square(250, 250, 340, 340)])
    expect(longe.rings.length).toBe(1)
  })

  it('anel repetido ou contido em outro não é guardado de novo', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(exp, [circle(200, 200, 90)])
    const depoisDoPrimeiro = exp.ringVertices
    markRings(exp, [circle(200, 200, 90)]) // mesmo anel: o snapshot é remarcado a cada mudança do mestre
    markRings(exp, [circle(200, 200, 40)]) // contido no primeiro
    expect(exp.rings.length).toBe(1)
    expect(exp.ringVertices).toBe(depoisDoPrimeiro)
    markRings(exp, [circle(200, 200, 120)]) // maior: borda nova, entra
    expect(exp.rings.length).toBe(2)
  })

  it('teto de vértices: o contorno para de crescer e o bitset continua marcando', () => {
    const exp = createExploration({ width: 4000, height: 4000, grid: 40 })
    for (let i = 0; i < 700; i += 1) markRings(exp, [circle(120 + (i % 26) * 150, 120 + Math.floor(i / 26) * 150, 80)])
    expect(exp.ringVertices).toBeLessThanOrEqual(MAX_MEMORY_VERTICES)
    expect(exp.ringVertices).toBeGreaterThan(MAX_MEMORY_VERTICES - 200)
    const antes = exp.rings.length
    markRings(exp, [circle(3900, 3900, 80)])
    expect(exp.rings.length).toBe(antes) // cheio: não entra mais contorno
    expect(celulaMarcada(exp, 3900, 3900)).toBe(true) // mas o jogador não perde a memória
  })
})

describe('encode/decode', () => {
  it('ida e volta preserva células e dimensões', () => {
    const exp = createExploration({ width: 1234, height: 567, grid: 50 })
    markRings(exp, [square(13, 17, 400, 300), square(900, 100, 1200, 560)])
    const wire = encodeExploration(exp)
    const back = decodeExploration(JSON.parse(JSON.stringify(wire)))
    expect(back).not.toBeNull()
    expect(back).toMatchObject({ cell: exp.cell, cols: exp.cols, rows: exp.rows })
    expect(Array.from(back?.bits ?? [])).toEqual(Array.from(exp.bits))
    expect(countExploredCells(back ?? createExploration({ width: 1, height: 1, grid: 1 }))).toBe(countExploredCells(exp))
  })

  it('bitset grande (perto do teto) codifica sem estourar a pilha', () => {
    const exp = createExploration({ width: 8000, height: 8000, grid: 32 })
    markRings(exp, [square(0, 0, 8000, 8000)])
    const back = decodeExploration(encodeExploration(exp))
    expect(back?.bits.length).toBe(exp.bits.length)
    expect(countExploredCells(exp)).toBe(exp.cols * exp.rows)
  })

  it('contorno lembrado atravessa o fio sem perda', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(exp, [circle(200, 200, 90)])
    const back = decodeExploration(JSON.parse(JSON.stringify(encodeExploration(exp))))
    expect(back?.rings).toEqual(exp.rings)
    expect(back?.ringVertices).toBe(exp.ringVertices)
    expect(back && isPointExplored(back, { x: 200, y: 113 })).toBe(true)
  })

  it('COMPATIBILIDADE: fio antigo, sem contorno, continua sendo lido', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(exp, [circle(200, 200, 90)])
    const { rings: _rings, ...antigo } = encodeExploration(exp)
    const back = decodeExploration(antigo)
    expect(back?.rings).toEqual([])
    expect(back?.ringVertices).toBe(0)
    expect(Array.from(back?.bits ?? [])).toEqual(Array.from(exp.bits))
    expect(back && isPointExplored(back, { x: 200, y: 200 })).toBe(true)
  })

  const valid = encodeExploration(createExploration({ width: 80, height: 80, grid: 40 }))
  /** Monta o campo `rings` do fio na mão: inteiros de 16 bits little-endian, como `encodeRings`. */
  function ringsNoFio(valores: number[]): string {
    const bytes = new Uint8Array(valores.length * 2)
    const view = new DataView(bytes.buffer)
    valores.forEach((v, i) => view.setInt16(i * 2, v, true))
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
  }

  it('aceita contorno bem formado montado na mão', () => {
    const back = decodeExploration({ ...valid, rings: ringsNoFio([3, 0, 0, 20, 0, 0, 20]) })
    expect(back?.rings).toEqual([{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }], minX: 0, minY: 0, maxX: 10, maxY: 10 }])
  })

  it.each([
    ['rings não é string', { ...valid, rings: 7 }],
    ['rings com caractere fora do base64', { ...valid, rings: ringsNoFio([3, 0, 0, 20, 0, 0, 20]).replace(/^./, '*') }],
    // 9 inteiros = 18 bytes, múltiplo de 3: o base64 sai sem padding e o 'AAAA' vira sobra de verdade.
    ['rings com sobra no fim', { ...valid, rings: `${ringsNoFio([4, 0, 0, 20, 0, 20, 20, 0, 20])}AAAA` }],
    ['anel com menos de 3 vértices', { ...valid, rings: ringsNoFio([2, 0, 0, 20, 0]) }],
    ['anel que promete mais vértices do que tem', { ...valid, rings: ringsNoFio([4, 0, 0, 20, 0, 0, 20]) }],
    ['contorno acima do teto de vértices', { ...valid, rings: ringsNoFio([MAX_MEMORY_VERTICES + 1, ...Array((MAX_MEMORY_VERTICES + 1) * 2).fill(0)]) }],
  ])('rejeita contorno corrompido: %s', (_label, wire) => {
    expect(decodeExploration(wire)).toBeNull()
  })

  it.each([
    ['null', null],
    ['string', 'abc'],
    ['array', [valid]],
    ['cell zero', { ...valid, cell: 0 }],
    ['cell NaN', { ...valid, cell: Number.NaN }],
    ['cell string', { ...valid, cell: '10' }],
    ['cols fracionário', { ...valid, cols: 7.5 }],
    ['rows negativo', { ...valid, rows: -8 }],
    ['cols*rows acima do teto', { cell: 10, cols: 1001, rows: 1000, bits: 'A'.repeat(Math.ceil(125_125 / 3) * 4) }],
    ['bits ausente', { cell: valid.cell, cols: valid.cols, rows: valid.rows }],
    ['bits curto', { ...valid, bits: valid.bits.slice(4) }],
    ['bits longo', { ...valid, bits: `${valid.bits}AAAA` }],
    ['bits com caractere fora do base64', { ...valid, bits: `*${valid.bits.slice(1)}` }],
    ['bits com padding a mais', { ...valid, bits: `${valid.bits.slice(0, -3)}===` }],
  ])('rejeita payload corrompido: %s', (_label, wire) => {
    expect(decodeExploration(wire)).toBeNull()
  })
})

describe('forEachExploredRun', () => {
  it('agrupa células contíguas por linha, com colEnd exclusivo', () => {
    const exp = createExploration({ width: 80, height: 16, grid: 32 })
    // cell 8: 10 colunas × 2 linhas. Linha 0: cols 1-3 e 6-9; linha 1: nada.
    markRings(exp, [square(8, 0, 32, 8), square(48, 0, 80, 8)])
    const runs: [number, number, number][] = []
    forEachExploredRun(exp, (row, colStart, colEnd) => runs.push([row, colStart, colEnd]))
    expect(runs).toEqual([
      [0, 1, 4],
      [0, 6, 10],
    ])
  })
})

/**
 * FIO DOURADO — a memória serializada precisa continuar LEGÍVEL por quem já
 * gravou um mapa, não só de acordo consigo mesma.
 *
 * POR QUE EXISTE. Todo o bloco `encode/decode` acima é ida-e-volta: ele compara
 * o `decode` do `encode` do próprio processo. Trocar a ordem dos bits nos DOIS
 * lados (exploration.ts:57 `1 << (index & 7)` e :63) mantém os dois de acordo
 * entre si e deixa a suíte inteira verde — medido em 17/09/2026: o formato de
 * fio foi mutado e os 2096 testes passaram, com todo mapa antigo virando névoa
 * embaralhada. A Invariante 3 da bar não tinha comando nenhum.
 *
 * Aqui o valor é LITERAL nas duas direções: o `bits` escrito é o base64 exato
 * que a versão em produção grava, e a leitura parte de uma string escrita à mão
 * neste arquivo, nunca de um `encodeExploration`. Qualquer mudança na ordem dos
 * bits, no passo da célula, na origem do índice ou no empacotamento em bytes
 * derruba um destes testes.
 *
 * Como recalcular de propósito (só ao MUDAR o formato de propósito, o que
 * quebra todo mapa salvo): rode o encode e copie o `bits` de volta para cá.
 */
const FIO_DOURADO = {
  /** Um só bloco explorado, alinhado ao byte: pega ordem de linha e valor do bit. */
  simples: {
    mapa: { width: 64, height: 32, grid: 32 },
    visao: square(0, 0, 32, 16),
    wire: { cell: 8, cols: 8, rows: 4, bits: 'Dw8AAA==' },
    celulas: 8,
    runs: [
      [0, 0, 4],
      [1, 0, 4],
    ] as [number, number, number][],
  },
  /**
   * 10 colunas: o trecho explorado ATRAVESSA a fronteira do byte (índices 6..9),
   * então o teste também cobra o empacotamento `índice >> 3` / `índice & 7`.
   * Bytes: 0xCE, 0x03, 0x00.
   */
  atravessaByte: {
    mapa: { width: 80, height: 16, grid: 32 },
    visao: [square(8, 0, 32, 8), square(48, 0, 80, 8)],
    wire: { cell: 8, cols: 10, rows: 2, bits: 'zgMA' },
    celulas: 7,
    runs: [
      [0, 1, 4],
      [0, 6, 10],
    ] as [number, number, number][],
  },
}

/**
 * Só os quatro campos que existem desde o primeiro mapa salvo. Campo NOVO no
 * fio é evolução PERMITIDA (quem já gravou continua lendo); o que a Invariante
 * 3 proíbe é campo antigo mudar de significado. Por isso a comparação é sobre
 * este recorte, e não sobre o objeto inteiro: uma peça que acrescente, por
 * exemplo, os contornos dos anéis ao fio não é derrubada por este teste, mas
 * continua presa a estes quatro valores.
 */
function camposAntigos(wire: { cell: number; cols: number; rows: number; bits: string }) {
  return { cell: wire.cell, cols: wire.cols, rows: wire.rows, bits: wire.bits }
}

describe('formato de fio (Invariante 3: mapa antigo continua abrindo)', () => {
  it('encodeExploration grava exatamente o fio dourado simples', () => {
    const exp = createExploration(FIO_DOURADO.simples.mapa)
    markRings(exp, [FIO_DOURADO.simples.visao])
    expect(camposAntigos(encodeExploration(exp))).toEqual(FIO_DOURADO.simples.wire)
  })

  it('encodeExploration grava exatamente o fio dourado que atravessa o byte', () => {
    const exp = createExploration(FIO_DOURADO.atravessaByte.mapa)
    markRings(exp, FIO_DOURADO.atravessaByte.visao)
    expect(camposAntigos(encodeExploration(exp))).toEqual(FIO_DOURADO.atravessaByte.wire)
  })

  it.each([
    ['simples', FIO_DOURADO.simples],
    ['atravessa byte', FIO_DOURADO.atravessaByte],
  ])('decodeExploration lê o fio gravado por uma versão anterior: %s', (_nome, dourado) => {
    // Entra a string LITERAL, sem passar por encodeExploration: é assim que um
    // mapa salvo em outro dia chega.
    const lido = decodeExploration(JSON.parse(JSON.stringify(dourado.wire)))
    expect(lido).not.toBeNull()
    if (lido === null) return
    expect({ cell: lido.cell, cols: lido.cols, rows: lido.rows }).toEqual({
      cell: dourado.wire.cell,
      cols: dourado.wire.cols,
      rows: dourado.wire.rows,
    })
    expect(countExploredCells(lido)).toBe(dourado.celulas)
    const runs: [number, number, number][] = []
    forEachExploredRun(lido, (row, colStart, colEnd) => runs.push([row, colStart, colEnd]))
    expect(runs).toEqual(dourado.runs)
  })

  it('o fio dourado lido cai nas MESMAS células do mapa, não só no mesmo bitset', () => {
    const lido = decodeExploration(FIO_DOURADO.simples.wire)
    expect(lido).not.toBeNull()
    if (lido === null) return
    // Dentro do bloco explorado (0,0)-(32,16), em px de mundo.
    expect(isPointExplored(lido, { x: 4, y: 4 })).toBe(true)
    expect(isPointExplored(lido, { x: 28, y: 12 })).toBe(true)
    // Fora dele: à direita e abaixo. Se a ordem dos bits virar coluna-primeiro,
    // um destes acende.
    expect(isPointExplored(lido, { x: 36, y: 4 })).toBe(false)
    expect(isPointExplored(lido, { x: 4, y: 20 })).toBe(false)
  })
})
