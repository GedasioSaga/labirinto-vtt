import { Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { buildStairFromDraft } from '../lib/stairs'
import { tracadoDaSalaLivre } from '../lib/tracadoDaSalaLivre'
import { SELECTION_COLOR } from './constants'
import { drawRegionDraft, drawStairDraft, drawWallDraft, STAIR_DRAFT_ALPHA } from './drawDraft'
import { drawStairs } from './drawStairs'
import type { Point } from './world'

const A: Point = { x: 0, y: 0 }
const B: Point = { x: 200, y: 0 }
const C: Point = { x: 200, y: 100 }
const CURSOR: Point = { x: 0, y: 100 }

/** A linha da prévia: os pontos por onde ela passa e se ela volta ao começo. */
function linhaDaPrevia(g: Graphics): { pontos: Point[]; fechada: boolean } {
  const stroke = g.context.instructions.find((instruction) => instruction.action === 'stroke')
  if (!stroke || stroke.action !== 'stroke') throw new Error('a prévia deveria desenhar uma linha')
  const pontos = stroke.data.path.instructions.flatMap((i) => {
    if (i.action !== 'moveTo' && i.action !== 'lineTo') return []
    const [x, y] = i.data
    return typeof x === 'number' && typeof y === 'number' ? [{ x, y }] : []
  })
  const fechada = stroke.data.path.instructions.some((i) => i.action === 'closePath')
  return { pontos, fechada }
}

/** Centro de cada bolinha que marca um clique. */
function centrosDasBolinhas(g: Graphics): Point[] {
  return g.context.instructions.flatMap((instruction) => {
    if (instruction.action !== 'fill') return []
    return instruction.data.path.instructions
      .filter((p) => p.action === 'circle')
      .map((p) => {
        const [x, y] = p.data as number[]
        return { x, y }
      })
  })
}

describe('drawRegionDraft', () => {
  it('Região: linha aberta pelos cliques até o cursor', () => {
    const g = new Graphics()
    drawRegionDraft(g, [A, B, C], CURSOR)
    expect(linhaDaPrevia(g)).toEqual({ pontos: [A, B, C, CURSOR], fechada: false })
  })

  it('sem clique nenhum não desenha nada', () => {
    const g = new Graphics()
    drawRegionDraft(g, [], CURSOR, { modo: 'sala', arredondar: true })
    expect(g.context.instructions).toHaveLength(0)
  })

  describe('Sala livre com Arredondar', () => {
    it('Sala: mostra a MESMA curva fechada que vai ser gravada, com o cursor como próximo canto', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], CURSOR, { modo: 'sala', arredondar: true })
      const gravada = tracadoDaSalaLivre([A, B, C, CURSOR], 'sala', true)
      expect(gravada.fechado).toBe(true)
      expect(linhaDaPrevia(g)).toEqual({ pontos: gravada.pontos, fechada: true })
    })

    it('Sala: logo depois do clique, sem cursor, a curva fechada é a dos cliques', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], null, { modo: 'sala', arredondar: true })
      expect(linhaDaPrevia(g)).toEqual({ pontos: tracadoDaSalaLivre([A, B, C], 'sala', true).pontos, fechada: true })
    })

    it('Sala com um clique só: ainda é uma linha reta até o cursor', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A], B, { modo: 'sala', arredondar: true })
      expect(linhaDaPrevia(g)).toEqual({ pontos: [A, B], fechada: false })
    })

    it('Parede aberta: a curva que vai ser gravada, com as pontas no primeiro clique e no cursor', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], CURSOR, { modo: 'parede', arredondar: true })
      const gravada = tracadoDaSalaLivre([A, B, C, CURSOR], 'parede', true)
      expect(gravada.fechado).toBe(false)
      expect(linhaDaPrevia(g)).toEqual({ pontos: gravada.pontos, fechada: false })
    })

    it('Parede com o cursor no primeiro clique: mostra o contorno fechado, arredondado também ali', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], A, { modo: 'parede', arredondar: true })
      const gravada = tracadoDaSalaLivre([A, B, C, A], 'parede', true)
      expect(gravada.fechado).toBe(true)
      expect(linhaDaPrevia(g)).toEqual({ pontos: gravada.pontos, fechada: true })
    })

    it('as bolinhas continuam nos cliques, que é onde a pessoa mira o próximo', () => {
      const g = new Graphics()
      drawRegionDraft(g, [A, B, C], CURSOR, { modo: 'sala', arredondar: true })
      expect(centrosDasBolinhas(g)).toEqual([A, B, C])
    })
  })

  it('Sala livre com Arredondar desligado: a linha aberta de sempre', () => {
    const g = new Graphics()
    drawRegionDraft(g, [A, B, C], CURSOR, { modo: 'sala', arredondar: false })
    expect(linhaDaPrevia(g)).toEqual({ pontos: [A, B, C, CURSOR], fechada: false })
  })
})

