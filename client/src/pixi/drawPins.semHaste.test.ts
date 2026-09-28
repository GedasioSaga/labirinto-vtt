import { describe, expect, it } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import type { Pin } from '../types/map'
import { PIN_HEAD_OFFSET } from '../lib/pins'
import { createPinsRenderer } from './drawPins'

/**
 * PINO SEM HASTE (pedido do mestre, 27/09): "coloca opção de aparecer sem a
 * parte de baixo, só a imagem". Com `semHaste`, o pino é só o círculo.
 *
 * A âncora: a ponta continua em `pin.x`/`pin.y` e a cabeça continua EXATAMENTE
 * onde estava — só a haste some. Ligar e desligar não faz nada saltar, em
 * nenhum zoom, e o `y` salvo não muda de sentido (névoa, "ler de perto" e
 * viagem medem a partir dele).
 */

const MARCADOR: Pin = { id: 'p', x: 100, y: 200, kind: 'exclamacao', description: '', image: null }

/** Os quatro desenhos de cabeça que existem: todos perdem a haste do mesmo jeito. */
const CABECAS: readonly { nome: string; pin: Pin }[] = [
  { nome: 'marcador', pin: MARCADOR },
  { nome: 'marcador com ícone', pin: { ...MARCADOR, icon: 'chave' } },
  { nome: 'alavanca', pin: { ...MARCADOR, kind: 'alavanca' } },
  { nome: 'viagem', pin: { ...MARCADOR, kind: 'viagem' } },
  { nome: 'chegada oculta', pin: { ...MARCADOR, kind: 'viagem', soChegada: true } },
]

interface Desenho {
  minX: number
  maxX: number
  minY: number
  maxY: number
  glifoY: number | null
}

function desenhar(pin: Pin, selectedId: string | null = null, sizeScale = 1): Desenho {
  const container = new Container()
  createPinsRenderer().draw(container, [pin], selectedId, undefined, sizeScale)
  const graphics = container.children.find((child): child is Graphics => child instanceof Graphics)
  if (!graphics) throw new Error('o renderer não pôs o Graphics dos pinos no container')
  const glifo = container.children.find((child): child is Text => child instanceof Text && child.visible)
  const { minX, maxX, minY, maxY } = graphics.getLocalBounds()
  return { minX, maxX, minY, maxY, glifoY: glifo ? glifo.position.y : null }
}

describe('drawPins: pino sem haste', () => {
  it('pino sem o campo (mapa de sempre) continua com a haste descendo até a ponta', () => {
    const { maxY } = desenhar(MARCADOR)
    expect(maxY).toBeGreaterThanOrEqual(MARCADOR.y)
  })

  it.each(CABECAS)('$nome: sem haste, nada é desenhado entre a cabeça e a ponta', ({ pin }) => {
    const { maxY } = desenhar({ ...pin, semHaste: true })
    // A cabeça termina em y - 11 (centro a 23 acima da ponta, raio 11, meio
    // contorno de 1). Tudo o que passasse disso seria a haste.
    expect(maxY).toBeLessThanOrEqual(pin.y - 10)
  })

  it.each(CABECAS)('$nome: a cabeça não sai do lugar ao tirar a haste', ({ pin }) => {
    const com = desenhar(pin)
    const sem = desenhar({ ...pin, semHaste: true })
    expect(sem.minY).toBeCloseTo(com.minY, 5)
    expect(sem.minX).toBeCloseTo(com.minX, 5)
    expect(sem.maxX).toBeCloseTo(com.maxX, 5)
    expect(sem.glifoY).toBe(com.glifoY)
  })

  it('o glifo continua no centro da cabeça, a 23 acima da ponta', () => {
    const { glifoY } = desenhar({ ...MARCADOR, semHaste: true })
    expect(glifoY).toBe(MARCADOR.y - PIN_HEAD_OFFSET)
  })

  it('selecionado: o anel envolve só a cabeça, sem a haste por baixo', () => {
    const com = desenhar(MARCADOR, 'p')
    const sem = desenhar({ ...MARCADOR, semHaste: true }, 'p')
    expect(com.maxY).toBeGreaterThanOrEqual(MARCADOR.y)
    // Anel: raio 14 e traço 3 em volta do centro a 23 acima da ponta.
    expect(sem.maxY).toBeLessThanOrEqual(MARCADOR.y - 7)
    expect(sem.minY).toBeCloseTo(com.minY, 5)
  })

  it('pino crescido no zoom afastado: sem haste e sem salto, com o mesmo fator', () => {
    const fator = 2
    const com = desenhar(MARCADOR, null, fator)
    const sem = desenhar({ ...MARCADOR, semHaste: true }, null, fator)
    expect(com.maxY).toBeGreaterThanOrEqual(MARCADOR.y)
    expect(sem.maxY).toBeLessThanOrEqual(MARCADOR.y - 10 * fator)
    expect(sem.minY).toBeCloseTo(com.minY, 5)
    expect(sem.glifoY).toBe(MARCADOR.y - PIN_HEAD_OFFSET * fator)
  })
})
