import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Sprite } from 'pixi.js'
import { createPropsRenderer } from './drawProps'
import type { Prop } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

function buildProp(overrides: Partial<Prop> = {}): Prop {
  return { id: 'p1', src: 'C:\\imgs\\barril.png', x: 100, y: 100, width: 64, height: 64, linkedMapPath: null, ...overrides }
}

function spriteOf(container: Container): Sprite {
  const sprite = container.children.find((c) => c instanceof Sprite)
  if (!sprite) throw new Error('sem sprite')
  return sprite as Sprite
}

function highlightOf(container: Container): Graphics {
  const g = container.children.find((c) => c instanceof Graphics)
  if (!g) throw new Error('sem graphics de destaque')
  return g as Graphics
}

describe('createPropsRenderer — objeto "Oculto no editor" como fantasma', () => {
  it('oculto continua visível (clicável), bem transparente e com contorno tracejado', () => {
    const container = new Container()
    createPropsRenderer().draw(container, [buildProp({ hidden: true })], null)

    const sprite = spriteOf(container)
    expect(sprite.visible).toBe(true)
    expect(sprite.alpha).toBeCloseTo(0.3, 6)
    const strokesList = highlightOf(container).context.instructions.filter((i) => i.action === 'stroke')
    expect(strokesList).toHaveLength(1)
    // Tracejado: vários subtraços (moveTo) no mesmo stroke, não um retângulo contínuo.
    const stroke = strokesList[0]
    if (stroke.action !== 'stroke') throw new Error('instrução inesperada')
    expect(stroke.data.path.instructions.filter((i) => i.action === 'moveTo').length).toBeGreaterThan(4)
  })

  it('oculto e selecionado: mantém o fantasma e ganha o destaque de seleção', () => {
    const container = new Container()
    createPropsRenderer().draw(container, [buildProp({ hidden: true })], 'p1')
    const strokesList = highlightOf(container).context.instructions.filter((i) => i.action === 'stroke')
    expect(strokesList).toHaveLength(2)
  })

  it('normal não ganha contorno; desocultar tira o fantasma', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    renderer.draw(container, [buildProp({ hidden: true })], null)
    renderer.draw(container, [buildProp({ hidden: false })], null)

    expect(spriteOf(container).alpha).toBe(1)
    expect(highlightOf(container).context.instructions).toHaveLength(0)
  })
})
