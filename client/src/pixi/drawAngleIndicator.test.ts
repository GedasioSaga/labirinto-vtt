import { describe, expect, it } from 'vitest'
import { Container, Text } from 'pixi.js'
import { createAngleIndicatorRenderer } from './drawAngleIndicator'
import { resolveStrokeLabelPosition, type WorldViewport } from './drawDimensionLabel'

const VIEWPORT: WorldViewport = { left: -1000, top: -1000, right: 1000, bottom: 1000 }

/** Type guard no lugar de `as Text`, mesmo padrão de drawDimensionLabel.test.ts. */
function textoDe(container: Container): Text | undefined {
  return container.children.find((child): child is Text => child instanceof Text)
}

describe('createAngleIndicatorRenderer (rótulo "comprimento · ângulo" do traço)', () => {
  it('nasce onde resolveStrokeLabelPosition manda, branco com contorno escuro como o rótulo das formas', () => {
    const container = new Container()
    const renderer = createAngleIndicatorRenderer()
    const from = { x: 300, y: 0 }
    const end = { x: 0, y: 0 }

    renderer.show(container, from, end, '4,7 m · 180,0°', VIEWPORT)

    const texto = textoDe(container)
    expect(texto?.text).toBe('4,7 m · 180,0°')
    expect(texto?.visible).toBe(true)
    expect({ x: texto?.x, y: texto?.y }).toEqual(resolveStrokeLabelPosition(from, end, '4,7 m · 180,0°', VIEWPORT))
    // Conferência guias-4e5: o cinza sem contorno sumia sobre o chão da sala.
    expect(texto?.style.fill).toBe(0xffffff)
    expect(texto?.style.stroke).toMatchObject({ color: 0x000000 })
  })

  it('show repetido reusa o MESMO Text, e hide esconde sem remover', () => {
    const container = new Container()
    const renderer = createAngleIndicatorRenderer()

    renderer.show(container, { x: 0, y: 0 }, { x: 100, y: 0 }, '1,5 m · 0,0°', VIEWPORT)
    renderer.show(container, { x: 0, y: 0 }, { x: 200, y: 0 }, '3,0 m · 0,0°', VIEWPORT)
    expect(container.children.filter((child) => child instanceof Text)).toHaveLength(1)
    expect(textoDe(container)?.text).toBe('3,0 m · 0,0°')

    renderer.hide()
    expect(textoDe(container)?.visible).toBe(false)
    expect(container.children).toHaveLength(1)
  })

  it('hide antes de qualquer show não lança', () => {
    expect(() => createAngleIndicatorRenderer().hide()).not.toThrow()
  })
})
