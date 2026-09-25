/**
 * CONTORNO LEMBRADO EM MAPA MUITO GRANDE — acima de 16.383 px de mundo o anel
 * de visão não cabia no inteiro de 16 bits de meio pixel do fio e era
 * descartado: sobrava só o bitset conservador, e a borda da memória voltava a
 * ser a escadinha da célula (o a09-blocos tem 34.176 px de largura; 1.019 das
 * 2.834 salas ficavam além do limite).
 *
 * Agora o anel além do limite vai no campo `ringsFar`, com a origem em inteiro
 * de 32 bits e os vértices como deslocamento de 16 bits a partir dela. O campo
 * antigo `rings` continua IGUAL byte a byte para quem cabe nele: mapa salvo
 * ontem abre do mesmo jeito.
 */
import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../types/map'
import {
  createExploration,
  decodeExploration,
  encodeExploration,
  forEachExploredRun,
  forgetBlocked,
  isPointExplored,
  markRings,
  MAX_MEMORY_VERTICES,
  mergeExploration,
  ringTouchesRect,
  type Exploration,
} from './exploration'

/** 40.000 × 2.000 px, grade 50: célula 12,5 px (3.200 × 160 células, abaixo do teto). */
const MAPA_GRANDE = { width: 40_000, height: 2_000, grid: 50 }
const RAIO = 200
/** Centro do anel bem além dos 16.383 px que cabiam no fio antigo. */
const LONGE = { x: 30_000, y: 1_000 }
/** Na faixa da borda: dentro do anel, mas numa célula que o anel corta (o bitset não a marca). */
const NA_BORDA = { x: LONGE.x + RAIO - 3, y: LONGE.y }

