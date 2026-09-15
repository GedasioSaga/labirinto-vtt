import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawDoors } from './drawDoors'
import { drawWalls } from './drawWalls'
import type { Wall } from '../types/map'

function baseWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: 'w1',
    x1: 0,
    y1: 0,
    x2: 40,
    y2: 0,
    blocksLight: true,
    blocksMove: true,
    door: null,
    ...overrides,
  }
}

/** Instruções de topo (`fill`/`stroke`) de fato empilhadas — mesmo padrão de drawRegions.test.ts. */
function strokeInstructions(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke')
}

/** Conta `moveTo` dentro do path de UMA instrução de stroke — cada `moveTo` inicia
 *  um subtraço novo (ombreira, folha ou barra de portão), então contar quantos
 *  existem prova quantos elementos o kind desenhou, sem depender de coordenada exata. */
function moveToCount(instruction: ReturnType<typeof strokeInstructions>[number]): number {
  if (instruction.action !== 'stroke') return 0
  return instruction.data.path.instructions.filter((i) => i.action === 'moveTo').length
}

describe('drawDoors + drawWalls — distinguibilidade visual (risco nº 6 do plano)', () => {
  it('parede COM porta produz traço na camada de portas; parede SEM porta não produz nada', () => {
    const wallsGraphics = new Graphics()
    const doorsGraphics = new Graphics()
    const walls: Wall[] = [
      baseWall({ id: 'solid', door: null }),
      baseWall({ id: 'withDoor', x1: 100, y1: 0, x2: 140, y2: 0, door: { open: false, locked: false, kind: 'normal' } }),
    ]

    drawWalls(wallsGraphics, walls, null)
    drawDoors(doorsGraphics, walls, null)

    // Passo 3, F2: parede com porta não vira linha (o vão é da porta) — só a
    // parede sólida tem stroke em drawWalls.
    expect(strokeInstructions(wallsGraphics)).toHaveLength(1)

    // drawDoors ignora a parede sem porta e desenha algo pra a com porta —
    // é isso que mantém as duas visualmente diferentes na composição final.
    expect(strokeInstructions(doorsGraphics)).toHaveLength(1)
  })

  it('parede sem porta: drawDoors não desenha nada (graphics fica limpo)', () => {
    const doorsGraphics = new Graphics()
    drawDoors(doorsGraphics, [baseWall({ door: null })], null)
    expect(strokeInstructions(doorsGraphics)).toHaveLength(0)
  })
})

describe('drawDoors — kind muda a geometria desenhada', () => {
  it('normal: 2 ombreiras + 1 folha = 3 moveTo', () => {
    const g = new Graphics()
    drawDoors(g, [baseWall({ door: { open: false, locked: false, kind: 'normal' } })], null)
    const [stroke] = strokeInstructions(g)
    expect(moveToCount(stroke)).toBe(3)
  })

  it('double: 2 ombreiras + 2 folhas = 4 moveTo', () => {
    const g = new Graphics()
    drawDoors(g, [baseWall({ door: { open: false, locked: false, kind: 'double' } })], null)
    const [stroke] = strokeInstructions(g)
    expect(moveToCount(stroke)).toBe(4)
  })

  it('gate: 2 ombreiras + N barras (N > 1 folha) — mais moveTo que normal/double no mesmo vão', () => {
    const g = new Graphics()
    drawDoors(g, [baseWall({ door: { open: false, locked: false, kind: 'gate' } })], null)
    const [stroke] = strokeInstructions(g)
    expect(moveToCount(stroke)).toBeGreaterThan(4)
  })

  it('open muda o ponto final da folha em relação a fechada (folha gira, não fica reta sobre o vão)', () => {
    const gClosed = new Graphics()
    const gOpen = new Graphics()
    drawDoors(gClosed, [baseWall({ door: { open: false, locked: false, kind: 'normal' } })], null)
    drawDoors(gOpen, [baseWall({ door: { open: true, locked: false, kind: 'normal' } })], null)

    const closedLeaf = strokeInstructions(gClosed)[0].data.path.instructions.filter((i) => i.action === 'lineTo')
    const openLeaf = strokeInstructions(gOpen)[0].data.path.instructions.filter((i) => i.action === 'lineTo')

    // Último lineTo de cada um é o fim da folha (os dois primeiros são as ombreiras).
    const closedEnd = closedLeaf.at(-1)
    const openEnd = openLeaf.at(-1)
    expect(closedEnd).toBeDefined()
    expect(openEnd).toBeDefined()
    expect(closedEnd).not.toEqual(openEnd)
  })
})

