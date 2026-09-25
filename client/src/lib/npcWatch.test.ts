/**
 * OLHOS DO GUARDA — a regra pura. Uma ficha de NPC com `vigia` olha para um
 * lado, com uma abertura e um alcance em quadrados; parede e porta fechada
 * cortam a visão dele como cortam a de quem joga. É daqui que saem o cone que
 * o mestre vê no editor, o aviso "Guarda viu Ana" e a marca (?, !) que o
 * jogador vê em cima do guarda.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, TokenWatch, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { visionSegments } from './visibility'
import {
  WATCH_DEFAULT,
  guardAlerts,
  guardSeesPoint,
  guardSightings,
  readTokenWatch,
  watchAlertOf,
  watchConePolygon,
} from './npcWatch'

const GRADE = 50
/** Olha para o leste (0°), cone de 90°, 6 quadrados (300 px). */
const LESTE: TokenWatch = { direcao: 0, abertura: 90, alcance: 6 }
const GUARDA = { x: 500, y: 300 }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function mapa(tokens: Token[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap('m', 'M', 40, 20, GRADE), tokens, walls }
}

const semParede = visionSegments(mapa([]))
const comParede = visionSegments(mapa([], [parede('muro', 600, 0, 600, 1000)]))

describe('readTokenWatch — o campo como chega do disco', () => {
  it('campo ausente, nulo ou torto não faz de ninguém um guarda', () => {
    expect(readTokenWatch(undefined)).toBeNull()
    expect(readTokenWatch(null)).toBeNull()
    expect(readTokenWatch('olhos')).toBeNull()
    expect(readTokenWatch({ direcao: 'leste', abertura: 90, alcance: 6 })).toBeNull()
    expect(readTokenWatch({ direcao: 0, abertura: Number.NaN, alcance: 6 })).toBeNull()
  })

  it('valor válido volta igual; fora da faixa é trazido para dentro dela', () => {
    expect(readTokenWatch({ ...LESTE })).toEqual(LESTE)
    expect(readTokenWatch({ direcao: 370, abertura: 5, alcance: 99 })).toEqual({ direcao: 10, abertura: 15, alcance: 30 })
    expect(readTokenWatch({ direcao: -90, abertura: 500, alcance: 0 })).toEqual({ direcao: 270, abertura: 360, alcance: 1 })
  })

  it('só os três campos atravessam a leitura: anotação enfiada no objeto fica de fora', () => {
    expect(readTokenWatch({ ...LESTE, segredo: 'o guarda é o assassino' })).toEqual(LESTE)
  })

  it('o padrão de quem liga a vigia é um cone válido', () => {
    expect(readTokenWatch(WATCH_DEFAULT)).toEqual(WATCH_DEFAULT)
  })
})

describe('guardSeesPoint — o que cai dentro do olhar', () => {
  it('à frente e dentro do alcance: vê', () => {
    expect(guardSeesPoint(GUARDA, LESTE, GRADE, semParede, { x: 650, y: 300 })).toBe(true)
    expect(guardSeesPoint(GUARDA, LESTE, GRADE, semParede, { x: 780, y: 360 })).toBe(true)
  })

  it('atrás dele, fora da abertura, ou além do alcance: não vê', () => {
    expect(guardSeesPoint(GUARDA, LESTE, GRADE, semParede, { x: 350, y: 300 })).toBe(false)
    expect(guardSeesPoint(GUARDA, LESTE, GRADE, semParede, { x: 550, y: 450 })).toBe(false)
    expect(guardSeesPoint(GUARDA, LESTE, GRADE, semParede, { x: 850, y: 300 })).toBe(false)
  })

  it('parede entre ele e o alvo corta a visão', () => {
    expect(guardSeesPoint(GUARDA, LESTE, GRADE, comParede, { x: 580, y: 300 })).toBe(true)
    expect(guardSeesPoint(GUARDA, LESTE, GRADE, comParede, { x: 650, y: 300 })).toBe(false)
  })

  it('abertura de 360° vê as costas também', () => {
    expect(guardSeesPoint(GUARDA, { ...LESTE, abertura: 360 }, GRADE, semParede, { x: 350, y: 300 })).toBe(true)
  })

  it('a direção gira no sentido horário da tela: 90° olha para baixo', () => {
    const sul: TokenWatch = { ...LESTE, direcao: 90 }
    expect(guardSeesPoint(GUARDA, sul, GRADE, semParede, { x: 500, y: 450 })).toBe(true)
    expect(guardSeesPoint(GUARDA, sul, GRADE, semParede, { x: 500, y: 150 })).toBe(false)
  })
})

