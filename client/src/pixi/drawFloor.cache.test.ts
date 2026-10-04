import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Graphics } from 'pixi.js'
import type { FloorPiece, FloorStyle } from '../types/map'

/*
 * Pedido 03/10/2026: "coloco [o chão] em um lugar muito grande e ele trava; é
 * uma luta para trocar de cor". Trocar a cor de uma peça refazia o contorno
 * inteiro (campo de distância + marching squares) a cada evento do seletor.
 * Aqui se prova que cor não refaz contorno e que desenho novo refaz.
 */
const contornos = vi.hoisted(() => ({ n: 0 }))
vi.mock('../lib/floorContour', async (original) => {
  const real = await original<typeof import('../lib/floorContour')>()
  return {
    ...real,
    buildFloorOutline: (...args: Parameters<typeof real.buildFloorOutline>) => {
      contornos.n += 1
      return real.buildFloorOutline(...args)
    },
  }
})

const { createFloorRenderer } = await import('./drawFloor')

/** Graphics de mentira: guarda as cores de preenchimento de cada repintura. */
function graficoFalso() {
  const fills: number[] = []
  const g = {
    clear: () => {
      fills.length = 0
      return g
    },
    poly: () => g,
    fill: (opts: { color: number }) => {
      fills.push(opts.color)
      return g
    },
    cut: () => g,
    stroke: () => g,
  }
  return { graphics: g as unknown as Graphics, fills }
}

const ESTILO: FloorStyle = { fillColor: '#808080', strokeColor: null, strokeWidth: 0 } as FloorStyle
const FORMA = { kind: 'rect' as const, cx: 100, cy: 100, w: 128, h: 128 }
const MODS = {}
const peca = (fillColor?: string): FloorPiece => ({ id: 'p', shape: FORMA, op: 'add', modifiers: MODS, fillColor })

describe('createFloorRenderer — trocar a cor não refaz o contorno', () => {
  beforeEach(() => {
    contornos.n = 0
  })

  it('cor nova numa peça que já tem cor: repinta com a cor nova, zero contornos novos', () => {
    const r = createFloorRenderer()
    const { graphics, fills } = graficoFalso()
    r.draw(graphics, [peca('#ff0000')], ESTILO)
    const depoisDoPrimeiro = contornos.n
    expect(depoisDoPrimeiro).toBeGreaterThan(0)
    for (const cor of ['#00ff00', '#0000ff', '#123456']) {
      r.draw(graphics, [peca(cor)], ESTILO)
      expect(fills.at(-1)).toBe(Number.parseInt(cor.slice(1), 16))
    }
    expect(contornos.n).toBe(depoisDoPrimeiro)
  })

  it('a peça ganha cor própria pela primeira vez: só as camadas de cor são refeitas, não o contorno do chão', () => {
    const r = createFloorRenderer()
    const { graphics } = graficoFalso()
    r.draw(graphics, [peca()], ESTILO)
    const antes = contornos.n
    r.draw(graphics, [peca('#ff0000')], ESTILO)
    // Peça única: a camada dela É o contorno do chão, já pronto (camadas do
    // pincel, 03/10/2026). Antes era 1 (a camada recontornada); nunca o chão de novo.
    expect(contornos.n - antes).toBe(0)
  })

  it('mover a peça (forma nova) refaz o contorno', () => {
    const r = createFloorRenderer()
    const { graphics } = graficoFalso()
    r.draw(graphics, [peca()], ESTILO)
    const antes = contornos.n
    r.draw(graphics, [{ ...peca(), shape: { ...FORMA, cx: 300 } }], ESTILO)
    expect(contornos.n).toBeGreaterThan(antes)
  })

  it('o destaque da peça selecionada não é recontornado quando só a cor dela muda', () => {
    const r = createFloorRenderer()
    const { graphics } = graficoFalso()
    r.drawSelection(graphics, peca('#ff0000'))
    const antes = contornos.n
    r.drawSelection(graphics, peca('#00ff00'))
    expect(contornos.n).toBe(antes)
    r.drawSelection(graphics, { ...peca(), shape: { ...FORMA, w: 64 } })
    expect(contornos.n).toBe(antes + 1)
  })
})
