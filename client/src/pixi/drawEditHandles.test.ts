import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawEditHandles, findLightRadiusHandleAt, lightRadiusHandlePosition, circleDrawingRadiusHandle } from './drawEditHandles'
import { createEmptyMap } from '../lib/mapFactory'
import { ROOM_ROTATE_HANDLE } from '../lib/roomRotation'
import type { Light, Region, Wall, Drawing, Token, Prop } from '../types/map'

/** Conta instruções `action: 'fill'` realmente empilhadas no GraphicsContext da instância. */
function countFillInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill').length
}

/** Conta instruções `action: 'stroke'` realmente empilhadas no GraphicsContext da instância. */
function countStrokeInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke').length
}

/**
 * Fills por alça de CANTO (Sala retangular, Drawing rect/ellipse/polygon,
 * Token, Prop): o chip é faixa escura por baixo + quadrado amarelo dentro
 * (`pixi/drawRoomHandles.ts` → `drawCornerHandle`). Nomeado aqui para os
 * testes abaixo falarem em "cantos", não em "número de fills" — se um dia o
 * chip virar 1 ou 3 fills, muda um número só.
 */
const FILLS_POR_CHIP = 2

/**
 * O que a alça de GIRAR sala desenha (`drawRoomRotateHandle`): a haste é UM
 * traço, e a bolinha é UMA fill (a cabeça) com UM traço em volta (o aro).
 * Toda Sala selecionada e destravada a tem; região comum, não.
 */
const FILLS_DA_ALCA_DE_GIRAR = 1
const STROKES_DA_ALCA_DE_GIRAR = 2

function buildSquareRegion(id: string): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: 'region',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
  }
}

/** Mesmo quadrado de buildSquareRegion, mas marcado como Sala retangular
 *  (RoomMeta.shape === 'rect') — usado pelos testes de RISCO Nº 7
 *  (docs/PLANO-FASES.md §5, ver describe('Sala (region.room)') abaixo). */
function buildRectRoomRegion(id: string): Region {
  return { ...buildSquareRegion(id), room: { shape: 'rect', name: 'Sala' } }
}

/** Mesmo quadrado, marcado como Sala Circular/Polígono Regular
 *  (RoomMeta.shape === 'polygon') — precisa continuar com os handles
 *  redondos de sempre, só a Sala 'rect' ganha alça quadrada. */
function buildPolygonRoomRegion(id: string): Region {
  return { ...buildSquareRegion(id), room: { shape: 'polygon', name: 'Sala Circular' } }
}

function buildLooseWall(id: string): Wall {
  return { id, x1: 10, y1: 20, x2: 90, y2: 20, blocksLight: true, blocksMove: true, door: null }
}

function buildLinkedWall(id: string, regionId: string, regionEdgeIndex: number): Wall {
  return { ...buildLooseWall(id), regionId, regionEdgeIndex }
}

function buildLight(id: string): Light {
  return { id, x: 100, y: 100, radius: 50, color: '#ffaa33', intensity: 0.8 }
}

