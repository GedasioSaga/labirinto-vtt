/**
 * OLHOS DO GUARDA no RECORTE DO JOGADOR. O cone do guarda (`vigia`) é do
 * mestre e nunca sai da máquina dele. O jogador recebe, na ficha do guarda que
 * ELE PRÓPRIO enxerga, só a marca de alerta (`alerta`: "?" ou "!") — nunca a
 * direção, a abertura, o alcance, nem QUEM o guarda viu. Guarda que o jogador
 * não vê (atrás da parede, fora do raio, "Oculto para jogadores", em zona
 * oculta) não leva marca nenhuma para a rede.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Token, TokenWatch, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Grade de 40 px: alcance 6 = 240 px, metade = 120 px. */
function mesa(tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), tokens, ...extra }
}

const OESTE: TokenWatch = { direcao: 180, abertura: 90, alcance: 6 }
const LESTE: TokenWatch = { direcao: 0, abertura: 90, alcance: 6 }
const DONOS = { p1: ['heroi'], p2: ['ladra'] }
const RAIO = 700

function guardaNo(out: MapData, id = 'sentinela'): Token | undefined {
  return out.tokens.find((t) => t.id === id)
}

describe('filterMapForPlayer — olhos do guarda', () => {
  it('guarda que vê a ficha do jogador de perto chega com "!", e sem o cone', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: OESTE })]), 'p1', DONOS, RAIO)
    const guarda = guardaNo(out.map)
    expect(guarda?.alerta).toBe('!')
    expect(guarda !== undefined && 'vigia' in guarda).toBe(false)
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('vigia')
    expect(texto).not.toContain('direcao')
    expect(texto).not.toContain('abertura')
    expect(texto).not.toContain('alcance')
  })

  it('de longe, na borda do olhar: "?"', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200), ficha('sentinela', 400, 200, { vigia: OESTE })]), 'p1', DONOS, RAIO)
    expect(guardaNo(out.map)?.alerta).toBe('?')
  })

  it('guarda de costas para todo mundo: a ficha dele chega sem marca', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: LESTE })]), 'p1', DONOS, RAIO)
    const guarda = guardaNo(out.map)
    expect(guarda).toBeDefined()
    expect(guarda !== undefined && 'alerta' in guarda).toBe(false)
    expect(JSON.stringify(out)).not.toContain('alerta')
  })

  it('o guarda viu OUTRO jogador que eu não vejo: recebo a marca, nunca quem ele viu', () => {
    // Raio 400: o herói (x=100) vê o guarda (x=400) mas não a ladra (x=600).
    const mapa = mesa([ficha('heroi', 100, 200), ficha('sentinela', 400, 200, { vigia: LESTE }), ficha('ladra', 600, 200)])
    const out = filterMapForPlayer(mapa, 'p1', DONOS, 400)
    expect(guardaNo(out.map)?.alerta).toBe('?')
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('ladra')
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'sentinela'])
  })

  it('guarda "Oculto para jogadores" que me vê: nem ele, nem marca nenhuma', () => {
    const out = filterMapForPlayer(
      mesa([ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: OESTE, secret: true })]),
      'p1',
      DONOS,
      RAIO,
    )
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('sentinela')
    expect(texto).not.toContain('alerta')
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
  })

  it('guarda atrás da parede não chega, nem a marca dele', () => {
    // O guarda olha para a parede (oeste) e não enxerga o herói; o que importa aqui é que ele nem sai.
    const mapa = mesa([ficha('heroi', 200, 200), ficha('sentinela', 800, 200, { vigia: OESTE }), ficha('ladra', 700, 200)], {
      walls: [parede('divisoria', 500, 0, 500, 1000)],
    })
    const out = filterMapForPlayer(mapa, 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(out)).not.toContain('alerta')
  })

  it('guarda dentro de zona oculta: a marca só chega depois de o mestre revelar a zona', () => {
    const zona = (revealed: boolean): ConcealZone => ({
      id: 'zona',
      name: 'zona',
      revealed,
      points: [{ x: 260, y: 160 }, { x: 360, y: 160 }, { x: 360, y: 240 }, { x: 260, y: 240 }],
    })
    const fichas = [ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: OESTE })]
    expect(JSON.stringify(filterMapForPlayer(mesa(fichas, { concealZones: [zona(false)] }), 'p1', DONOS, RAIO))).not.toContain('alerta')
    expect(guardaNo(filterMapForPlayer(mesa(fichas, { concealZones: [zona(true)] }), 'p1', DONOS, RAIO).map)?.alerta).toBe('!')
  })

  it('"alerta" gravado à mão numa ficha não passa: quem decide a marca é o recorte', () => {
    const mapa = mesa([ficha('heroi', 200, 200), ficha('rato', 300, 200, { alerta: '!' }), ficha('sentinela', 300, 260, { vigia: LESTE, alerta: '!' })])
    const out = filterMapForPlayer(mapa, 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'rato', 'sentinela'])
    expect(JSON.stringify(out)).not.toContain('alerta')
  })

  it('vigia posta na ficha do PRÓPRIO jogador também não sai para ele', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200, { vigia: LESTE })]), 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(out)).not.toContain('vigia')
  })
})