function square(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function circle(cx: number, cy: number, radius: number, sides = 96): RegionPoint[] {
  return Array.from({ length: sides }, (_unused, i) => {
    const angle = (i / sides) * Math.PI * 2
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
  })
}

/** Só o BITSET, sem passar pelo contorno lembrado. */
function celulaMarcada(exp: Exploration, x: number, y: number): boolean {
  const col = Math.floor(x / exp.cell)
  const row = Math.floor(y / exp.cell)
  let marcada = false
  forEachExploredRun(exp, (r, colStart, colEnd) => {
    if (r === row && col >= colStart && col < colEnd) marcada = true
  })
  return marcada
}

function lido(wire: unknown): Exploration {
  const exp = decodeExploration(wire)
  if (exp === null) throw new Error('explorado ilegível')
  return exp
}

describe('contorno lembrado em mapa acima de 16.383 px', () => {
  it('o anel além do limite vira contorno lembrado: a borda da memória é a do anel, não a da célula', () => {
    const exp = createExploration(MAPA_GRANDE)
    markRings(exp, [circle(LONGE.x, LONGE.y, RAIO)])
    expect(exp.rings.length).toBe(1)
    expect(exp.ringVertices).toBeGreaterThanOrEqual(3)
    // A faixa da borda só é memória por causa do contorno: o bitset não a tem.
    expect(celulaMarcada(exp, NA_BORDA.x, NA_BORDA.y)).toBe(false)
    expect(isPointExplored(exp, NA_BORDA)).toBe(true)
    // Fora do anel continua preto.
    expect(isPointExplored(exp, { x: LONGE.x + RAIO + 5, y: LONGE.y })).toBe(false)
  })

  it('atravessa o fio sem perda (JSON de ida e volta)', () => {
    const exp = createExploration(MAPA_GRANDE)
    markRings(exp, [circle(LONGE.x, LONGE.y, RAIO)])
    const back = lido(JSON.parse(JSON.stringify(encodeExploration(exp))))
    expect(back.rings).toEqual(exp.rings)
    expect(back.ringVertices).toBe(exp.ringVertices)
    expect(isPointExplored(back, NA_BORDA)).toBe(true)
    expect(isPointExplored(back, { x: LONGE.x + RAIO + 5, y: LONGE.y })).toBe(false)
  })

  it('anel que ATRAVESSA os 16.383 px (metade antes, metade depois) também fica', () => {
    const exp = createExploration(MAPA_GRANDE)
    markRings(exp, [circle(16_383, LONGE.y, RAIO)])
    expect(exp.rings.length).toBe(1)
    const back = lido(JSON.parse(JSON.stringify(encodeExploration(exp))))
    expect(back.rings).toEqual(exp.rings)
    expect(isPointExplored(back, { x: 16_383 + RAIO - 3, y: LONGE.y })).toBe(true)
    expect(isPointExplored(back, { x: 16_383 - RAIO + 3, y: LONGE.y })).toBe(true)
  })

  it('mapa pequeno grava o MESMO fio de antes: sem campo novo, e o campo antigo idêntico', () => {
    const pequeno = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(pequeno, [circle(200, 200, 90)])
    const fio = encodeExploration(pequeno)
    expect(fio.ringsFar).toBeUndefined()
    expect(Object.keys(fio).sort()).toEqual(['bits', 'cell', 'cols', 'rings', 'rows'])
    // Misturado com anel longe, o anel perto sai no campo antigo exatamente como antes.
    const soPerto = createExploration(MAPA_GRANDE)
    markRings(soPerto, [circle(500, LONGE.y, RAIO)])
    const misturado = createExploration(MAPA_GRANDE)
    markRings(misturado, [circle(500, LONGE.y, RAIO), circle(LONGE.x, LONGE.y, RAIO)])
    expect(misturado.rings.length).toBe(2)
    expect(encodeExploration(misturado).rings).toBe(encodeExploration(soPerto).rings)
    expect(typeof encodeExploration(misturado).ringsFar).toBe('string')
    const back = lido(encodeExploration(misturado))
    expect(back.rings.length).toBe(2)
    expect(back.ringVertices).toBe(misturado.ringVertices)
    expect(isPointExplored(back, NA_BORDA)).toBe(true)
    expect(isPointExplored(back, { x: 500 + RAIO - 3, y: LONGE.y })).toBe(true)
  })
})

describe('SEGURANÇA: o contorno longe segue as mesmas regras de área proibida', () => {
  /** Zona oculta ativa colada na borda direita do anel. */
  const ZONA = square(LONGE.x + RAIO - 50, LONGE.y - 50, LONGE.x + RAIO + 100, LONGE.y + 50)

  it('anel que encosta em zona oculta não é guardado, e nada dele vai pelo fio', () => {
    const exp = createExploration(MAPA_GRANDE)
    markRings(exp, [circle(LONGE.x, LONGE.y, RAIO)], [ZONA])
    expect(exp.rings).toEqual([])
    const back = lido(JSON.parse(JSON.stringify(encodeExploration(exp))))
    expect(back.rings).toEqual([])
    expect(encodeExploration(exp).ringsFar).toBeUndefined()
    // Dentro da zona: nem célula, nem contorno.
    expect(isPointExplored(back, { x: LONGE.x + RAIO - 10, y: LONGE.y })).toBe(false)
    // A borda do lado oposto também volta a ser só a do bitset (o anel inteiro saiu).
    expect(isPointExplored(back, { x: LONGE.x - RAIO + 3, y: LONGE.y })).toBe(false)
  })

  it('zona que aparece DEPOIS apaga o contorno longe (forgetBlocked)', () => {
    const exp = createExploration(MAPA_GRANDE)
    markRings(exp, [circle(LONGE.x, LONGE.y, RAIO)])
    expect(exp.rings.length).toBe(1)
    forgetBlocked(exp, [ZONA])
    expect(exp.rings).toEqual([])
    expect(exp.ringVertices).toBe(0)
    const back = lido(encodeExploration(exp))
    expect(back.rings).toEqual([])
    expect(isPointExplored(back, { x: LONGE.x - RAIO + 3, y: LONGE.y })).toBe(false)
  })

  it('memória herdada (mergeExploration) não traz o contorno longe que encosta em área proibida', () => {
    const ficha = createExploration(MAPA_GRANDE)
    markRings(ficha, [circle(LONGE.x, LONGE.y, RAIO), circle(LONGE.x - 5_000, LONGE.y, RAIO)])
    expect(ficha.rings.length).toBe(2)
    const jogador = createExploration(MAPA_GRANDE)
    mergeExploration(jogador, ficha, [ZONA])
    expect(jogador.rings.length).toBe(1)
    for (const r of lido(encodeExploration(jogador)).rings) {
      expect(ringTouchesRect(r.points, LONGE.x + RAIO - 50, LONGE.y - 50, LONGE.x + RAIO + 100, LONGE.y + 50)).toBe(false)
    }
  })
})

describe('campo ringsFar vindo da rede', () => {
  const valido = encodeExploration(createExploration(MAPA_GRANDE))

  /** Monta `ringsFar` na mão: por anel, [n Int16][origem x, y Int32][dx, dy Uint16]..., little-endian, meio pixel. */
  function ringsFarNoFio(aneis: { n: number; ox: number; oy: number; deltas: number[] }[], sobra = 0): string {
    const total = aneis.reduce((soma, a) => soma + 10 + a.deltas.length * 2, 0) + sobra
    const bytes = new Uint8Array(total)
    const view = new DataView(bytes.buffer)
    let at = 0
    for (const a of aneis) {
      view.setInt16(at, a.n, true)
      view.setInt32(at + 2, a.ox, true)
      view.setInt32(at + 6, a.oy, true)
      at += 10
      for (const d of a.deltas) {
        view.setUint16(at, d, true)
        at += 2
      }
    }
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
  }

  /** Campo antigo `rings` montado na mão: inteiros de 16 bits little-endian. */
  function ringsNoFio(valores: number[]): string {
    const bytes = new Uint8Array(valores.length * 2)
    const view = new DataView(bytes.buffer)
    valores.forEach((v, i) => view.setInt16(i * 2, v, true))
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
  }

  it('o teto combinado aceita exatamente MAX_MEMORY_VERTICES somando os dois campos', () => {
    const back = lido({
      ...valido,
      rings: ringsNoFio([3, 0, 0, 20, 0, 0, 20]),
      ringsFar: ringsFarNoFio([{ n: MAX_MEMORY_VERTICES - 3, ox: 0, oy: 0, deltas: Array((MAX_MEMORY_VERTICES - 3) * 2).fill(0) }]),
    })
    expect(back.ringVertices).toBe(MAX_MEMORY_VERTICES)
    expect(back.rings.length).toBe(2)
  })

  it('FIO LITERAL: lê o formato escrito à mão (origem de 32 bits + deslocamentos de 16 bits)', () => {
    // Origem (60.000, 2.000) meios pixels = (30.000, 1.000) px.
    const back = lido({ ...valido, ringsFar: ringsFarNoFio([{ n: 3, ox: 60_000, oy: 2_000, deltas: [0, 0, 20, 0, 0, 20] }]) })
    expect(back.rings).toEqual([
      {
        points: [
          { x: 30_000, y: 1_000 },
          { x: 30_010, y: 1_000 },
          { x: 30_000, y: 1_010 },
        ],
        minX: 30_000,
        minY: 1_000,
        maxX: 30_010,
        maxY: 1_010,
      },
    ])
    expect(back.ringVertices).toBe(3)
  })

  it('FIO LITERAL: grava exatamente este formato', () => {
    const exp = createExploration(MAPA_GRANDE)
    markRings(exp, [square(30_000, 1_000, 30_010, 1_010)])
    expect(encodeExploration(exp).ringsFar).toBe(
      ringsFarNoFio([{ n: 4, ox: 60_000, oy: 2_000, deltas: [0, 0, 20, 0, 20, 20, 0, 20] }]),
    )
  })

  it('ausente = memória só com o campo antigo, nunca erro', () => {
    const back = lido(valido)
    expect(back.rings).toEqual([])
    expect(back.ringVertices).toBe(0)
  })

  it.each([
    ['não é string', { ...valido, ringsFar: 7 }],
    ['caractere fora do base64', { ...valido, ringsFar: `*${ringsFarNoFio([{ n: 3, ox: 0, oy: 0, deltas: [0, 0, 20, 0, 0, 20] }]).slice(1)}` }],
    ['anel com menos de 3 vértices', { ...valido, ringsFar: ringsFarNoFio([{ n: 2, ox: 0, oy: 0, deltas: [0, 0, 20, 0] }]) }],
    ['anel que promete mais vértices do que tem', { ...valido, ringsFar: ringsFarNoFio([{ n: 4, ox: 0, oy: 0, deltas: [0, 0, 20, 0, 0, 20] }]) }],
    ['cabeçalho cortado no fim', { ...valido, ringsFar: ringsFarNoFio([{ n: 3, ox: 0, oy: 0, deltas: [0, 0, 20, 0, 0, 20] }], 4) }],
    [
      'acima do teto de vértices sozinho',
      {
        ...valido,
        ringsFar: ringsFarNoFio([
          { n: MAX_MEMORY_VERTICES - 2, ox: 0, oy: 0, deltas: Array((MAX_MEMORY_VERTICES - 2) * 2).fill(0) },
          { n: 3, ox: 0, oy: 0, deltas: Array(6).fill(0) },
        ]),
      },
    ],
    [
      // O teto é da memória inteira: 3 vértices no campo antigo + o resto no novo passa dele.
      'soma dos dois campos acima do teto de vértices',
      {
        ...valido,
        rings: ringsNoFio([3, 0, 0, 20, 0, 0, 20]),
        ringsFar: ringsFarNoFio([{ n: MAX_MEMORY_VERTICES - 2, ox: 0, oy: 0, deltas: Array((MAX_MEMORY_VERTICES - 2) * 2).fill(0) }]),
      },
    ],
  ])('rejeita ringsFar corrompido: %s', (_label, wire) => {
    expect(decodeExploration(wire)).toBeNull()
  })
})
