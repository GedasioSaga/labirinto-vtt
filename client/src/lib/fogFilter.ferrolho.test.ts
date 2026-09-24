import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { DoorState, MapData, Pin, Token, Wall } from '../types/map'
import { filterMapForPlayer, marcarTrancasParaJogador } from './fogFilter'
import { ladoDaPorta } from './ferrolho'

/**
 * RECORTE DAS TRANCAS DO JOGADOR. O ferrolho mora na sessão do host (nunca no
 * mapa do mestre); o que chega ao jogador é só uma marca booleana, e só do
 * LADO de quem passou: quem está do outro lado recebe a porta como sempre
 * (fechada), sem marca, sem nome de quem trancou.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number): Pin {
  return { id, x, y, kind: 'viagem', description: 'Alçapão', image: null }
}

const PORTA = parede('porta', 500, 200, 500, 300, { open: false, locked: false, kind: 'normal' })
const OWNERSHIP = { ana: ['ficha-ana'], bruno: ['ficha-bruno'] }

function corredor(): MapData {
  return {
    ...createEmptyMap('mapa-corredor', 'Corredor', 20, 10, 50),
    walls: [parede('norte', 500, 0, 500, 200), PORTA, parede('sul', 500, 300, 500, 500)],
    tokens: [ficha('ficha-ana', 450, 250), ficha('ficha-bruno', 550, 250)],
    pins: [pino('alcapao', 300, 250)],
  }
}

function recorteDe(playerId: 'ana' | 'bruno', lado: 1 | -1) {
  const map = corredor()
  const view = filterMapForPlayer(map, playerId, OWNERSHIP, 700)
  return marcarTrancasParaJogador(view, new Set(OWNERSHIP[playerId]), { ferrolhos: new Map([['porta', lado]]), pinosBarrados: new Set(['alcapao']) })
}

const LADO_DA_ANA = ladoDaPorta(PORTA, { x: 450, y: 250 })

describe('marcarTrancasParaJogador', () => {
  it('quem está do lado do ferrolho recebe a porta marcada', () => {
    if (LADO_DA_ANA === null) throw new Error('a Ana tem lado')
    const map = recorteDe('ana', LADO_DA_ANA)
    expect(map.walls.find((w) => w.id === 'porta')?.door).toEqual({ open: false, locked: false, kind: 'normal', ferrolhoDoMeuLado: true })
  })

  it('SEGURANÇA: quem está do outro lado recebe a porta como sempre, sem marca nenhuma', () => {
    if (LADO_DA_ANA === null) throw new Error('a Ana tem lado')
    const map = recorteDe('bruno', LADO_DA_ANA)
    expect(map.walls.find((w) => w.id === 'porta')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(JSON.stringify(map)).not.toContain('ferrolho')
  })

  it('o pino barrado chega marcado a quem o vê; sem barra, o pino sai como sempre', () => {
    if (LADO_DA_ANA === null) throw new Error('a Ana tem lado')
    const barrado = recorteDe('ana', LADO_DA_ANA).pins.find((p) => p.id === 'alcapao')
    expect(barrado?.barradaDaqui).toBe(true)
    const view = filterMapForPlayer(corredor(), 'ana', OWNERSHIP, 700)
    const livre = marcarTrancasParaJogador(view, new Set(OWNERSHIP.ana), { ferrolhos: new Map(), pinosBarrados: new Set() })
    expect(livre).toBe(view.map)
    expect(JSON.stringify(livre)).not.toContain('barrada')
  })

  it('só conta ficha que ALCANÇA a porta: uma do lado do ferrolho mas longe não marca, mesmo com outra encostada do lado oposto', () => {
    if (LADO_DA_ANA === null) throw new Error('a Ana tem lado')
    // Ana tem duas fichas: uma recuada do lado do ferrolho (x=200), outra encostada do lado oposto (x=550).
    const map: MapData = { ...corredor(), tokens: [ficha('ficha-ana', 200, 250), ficha('ficha-ana2', 550, 250), ficha('ficha-bruno', 900, 400)] }
    const donos = { ana: ['ficha-ana', 'ficha-ana2'], bruno: ['ficha-bruno'] }
    const view = filterMapForPlayer(map, 'ana', donos, 700)
    const marcado = marcarTrancasParaJogador(view, new Set(donos.ana), { ferrolhos: new Map([['porta', LADO_DA_ANA]]), pinosBarrados: new Set() })
    expect(marcado.walls.find((w) => w.id === 'porta')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    // A ficha recuada volta a encostar do lado do ferrolho: aí sim a marca vem.
    const encostada: MapData = { ...map, tokens: [ficha('ficha-ana', 450, 250), ficha('ficha-ana2', 550, 250), ficha('ficha-bruno', 900, 400)] }
    const viewEncostada = filterMapForPlayer(encostada, 'ana', donos, 700)
    const comMarca = marcarTrancasParaJogador(viewEncostada, new Set(donos.ana), { ferrolhos: new Map([['porta', LADO_DA_ANA]]), pinosBarrados: new Set() })
    expect(comMarca.walls.find((w) => w.id === 'porta')?.door?.ferrolhoDoMeuLado).toBe(true)
  })

  it('porta aberta pelo mestre não leva marca: o ferrolho só vale com a porta fechada', () => {
    if (LADO_DA_ANA === null) throw new Error('a Ana tem lado')
    const map: MapData = { ...corredor(), walls: corredor().walls.map((w) => (w.id === 'porta' && w.door !== null ? { ...w, door: { ...w.door, open: true } } : w)) }
    const view = filterMapForPlayer(map, 'ana', OWNERSHIP, 700)
    const marcado = marcarTrancasParaJogador(view, new Set(OWNERSHIP.ana), { ferrolhos: new Map([['porta', LADO_DA_ANA]]), pinosBarrados: new Set() })
    expect(marcado.walls.find((w) => w.id === 'porta')?.door).toEqual({ open: true, locked: false, kind: 'normal' })
  })
})