describe('drawEditHandles', () => {
  it('sem seleção: não desenha nada', () => {
    const map = createEmptyMap('m', 'M', 30, 20, 64)
    const g = new Graphics()

    drawEditHandles(g, map, null, 'select')

    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('região selecionada: 1 círculo preenchido por vértice + 1 vazado por ponto médio de aresta', () => {
    const region = buildSquareRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select')

    expect(countFillInstructions(g)).toBe(region.points.length)
    expect(countStrokeInstructions(g)).toBe(region.points.length)
  })

  it('parede solta selecionada: 2 círculos preenchidos (extremos), nenhum vazado', () => {
    const wall = buildLooseWall('w1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), walls: [wall] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'wall', id: 'w1' }, 'select')

    expect(countFillInstructions(g)).toBe(2)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('parede vinculada selecionada: delega para os handles da região dona (vértice + meio)', () => {
    const region = buildSquareRegion('r1')
    const wall = buildLinkedWall('w1', 'r1', 0)
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region], walls: [wall] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'wall', id: 'w1' }, 'select')

    expect(countFillInstructions(g)).toBe(region.points.length)
    expect(countStrokeInstructions(g)).toBe(region.points.length)
  })

  it('ferramenta diferente de Selecionar: não desenha nada mesmo com seleção presente', () => {
    const region = buildSquareRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'room')

    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('luz selecionada: 1 contorno de alcance vazado + 1 alça preenchida na borda', () => {
    const light = buildLight('l1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), lights: [light] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'light', id: 'l1' }, 'select')

    expect(countFillInstructions(g)).toBe(1)
    expect(countStrokeInstructions(g)).toBe(1)
  })

  it('luz selecionada mas removida do mapa: seleção órfã não desenha nada', () => {
    const map = createEmptyMap('m', 'M', 30, 20, 64)
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'light', id: 'inexistente' }, 'select')

    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(0)
  })
})

// RISCO Nº 7 do plano (docs/PLANO-FASES.md §5): drawEditHandles serve
// Wall/Region/Line, e o branch `region.room?.shape === 'rect'` (Sala
// retangular → alças quadradas) precisa ser ESTREITO — os 3 casos abaixo
// provam que região comum (sem `room`) e Sala Circular/Polígono
// (`room.shape: 'polygon'`) continuam com os handles redondos de sempre;
// só `room.shape: 'rect'` muda de forma.
describe('drawEditHandles — Sala (region.room)', () => {
  it('região SEM room (região comum): handles redondos de sempre — 1 fill + 1 stroke por vértice', () => {
    const region = buildSquareRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select')

    expect(countFillInstructions(g)).toBe(region.points.length)
    expect(countStrokeInstructions(g)).toBe(region.points.length)
  })

  it('região com room.shape "polygon" (Sala Circular/Polígono Regular): continua com handles redondos', () => {
    const region = buildPolygonRoomRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select')

    // Os redondos de sempre, mais a alça de girar que toda Sala ganhou.
    expect(countFillInstructions(g)).toBe(region.points.length + FILLS_DA_ALCA_DE_GIRAR)
    expect(countStrokeInstructions(g)).toBe(region.points.length + STROKES_DA_ALCA_DE_GIRAR)
  })

  // FILLS_POR_CHIP: desde 21/09/2026 a alça de canto é um chip de DOIS fills
  // (faixa escura por baixo + quadrado amarelo dentro, ver `drawRoomHandles.ts`)
  // — é a faixa escura que separa a alça do contorno de seleção, que tem a
  // mesma cor dela. Continua SEM stroke nenhum: o "sem ponto médio de aresta"
  // que estes testes guardam segue valendo, e continua sendo medido pelo 0.
  it('região com room.shape "rect" (Sala retangular): chip de canto — 2 fills por canto, sem stroke de ponto médio', () => {
    const region = buildRectRoomRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select')

    // Os únicos traços são os da alça de girar (haste e aro): nenhum ponto médio.
    expect(countFillInstructions(g)).toBe(region.points.length * FILLS_POR_CHIP + FILLS_DA_ALCA_DE_GIRAR)
    expect(countStrokeInstructions(g)).toBe(STROKES_DA_ALCA_DE_GIRAR)
  })

  it('parede vinculada a uma Sala retangular: delega para as alças quadradas da sala dona', () => {
    const region = buildRectRoomRegion('r1')
    const wall = buildLinkedWall('w1', 'r1', 0)
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region], walls: [wall] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'wall', id: 'w1' }, 'select')

    expect(countFillInstructions(g)).toBe(region.points.length * FILLS_POR_CHIP + FILLS_DA_ALCA_DE_GIRAR)
    expect(countStrokeInstructions(g)).toBe(STROKES_DA_ALCA_DE_GIRAR)
  })
})

