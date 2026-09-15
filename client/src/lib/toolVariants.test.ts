import { describe, expect, it } from 'vitest'
import { DRAWING_SHAPE_GROUP, drawingClusterGroups, readyToolVariants, TOOL_VARIANTS, type ToolVariantGroup } from './toolVariants'
import { TOOL_SHORTCUTS } from './keymap'
import { DRAWING_TOOLS } from '../components/labels'
import type { DrawingTool } from '../types/tools'

/** Toda ferramenta com variante — pronta ou não — precisa existir em
 *  `types/tools.ts` (DrawingTool), senão o catálogo referencia uma
 *  ferramenta que não existe mais na barra. */
const ALL_TOOLS: DrawingTool[] = [
  'select', 'wall', 'door', 'light', 'region', 'room', 'roomCircle', 'roomPolygon',
  'stair', 'token', 'prop', 'brush', 'line', 'circle', 'ellipse', 'rect', 'polygon',
  'curve', 'text', 'measure', 'eraser', 'floor',
]

describe('TOOL_VARIANTS', () => {
  it('só referencia ferramentas que existem em DrawingTool', () => {
    for (const key of Object.keys(TOOL_VARIANTS)) {
      expect(ALL_TOOLS).toContain(key)
    }
  })

  it('a chave do catálogo bate com o campo `tool` da própria entrada', () => {
    for (const [key, entry] of Object.entries(TOOL_VARIANTS)) {
      expect(entry?.tool).toBe(key)
    }
  })

  it('toda entrada pronta tem pelo menos 1 grupo, e todo grupo tem pelo menos 2 opções', () => {
    for (const entry of readyToolVariants()) {
      expect(entry.groups.length).toBeGreaterThan(0)
      for (const group of entry.groups) {
        expect(group.options.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('toda opção tem id, label, description e value não-vazios (nenhum item de menu mudo)', () => {
    for (const entry of readyToolVariants()) {
      for (const group of entry.groups) {
        for (const option of group.options) {
          expect(option.id.length).toBeGreaterThan(0)
          expect(option.label.length).toBeGreaterThan(0)
          expect(option.description.length).toBeGreaterThan(0)
          expect(option.value).not.toBeUndefined()
          expect(option.value).not.toBeNull()
        }
      }
    }
  })

  it('ids de opção são únicos dentro do mesmo grupo (senão key do React colide)', () => {
    for (const entry of readyToolVariants()) {
      for (const group of entry.groups) {
        const ids = group.options.map((o) => o.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('storeKey de cada grupo é um dos eixos confirmados (dossiê F4 + Fase 5)', () => {
    const validKeys: ToolVariantGroup['storeKey'][] = [
      'doorKind', 'wallKind', 'regionFillPattern', 'polygonSides',
      'stairSizePreset', 'drawTexture', 'eraseMode',
      'floorShapeKind', 'floorOp', 'floorPolygonSides',
    ]
    for (const entry of readyToolVariants()) {
      for (const group of entry.groups) {
        expect(validKeys).toContain(group.storeKey)
      }
    }
  })

  it('toda entrada indisponível documenta o pedido E o que falta, sem string vazia', () => {
    for (const entry of Object.values(TOOL_VARIANTS)) {
      if (!entry || entry.available) continue
      expect(entry.requested.length).toBeGreaterThan(0)
      expect(entry.missing.length).toBeGreaterThan(0)
    }
  })

  it('wall tem exatamente as 2 variantes de wallKind (interior/exterior)', () => {
    const entry = TOOL_VARIANTS.wall
    expect(entry?.available).toBe(true)
    if (!entry || !entry.available) throw new Error('wall deveria estar disponível')
    expect(entry.groups).toHaveLength(1)
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['exterior', 'interior'])
  })

  it('door tem exatamente as 3 variantes de doorKind (normal/double/gate)', () => {
    const entry = TOOL_VARIANTS.door
    if (!entry || !entry.available) throw new Error('door deveria estar disponível')
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['normal', 'double', 'gate'])
  })

  it('region/room/roomCircle usam a MESMA lista de opções de fillPattern (mesma preferência de store)', () => {
    const region = TOOL_VARIANTS.region
    const room = TOOL_VARIANTS.room
    const roomCircle = TOOL_VARIANTS.roomCircle
    if (!region?.available || !room?.available || !roomCircle?.available) {
      throw new Error('region/room/roomCircle deveriam estar disponíveis')
    }
    expect(region.groups[0].options).toEqual(room.groups[0].options)
    expect(region.groups[0].options).toEqual(roomCircle.groups[0].options)
  })

  it('roomPolygon tem os DOIS eixos: preenchimento e lados', () => {
    const entry = TOOL_VARIANTS.roomPolygon
    if (!entry || !entry.available) throw new Error('roomPolygon deveria estar disponível')
    const storeKeys = entry.groups.map((g) => g.storeKey)
    expect(storeKeys).toContain('regionFillPattern')
    expect(storeKeys).toContain('polygonSides')
  })

  it('polygonSides do roomPolygon respeita o intervalo 3–12 do slider existente (PolygonSidesControls)', () => {
    const entry = TOOL_VARIANTS.roomPolygon
    if (!entry || !entry.available) throw new Error('roomPolygon deveria estar disponível')
    const sidesGroup = entry.groups.find((g) => g.storeKey === 'polygonSides')
    if (!sidesGroup) throw new Error('roomPolygon deveria ter grupo polygonSides')
    for (const option of sidesGroup.options) {
      expect(option.value).toBeGreaterThanOrEqual(3)
      expect(option.value).toBeLessThanOrEqual(12)
    }
  })

  it('line está marcada como indisponível (Linha/Curva é escolha de Forma no botão Desenho, sem eixo próprio)', () => {
    const entry = TOOL_VARIANTS.line
    expect(entry?.available).toBe(false)
  })

  it('readyToolVariants() não inclui nenhuma entrada indisponível', () => {
    for (const entry of readyToolVariants()) {
      expect(entry.available).toBe(true)
    }
  })

  it('stair tem exatamente os 3 presets de tamanho (small/medium/large)', () => {
    const entry = TOOL_VARIANTS.stair
    if (!entry || !entry.available) throw new Error('stair deveria estar disponível (Fase 5)')
    expect(entry.groups).toHaveLength(1)
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['small', 'medium', 'large'])
  })

  it('brush tem exatamente as 3 texturas de traço (pen/pencil/marker)', () => {
    const entry = TOOL_VARIANTS.brush
    if (!entry || !entry.available) throw new Error('brush deveria estar disponível (Fase 5)')
    expect(entry.groups).toHaveLength(1)
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['pen', 'pencil', 'marker'])
  })

  it('eraser tem exatamente os 2 modos (objeto/parte)', () => {
    const entry = TOOL_VARIANTS.eraser
    if (!entry || !entry.available) throw new Error('eraser deveria estar disponível (Fase 5)')
    expect(entry.groups).toHaveLength(1)
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['objeto', 'parte'])
  })
})

describe('DRAWING_SHAPE_GROUP e drawingClusterGroups (botão Desenho)', () => {
  it('Forma tem as 7 opções na ordem do usuário, o mesmo conjunto de DRAWING_TOOLS', () => {
    expect(DRAWING_SHAPE_GROUP.label).toBe('Forma')
    expect(DRAWING_SHAPE_GROUP.options.map((o) => o.value)).toEqual(['brush', 'line', 'curve', 'circle', 'ellipse', 'rect', 'polygon'])
    expect(new Set(DRAWING_SHAPE_GROUP.options.map((o) => o.value))).toEqual(new Set(DRAWING_TOOLS))
  })

  it('a descrição termina com a letra do atalho', () => {
    for (const option of DRAWING_SHAPE_GROUP.options) {
      expect(option.description.endsWith(`(${TOOL_SHORTCUTS[option.value]})`), option.id).toBe(true)
    }
  })

  it("drawingClusterGroups('brush') tem Forma + Textura do traço; ('line') tem só Forma", () => {
    expect(drawingClusterGroups('brush').map((g) => g.label)).toEqual(['Forma', 'Textura do traço'])
    expect(drawingClusterGroups('line').map((g) => g.label)).toEqual(['Forma'])
  })

  it('toda opção dos grupos do botão Desenho tem id, label, description e value não-vazios', () => {
    for (const shape of DRAWING_TOOLS) {
      for (const group of drawingClusterGroups(shape)) {
        expect(group.options.length).toBeGreaterThanOrEqual(2)
        for (const option of group.options) {
          expect(option.id.length).toBeGreaterThan(0)
          expect(option.label.length).toBeGreaterThan(0)
          expect(option.description.length).toBeGreaterThan(0)
          expect(option.value).not.toBeUndefined()
          expect(option.value).not.toBeNull()
        }
      }
    }
  })
})
