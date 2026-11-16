import { describe, expect, it } from 'vitest'
import { Graphics, Texture } from 'pixi.js'
import { drawStairs } from './drawStairs'
import type { Stair } from '../types/map'

/**
 * ESCADA COM MATERIAL (pedido de 16/11/2026, item 9): a escada SEM material tem
 * de sair exatamente como antes (mapa velho não muda de cara), e a COM material
 * passa a pintar o degrau na cor do material, não no traço fino de sempre.
 */

const ESCADAS: Stair[] = [
  { id: 'reta', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 200, y2: 0 }], stepWidth: 64 },
  { id: 'reta-desce', shape: 'straight', direction: 'down', segments: [{ x1: 0, y1: 100, x2: 0, y2: 300 }], stepWidth: 96 },
  { id: 'curva', shape: 'straight', direction: 'up', segments: [{ x1: 300, y1: 0, x2: 500, y2: 40 }], stepWidth: 64, curva: 40 },
  { id: 'l', shape: 'l', direction: 'up', segments: [{ x1: 0, y1: 400, x2: 160, y2: 400 }, { x1: 160, y1: 400, x2: 160, y2: 560 }], stepWidth: 64 },
  { id: 'espiral', shape: 'spiral', direction: 'down', segments: [{ x1: 600, y1: 0, x2: 728, y2: 0 }], stepWidth: 64 },
]

/** As instruções do Graphics numa string curta: ação, estilo e pontos (3 casas), sem os objetos internos do Pixi. */
function impressaoDigital(g: Graphics): string {
  const linhas = g.context.instructions.map((instrucao) => {
    if (instrucao.action === 'texture') return 'texture'
    const { style, path } = instrucao.data
    const estilo = [style.color, style.alpha, 'width' in style ? style.width : '', style.texture === Texture.WHITE ? 'branca' : 'textura']
    const passos = path.instructions.map((p) => `${p.action}:${JSON.stringify(p.data, (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))}`)
    return `${instrucao.action}|${estilo.join(',')}|${passos.join(';')}`
  })
  // FNV-1a de 32 bits: o desenho inteiro numa palavra, para o teste não carregar quilômetros de números.
  let hash = 0x811c9dc5
  for (const ch of linhas.join('\n')) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${linhas.length}:${hash.toString(16)}`
}

describe('escada com material', () => {
  it('sem material, sai igual a antes do material existir (retas, curva, L e espiral, com e sem zoom)', () => {
    const g = new Graphics()
    const digitais = [1, 0.4, 2.5].map((zoom) => {
      drawStairs(g, ESCADAS, 'reta', zoom, 1)
      return impressaoDigital(g)
    })
    // Gravado com o código de antes do material (16/11/2026): qualquer mudança no desenho de linhas quebra aqui.
    expect(digitais).toEqual(DIGITAIS_DE_ANTES)
    expect(g.context.instructions.every((i) => i.action !== 'fill' || i.data.style.texture === Texture.WHITE)).toBe(true)
  })
})

const DIGITAIS_DE_ANTES = ['21:4d653417', '21:2440647b', '21:7406681c']
