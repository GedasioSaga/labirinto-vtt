import { describe, expect, it, vi } from 'vitest'
import { Container, Text } from 'pixi.js'
import type { Pin } from '../types/map'
import { createPinsRenderer } from './drawPins'

/**
 * O nome só do mestre aparece AO LADO do pino no editor ("Faca" junto do "?").
 * O mesmo renderer desenha o mapa do jogador: lá o nome nunca é desenhado,
 * mesmo que um pino chegasse com ele.
 */

const FACA: Pin = { id: 'faca', x: 100, y: 200, kind: 'interrogacao', description: 'Lâmina suja.', image: null, nome: 'Faca' }

function textos(container: Container): Text[] {
  return container.children.filter((child): child is Text => child instanceof Text)
}

function nomeVisivel(container: Container): Text | undefined {
  return textos(container).find((t) => t.visible && t.text === 'Faca')
}

describe('drawPins: nome do mestre ao lado do pino', () => {
  it('no editor, "Faca" é desenhado à direita da cabeça do pino', () => {
    const container = new Container()
    createPinsRenderer({ showNames: true }).draw(container, [FACA], null)
    const nome = nomeVisivel(container)
    expect(nome).toBeDefined()
    expect(nome?.position.x).toBeGreaterThan(FACA.x)
    expect(nome?.position.y).toBeLessThan(FACA.y)
  })

  it('no mapa do jogador (renderer sem nomes), o nome não é desenhado', () => {
    const container = new Container()
    createPinsRenderer().draw(container, [FACA], null)
    expect(nomeVisivel(container)).toBeUndefined()
    // O glifo "?" continua lá: o pino em si é desenhado.
    expect(textos(container).map((t) => t.text)).toEqual(['?'])
  })

  it('pino sem nome (mapa antigo) não ganha rótulo; apagar o nome esconde o rótulo sem destruir', () => {
    const container = new Container()
    const renderer = createPinsRenderer({ showNames: true })
    const { nome: _nome, ...semNome } = FACA
    renderer.draw(container, [semNome], null)
    expect(textos(container).filter((t) => t.visible).map((t) => t.text)).toEqual(['?'])

    renderer.draw(container, [FACA], null)
    const rotulo = nomeVisivel(container)
    expect(rotulo).toBeDefined()
    const destroySpy = vi.spyOn(Text.prototype, 'destroy')
    renderer.draw(container, [{ ...FACA, nome: '   ' }], null)
    expect(destroySpy).not.toHaveBeenCalled()
    expect(rotulo?.visible).toBe(false)
    destroySpy.mockRestore()
  })
})
