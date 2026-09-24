/**
 * ROTA DE PATRULHA no RECORTE DO JOGADOR. A rota é do mestre: os pontos, o
 * ponto em que o NPC está e para onde ele vai NUNCA saem da máquina dele. O
 * jogador vê o NPC andar só quando o NPC está na visão dele — antes ou depois
 * do passo. Passo que leva o NPC para a névoa ou para trás da parede tira a
 * ficha do recorte; passo que o traz para a visão faz a ficha aparecer já no
 * ponto novo.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, TokenPatrol, Wall } from '../types/map'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { applyPatrolOp } from './npcPatrol'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function mesa(tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 2000, 2000, 40), tokens, ...extra }
}

const DONOS = { p1: ['heroi'] }
/** Raio 400: o herói em x=100 vê até x=500. */
const RAIO = 400

/**
 * Coordenadas com casas decimais únicas: se qualquer ponto da rota vazar no
 * JSON, o texto aparece. A rota vai de perto do herói (x=300.125) para longe
 * dele (x=1500.375, fora do raio) e volta.
 */
const RONDA: TokenPatrol = {
  pontos: [
    { x: 300.125, y: 200.5 },
    { x: 1500.375, y: 200.5 },
  ],
  atual: 0,
}

function guardaNo(map: MapData): Token | undefined {
  return map.tokens.find((t) => t.id === 'guarda')
}

describe('filterMapForPlayer — rota de patrulha', () => {
  it('NPC em patrulha à vista: a ficha chega, sem a rota e sem nenhum ponto dela', () => {
    const map = mesa([ficha('heroi', 100, 200.5), ficha('guarda', 300.125, 200.5, { patrulha: RONDA })])
    const out = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    const guarda = guardaNo(out.map)
    expect(guarda?.x).toBe(300.125)
    expect(guarda !== undefined && 'patrulha' in guarda).toBe(false)
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('patrulha')
    expect(texto).not.toContain('pontos')
    expect(texto).not.toContain('1500.375')
  })

  it('Avançar patrulha leva o NPC para fora do raio: a ficha some do recorte, e o ponto novo não chega', () => {
    const antes = mesa([ficha('heroi', 100, 200.5), ficha('guarda', 300.125, 200.5, { patrulha: RONDA })])
    expect(guardaNo(filterMapForPlayer(antes, 'p1', DONOS, RAIO).map)).toBeDefined()

    const depois = applyPatrolOp(antes, 'guarda', 'avancar')
    const out = filterMapForPlayer(depois, 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('guarda')
    expect(texto).not.toContain('1500.375')
  })

  it('Avançar patrulha traz o NPC da névoa para a visão: a ficha aparece já no ponto novo', () => {
    const longe = mesa([ficha('heroi', 100, 200.5), ficha('guarda', 1500.375, 200.5, { patrulha: { ...RONDA, atual: 1 } })])
    expect(guardaNo(filterMapForPlayer(longe, 'p1', DONOS, RAIO).map)).toBeUndefined()

    const perto = applyPatrolOp(longe, 'guarda', 'avancar')
    const guarda = guardaNo(filterMapForPlayer(perto, 'p1', DONOS, RAIO).map)
    expect(guarda?.x).toBe(300.125)
    expect(guarda !== undefined && 'patrulha' in guarda).toBe(false)
  })

  it('passo para trás de uma parede, dentro do raio: a parede esconde o NPC do mesmo jeito', () => {
    const rota: TokenPatrol = { pontos: [{ x: 250, y: 200 }, { x: 450, y: 200 }], atual: 0 }
    const muro = parede('muro', 350, 0, 350, 600)
    const antes = mesa([ficha('heroi', 100, 200), ficha('guarda', 250, 200, { patrulha: rota })], { walls: [muro] })
    expect(guardaNo(filterMapForPlayer(antes, 'p1', DONOS, RAIO).map)?.x).toBe(250)

    const depois = applyPatrolOp(antes, 'guarda', 'avancar')
    expect(guardaNo(filterMapForPlayer(depois, 'p1', DONOS, RAIO).map)).toBeUndefined()
  })

  it('NPC "Oculto para jogadores" em patrulha, bem na frente do herói: nem a ficha nem a rota chegam', () => {
    const map = mesa([ficha('heroi', 100, 200.5), ficha('guarda', 300.125, 200.5, { patrulha: RONDA, secret: true })])
    const out = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(out)).not.toContain('1500.375')
  })

  it('tela da mesa (recorte do grupo): a rota também não sai', () => {
    const map = mesa([ficha('heroi', 100, 200.5), ficha('guarda', 300.125, 200.5, { patrulha: RONDA })])
    const out = filterMapForGroup(map, [{ tokenIds: ['heroi'], visionRadius: RAIO }])
    expect(guardaNo(out.map)?.x).toBe(300.125)
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('patrulha')
    expect(texto).not.toContain('1500.375')
  })
})