// GIRAR SALA: toda Sala selecionada ganha a alça de girar — bolinha acima do
// topo, ligada a ele por um traço fino. Região comum não é Sala e não gira.
describe('drawEditHandles — alça de girar sala', () => {
  it('região comum (sem room) não tem alça de girar: só os redondos de vértice e meio', () => {
    const region = buildSquareRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select')

    expect(countFillInstructions(g)).toBe(region.points.length)
    expect(countStrokeInstructions(g)).toBe(region.points.length)
  })

  it('Sala travada: sem alça de girar (o gesto não existe, então o controle também não)', () => {
    const region: Region = { ...buildRectRoomRegion('r1'), locked: true }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select')

    expect(countFillInstructions(g)).toBe(region.points.length * FILLS_POR_CHIP)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('Sala retangular girada torta: sem chip de canto (puxar um canto a desmontaria), só a alça de girar', () => {
    const torta: Region = {
      ...buildRectRoomRegion('r1'),
      points: [{ x: 50, y: -20.71 }, { x: 120.71, y: 50 }, { x: 50, y: 120.71 }, { x: -20.71, y: 50 }],
      room: { shape: 'rect', name: 'Sala', rotation: 45 },
    }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [torta] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select')

    expect(countFillInstructions(g)).toBe(FILLS_DA_ALCA_DE_GIRAR)
    expect(countStrokeInstructions(g)).toBe(STROKES_DA_ALCA_DE_GIRAR)
  })

  it('a bolinha fica acima do meio do topo, a ROOM_ROTATE_HANDLE.offsetPx de TELA — em qualquer zoom', () => {
    const region = buildRectRoomRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    for (const cameraScale of [1, 2, 0.5]) {
      const g = new Graphics()
      drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select', { cameraScale })
      const bounds = g.getLocalBounds()
      // O topo da sala está em y = 0; o que sobe acima dele é a alça (aro incluso).
      const acima = -bounds.minY * cameraScale
      expect(acima).toBeGreaterThan(ROOM_ROTATE_HANDLE.offsetPx + ROOM_ROTATE_HANDLE.radiusPx - 1)
      expect(acima).toBeLessThan(ROOM_ROTATE_HANDLE.offsetPx + ROOM_ROTATE_HANDLE.radiusPx + 3)
    }
  })

  it('pega (no arrasto), a cabeça acende: o preenchimento vira a cor da seleção', () => {
    const region = buildPolygonRoomRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const cores = (rotating: boolean): number[] => {
      const g = new Graphics()
      drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select', { rotating })
      return g.context.instructions.flatMap((instruction) => (instruction.action === 'fill' ? [instruction.data.style.color] : []))
    }
    const solta = cores(false)
    const pega = cores(true)
    // A última fill é a cabeça da alça; a primeira, um vértice — que já é da cor da seleção.
    expect(pega[pega.length - 1]).not.toBe(solta[solta.length - 1])
    expect(pega[pega.length - 1]).toBe(solta[0])
  })
})

// Agente B3 (dossiê F4, bug3): rect/ellipse/polygon (Drawing), Token e Prop
// ganham alça de canto (drawBoxResizeHandles → 4 chips, 0 stroke, o MESMO
// desenho de drawRoomHandles — desde 21/09/2026 os dois chamam a mesma
// `drawCornerHandle`). circle/text/freehand continuam sem
// handle nenhum — têm move nesta fase, mas não resize (ver relatório).
describe('drawEditHandles — Drawing rect/ellipse/polygon (bounding box)', () => {
  it('rect selecionado: 4 alças de canto preenchidas, nenhum stroke', () => {
    const drawing: Drawing = { id: 'd1', kind: 'rect', x: 0, y: 0, w: 100, h: 50, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), drawings: [drawing] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'drawing', id: 'd1' }, 'select')

    expect(countFillInstructions(g)).toBe(4 * FILLS_POR_CHIP)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('ellipse selecionada: 4 alças de canto preenchidas', () => {
    const drawing: Drawing = { id: 'd2', kind: 'ellipse', cx: 100, cy: 100, rx: 40, ry: 20, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), drawings: [drawing] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'drawing', id: 'd2' }, 'select')

    expect(countFillInstructions(g)).toBe(4 * FILLS_POR_CHIP)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('polygon selecionado: 4 alças de canto (bounding box, não 1 por vértice)', () => {
    const drawing: Drawing = {
      id: 'd3', kind: 'polygon',
      points: [{ x: 0, y: 0 }, { x: 50, y: -20 }, { x: 100, y: 0 }, { x: 50, y: 80 }],
      color: '#fff', width: 2, filled: false, fillAlpha: 0.5,
    }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), drawings: [drawing] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'drawing', id: 'd3' }, 'select')

    expect(countFillInstructions(g)).toBe(4 * FILLS_POR_CHIP)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('text/freehand selecionados: sem handle nenhum (fora de escopo de resize nesta fase)', () => {
    const freehand: Drawing = { id: 'd4', kind: 'freehand', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#fff', width: 2 }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), drawings: [freehand] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'drawing', id: 'd4' }, 'select')

    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(0)
  })
})

// Item 18 do plano (Onda 3, frente B): círculo era o único Drawing sem alça
// nenhuma — agora reaproveita a MESMA alça de raio da Luz (generalizada de
// `Light` pra `RadiusHandleTarget`), via `circleDrawingRadiusHandle`
// (cx/cy → x/y). Mesmo padrão visual de `light selecionada` acima: 1 stroke
// (contorno vazado) + 1 fill (alça na borda).
describe('drawEditHandles — Drawing circle (alça de raio)', () => {
  it('circle selecionado: 1 contorno vazado + 1 alça preenchida na borda, mesmo padrão da Luz', () => {
    const circle: Drawing = { id: 'd4', kind: 'circle', cx: 0, cy: 0, radius: 10, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), drawings: [circle] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'drawing', id: 'd4' }, 'select')

    expect(countFillInstructions(g)).toBe(1)
    expect(countStrokeInstructions(g)).toBe(1)
  })
})