describe('guardSightings / guardAlerts — quem o guarda viu e a marca dele', () => {
  const guarda = ficha('guarda', GUARDA.x, GUARDA.y, { vigia: LESTE })

  it('ficha de jogador perto (metade do alcance): "!"; longe, na borda do olhar: "?"', () => {
    const perto = mapa([guarda, ficha('ana', 640, 300)])
    expect(guardSightings(perto, new Set(['ana']))).toEqual([{ guardId: 'guarda', tokenId: 'ana', alert: '!' }])
    const longe = mapa([guarda, ficha('ana', 760, 300)])
    expect(guardSightings(longe, new Set(['ana']))).toEqual([{ guardId: 'guarda', tokenId: 'ana', alert: '?' }])
  })

  it('só conta ficha de JOGADOR: o outro NPC na frente dele não dispara nada', () => {
    const m = mapa([guarda, ficha('rato', 640, 300)])
    expect(guardSightings(m, new Set(['ana']))).toEqual([])
    expect(guardAlerts(m, new Set(['ana'])).size).toBe(0)
  })

  it('a marca do guarda é a mais forte entre o que ele vê', () => {
    const m = mapa([guarda, ficha('ana', 760, 300), ficha('bia', 620, 300)])
    expect(guardAlerts(m, new Set(['ana', 'bia'])).get('guarda')).toBe('!')
  })

  it('guarda oculto no editor, ou sem vigia, não vigia ninguém', () => {
    const oculto = mapa([{ ...guarda, hidden: true }, ficha('ana', 640, 300)])
    expect(guardSightings(oculto, new Set(['ana']))).toEqual([])
    const comum = mapa([ficha('guarda', GUARDA.x, GUARDA.y), ficha('ana', 640, 300)])
    expect(guardSightings(comum, new Set(['ana']))).toEqual([])
  })

  it('ficha de jogador oculta no editor não é vista', () => {
    const m = mapa([guarda, ficha('ana', 640, 300, { hidden: true })])
    expect(guardSightings(m, new Set(['ana']))).toEqual([])
  })

  it('o guarda não se vê: ficha de jogador com vigia não alerta a si mesma', () => {
    const m = mapa([ficha('ana', GUARDA.x, GUARDA.y, { vigia: LESTE })])
    expect(guardSightings(m, new Set(['ana']))).toEqual([])
  })
})

describe('watchConePolygon — o que o mestre vê no editor', () => {
  it('nasce no guarda e não passa do alcance', () => {
    const cone = watchConePolygon(GUARDA, LESTE, GRADE, semParede)
    expect(cone[0]).toEqual(GUARDA)
    expect(cone.length).toBeGreaterThan(3)
    for (const p of cone) expect(Math.hypot(p.x - GUARDA.x, p.y - GUARDA.y)).toBeLessThanOrEqual(LESTE.alcance * GRADE + 1e-6)
  })

  it('para na parede', () => {
    const cone = watchConePolygon(GUARDA, LESTE, GRADE, comParede)
    expect(cone.length).toBeGreaterThan(3)
    for (const p of cone) expect(p.x).toBeLessThanOrEqual(600 + 1e-6)
  })

  it('fica do lado para onde ele olha', () => {
    const cone = watchConePolygon(GUARDA, LESTE, GRADE, semParede)
    expect(cone.length).toBeGreaterThan(3)
    for (const p of cone) expect(p.x).toBeGreaterThanOrEqual(GUARDA.x - 1e-6)
  })
})

// A ficha do guarda como o jogador a recebe (sem cone, marca só a do recorte)
// é provada no recorte inteiro: `fogFilter.vigia.test.ts`.
describe('watchAlertOf — a marca lida da ficha', () => {
  it('watchAlertOf só aceita "?" e "!"', () => {
    expect(watchAlertOf({ alerta: '?' })).toBe('?')
    expect(watchAlertOf({ alerta: '!' })).toBe('!')
    expect(watchAlertOf({ alerta: 'Ana' })).toBeNull()
    expect(watchAlertOf({})).toBeNull()
  })
})
