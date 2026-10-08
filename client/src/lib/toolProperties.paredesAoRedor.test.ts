import { describe, expect, it } from 'vitest'
import type { Drawing } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { relevantPropertyGroups } from './toolProperties'

/**
 * PAREDES AO REDOR no painel: a seção aparece para UM desenho selecionado que
 * aceita paredes (Pincel traço/balde, Linha, Curva, Círculo, Elipse,
 * Retângulo, Polígono); Texto e Caminho não. Com a ferramenta de desenho na
 * mão e nada selecionado, não aparece (é propriedade do desenho, não do
 * próximo traço). Parede presa selecionada: o aviso no lugar dos controles de
 * parede.
 */
const ACEITAM: Exclude<Drawing['kind'], 'text'>[] = ['freehand', 'line', 'curve', 'circle', 'ellipse', 'rect', 'polygon']
const FERRAMENTAS_DE_DESENHO: DrawingTool[] = ['brush', 'line', 'rect', 'polygon']

describe('relevantPropertyGroups — paredes ao redor', () => {
  it.each(ACEITAM)('desenho %s selecionado mostra a seção', (drawingKind) => {
    expect(relevantPropertyGroups('select', { drawingKind }).has('paredesAoRedor')).toBe(true)
  })

  it('caminho e texto selecionados não mostram', () => {
    expect(relevantPropertyGroups('select', { drawingKind: 'path' }).has('paredesAoRedor')).toBe(false)
    expect(relevantPropertyGroups('select', { textLabel: true }).has('paredesAoRedor')).toBe(false)
  })

  it('a ferramenta de desenho sem nada selecionado não mostra', () => {
    for (const tool of FERRAMENTAS_DE_DESENHO) {
      expect(relevantPropertyGroups(tool).has('paredesAoRedor')).toBe(false)
    }
  })

  it('parede presa selecionada: aviso no lugar de estilo, porta e tipo de porta', () => {
    const grupos = relevantPropertyGroups('select', { wall: true, wallPresa: true })
    expect(grupos.has('paredePresa')).toBe(true)
    expect(grupos.has('wallStyle')).toBe(false)
    expect(grupos.has('wallDoor')).toBe(false)
    expect(grupos.has('doorKind')).toBe(false)
  })

  it('parede comum continua com os controles de parede', () => {
    const grupos = relevantPropertyGroups('select', { wall: true })
    expect(grupos.has('paredePresa')).toBe(false)
    expect(grupos.has('wallStyle')).toBe(true)
  })
})
