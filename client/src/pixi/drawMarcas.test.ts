import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { MarcaNoLugar } from '../types/map'
import { BILHETE_PAPEL, GIZ_COR, drawMarcas } from './drawMarcas'

/**
 * BILHETE NO LUGAR no canvas: papel chapado com contorno fino (bilhete) e
 * traço claro de giz com ponta (seta) — vetor, estilo minimapa, sem `Text`.
 */

type Instruction = Graphics['context']['instructions'][number]

const acoes = (g: Graphics): Instruction['action'][] => g.context.instructions.map((i) => i.action)

function coresDePreenchimento(g: Graphics): number[] {
  return g.context.instructions.flatMap((i) => (i.action === 'fill' ? [i.data.style.color] : []))
}

function coresDeTraco(g: Graphics): number[] {
  return g.context.instructions.flatMap((i) => (i.action === 'stroke' ? [i.data.style.color] : []))
}

describe('drawMarcas', () => {
  it('bilhete: papel preenchido com a cor do bilhete e contorno fino', () => {
    const g = new Graphics()
    const bilhete: MarcaNoLugar = { id: 'b', tipo: 'bilhete', x: 100, y: 100, texto: 'oi' }
    drawMarcas(g, [bilhete])
    expect(coresDePreenchimento(g)).toContain(BILHETE_PAPEL)
    expect(acoes(g)).toContain('stroke')
  })

  it('seta: só traço de giz, sem preenchimento de papel', () => {
    const g = new Graphics()
    drawMarcas(g, [{ id: 's', tipo: 'seta', x: 100, y: 100, rumo: 'l' }])
    expect(coresDeTraco(g)).toContain(GIZ_COR)
    expect(coresDePreenchimento(g)).not.toContain(BILHETE_PAPEL)
  })

  it('redesenhar limpa o anterior; lista vazia não deixa nada; ponto torto é pulado', () => {
    const g = new Graphics()
    drawMarcas(g, [{ id: 'b', tipo: 'bilhete', x: 100, y: 100, texto: 'oi' }])
    drawMarcas(g, [])
    expect(g.context.instructions).toEqual([])
    drawMarcas(g, [{ id: 'x', tipo: 'bilhete', x: Number.NaN, y: 1, texto: 'oi' }])
    expect(g.context.instructions).toEqual([])
  })
})
