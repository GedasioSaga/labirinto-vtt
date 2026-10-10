/**
 * BALDE e PLANO das texturas: qual forma o clique enche (o desenho pintado de
 * cima, senão a região; o mar não), a parte À VISTA dela (o que está desenhado
 * por cima fica de fora), e as camadas da tela (a mesma textura numa camada só
 * enquanto nenhuma outra encosta; a borracha tira das que já existiam; a
 * memória das máscaras tem teto).
 */
import { describe, expect, it } from 'vitest'
import type { Drawing, PinceladaDeTextura, Region, RegionPoint } from '../types/map'
import { alvoDoBalde, caixaDoAlvo, formaDoBalde } from './baldeDeTextura'
import { ORCAMENTO_DAS_MASCARAS, pixelsDoPlano, planoDasTexturas } from './planoDasTexturas'

const quadrado = (x: number, y: number, lado: number): RegionPoint[] => [
  { x, y },
  { x: x + lado, y },
  { x: x + lado, y: y + lado },
  { x, y: y + lado },
]
const regiao = (id: string, pontos: RegionPoint[], filled = true): Region => ({ id, points: pontos, tag: 'region', fillColor: '#a8776a', fillPattern: 'solid', filled, data: {} }) as Region
const bioma = (id: string, pontos: RegionPoint[], filled = true): Drawing => ({ id, kind: 'polygon', points: pontos, color: '#177c5c', width: 0, filled, fillAlpha: 1 })
const risco = (id: string, pontos: RegionPoint[], width = 4): Drawing => ({ id, kind: 'freehand', points: pontos, color: '#82766b', width })

const ILHA = regiao('ilha', quadrado(0, 0, 1000))
const MATA = bioma('mata', quadrado(100, 100, 300))
const SERRA = risco('serra', [{ x: 150, y: 200 }, { x: 350, y: 200 }])

describe('balde: a forma do clique', () => {
  it('o desenho pintado de cima ganha; fora dele, a região; no mar, nada', () => {
    expect(alvoDoBalde([ILHA], [MATA], { x: 200, y: 200 })).toEqual({ tipo: 'desenho', id: 'mata' })
    expect(alvoDoBalde([ILHA], [MATA], { x: 800, y: 800 })).toEqual({ tipo: 'regiao', id: 'ilha' })
    expect(alvoDoBalde([ILHA], [MATA], { x: 2000, y: 2000 })).toBeNull()
  })

  it('desenho sem fundo e região só contorno não são mancha', () => {
    expect(alvoDoBalde([regiao('rua', quadrado(0, 0, 1000), false)], [bioma('contorno', quadrado(100, 100, 300), false)], { x: 200, y: 200 })).toBeNull()
  })

  it('a parte à vista: na região, todo desenho por cima sai; no desenho, só os de depois', () => {
    const daIlha = formaDoBalde({ tipo: 'regiao', id: 'ilha' }, [ILHA], [MATA, SERRA])
    expect(daIlha?.recortes.map((r) => r.tipo)).toEqual(['area', 'linha'])
    const daMata = formaDoBalde({ tipo: 'desenho', id: 'mata' }, [ILHA], [MATA, SERRA])
    expect(daMata?.recortes).toEqual([{ tipo: 'linha', pontos: SERRA.kind === 'freehand' ? SERRA.points : [], largura: 4, fechada: false }])
    // O desenho de ANTES fica embaixo: não recorta.
    expect(formaDoBalde({ tipo: 'desenho', id: 'mata' }, [ILHA], [SERRA, MATA])?.recortes).toEqual([])
  })

  it('forma que sumiu (apagada, ou fora do recorte do jogador) é null', () => {
    expect(formaDoBalde({ tipo: 'desenho', id: 'nenhum' }, [ILHA], [MATA])).toBeNull()
    expect(caixaDoAlvo({ tipo: 'regiao', id: 'ilha' }, [ILHA], [])).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 })
  })
})

const pincel = (id: string, textura: string, x: number, y: number, raio = 20): PinceladaDeTextura => ({ id, tipo: 'pincel', textura, forca: 1, raio, pontos: [{ x, y }] })
const todas = () => true

