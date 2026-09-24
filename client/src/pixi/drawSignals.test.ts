import { describe, expect, it } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import type { SignalMark } from '../lib/signals'
import { SIGNAL_EDGE_MARGIN, SIGNAL_RING_DASHES, createSignalsRenderer, placeSignal, signalRingDashes } from './drawSignals'

const VIEWPORT = { width: 800, height: 600 }
const CAMERA = { x: 0, y: 0, scale: 1 }

describe('placeSignal', () => {
  it('ponto dentro da tela fica onde está, já convertido pela câmera', () => {
    expect(placeSignal({ x: 100, y: 50 }, { x: 10, y: 20, scale: 2 }, VIEWPORT)).toEqual({ x: 210, y: 120, onScreen: true, angle: 0 })
  })

  it('ponto à direita fora da tela vira seta presa na borda direita, apontando para a direita', () => {
    const place = placeSignal({ x: 5000, y: 300 }, CAMERA, VIEWPORT)
    expect(place.onScreen).toBe(false)
    expect(place.x).toBeCloseTo(VIEWPORT.width - SIGNAL_EDGE_MARGIN)
    expect(place.y).toBeCloseTo(300)
    expect(place.angle).toBeCloseTo(0)
  })

  it('ponto na diagonal acima e à esquerda fica dentro da margem, na reta centro -> ponto', () => {
    const place = placeSignal({ x: -4000, y: -4000 }, CAMERA, VIEWPORT)
    expect(place.onScreen).toBe(false)
    expect(place.x).toBeGreaterThanOrEqual(SIGNAL_EDGE_MARGIN - 1e-6)
    expect(place.y).toBeGreaterThanOrEqual(SIGNAL_EDGE_MARGIN - 1e-6)
    // Um dos lados encosta na margem.
    expect(Math.min(place.x, place.y)).toBeCloseTo(SIGNAL_EDGE_MARGIN)
    const cross = (place.x - 400) * (-4000 - 300) - (place.y - 300) * (-4000 - 400)
    expect(Math.abs(cross)).toBeLessThan(1e-6)
    expect(Math.cos(place.angle)).toBeLessThan(0)
    expect(Math.sin(place.angle)).toBeLessThan(0)
  })

  it('ponto abaixo usa a borda de baixo', () => {
    const place = placeSignal({ x: 400, y: 9000 }, CAMERA, VIEWPORT)
    expect(place.y).toBeCloseTo(VIEWPORT.height - SIGNAL_EDGE_MARGIN)
    expect(place.x).toBeCloseTo(400)
  })
})

describe('signalRingDashes (eco sem destinatário sai tracejado)', () => {
  it('parte a volta em traços iguais com vão entre eles, sem passar de uma volta', () => {
    const dashes = signalRingDashes()
    expect(dashes).toHaveLength(SIGNAL_RING_DASHES)
    expect(dashes[0]?.[0]).toBe(0)
    const size = (dashes[0]?.[1] ?? 0) - (dashes[0]?.[0] ?? 0)
    for (let i = 0; i < dashes.length; i += 1) {
      const [start, end] = dashes[i] ?? [0, 0]
      expect(end - start).toBeCloseTo(size)
      expect(end).toBeGreaterThan(start)
      // Vão de verdade: o próximo traço começa depois de este acabar.
      const next = dashes[i + 1]?.[0] ?? Math.PI * 2
      expect(next).toBeGreaterThan(end)
    }
    expect(dashes[dashes.length - 1]?.[1]).toBeLessThan(Math.PI * 2)
  })
})

/** Um sinal em (x, y) nascido em t=0; `unheard` só quando pedido. */
function marca(x: number, y: number, unheard: boolean): SignalMark {
  const mark: SignalMark = { id: 's1', x, y, name: 'Ana', color: '#64b5f6', createdAt: 0 }
  if (unheard) mark.unheard = true
  return mark
}

/** Desenha um sinal só e devolve o Graphics dele (o primeiro filho do container). */
function desenhar(mark: SignalMark): Graphics {
  const container = new Container()
  const drawn = createSignalsRenderer().draw(container, [mark], CAMERA, VIEWPORT, 250)
  expect(drawn).toBe(1)
  const g = container.children[0]
  if (!(g instanceof Graphics)) throw new Error('esperava o Graphics do sinal')
  return g
}

type Instrucao = Graphics['context']['instructions'][number]

/** As ações de path (circle, arc, lineTo, poly…) de uma instrução de fill/stroke. */
function acoes(instruction: Instrucao): string[] {
  if (instruction.action !== 'fill' && instruction.action !== 'stroke') return []
  return instruction.data.path.instructions.map((i) => i.action)
}

const strokes = (g: Graphics): Instrucao[] => g.context.instructions.filter((i) => i.action === 'stroke')
const fills = (g: Graphics): Instrucao[] => g.context.instructions.filter((i) => i.action === 'fill')

describe('createSignalsRenderer: o eco com unheard aparece diferente na tela', () => {
  it('na tela, sem unheard: as 3 ondas são círculos inteiros, sem arco', () => {
    const g = desenhar(marca(400, 300, false))
    const ondas = strokes(g).filter((s) => acoes(s).includes('circle'))
    // 3 ondas + o contorno do ponto central.
    expect(ondas).toHaveLength(4)
    expect(strokes(g).some((s) => acoes(s).includes('arc'))).toBe(false)
  })

  it('na tela, com unheard: cada onda vira traços (arcos) e nenhuma onda sai como círculo inteiro', () => {
    const g = desenhar(marca(400, 300, true))
    const arcos = strokes(g).filter((s) => acoes(s).includes('arc'))
    expect(arcos).toHaveLength(3 * SIGNAL_RING_DASHES)
    // Só o contorno do ponto central continua círculo.
    expect(strokes(g).filter((s) => acoes(s).includes('circle'))).toHaveLength(1)
  })

  it('fora da tela, sem unheard: a seta é um triângulo cheio', () => {
    const g = desenhar(marca(5000, 300, false))
    expect(fills(g).filter((f) => acoes(f).includes('poly'))).toHaveLength(1)
    expect(strokes(g).some((s) => acoes(s).includes('lineTo'))).toBe(false)
  })

  it('fora da tela, com unheard: a seta fica vazada e tracejada, então o aviso não some na borda', () => {
    const g = desenhar(marca(5000, 300, true))
    // Sem o triângulo cheio…
    expect(fills(g)).toHaveLength(0)
    // …e com o contorno em traços separados (vários moveTo, um por traço).
    const contorno = strokes(g).flatMap(acoes)
    expect(contorno.filter((a) => a === 'lineTo').length).toBeGreaterThanOrEqual(6)
    expect(contorno.filter((a) => a === 'moveTo').length).toBe(contorno.filter((a) => a === 'lineTo').length)
  })
})
