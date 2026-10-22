import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { DOOR_COLOR, DOOR_TO_CROSS_COLOR, DOOR_TO_CROSS_DOT_SCREEN_PX, drawDoors, type PortaAnimando } from './drawDoors'
import { animacaoDePorta } from '../portas/animacoesDePorta'
import type { Wall } from '../types/map'

/**
 * PORTAS POR ATRAVESSAR na tela do jogador: a porta marcada ganha um ponto
 * claro pequeno no meio do retângulo — estilo minimapa, sem ícone nem halo. A
 * porta sem marca desenha exatamente como sempre.
 */

function porta(id: string, x: number, open = false): Wall {
  return { id, x1: x, y1: 0, x2: x + 40, y2: 0, blocksLight: true, blocksMove: true, door: { open, locked: false, kind: 'normal' } }
}

function fills(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

function circulos(g: Graphics) {
  return fills(g).flatMap((i) => {
    if (i.action !== 'fill') return []
    return i.data.path.instructions.filter((p) => p.action === 'circle').map((p) => ({ data: p.data as number[], color: i.data.style.color }))
  })
}

describe('drawDoors: marca de porta por atravessar', () => {
  it('sem marca, nenhum ponto: o desenho de sempre', () => {
    const g = new Graphics()
    drawDoors(g, [porta('pa', 0), porta('pb', 100)], null)
    expect(circulos(g)).toEqual([])
    // Duas portas, cada uma o contorno e a cor.
    expect(fills(g)).toHaveLength(4)
  })

  it('porta marcada ganha UM ponto claro no meio do vão; a outra fica igual', () => {
    const g = new Graphics()
    drawDoors(g, [porta('pa', 0), porta('pb', 100)], null, 1, 1, new Set(['pb']))
    const pontos = circulos(g)
    expect(pontos).toHaveLength(1)
    const [cx, cy, raio] = pontos[0].data
    // Centro alinhado ao pixel físico, como o retângulo da porta: até meio pixel do meio exato.
    expect(Math.abs(cx - 120)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(cy)).toBeLessThanOrEqual(0.5)
    expect(raio).toBeGreaterThan(0)
    expect(raio).toBeLessThanOrEqual(DOOR_TO_CROSS_DOT_SCREEN_PX)
    expect(pontos[0].color).toBe(DOOR_TO_CROSS_COLOR)
    expect(DOOR_TO_CROSS_COLOR).not.toBe(DOOR_COLOR)
  })

  it('porta aberta marcada também leva o ponto, na cor da porta (o miolo da aberta já é escuro)', () => {
    const g = new Graphics()
    drawDoors(g, [porta('pa', 0, true)], null, 2, 1, new Set(['pa']))
    const pontos = circulos(g)
    expect(pontos).toHaveLength(1)
    expect(pontos[0].color).toBe(DOOR_COLOR)
  })

  it('o ponto escuro cabe na folha fechada: o raio é menor que a meia espessura da cor, em px de tela', () => {
    expect(DOOR_TO_CROSS_COLOR).toBe(0x15181a)
    expect(DOOR_TO_CROSS_DOT_SCREEN_PX).toBeLessThanOrEqual((4 - 1) / 2)
  })

  it('parede sem porta com o id na lista não ganha ponto', () => {
    const g = new Graphics()
    const muro: Wall = { ...porta('muro', 0), door: null }
    drawDoors(g, [muro], null, 1, 1, new Set(['muro']))
    expect(circulos(g)).toEqual([])
  })
})

/**
 * Com a porta ANDANDO, o que fica debaixo do ponto muda (folha creme, chão,
 * miolo escuro). Antes, a cor saía do estado FINAL: abrindo, ponto creme sobre
 * a folha creme; fechando, escuro sobre o escuro — sumia. A prova no pixel, com
 * o renderizador de verdade, é a M15 de docs/design/porta-animacoes/app.
 */
describe('drawDoors: o ponto de porta por atravessar com a porta andando', () => {
  const ZOOM = 2

  /** O ponto da porta no estado final de quem anda, desenhada pela animação embutida Girar em `progresso`. */
  function pontoAndando(progresso: number, abrindo = true) {
    const animacao = animacaoDePorta('girar')
    if (animacao === null) throw new Error('girar é embutida')
    const g = new Graphics()
    const andando = new Map<string, PortaAnimando>([['pa', { animacao, progresso, abrindo }]])
    drawDoors(g, [porta('pa', 0, abrindo)], null, ZOOM, 1, new Set(['pa']), andando)
    return circulos(g).map((c) => ({ raioPx: c.data[2] * ZOOM, color: c.color }))
  }

  function pontoParado(aberta: boolean) {
    const g = new Graphics()
    drawDoors(g, [porta('pa', 0, aberta)], null, ZOOM, 1, new Set(['pa']))
    return circulos(g).map((c) => ({ raioPx: c.data[2] * ZOOM, color: c.color }))
  }

  it('nos extremos é o ponto da porta parada, nos dois sentidos: escuro em 0, na cor da porta em 1', () => {
    for (const abrindo of [true, false]) {
      expect(pontoAndando(0, abrindo)).toEqual(pontoParado(false))
      expect(pontoAndando(1, abrindo)).toEqual(pontoParado(true))
    }
    expect(pontoParado(false)).toEqual([{ raioPx: DOOR_TO_CROSS_DOT_SCREEN_PX, color: DOOR_TO_CROSS_COLOR }])
    expect(pontoParado(true)).toEqual([{ raioPx: DOOR_TO_CROSS_DOT_SCREEN_PX, color: DOOR_COLOR }])
  })

  it('no caminho tem os dois tons: o miolo escuro de 1,5 px (a faixa clara da folha) e o anel na cor da porta de pelo menos 0,7 px (o contorno, o chão, o miolo da aberta)', () => {
    for (const abrindo of [true, false]) {
      for (const p of [0.25, 0.5, 0.75]) {
        const [anel, miolo] = pontoAndando(p, abrindo)
        expect(anel.color).toBe(DOOR_COLOR)
        expect(miolo.color).toBe(DOOR_TO_CROSS_COLOR)
        expect(miolo.raioPx).toBeCloseTo(DOOR_TO_CROSS_DOT_SCREEN_PX)
        expect(anel.raioPx - miolo.raioPx).toBeGreaterThanOrEqual(0.7)
      }
    }
  })

  it('cresce e encolhe sem salto: a cada 1% de progresso os raios andam no máximo 0,1 px de tela', () => {
    const raios = (p: number) => {
      const pontos = pontoAndando(p)
      const de = (cor: number) => pontos.find((c) => c.color === cor)?.raioPx ?? 0
      return [de(DOOR_COLOR), de(DOOR_TO_CROSS_COLOR)]
    }
    let antes = raios(0)
    for (let i = 1; i <= 100; i += 1) {
      const agora = raios(i / 100)
      // O disco claro coberto pelo escuro do mesmo tamanho (em 0) não é pintado: conta como o raio do escuro.
      const claroAntes = Math.max(antes[0], antes[1])
      const claroAgora = Math.max(agora[0], agora[1])
      expect(Math.abs(claroAgora - claroAntes)).toBeLessThanOrEqual(0.1)
      expect(Math.abs(agora[1] - antes[1])).toBeLessThanOrEqual(0.1)
      antes = agora
    }
  })
})