describe('drawDoors — cor por locked/seleção', () => {
  it('trancada usa cor diferente de destrancada', () => {
    const gLocked = new Graphics()
    const gUnlocked = new Graphics()
    drawDoors(gLocked, [baseWall({ door: { open: false, locked: true, kind: 'normal' } })], null)
    drawDoors(gUnlocked, [baseWall({ door: { open: false, locked: false, kind: 'normal' } })], null)

    const lockedColor = strokeInstructions(gLocked)[0].data.style.color
    const unlockedColor = strokeInstructions(gUnlocked)[0].data.style.color
    expect(lockedColor).not.toBe(unlockedColor)
  })

  // Auditoria 14/09: trancar não mudava nada visível no canvas (a troca de cor
  // da linha fina não se nota). Agora a porta trancada ganha um cadeado.
  it('trancada desenha um cadeado (corpo preenchido); destrancada não', () => {
    const fillCount = (g: Graphics) => g.context.instructions.filter((i) => i.action === 'fill').length
    const gLocked = new Graphics()
    const gUnlocked = new Graphics()
    drawDoors(gLocked, [baseWall({ door: { open: false, locked: true, kind: 'normal' } })], null)
    drawDoors(gUnlocked, [baseWall({ door: { open: false, locked: false, kind: 'normal' } })], null)

    expect(fillCount(gLocked)).toBe(1)
    expect(fillCount(gUnlocked)).toBe(0)
    // alça do cadeado é um traço a mais
    expect(strokeInstructions(gLocked).length).toBe(strokeInstructions(gUnlocked).length + 1)
  })

  it('porta trancada selecionada: contorno SELECTION_COLOR por baixo, e o vermelho de trancada continua por cima', () => {
    const gSelected = new Graphics()
    const gLocked = new Graphics()
    drawDoors(gSelected, [baseWall({ id: 'sel', door: { open: false, locked: true, kind: 'normal' } })], 'sel')
    drawDoors(gLocked, [baseWall({ id: 'sel', door: { open: false, locked: true, kind: 'normal' } })], null)
    const lockedColor = strokeInstructions(gLocked)[0].data.style.color

    const strokes = strokeInstructions(gSelected)
    const outline = strokes[0]
    const leaf = strokes.find((s) => s.data.style.color !== 0xffdd55)
    if (!leaf) throw new Error('folha da porta não foi desenhada')
    // 1º traço = contorno amarelo mais largo que a folha; depois, a folha na cor de trancada.
    expect(outline.data.style.color).toBe(0xffdd55)
    expect(leaf.data.style.color).toBe(lockedColor)
    expect(leaf.data.style.color).not.toBe(0xffdd55)
    expect(outline.data.style.width).toBeGreaterThan(leaf.data.style.width)
    // Nenhuma parte da porta real (folha, alça do cadeado) é pintada de amarelo.
    const yellowStrokes = strokes.filter((s) => s.data.style.color === 0xffdd55)
    expect(yellowStrokes).toHaveLength(2) // contorno da folha + contorno do corpo do cadeado
    const fills = gSelected.context.instructions.filter((i) => i.action === 'fill')
    expect(fills.map((f) => (f.data.style as { color: number }).color)).toEqual([lockedColor])
  })

  it('contorno da porta selecionada tem espessura fixa na TELA (engorda em mundo quando o zoom diminui)', () => {
    const wall = baseWall({ id: 'sel', door: { open: false, locked: false, kind: 'normal' } })
    const g1 = new Graphics()
    const gHalf = new Graphics()
    drawDoors(g1, [wall], 'sel', 1)
    drawDoors(gHalf, [wall], 'sel', 0.5)
    const outlineMinusLeaf = (g: Graphics) => {
      const [outline, leaf] = strokeInstructions(g)
      return outline.data.style.width - leaf.data.style.width
    }
    // 2 px de tela de cada lado: 4 px de mundo a 100%, 8 px de mundo a 50%.
    expect(outlineMinusLeaf(g1)).toBeCloseTo(4, 6)
    expect(outlineMinusLeaf(gHalf)).toBeCloseTo(8, 6)
  })
})
