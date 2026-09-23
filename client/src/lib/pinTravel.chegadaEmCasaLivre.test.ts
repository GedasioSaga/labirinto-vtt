import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { arrivalPoint, arrivalSpot, arrivalSpotWithoutPin } from './pinTravel'
import { PIN_HEAD_OFFSET, PIN_HEAD_RADIUS } from './pins'
import type { MapData, Pin, Token, Wall } from '../types/map'

/**
 * CHEGADA EM CASA LIVRE: quem passa pelo mesmo pino chega em casas vizinhas,
 * não empilhado. Antes, `arrivalSpot` devolvia sempre a casa do pino par, sem
 * olhar quem já estava lá: a ficha de baixo sumia e o dono não a arrastava.
 */

const GRADE = 50
type Ponto = { x: number; y: number }

/** No MEIO de uma casa, como na régua e2e: "em cima do pino" não tem ambiguidade. */
const PINO: Pin = { id: 'escada-b', x: 1025, y: 325, kind: 'viagem', description: 'Escada que sobe', image: null, destino: { sceneId: 'salao', pinId: 'escada-a' } }
const CABECA: Ponto = { x: PINO.x, y: PINO.y - PIN_HEAD_OFFSET }

function ficha(id: string, p: Ponto, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

function porao(tokens: Token[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap('mapa-porao', 'Porão', 40, 12, GRADE), tokens, walls, pins: [PINO] }
}

const distancia = (a: Ponto, b: Ponto): number => Math.hypot(a.x - b.x, a.y - b.y)

/** `n` fichas passam, uma depois da outra, pelo mesmo pino: cada chegada já vê as de antes no mapa. */
function chegamEmFila(n: number, inicio: MapData = porao([])): Ponto[] {
  let mapa = inicio
  const casas: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const id = `viajante-${i}`
    const casa = arrivalSpot(mapa, PINO, 1, id)
    casas.push(casa)
    mapa = { ...mapa, tokens: [...mapa.tokens, ficha(id, casa)] }
  }
  return casas
}

/** O que está errado numa chegada: em cima do pino, cobrindo a cabeça dele, ou na casa de outra ficha. */
function problemas(casas: readonly Ponto[], outras: readonly Ponto[] = []): string[] {
  const achados: string[] = []
  casas.forEach((c, i) => {
    if (distancia(c, PINO) < GRADE / 2) achados.push(`ficha ${i} em cima do pino (${distancia(c, PINO).toFixed(1)} px)`)
    if (distancia(c, CABECA) < GRADE / 2 + PIN_HEAD_RADIUS) achados.push(`ficha ${i} cobre a cabeça do pino`)
    for (const o of outras) if (distancia(c, o) < GRADE) achados.push(`ficha ${i} na casa de quem já estava lá`)
    for (let k = i + 1; k < casas.length; k += 1) {
      if (distancia(c, casas[k]) < GRADE) achados.push(`fichas ${i} e ${k} na mesma casa`)
    }
  })
  return achados
}

describe('chegada em casa livre (arrivalSpot)', () => {
  it('com uma ficha já parada no pino, quem chega vai para a casa vizinha, não para cima dela', () => {
    const noPino = ficha('estatua', { x: PINO.x, y: PINO.y })
    const casa = arrivalSpot(porao([noPino]), PINO, 1, 'viajante')
    expect(problemas([casa], [noPino])).toEqual([])
    // Vizinha de verdade: no máximo uma casa e meia do pino, não do outro lado do mapa.
    expect(distancia(casa, PINO)).toBeLessThanOrEqual(GRADE * 1.5)
  })

  it('7 pela mesma escada ocupam 7 casas diferentes, fora do pino e sem cobrir a cabeça dele', () => {
    const casas = chegamEmFila(7)
    expect(new Set(casas.map((c) => `${c.x}|${c.y}`)).size).toBe(7)
    expect(problemas(casas)).toEqual([])
  })

  it('assenta no centro da casa, como o snap de ficha do editor', () => {
    for (const c of chegamEmFila(3)) {
      expect([(c.x - GRADE / 2) % GRADE, (c.y - GRADE / 2) % GRADE]).toEqual([0, 0])
    }
  })

  it('a ficha que chega não conta como obstáculo para si mesma (já está no destino por outra via)', () => {
    const casa = arrivalSpot(porao([ficha('viajante', { x: 975, y: 325 })]), PINO, 1, 'viajante')
    expect(casa).toEqual(arrivalSpot(porao([]), PINO, 1, 'viajante'))
  })

  it('não cruza parede: com uma parede logo à esquerda do pino, ninguém aparece do outro lado', () => {
    const parede: Wall = { id: 'w', x1: 1000, y1: 0, x2: 1000, y2: 600, blocksLight: true, blocksMove: true, door: null }
    let mapa = porao([], [parede])
    const casas: Ponto[] = []
    for (let i = 0; i < 5; i += 1) {
      const casa = arrivalSpot(mapa, PINO, 1, `v${i}`)
      casas.push(casa)
      mapa = { ...mapa, tokens: [...mapa.tokens, ficha(`v${i}`, casa)] }
    }
    expect(casas.filter((c) => c.x < parede.x1)).toEqual([])
    expect(problemas(casas)).toEqual([])
  })

  it('ficha secreta ou escondida do mestre não ocupa casa: a chegada não denuncia o que o jogador não vê', () => {
    const livre = arrivalSpot(porao([]), PINO, 1, 'viajante')
    const secreta = ficha('monstro', livre, { secret: true })
    const escondida = ficha('armadilha', livre, { hidden: true })
    expect(arrivalSpot(porao([secreta]), PINO, 1, 'viajante')).toEqual(livre)
    expect(arrivalSpot(porao([escondida]), PINO, 1, 'viajante')).toEqual(livre)
  })
})

describe('chegada em casa livre sem pino ("Mandar para…" direto à cena)', () => {
  it('cena vazia: continua no centro (arrivalPoint)', () => {
    const mapa = porao([])
    expect(arrivalSpotWithoutPin(mapa, 1, 'viajante')).toEqual(arrivalPoint(mapa))
  })

  it('centro ocupado: quem chega vai para a casa livre mais perto, não empilha', () => {
    const mapa = porao([])
    const centro = arrivalPoint(mapa)
    const casa = arrivalSpotWithoutPin(porao([ficha('primeiro', centro)]), 1, 'viajante')
    expect(distancia(casa, centro)).toBeGreaterThanOrEqual(GRADE * 0.9)
    // O centro da cena cai numa quina: as quatro casas em volta dela encostam na ficha do centro.
    expect(distancia(casa, centro)).toBeLessThanOrEqual(GRADE * 2)
  })
})