// --------------------------------------------------------------------------
// ESCADA: o que o mestre vê arrastando é o que fica ao soltar
//
// A barra é a própria escada gravada: `drawStairs` pintando o que o pointerup
// do PixiCanvas grava para o mesmo arrasto (`buildStairFromDraft`, com os
// defaults de sentido e forma). A prévia tem de sair igual camada por camada,
// só mais apagada.
// --------------------------------------------------------------------------

type Instrucao = Graphics['context']['instructions'][number]
/** Preenchimento ou traço: a escada não usa textura. */
type Pintura = Exclude<Instrucao, { action: 'texture' }>

function pinturasDe(g: Graphics): Pintura[] {
  return g.context.instructions.map((instrucao) => {
    if (instrucao.action === 'texture') throw new Error('a escada não desenha textura')
    return instrucao
  })
}

/** Tudo o que faz o desenho de uma camada, menos a opacidade: ação, cor, traço e caminho. */
function desenhoSemOpacidade(pintura: Pintura) {
  return {
    acao: pintura.action,
    cor: pintura.data.style.color,
    traco:
      pintura.action === 'stroke'
        ? { largura: pintura.data.style.width, ponta: pintura.data.style.cap, junta: pintura.data.style.join }
        : null,
    caminho: pintura.data.path.instructions,
  }
}

const LARGURA_DO_DEGRAU = 64
const CLIQUE: Point = { x: 0, y: 0 }
const ARRASTO: Point = { x: 200, y: 0 }

/** A escada que o pointerup grava para o mesmo arrasto, pintada pelo pintor do mapa. */
function escadaGravada(inicio: Point, fim: Point, cameraScale?: number, resolucao?: number): Graphics {
  const g = new Graphics()
  drawStairs(g, [buildStairFromDraft('gravada', inicio, fim, LARGURA_DO_DEGRAU)], null, cameraScale, resolucao)
  return g
}

describe('drawStairDraft — a prévia do arrasto é a escada que nasce ao soltar', () => {
  it.each([
    { nome: 'para a direita', inicio: CLIQUE, fim: ARRASTO },
    { nome: 'na diagonal, para trás e para cima', inicio: { x: 300, y: 120 }, fim: { x: 40, y: -90 } },
  ])('$nome: placa, patamar, degraus e moldura da gravada, com a mesma geometria e as mesmas cores', ({ inicio, fim }) => {
    const previa = new Graphics()
    drawStairDraft(previa, inicio, fim, LARGURA_DO_DEGRAU)
    expect(pinturasDe(previa).map(desenhoSemOpacidade)).toEqual(pinturasDe(escadaGravada(inicio, fim)).map(desenhoSemOpacidade))
  })

  it('com zoom e tela de alta densidade: acompanha a gravada, que mantém o traço fino na tela', () => {
    const previa = new Graphics()
    drawStairDraft(previa, CLIQUE, ARRASTO, LARGURA_DO_DEGRAU, 2.5, 2)
    const gravadaNoZoom = pinturasDe(escadaGravada(CLIQUE, ARRASTO, 2.5, 2)).map(desenhoSemOpacidade)
    // Controle: no zoom a gravada muda de verdade; sem isto o teste passaria
    // com uma prévia que ignora o zoom.
    expect(gravadaNoZoom).not.toEqual(pinturasDe(escadaGravada(CLIQUE, ARRASTO)).map(desenhoSemOpacidade))
    expect(pinturasDe(previa).map(desenhoSemOpacidade)).toEqual(gravadaNoZoom)
  })

  it('é rascunho: cada camada sai com a opacidade da gravada vezes STAIR_DRAFT_ALPHA', () => {
    const previa = new Graphics()
    drawStairDraft(previa, CLIQUE, ARRASTO, LARGURA_DO_DEGRAU)
    const daPrevia = pinturasDe(previa).map((pintura) => pintura.data.style.alpha)
    const daGravada = pinturasDe(escadaGravada(CLIQUE, ARRASTO)).map((pintura) => pintura.data.style.alpha)
    expect(daPrevia).toHaveLength(daGravada.length)
    expect(STAIR_DRAFT_ALPHA).toBeGreaterThan(0)
    expect(STAIR_DRAFT_ALPHA).toBeLessThan(1)
    daPrevia.forEach((alpha, i) => expect(alpha).toBeCloseTo(daGravada[i] * STAIR_DRAFT_ALPHA, 9))
  })

  it('cursor ainda em cima do clique: não desenha nada, como a gravada', () => {
    const previa = new Graphics()
    drawStairDraft(previa, CLIQUE, CLIQUE, LARGURA_DO_DEGRAU)
    expect(previa.context.instructions).toHaveLength(0)
  })

  it('o Graphics é o mesmo de todas as prévias: a da escada apaga a anterior e não usa o amarelo de seleção', () => {
    const g = new Graphics()
    drawWallDraft(g, CLIQUE, ARRASTO)
    drawStairDraft(g, CLIQUE, ARRASTO, LARGURA_DO_DEGRAU)
    expect(pinturasDe(g).map((pintura) => pintura.data.style.color)).not.toContain(SELECTION_COLOR)
    expect(pinturasDe(g)).toHaveLength(pinturasDe(escadaGravada(CLIQUE, ARRASTO)).length)
  })
})
