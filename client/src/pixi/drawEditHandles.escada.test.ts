import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawEditHandles } from './drawEditHandles'
import { createEmptyMap } from '../lib/mapFactory'
import { stairHandles } from '../lib/stairHandles'
import { CORNER_HANDLE_KEYLINE_COLOR, SELECTION_COLOR } from './constants'
import type { MapData, Stair } from '../types/map'

function escada(overrides: Partial<Stair> = {}): Stair {
  return { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 140, y1: 420, x2: 140, y2: 140 }], stepWidth: 70, ...overrides }
}

function mapaCom(stair: Stair): MapData {
  return { ...createEmptyMap('t', 'Teste', 20, 16, 70), stairs: [stair] }
}

const SELECAO = { kind: 'stair' as const, id: 's1' }

function desenhar(stair: Stair, tool: 'select' | 'stair' = 'select', cameraScale = 1): Graphics {
  const g = new Graphics()
  drawEditHandles(g, mapaCom(stair), SELECAO, tool, { cameraScale })
  return g
}

const conta = (g: Graphics, action: 'fill' | 'stroke') => g.context.instructions.filter((i) => i.action === action).length

/** Centros dos chips amarelos (`rect` pintado de SELECTION_COLOR). */
function centrosDosChips(g: Graphics): { x: number; y: number }[] {
  return g.context.instructions.flatMap((i) => {
    if (i.action !== 'fill' || i.data.style.color !== SELECTION_COLOR) return []
    return i.data.path.instructions.flatMap((passo) => {
      if (passo.action !== 'rect') return []
      const [x, y, w, h] = passo.data as [number, number, number, number] // passo 'rect' do Pixi: data é (x, y, largura, altura); o tipo dele é a união de todos os passos
      return [{ x: x + w / 2, y: y + h / 2 }]
    })
  })
}

describe('drawEditHandles — escada selecionada', () => {
  it('reta: chips nas duas pontas e nas duas laterais, e a alça vazada de curvar no meio', () => {
    const g = desenhar(escada())
    // 4 chips (faixa escura + amarelo cada) + o fundo escuro da vazada.
    expect(conta(g, 'fill')).toBe(4 * 2 + 1)
    // O aro amarelo da vazada.
    expect(conta(g, 'stroke')).toBe(1)
    const esperado = stairHandles(escada())
      .filter((h) => h.kind !== 'curve')
      .map((h) => h.point)
    expect(centrosDosChips(g)).toEqual(esperado)
  })

  it('curva: as alças acompanham o meio do arco', () => {
    const curva = escada({ curva: 70 })
    const lateral = stairHandles(curva).find((h) => h.kind === 'side-left')?.point
    expect(centrosDosChips(desenhar(curva))).toContainEqual(lateral)
  })

  it('espiral: só as pontas do diâmetro', () => {
    const g = desenhar(escada({ shape: 'spiral' }))
    expect(conta(g, 'fill')).toBe(2 * 2)
    expect(conta(g, 'stroke')).toBe(0)
  })

  it('travada não tem alça; fora da ferramenta Selecionar também não', () => {
    expect(desenhar(escada({ locked: true })).context.instructions).toHaveLength(0)
    expect(desenhar(escada(), 'stair').context.instructions).toHaveLength(0)
  })

  it('a alça de curvar tem a faixa escura em volta, como os pontos-chave', () => {
    const g = desenhar(escada())
    const fundo = g.context.instructions.filter((i) => i.action === 'fill' && i.data.style.color === CORNER_HANDLE_KEYLINE_COLOR)
    expect(fundo.length).toBe(4 + 1)
  })
})
