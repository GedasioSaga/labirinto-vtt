import { describe, expect, it } from 'vitest'
import { createExploration, markRings } from '../exploration'
import type { Region, RegionPoint, Wall } from '../../types/map'
import { portaJaVista, portasDeFora, portasNoTelhado, salasComTetoDe } from './portasDeFora'

/**
 * PORTA VISÍVEL POR CIMA DO TELHADO (pedido de 20/10/2026): só a porta "de
 * fora" — a que está na borda de uma Sala com teto e cujo outro lado não cai
 * dentro de outra Sala com teto — e só a que o jogador vê ou já viu (o ponto
 * meia casa para fora dela na visão ou no explorado).
 */

const GRADE = 40

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function sala(id: string, pontos: RegionPoint[], teto: boolean): Region {
  return { id, points: pontos, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: '', roof: teto } }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, comPorta = true): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: comPorta ? { open: false, locked: false, kind: 'normal' } : null }
}

/** Casa 200..600 com a porta da frente no meio da parede de baixo (y = 600). */
const CASA = sala('casa', retangulo(200, 200, 600, 600), true)
const PORTA_DA_FRENTE = parede('porta-da-frente', 380, 600, 420, 600)
/** Meia casa (20 px) para fora do meio da porta, pela normal: abaixo da casa. */
const FORA_DA_FRENTE: RegionPoint = { x: 400, y: 620 }

describe('portasDeFora — quais portas são de fora', () => {
  it('porta de fora de uma sala com teto: entra, com o ponto meia casa para fora', () => {
    const portas = portasDeFora([PORTA_DA_FRENTE], salasComTetoDe([CASA]), GRADE)
    expect(portas).toHaveLength(1)
    expect(portas[0].parede).toBe(PORTA_DA_FRENTE)
    expect(portas[0].salaIds).toEqual(['casa'])
    expect(portas[0].fora.x).toBeCloseTo(FORA_DA_FRENTE.x, 6)
    expect(portas[0].fora.y).toBeCloseTo(FORA_DA_FRENTE.y, 6)
  })

  it('porta entre duas salas com teto: fica fora', () => {
    const quintal = sala('quintal', retangulo(200, 600, 600, 800), true)
    expect(portasDeFora([PORTA_DA_FRENTE], salasComTetoDe([CASA, quintal]), GRADE)).toEqual([])
  })

  it('porta entre sala com teto e sala sem teto: entra', () => {
    const quintal = sala('quintal', retangulo(200, 600, 600, 800), false)
    const portas = portasDeFora([PORTA_DA_FRENTE], salasComTetoDe([CASA, quintal]), GRADE)
    expect(portas.map((p) => p.parede.id)).toEqual(['porta-da-frente'])
    expect(portas[0].salaIds).toEqual(['casa'])
  })

  it('parede sem porta na borda: fica fora', () => {
    const muro = parede('muro', 380, 600, 420, 600, false)
    expect(portasDeFora([muro], salasComTetoDe([CASA]), GRADE)).toEqual([])
  })

  it('porta fora da borda (divisória de dentro, ou solta no campo): fica fora', () => {
    const deDentro = parede('de-dentro', 380, 400, 420, 400)
    const noCampo = parede('no-campo', 380, 700, 420, 700)
    // Encosta na borda só com uma ponta: o traço inteiro tem de estar nela.
    const atravessada = parede('atravessada', 600, 380, 640, 380)
    expect(portasDeFora([deDentro, noCampo, atravessada], salasComTetoDe([CASA]), GRADE)).toEqual([])
  })

  it('o lado de fora vale em qualquer parede e em qualquer sentido de desenho do polígono', () => {
    const esquerda = parede('esquerda', 200, 420, 200, 380)
    const antiHorario = sala('casa', [...retangulo(200, 200, 600, 600)].reverse(), true)
    const portas = portasDeFora([esquerda], salasComTetoDe([antiHorario]), GRADE)
    expect(portas).toHaveLength(1)
    expect(portas[0].fora.x).toBeCloseTo(180, 6)
    expect(portas[0].fora.y).toBeCloseTo(400, 6)
  })

  it('quarto encostado na parede de fora da casa: a porta é de fora das duas', () => {
    const quarto = { ...sala('quarto', retangulo(300, 400, 500, 600), true), parentId: 'casa' }
    const portas = portasDeFora([PORTA_DA_FRENTE], salasComTetoDe([CASA, quarto]), GRADE)
    expect(portas).toHaveLength(1)
    expect(portas[0].salaIds).toEqual(['casa', 'quarto'])
  })

  it('porta do quarto que dá para dentro da casa: fica fora (o outro lado tem teto)', () => {
    const quarto = { ...sala('quarto', retangulo(300, 300, 500, 500), true), parentId: 'casa' }
    const portaDoQuarto = parede('porta-do-quarto', 380, 500, 420, 500)
    expect(portasDeFora([portaDoQuarto], salasComTetoDe([CASA, quarto]), GRADE)).toEqual([])
  })

  it('grade inválida ou porta de comprimento zero: nenhuma (na dúvida, o telhado cobre como antes)', () => {
    expect(portasDeFora([PORTA_DA_FRENTE], salasComTetoDe([CASA]), 0)).toEqual([])
    expect(portasDeFora([PORTA_DA_FRENTE], salasComTetoDe([CASA]), Number.NaN)).toEqual([])
    expect(portasDeFora([parede('ponto', 400, 600, 400, 600)], salasComTetoDe([CASA]), GRADE)).toEqual([])
  })

  it('salasComTetoDe: só Sala com teto e polígono de verdade', () => {
    const semTeto = sala('sem-teto', retangulo(0, 0, 100, 100), false)
    const quebrada = sala('quebrada', [{ x: 0, y: 0 }, { x: 10, y: 0 }], true)
    expect(salasComTetoDe([CASA, semTeto, quebrada]).map((s) => s.id)).toEqual(['casa'])
  })
})