describe('plano das camadas', () => {
  it('a mesma textura em lugares que outra não toca fica numa camada só', () => {
    const plano = planoDasTexturas([pincel('a', 'floresta', 0, 0), pincel('b', 'areia', 500, 0), pincel('c', 'floresta', 1000, 0)], [], [], todas)
    expect(plano?.camadas.map((c) => c.textura)).toEqual(['floresta', 'areia'])
    expect(plano?.passos.map((p) => p.camada)).toEqual([0, 1, 0])
  })

  it('repintar por cima de outra textura abre camada nova (a de depois cobre a de antes)', () => {
    const plano = planoDasTexturas([pincel('a', 'floresta', 0, 0), pincel('b', 'areia', 10, 0), pincel('c', 'floresta', 20, 0)], [], [], todas)
    expect(plano?.camadas.map((c) => c.textura)).toEqual(['floresta', 'areia', 'floresta'])
  })

  it('a borracha tira só das camadas que já existiam e encostam nela', () => {
    const borracha: PinceladaDeTextura = { id: 'e', tipo: 'borracha', forca: 1, raio: 20, pontos: [{ x: 0, y: 0 }] }
    const plano = planoDasTexturas([pincel('a', 'floresta', 0, 0), pincel('b', 'areia', 900, 0), borracha, pincel('c', 'neve', 0, 0)], [], [], todas)
    expect(plano?.passos[2]).toMatchObject({ camada: null, apagaDe: [0] })
    // Borracha antes de qualquer tinta não deixa plano.
    expect(planoDasTexturas([borracha], [], [], todas)).toBeNull()
  })

  it('textura que esta tela não tem fica de fora; balde de forma sumida também', () => {
    const plano = planoDasTexturas(
      [pincel('a', 'do-pacote', 0, 0), { id: 'b', tipo: 'balde', textura: 'areia', forca: 1, alvo: { tipo: 'desenho', id: 'sumiu' } }, pincel('c', 'areia', 0, 0)],
      [],
      [],
      (id) => id !== 'do-pacote',
    )
    expect(plano?.camadas.map((c) => c.textura)).toEqual(['areia'])
    expect(plano?.passos).toHaveLength(1)
  })

  it('o balde enche a caixa da forma, com os recortes', () => {
    const plano = planoDasTexturas([{ id: 'b', tipo: 'balde', textura: 'areia', forca: 1, alvo: { tipo: 'regiao', id: 'ilha' } }], [ILHA], [MATA], todas)
    expect(plano?.camadas[0].caixa).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 })
    expect(plano?.passos[0].forma.tipo).toBe('balde')
  })

  it('a memória das máscaras tem teto: o continente inteiro pintado cabe nele', () => {
    const grande = (id: string, textura: string, x: number): PinceladaDeTextura => ({ id, tipo: 'pincel', textura, forca: 1, raio: 3000, pontos: [{ x, y: 0 }, { x: x + 6000, y: 12800 }] })
    const plano = planoDasTexturas([grande('a', 'floresta', 0), grande('b', 'areia', 3000), grande('c', 'neve', 6000), grande('d', 'duna', 9000)], [], [], todas)
    expect(plano).not.toBeNull()
    if (plano === null) return
    expect(pixelsDoPlano(plano)).toBeLessThanOrEqual(ORCAMENTO_DAS_MASCARAS * 1.01)
    for (const c of plano.camadas) expect(Math.max(c.largura, c.altura)).toBeLessThanOrEqual(2048)
  })

  it('as caixas caem na grade de pixels da máscara (camada e passo casam pixel a pixel)', () => {
    const plano = planoDasTexturas([pincel('a', 'floresta', 0.3, 0.7, 10.2)], [], [], todas)
    const c = plano?.camadas[0]
    expect(c).toBeDefined()
    if (c === undefined || plano === null) return
    for (const v of [c.caixa.minX, c.caixa.minY, c.caixa.maxX, c.caixa.maxY]) expect(Math.abs(v * plano.escala - Math.round(v * plano.escala))).toBeLessThan(1e-6)
  })
})
