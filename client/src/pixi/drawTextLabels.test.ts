import { describe, expect, it } from 'vitest'
import { Container, Text } from 'pixi.js'
import { createTextLabelsRenderer } from './drawTextLabels'
import type { Drawing } from '../types/map'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'

/** Type guard evita `as Text` no ponto de uso: find() já devolve `Text | undefined` tipado. */
function findTextChild(container: Container): Text | undefined {
  return container.children.find((child): child is Text => child instanceof Text)
}

function buildTextDrawing(overrides: Partial<Extract<Drawing, { kind: 'text' }>> = {}): Drawing {
  return {
    id: 'text-1',
    kind: 'text',
    x: 10,
    y: 20,
    text: 'Rótulo',
    color: '#ffffff',
    fontSize: 16,
    ...overrides,
  }
}

describe('createTextLabelsRenderer', () => {
  it('rótulo de mapa antigo sem fontFamily (campo opcional ausente) cai no default Arial', () => {
    // Reproduz um Drawing salvo antes do campo fontFamily existir: a chave nem
    // aparece no objeto, não é `undefined` explícito — é o formato real de
    // map.json legado depois de JSON.parse.
    const legacyDrawing = buildTextDrawing()
    expect('fontFamily' in legacyDrawing).toBe(false)

    const container = new Container()
    const renderer = createTextLabelsRenderer()

    renderer.draw(container, [legacyDrawing], null)

    const textObj = findTextChild(container)
    expect(textObj).toBeDefined()
    expect(textObj?.style.fontFamily).toBe(DEFAULT_TEXT_FONT_FAMILY)
  })

  it('rótulo com fontFamily explícito usa a fonte gravada, não o default', () => {
    const drawing = buildTextDrawing({ fontFamily: 'Georgia' })

    const container = new Container()
    const renderer = createTextLabelsRenderer()

    renderer.draw(container, [drawing], null)

    const textObj = findTextChild(container)
    expect(textObj?.style.fontFamily).toBe('Georgia')
  })

  it('redraw depois de remover fontFamily do drawing volta pro default (não fica preso na fonte anterior)', () => {
    const container = new Container()
    const renderer = createTextLabelsRenderer()

    renderer.draw(container, [buildTextDrawing({ fontFamily: 'Georgia' })], null)
    expect(findTextChild(container)?.style.fontFamily).toBe('Georgia')

    renderer.draw(container, [buildTextDrawing()], null)
    expect(findTextChild(container)?.style.fontFamily).toBe(DEFAULT_TEXT_FONT_FAMILY)
  })
})