describe('portaJaVista — a névoa decide', () => {
  const [porta] = portasDeFora([PORTA_DA_FRENTE], salasComTetoDe([CASA]), GRADE)

  it('ponto de fora na visão de agora: vista', () => {
    expect(portaJaVista(porta, [retangulo(300, 610, 500, 700)], undefined)).toBe(true)
  })

  it('ponto de fora no explorado: vista', () => {
    const explorado = createExploration({ width: 1000, height: 1000, grid: GRADE })
    markRings(explorado, [retangulo(300, 610, 500, 700)])
    expect(portaJaVista(porta, [], explorado)).toBe(true)
  })

  it('ponto de fora nem na visão nem no explorado (a porta dos fundos): não vista', () => {
    const explorado = createExploration({ width: 1000, height: 1000, grid: GRADE })
    markRings(explorado, [retangulo(700, 700, 900, 900)])
    expect(portaJaVista(porta, [retangulo(700, 100, 900, 300)], explorado)).toBe(false)
    expect(portaJaVista(porta, [], undefined)).toBe(false)
  })
})

describe('portasNoTelhado — só debaixo de telhado à vista', () => {
  const portas = portasDeFora([PORTA_DA_FRENTE], salasComTetoDe([CASA]), GRADE)
  const VISAO = [retangulo(300, 610, 500, 700)]

  it('telhado visível e porta vista: a parede vai para o desenho', () => {
    expect(portasNoTelhado(portas, new Set(['casa']), VISAO, undefined)).toEqual([PORTA_DA_FRENTE])
  })

  it('telhado já sumido (o jogador entrou): nenhuma', () => {
    expect(portasNoTelhado(portas, new Set<string>(), VISAO, undefined)).toEqual([])
  })

  it('porta nunca vista: nenhuma', () => {
    expect(portasNoTelhado(portas, new Set(['casa']), [], undefined)).toEqual([])
  })
})