// Retorno com tipo explícito estreito (`Extract<Drawing, {kind:'circle'}>`,
// não `Drawing`) — mesmo motivo do comentário em `objectTransform.test.ts`
// sobre `satisfies Drawing`: uma anotação `: Drawing` no literal apagaria o
// `kind: 'circle'` e `circleDrawingRadiusHandle` (que só aceita o kind
// estreito) exigiria um `as` em cada chamada.
function buildCircleDrawing(id: string): Extract<Drawing, { kind: 'circle' }> {
  return { id, kind: 'circle', cx: 30, cy: 40, radius: 10, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 }
}

describe('circleDrawingRadiusHandle', () => {
  it('adapta cx/cy/radius do Drawing pra x/y/radius que a alça espera', () => {
    expect(circleDrawingRadiusHandle(buildCircleDrawing('d4'))).toEqual({ x: 30, y: 40, radius: 10 })
  })

  it('a alça adaptada funciona com findLightRadiusHandleAt/lightRadiusHandlePosition (mesma alça da Luz, reaproveitada)', () => {
    const target = circleDrawingRadiusHandle(buildCircleDrawing('d4'))
    expect(lightRadiusHandlePosition(target)).toEqual({ x: 40, y: 40 })
    expect(findLightRadiusHandleAt(target, { x: 41, y: 41 })).toBe(true)
    // Lado OPOSTO do círculo (cx - radius, cy) = (20, 40) — a 20px da alça
    // (40, 40), bem fora da tolerância (10). Longe da alça mesmo estando em
    // cima do próprio contorno do círculo.
    expect(findLightRadiusHandleAt(target, { x: 20, y: 40 })).toBe(false)
  })
})

describe('drawEditHandles — Token / Prop (bounding box)', () => {
  it('token selecionado: 4 alças de canto preenchidas', () => {
    const token: Token = { id: 't1', characterId: null, name: 'H', x: 100, y: 100, size: 1, image: null }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), tokens: [token] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'token', id: 't1' }, 'select')

    expect(countFillInstructions(g)).toBe(4 * FILLS_POR_CHIP)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('prop selecionado: 4 alças de canto preenchidas', () => {
    const prop: Prop = { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 20, linkedMapPath: null }
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), props: [prop] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'prop', id: 'p1' }, 'select')

    expect(countFillInstructions(g)).toBe(4 * FILLS_POR_CHIP)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('token selecionado mas removido do mapa: seleção órfã não desenha nada', () => {
    const map = createEmptyMap('m', 'M', 30, 20, 64)
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'token', id: 'inexistente' }, 'select')

    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(0)
  })
})

describe('lightRadiusHandlePosition', () => {
  it('fica sobre a borda do círculo, no eixo +x a partir do centro', () => {
    const light = buildLight('l1')
    expect(lightRadiusHandlePosition(light)).toEqual({ x: 150, y: 100 })
  })
})

describe('findLightRadiusHandleAt', () => {
  it('acerta um ponto dentro da tolerância da alça', () => {
    const light = buildLight('l1')
    expect(findLightRadiusHandleAt(light, { x: 152, y: 101 })).toBe(true)
  })

  it('não acerta um ponto longe da alça, mesmo dentro do círculo da luz', () => {
    const light = buildLight('l1')
    expect(findLightRadiusHandleAt(light, { x: 100, y: 100 })).toBe(false)
  })
})
