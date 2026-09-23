import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawRoomHandles, drawCornerHandle, cornerHandleRadius } from './drawRoomHandles'
import {
  SELECTION_COLOR,
  HANDLE_VISUAL_RADIUS,
  CORNER_HANDLE_RADIUS,
  CORNER_HANDLE_KEYLINE_WIDTH,
  CORNER_HANDLE_KEYLINE_COLOR,
} from './constants'
import type { RegionPoint } from '../types/map'

/**
 * Retângulos (`action: 'rect'` no path) e fills, na ordem em que foram
 * empilhados no GraphicsContext. O par (retângulo i, fill i) é uma peça do
 * chip: o motor do Pixi guarda o caminho e o fill como instruções separadas.
 */
function rectangulos(g: Graphics): Array<{ x: number; y: number; w: number; h: number }> {
  const lidos: Array<{ x: number; y: number; w: number; h: number }> = []
  for (const instruction of g.context.instructions) {
    if (instruction.action !== 'fill') continue
    const path = (instruction.data as { path?: { instructions?: Array<{ action: string; data: number[] }> } }).path
    for (const passo of path?.instructions ?? []) {
      if (passo.action !== 'rect') continue
      const [x, y, w, h] = passo.data
      lidos.push({ x, y, w, h })
    }
  }
  return lidos
}

function cores(g: Graphics): number[] {
  return g.context.instructions
    .filter((instruction) => instruction.action === 'fill')
    .map((instruction) => (instruction.data as { style: { color: number } }).style.color)
}

const QUADRADO: RegionPoint[] = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 200 },
  { x: 0, y: 200 },
]

describe('drawCornerHandle — o chip', () => {
  it('a faixa escura entra ANTES e por FORA; o amarelo entra depois, dentro dela', () => {
    const g = new Graphics()

    drawCornerHandle(g, 100, 50, CORNER_HANDLE_RADIUS)

    // A ordem é o recurso: quem entra primeiro fica por baixo e recorta o
    // contorno de seleção; quem entra depois fica por cima.
    expect(cores(g)).toEqual([CORNER_HANDLE_KEYLINE_COLOR, SELECTION_COLOR])

    const [faixa, chip] = rectangulos(g)
    const fora = CORNER_HANDLE_RADIUS + CORNER_HANDLE_KEYLINE_WIDTH
    expect(faixa).toEqual({ x: 100 - fora, y: 50 - fora, w: fora * 2, h: fora * 2 })
    expect(chip).toEqual({
      x: 100 - CORNER_HANDLE_RADIUS,
      y: 50 - CORNER_HANDLE_RADIUS,
      w: CORNER_HANDLE_RADIUS * 2,
      h: CORNER_HANDLE_RADIUS * 2,
    })

    // Sobra escura IGUAL nos quatro lados: é essa sobra que o olho lê como
    // "peça solta", e não como "a moldura engrossou aqui".
    expect(chip.x - faixa.x).toBe(CORNER_HANDLE_KEYLINE_WIDTH)
    expect(chip.y - faixa.y).toBe(CORNER_HANDLE_KEYLINE_WIDTH)
    expect(faixa.x + faixa.w - (chip.x + chip.w)).toBe(CORNER_HANDLE_KEYLINE_WIDTH)
    expect(faixa.y + faixa.h - (chip.y + chip.h)).toBe(CORNER_HANDLE_KEYLINE_WIDTH)
  })

  it('o chip é MAIS ESPESSO que a faixa dupla do contorno de seleção que passa por baixo', () => {
    // O contorno de seleção da sala é a parede (2 px no preset médio) mais
    // `SELECTION_OUTLINE_SCREEN_PX` (2) de amarelo de cada lado: 4 px de
    // amarelo visível, e era exatamente isso que a alça antiga (7 px, mesma
    // cor) NÃO superava — ela cabia inteira dentro dessa faixa. A jornada
    // `e2e/task-jornada-selecao-mostra-alcas.spec.ts` cobra o dobro, em pixel
    // na tela; aqui a mesma conta é feita na geometria, sem abrir navegador.
    const AMARELO_DO_CONTORNO_PX = 4
    expect(CORNER_HANDLE_RADIUS * 2).toBeGreaterThanOrEqual(2 * AMARELO_DO_CONTORNO_PX)
  })
})

describe('cornerHandleRadius — o chip encolhe com o objeto, e nunca regride', () => {
  it('sala grande: o chip para de crescer em CORNER_HANDLE_RADIUS', () => {
    expect(cornerHandleRadius(1000, 640)).toBe(CORNER_HANDLE_RADIUS)
    expect(cornerHandleRadius(64, 64)).toBe(CORNER_HANDLE_RADIUS)
  })

  it('objeto pequeno: encolhe para os dois chips de um mesmo lado não encostarem', () => {
    // 24 px de lado → 24/6 = 4: dois chips de 4 ocupam 1/3 do lado, sobra folga.
    expect(cornerHandleRadius(24, 24)).toBe(4)
    // O menor lado é quem manda: um Prop deitado (80 x 24) usa o 24.
    expect(cornerHandleRadius(80, 24)).toBe(4)
  })

  it('objeto minúsculo: piso em HANDLE_VISUAL_RADIUS — nunca menor do que a alça antiga', () => {
    expect(cornerHandleRadius(6, 6)).toBe(HANDLE_VISUAL_RADIUS)
    expect(cornerHandleRadius(0, 0)).toBe(HANDLE_VISUAL_RADIUS)
  })

  it('largura/altura negativas (box invertido no meio de um arrasto) não viram chip negativo', () => {
    expect(cornerHandleRadius(-300, -200)).toBe(CORNER_HANDLE_RADIUS)
  })
})

describe('drawRoomHandles', () => {
  it('4 cantos, 2 fills cada, e os quatro do MESMO tamanho', () => {
    const g = new Graphics()

    drawRoomHandles(g, QUADRADO)

    const lidos = rectangulos(g)
    expect(lidos).toHaveLength(QUADRADO.length * 2)
    const lados = new Set(lidos.map((r) => r.w))
    expect(lados.size, 'os quatro cantos precisam ter o mesmo tamanho de chip').toBe(2)
  })

  it('cada chip fica centrado no seu vértice', () => {
    const g = new Graphics()

    drawRoomHandles(g, QUADRADO)

    const centros = rectangulos(g)
      .filter((_, i) => i % 2 === 1) // só o quadrado amarelo de cada par
      .map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }))
    expect(centros).toEqual(QUADRADO.map((p) => ({ x: p.x, y: p.y })))
  })

  it('polígono que não tem 4 vértices não desenha nada (guarda de contrato)', () => {
    const g = new Graphics()

    drawRoomHandles(g, QUADRADO.slice(0, 3))

    expect(rectangulos(g)).toHaveLength(0)
  })
})
