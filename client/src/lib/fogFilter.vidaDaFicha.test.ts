/**
 * BARRA DE VIDA — o recorte do jogador. O mestre escolhe, ficha por ficha, se
 * os JOGADORES veem a barra; barra que ele deixou só para si não pode chegar
 * nem como número escondido no JSON (régua e2e:
 * `e2e/task-jornada-barra-de-vida.spec.ts`, teste 5 — "os números de Og não
 * chegam a ela").
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const JOGADOR = 'p1'
const HEROI = 'tok-lu'
const MONSTRO = 'tok-og'
/** Números que não colidem com coordenada nenhuma da cena (mesma escolha da régua). */
const OCULTA = { current: 173, max: 419 }

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y: 300, size: 1, image: null, ...extra }
}

function cena(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-vida', 'Sala do Ogro', 20, 12, 50), tokens }
}

function recorte(map: MapData) {
  return filterMapForPlayer(map, JOGADOR, { [JOGADOR]: [HEROI] }, 700)
}

/** Algum objeto que fala do monstro carrega um dos números proibidos? (mesma varredura da régua) */
function numerosDoMonstroNoJson(valor: unknown): boolean {
  const proibidos = new Set([OCULTA.current, OCULTA.max])
  const temNumero = (v: unknown): boolean => {
    if (typeof v === 'number') return proibidos.has(v)
    if (typeof v === 'string') return proibidos.has(Number(v))
    if (Array.isArray(v)) return v.some(temNumero)
    if (v !== null && typeof v === 'object') return Object.values(v as Record<string, unknown>).some(temNumero)
    return false
  }
  const procurar = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(procurar)
    if (v === null || typeof v !== 'object') return false
    const o = v as Record<string, unknown>
    if (Object.values(o).some((x) => x === MONSTRO) && temNumero(o)) return true
    return Object.values(o).some(procurar)
  }
  return procurar(JSON.parse(JSON.stringify(valor)))
}

describe('recorte do jogador — barra de vida', () => {
  it('barra só do mestre: a ficha do monstro chega (está na visão), mas SEM o campo de vida', () => {
    const map = cena([ficha(HEROI, 400), ficha(MONSTRO, 550, { health: { ...OCULTA, shownToPlayers: false } })])
    const monstro = recorte(map).map.tokens.find((t) => t.id === MONSTRO)
    expect(monstro, 'o monstro está a 150 px do herói, dentro da visão: a ficha tem de chegar').toBeDefined()
    expect(monstro && 'health' in monstro).toBe(false)
    expect(numerosDoMonstroNoJson(recorte(map))).toBe(false)
  })

  it('o padrão é só o mestre: vida gravada sem a escolha também não viaja', () => {
    const cru = { current: OCULTA.current, max: OCULTA.max } as unknown as Token['health']
    const map = cena([ficha(HEROI, 400), ficha(MONSTRO, 550, { health: cru })])
    expect(numerosDoMonstroNoJson(recorte(map))).toBe(false)
  })

  it('barra que os jogadores veem chega como proporção em centésimos, sem os pontos', () => {
    const map = cena([ficha(HEROI, 400, { health: { current: 6, max: 10, shownToPlayers: true } }), ficha(MONSTRO, 550)])
    const heroi = recorte(map).map.tokens.find((t) => t.id === HEROI)
    expect(heroi?.health).toEqual({ current: 60, max: 100, shownToPlayers: true })
  })

  it('monstro com barra visível também chega só com a proporção: 173 de 419 vira 41 de 100', () => {
    const map = cena([ficha(HEROI, 400), ficha(MONSTRO, 550, { health: { ...OCULTA, shownToPlayers: true } })])
    const monstro = recorte(map).map.tokens.find((t) => t.id === MONSTRO)
    expect(monstro?.health).toEqual({ current: 41, max: 100, shownToPlayers: true })
    expect(numerosDoMonstroNoJson(recorte(map))).toBe(false)
  })

  it('campo que o arquivo trouxe dentro da vida e o app não conhece não chega ao jogador', () => {
    const comNota = { current: 6, max: 10, shownToPlayers: true, nota: 'fraco a fogo' } as unknown as Token['health']
    const map = cena([ficha(HEROI, 400, { health: comNota })])
    expect(JSON.stringify(recorte(map).map)).not.toContain('fraco a fogo')
  })

  it('CONTROLE: o recorte não mexe no mapa do mestre — ele continua com os números', () => {
    const monstro = ficha(MONSTRO, 550, { health: { ...OCULTA, shownToPlayers: false } })
    const map = cena([ficha(HEROI, 400), monstro])
    recorte(map)
    expect(map.tokens[1]?.health).toEqual({ ...OCULTA, shownToPlayers: false })
  })
})
