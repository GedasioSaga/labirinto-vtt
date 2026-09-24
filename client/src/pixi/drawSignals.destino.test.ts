import { Container, Text } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import type { DestinationMark } from '../lib/signals'
import { createDestinationsRenderer, destinationLabel } from './drawSignals'

const VIEWPORT = { width: 800, height: 600 }
const CAMERA = { x: 0, y: 0, scale: 1 }

const ELISA: DestinationMark = { x: 200, y: 300, from: 'Elisa', color: '#3cff00', mine: false }
const MINHA: DestinationMark = { x: 400, y: 100, from: 'Caio', color: '#2255ff', mine: true }

function rotulosVisiveis(layer: Container): string[] {
  return layer.children.filter((c): c is Text => c instanceof Text && c.visible).map((t) => t.text)
}

describe('marca "vamos para cá" no canvas', () => {
  it('o rótulo diz de quem é a marca; a própria diz "Meu destino"', () => {
    expect(destinationLabel(ELISA)).toBe('Elisa: vamos para cá')
    expect(destinationLabel(MINHA)).toBe('Meu destino')
  })

  it('desenha uma bandeirinha por marca, sem prazo, e esconde a que saiu da lista', () => {
    const layer = new Container()
    const renderer = createDestinationsRenderer()
    expect(renderer.draw(layer, [ELISA, MINHA], CAMERA, VIEWPORT)).toBe(2)
    expect(rotulosVisiveis(layer)).toEqual(['Elisa: vamos para cá', 'Meu destino'])
    // Tirou a marca: a view volta ao pool, escondida.
    expect(renderer.draw(layer, [MINHA], CAMERA, VIEWPORT)).toBe(1)
    expect(rotulosVisiveis(layer)).toEqual(['Meu destino'])
    expect(renderer.draw(layer, [], CAMERA, VIEWPORT)).toBe(0)
    expect(rotulosVisiveis(layer)).toEqual([])
  })
})
