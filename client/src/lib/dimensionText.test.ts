import { describe, expect, it } from 'vitest'
import { dimensionLabel, type DimensionDraft } from './dimensionText'
import type { MapScale } from '../types/map'

const SCALE_FT: MapScale = { unitsPerCell: 5, unit: 'ft', precision: 0 }
const GRID_SIZE = 50 // 1 célula = 50px de mundo, então 1 célula = 5 ft

describe('dimensionLabel', () => {
  it('rect: largura × altura, eixo a eixo a partir de start', () => {
    // 100px de largura (2 células = 10 ft), 50px de altura (1 célula = 5 ft)
    const draft: DimensionDraft = { tool: 'rect', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('10 ft × 5 ft')
  })

  it('room: mesmo formato de rect (mesmo par start/end)', () => {
    const draft: DimensionDraft = { tool: 'room', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('10 ft × 5 ft')
  })

  it('rect: start/end invertidos (arrasto pra cima/esquerda) dá o mesmo módulo', () => {
    const draft: DimensionDraft = { tool: 'rect', start: { x: 100, y: 50 }, end: { x: 0, y: 0 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('10 ft × 5 ft')
  })

  it('ellipse: largura × altura são as extensões TOTAIS (2×rx, 2×ry), não os semieixos', () => {
    // center→end tem rx=100px (2 células), ry=50px (1 célula) — largura total
    // esperada é 2×rx = 200px = 4 células = 20 ft, não 10 ft (que seria o raio).
    const draft: DimensionDraft = { tool: 'ellipse', center: { x: 0, y: 0 }, end: { x: 100, y: 50 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('20 ft × 10 ft')
  })

  it('circle: raio e diâmetro juntos, diâmetro é exatamente o dobro do raio', () => {
    // raio = 50px = 1 célula = 5 ft; diâmetro = 100px = 2 células = 10 ft
    const draft: DimensionDraft = { tool: 'circle', center: { x: 0, y: 0 }, end: { x: 50, y: 0 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('r 5 ft (⌀ 10 ft)')
  })

  it('circle: raio na diagonal usa distância euclidiana, não soma de eixos', () => {
    // (30,40) → hypot = 50px = 1 célula = 5 ft (triângulo 3-4-5 clássico)
    const draft: DimensionDraft = { tool: 'circle', center: { x: 0, y: 0 }, end: { x: 30, y: 40 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('r 5 ft (⌀ 10 ft)')
  })

  it.each(['line', 'wall', 'stair'] as const)('%s: só o comprimento, distância euclidiana start→end', (tool) => {
    const draft: DimensionDraft = { tool, start: { x: 0, y: 0 }, end: { x: 30, y: 40 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('5 ft')
  })

  it('polygon-room: número de lados fixo do draft + raio, não recalcula os lados', () => {
    const draft: DimensionDraft = { tool: 'polygon-room', center: { x: 0, y: 0 }, end: { x: 50, y: 0 }, sides: 6 }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('6 lados · r 5 ft')
  })

  it('polygon-room: sides diferente (Sala Circular, 24 lados) aparece no texto', () => {
    const draft: DimensionDraft = { tool: 'polygon-room', center: { x: 0, y: 0 }, end: { x: 50, y: 0 }, sides: 24 }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', SCALE_FT)).toBe('24 lados · r 5 ft')
  })

  it('gridShape "hex" não muda o resultado do modo euclidiano (measureDistance ignora o parâmetro nesse modo)', () => {
    const draft: DimensionDraft = { tool: 'circle', center: { x: 0, y: 0 }, end: { x: 50, y: 0 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'hex', SCALE_FT)).toBe('r 5 ft (⌀ 10 ft)')
  })

  it('precisão e unidade diferentes (metros, 1 casa decimal) refletem no rótulo', () => {
    const scaleM: MapScale = { unitsPerCell: 1.5, unit: 'm', precision: 1 }
    // 100px = 2 células = 3 m; 50px = 1 célula = 1,5 m (vírgula decimal, passo 3 F1)
    const draft: DimensionDraft = { tool: 'rect', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } }
    expect(dimensionLabel(draft, GRID_SIZE, 'square', scaleM)).toBe('3,0 m × 1,5 m')
  })

  // Caso 2 da regra 5 (campo opcional ausente): esta função não tem nenhum
  // campo opcional na assinatura — todo `DimensionDraft` é discriminado e
  // completo por `tool`. O equivalente aqui é a ENTRADA DEGENERADA que o
  // compilador não pega: arrasto de comprimento zero (start === end, ou
  // center === end) e grade sem tamanho (gridSize <= 0). Os dois são o caso
  // real que derruba a tela quando o usuário clica sem arrastar ainda.
  it('draft de comprimento zero (clique sem arrastar ainda) não produz NaN nem lança', () => {
    const rect: DimensionDraft = { tool: 'rect', start: { x: 10, y: 10 }, end: { x: 10, y: 10 } }
    expect(dimensionLabel(rect, GRID_SIZE, 'square', SCALE_FT)).toBe('0 ft × 0 ft')

    const circle: DimensionDraft = { tool: 'circle', center: { x: 10, y: 10 }, end: { x: 10, y: 10 } }
    expect(dimensionLabel(circle, GRID_SIZE, 'square', SCALE_FT)).toBe('r 0 ft (⌀ 0 ft)')

    const wall: DimensionDraft = { tool: 'wall', start: { x: 10, y: 10 }, end: { x: 10, y: 10 } }
    expect(dimensionLabel(wall, GRID_SIZE, 'square', SCALE_FT)).toBe('0 ft')
  })

  it('gridSize <= 0 (grade sem tamanho) devolve 0 em vez de Infinity/NaN — mesma guarda de measureCells', () => {
    const draft: DimensionDraft = { tool: 'rect', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } }
    expect(dimensionLabel(draft, 0, 'square', SCALE_FT)).toBe('0 ft × 0 ft')
    expect(dimensionLabel(draft, -10, 'square', SCALE_FT)).toBe('0 ft × 0 ft')
  })
})
