import { describe, expect, it } from 'vitest'
import { Container, Text } from 'pixi.js'
import { createDimensionLabelRenderer, resolveDimensionLabelPosition, type WorldViewport } from './drawDimensionLabel'

/** Type guard evita `as Text` no ponto de uso — mesmo padrão de
 *  drawTextLabels.test.ts (`findTextChild`). */
function findTextChild(container: Container): Text | undefined {
  return container.children.find((child): child is Text => child instanceof Text)
}

// Viewport "grande", âncora bem no meio — nenhum teste de canto usa este
// valor perto de nenhuma borda, então serve de baseline "longe de tudo".
const ROOMY_VIEWPORT: WorldViewport = { left: -1000, top: -1000, right: 1000, bottom: 1000 }

describe('resolveDimensionLabelPosition', () => {
  it('longe de toda borda: nasce acima e à direita da âncora (mesmo canto do indicador de ângulo)', () => {
    const anchor = { x: 0, y: 0 }
    const position = resolveDimensionLabelPosition(anchor, '10 ft × 5 ft', ROOMY_VIEWPORT)
    expect(position.x).toBeGreaterThan(anchor.x)
    expect(position.y).toBeLessThan(anchor.y)
  })

  it('perto da borda DIREITA: troca pra esquerda em vez de cortar o texto', () => {
    const anchor = { x: 995, y: 0 } // só 5px de sobra à direita num viewport que vai até 1000
    const position = resolveDimensionLabelPosition(anchor, '20 ft × 10 ft', ROOMY_VIEWPORT)
    expect(position.x).toBeLessThan(anchor.x)
  })

  it('perto da borda ESQUERDA: continua no lado padrão (direita), não troca sem necessidade', () => {
    const anchor = { x: -995, y: 0 }
    const position = resolveDimensionLabelPosition(anchor, '20 ft × 10 ft', ROOMY_VIEWPORT)
    expect(position.x).toBeGreaterThan(anchor.x)
  })

  it('perto da borda SUPERIOR: troca pra abaixo da âncora em vez de cortar o texto', () => {
    const anchor = { x: 0, y: -995 }
    const position = resolveDimensionLabelPosition(anchor, '10 ft × 5 ft', ROOMY_VIEWPORT)
    expect(position.y).toBeGreaterThan(anchor.y)
  })

  it('perto da borda INFERIOR: continua no lado padrão (acima), não troca sem necessidade', () => {
    const anchor = { x: 0, y: 995 }
    const position = resolveDimensionLabelPosition(anchor, '10 ft × 5 ft', ROOMY_VIEWPORT)
    expect(position.y).toBeLessThan(anchor.y)
  })

  it('canto inferior-direito: troca pra esquerda (pouco espaço à direita), mas mantém acima (sobra espaço lá)', () => {
    const anchor = { x: 995, y: 995 }
    const position = resolveDimensionLabelPosition(anchor, '20 ft × 10 ft', ROOMY_VIEWPORT)
    expect(position.x).toBeLessThan(anchor.x)
    // Assimetria intencional (ver comentário de `goBelow` em drawDimensionLabel.ts):
    // só troca pra "abaixo" quando falta espaço ACIMA, nunca por falta de
    // espaço abaixo — perto da borda inferior o lado padrão (acima) já tem
    // espaço de sobra, então continua acima mesmo colado embaixo.
    expect(position.y).toBeLessThan(anchor.y)
  })

  it('viewport bem menor que o rótulo (zoom extremo): o clamp mantém o rótulo dentro do viewport, sem NaN', () => {
    const tinyViewport: WorldViewport = { left: 0, top: 0, right: 20, bottom: 20 }
    const anchor = { x: 10, y: 10 }
    const position = resolveDimensionLabelPosition(anchor, 'um rótulo bem comprido de verdade', tinyViewport)
    expect(Number.isFinite(position.x)).toBe(true)
    expect(Number.isFinite(position.y)).toBe(true)
    // Nunca fica pior que colado na borda esquerda/superior do viewport —
    // não necessariamente dentro (o rótulo pode ser mais largo que o
    // viewport inteiro), mas nunca "voa" pra fora em direção oposta.
    expect(position.x).toBeGreaterThanOrEqual(tinyViewport.left)
    expect(position.y).toBeGreaterThanOrEqual(tinyViewport.top)
  })

  it('rótulo vazio não lança e devolve posição finita', () => {
    const position = resolveDimensionLabelPosition({ x: 0, y: 0 }, '', ROOMY_VIEWPORT)
    expect(Number.isFinite(position.x)).toBe(true)
    expect(Number.isFinite(position.y)).toBe(true)
  })
})

describe('createDimensionLabelRenderer', () => {
  it('show cria um único Text, com o texto e a cor de contorno esperados', () => {
    const container = new Container()
    const renderer = createDimensionLabelRenderer()

    renderer.show(container, { x: 0, y: 0 }, '10 ft × 5 ft', ROOMY_VIEWPORT)

    const text = findTextChild(container)
    expect(text).toBeDefined()
    expect(text?.text).toBe('10 ft × 5 ft')
    expect(text?.visible).toBe(true)
    expect(text?.style.fill).toBe(0xffffff)
  })

  it('show repetido reusa o MESMO objeto Text (não acumula um por chamada)', () => {
    const container = new Container()
    const renderer = createDimensionLabelRenderer()

    renderer.show(container, { x: 0, y: 0 }, '10 ft', ROOMY_VIEWPORT)
    renderer.show(container, { x: 50, y: 50 }, '20 ft', ROOMY_VIEWPORT)

    const textChildren = container.children.filter((child): child is Text => child instanceof Text)
    expect(textChildren).toHaveLength(1)
    expect(textChildren[0]?.text).toBe('20 ft')
  })

  it('hide esconde o rótulo sem removê-lo do container', () => {
    const container = new Container()
    const renderer = createDimensionLabelRenderer()

    renderer.show(container, { x: 0, y: 0 }, '10 ft', ROOMY_VIEWPORT)
    renderer.hide()

    const text = findTextChild(container)
    expect(text?.visible).toBe(false)
    expect(container.children).toHaveLength(1)
  })

  it('hide antes de qualquer show não lança (draft cancelado antes do primeiro pointermove)', () => {
    const renderer = createDimensionLabelRenderer()
    expect(() => renderer.hide()).not.toThrow()
  })
})
