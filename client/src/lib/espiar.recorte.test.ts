import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { espiadaPeloPino } from './fogFilter'
import type { MapData, Pin, Token, Wall } from '../types/map'

/**
 * ESPIAR PELA PASSAGEM contra as regras de esconder que o recorte do jogador
 * ganhou depois da primeira versão: PISOS NA MESMA CENA e CENA ESCURA. O olho
 * da espiada fica no pino par; ele vê o que um jogador de lá veria — e nada
 * do piso de cima, do de baixo nem do que está no escuro.
 */

const GRID = 50
const PAR = { x: 500, y: 500 }
const VERMELHO = '#c0392b'
const AZUL = '#2e86c1'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function par(extra: Partial<Pin> = {}): Pin {
  return { id: 'par', x: PAR.x, y: PAR.y, kind: 'viagem', description: 'Alçapão', image: null, ...extra }
}

/**
 * A torre: no térreo, o guarda vermelho a 2 casas ACIMA do par e uma parede à
 * direita; no 1º piso, a sentinela azul a 2 casas ABAIXO e outra parede à esquerda.
 */
function torre(pino: Pin): MapData {
  return {
    ...createEmptyMap('mapa-torre', 'Torre do Mago', 20, 20, GRID),
    tokens: [ficha('guarda-terreo', 500, 400, { color: VERMELHO }), ficha('sentinela-piso1', 500, 600, { color: AZUL, piso: 1 })],
    walls: [parede('parede-terreo', 600, 400, 600, 600), parede('parede-piso1', 400, 400, 400, 600, { piso: 1 })],
    pins: [pino],
  }
}

describe('espiadaPeloPino: pisos na mesma cena', () => {
  it('SEGURANÇA — par no 1º piso: sai só o 1º piso; nada do térreo vaza', () => {
    const espiada = espiadaPeloPino(torre(par({ piso: 1 })), par({ piso: 1 }), 3)
    expect(espiada.tokens).toEqual([{ x: 0, y: 100, size: 1, color: AZUL }])
    // A parede do 1º piso, à esquerda (x = -100), sai; a do térreo (x = +100), não.
    expect(espiada.walls.length).toBeGreaterThan(0)
    expect(espiada.walls.every((w) => w.x1 === -100 && w.x2 === -100)).toBe(true)
  })

  it('par no térreo: sai só o térreo (controle — o piso vem do pino par)', () => {
    const espiada = espiadaPeloPino(torre(par()), par(), 3)
    expect(espiada.tokens).toEqual([{ x: 0, y: -100, size: 1, color: VERMELHO }])
    expect(espiada.walls.length).toBeGreaterThan(0)
    expect(espiada.walls.every((w) => w.x1 === 100 && w.x2 === 100)).toBe(true)
  })
})

describe('espiadaPeloPino: cena escura', () => {
  it('SEGURANÇA — do outro lado é escuro e sem luz: a ficha perto do par NÃO chega', () => {
    const map: MapData = { ...torre(par()), dark: true }
    const escura = espiadaPeloPino(map, par(), 3)
    expect(escura.tokens).toEqual([])
    // Controle: a mesma cena clara mostra o guarda — é o escuro que o tira.
    expect(espiadaPeloPino(torre(par()), par(), 3).tokens).toEqual([{ x: 0, y: -100, size: 1, color: VERMELHO }])
  })
})
