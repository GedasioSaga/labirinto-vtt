/**
 * A LUZ SOLTA (Luz L3, decisão D4; Fase 6 de 16/11/2026): a ferramenta Luz cria
 * uma `Light` normal, sem vínculo com móvel, que já nasce acesa só à tarde e à
 * noite. A tocha, o lampião e a fogueira deixaram de ser presets: são objetos, e
 * a luz vem deles (`lib/luzDoFogo.ts`).
 */
import { describe, expect, it } from 'vitest'
import { buildLightAt } from './drawingFactory'
import { luzDoObjeto } from './luzDoFogo'
import { OBJETOS_DE_LUZ, luzSolta } from './presetsDeLuz'

const GRID = 64
const PONTO = { x: 320, y: 192 }

describe('luzSolta', () => {
  it('a Luz de sempre: o mesmo raio, cor e força de hoje, e acesa à tarde e à noite', () => {
    const hoje = buildLightAt('id-2', PONTO, GRID)
    expect(luzSolta('id-2', PONTO, GRID)).toEqual({ ...hoje, acesaEm: ['tarde', 'noite'] })
  })

  it('arrastar escolhe o raio', () => {
    expect(luzSolta('id-3', PONTO, GRID, 77).radius).toBe(77)
  })

  it('sem vínculo com móvel nem ficha (D4), e cada luz tem a própria lista', () => {
    const a = luzSolta('a', PONTO, GRID)
    const b = luzSolta('b', PONTO, GRID)
    expect('attachedTokenId' in a).toBe(false)
    expect(a.acesaEm).not.toBe(b.acesaEm)
  })
})

describe('os fogos que iluminam, no lugar dos presets', () => {
  it('Tocha, Lampião e Fogueira apontam objetos que acendem sozinhos', () => {
    expect(OBJETOS_DE_LUZ.map((o) => o.rotulo)).toEqual(['Tocha', 'Lampião', 'Fogueira'])
    for (const { tipo } of OBJETOS_DE_LUZ) expect(luzDoObjeto({ id: tipo, x: 0, y: 0, mobilia: tipo, width: 64, height: 64 }), tipo).not.toBeNull()
  })
})
