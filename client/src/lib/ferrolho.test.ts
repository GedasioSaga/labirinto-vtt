import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { DoorState, MapData, Pin, Token, Wall } from '../types/map'
import { acaoDeFerrolho, ladoDaPorta, tokenAlcancaPino } from './ferrolho'

/**
 * FERROLHO DO JOGADOR, a conta pura: de que lado da porta está uma ficha, se
 * ela alcança um pino, e o que o botão da tela do jogador oferece ("Passar o
 * ferrolho" ou "Tirar o ferrolho") para a porta mais perto que ele alcança.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

const FECHADA: DoorState = { open: false, locked: false, kind: 'normal' }

function corredor(porta: Partial<DoorState>, fichas: Token[]): MapData {
  return {
    ...createEmptyMap('mapa-corredor', 'Corredor', 20, 10, 50),
    walls: [parede('norte', 500, 0, 500, 200), parede('porta', 500, 200, 500, 300, { ...FECHADA, ...porta }), parede('sul', 500, 300, 500, 500)],
    tokens: fichas,
  }
}

describe('ladoDaPorta', () => {
  it('fichas dos dois lados da porta caem em lados opostos, e quem está na linha não tem lado', () => {
    const porta = parede('porta', 500, 200, 500, 300, FECHADA)
    const oeste = ladoDaPorta(porta, { x: 450, y: 250 })
    const leste = ladoDaPorta(porta, { x: 550, y: 250 })
    expect(oeste === 1 || oeste === -1).toBe(true)
    expect(leste).toBe(oeste === 1 ? -1 : 1)
    // Mesmo lado, mais longe e fora do vão: o lado é o da reta da porta.
    expect(ladoDaPorta(porta, { x: 100, y: 450 })).toBe(oeste)
    expect(ladoDaPorta(porta, { x: 500, y: 260 })).toBeNull()
  })
})

describe('tokenAlcancaPino', () => {
  it('alcança o pino encostado (até uma casa além da borda da ficha) e não o de longe', () => {
    const pino: Pick<Pin, 'x' | 'y'> = { x: 400, y: 200 }
    expect(tokenAlcancaPino(ficha('ana', 330, 200), pino, 50)).toBe(true)
    expect(tokenAlcancaPino(ficha('ana', 200, 200), pino, 50)).toBe(false)
  })
})

describe('acaoDeFerrolho', () => {
  it('ficha encostada numa porta fechada: oferece "passar" o ferrolho nela', () => {
    expect(acaoDeFerrolho(corredor({}, [ficha('ana', 450, 250)]), ['ana'])).toEqual({ wallId: 'porta', acao: 'passar', aberta: false })
  })

  it('porta aberta: oferece passar, avisando que ela está aberta (o host fecha junto)', () => {
    expect(acaoDeFerrolho(corredor({ open: true }, [ficha('ana', 450, 250)]), ['ana'])).toEqual({ wallId: 'porta', acao: 'passar', aberta: true })
  })

  it('o ferrolho já é do lado dele: oferece "tirar"', () => {
    expect(acaoDeFerrolho(corredor({ ferrolhoDoMeuLado: true }, [ficha('ana', 450, 250)]), ['ana'])).toEqual({ wallId: 'porta', acao: 'tirar', aberta: false })
  })

  it('nada a oferecer: longe da porta, porta trancada pelo mestre, ou ficha que não é dele', () => {
    expect(acaoDeFerrolho(corredor({}, [ficha('ana', 200, 250)]), ['ana'])).toBeNull()
    expect(acaoDeFerrolho(corredor({ locked: true }, [ficha('ana', 450, 250)]), ['ana'])).toBeNull()
    expect(acaoDeFerrolho(corredor({}, [ficha('severa', 450, 250)]), ['ana'])).toBeNull()
  })
})
