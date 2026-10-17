/**
 * BARRA DE VIDA — o recorte do jogador (fatia 10, decisões 4.3 e 4.4). A vida
 * vem da ficha do sistema ligada ao token; o recorte recebe só a proporção
 * (`barrasParaJogador`) e decide quem a vê: a ficha de jogador, para todos; a
 * de NPC, só para quem a controla. A vida antiga gravada no token nunca sai
 * (régua e2e: `e2e/task-jornada-barra-de-vida.spec.ts`, teste 5 — "os números
 * de Og não chegam a ela").
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { personagemDoArquivo, type Personagem } from './personagem'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'
import { barrasParaJogador } from './vidaDaFicha'

const JOGADOR = 'p1'
const HEROI = 'tok-lu'
const MONSTRO = 'tok-og'
const COLEGA = 'tok-bia'
/** Números que não colidem com coordenada nenhuma da cena (mesma escolha da régua). */
const OCULTA = { atual: 173, maximo: 419 }

function personagem(id: string, tipo: 'jogador' | 'npc', atual: number, maximo: number): Personagem {
  const lido = personagemDoArquivo({ id, tipo, nome: id, recursos: { hp: atual }, maximos: { hp: maximo } })
  if (lido === null) throw new Error(`personagem ${id} inválido`)
  return lido
}

const PERSONAGENS = [personagem('p-lu', 'jogador', 6, 10), personagem('p-bia', 'jogador', 3, 4), personagem('p-og', 'npc', OCULTA.atual, OCULTA.maximo)]

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y: 300, size: 1, image: null, ...extra }
}

function cena(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-vida', 'Sala do Ogro', 20, 12, 50), tokens }
}

/** O recorte do jogador com as barras que o host monta (`barrasParaJogador`). */
function recorte(map: MapData, posse: Record<string, string[]> = { [JOGADOR]: [HEROI], p2: [COLEGA] }) {
  const barras = barrasParaJogador(map.tokens, PERSONAGENS, SISTEMA_ONE_PIECE)
  // Os 13 opcionais do meio (memória, portas, pinos...) não mudam a barra.
  return filterMapForPlayer(map, JOGADOR, posse, 700, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, barras)
}

const recebida = (map: MapData, id: string, posse?: Record<string, string[]>) => recorte(map, posse).map.tokens.find((t) => t.id === id)

/** Algum objeto que fala do monstro carrega um dos números proibidos? (mesma varredura da régua) */
function numerosDoMonstroNoJson(valor: unknown): boolean {
  const proibidos = new Set([OCULTA.atual, OCULTA.maximo])
  const temNumero = (v: unknown): boolean => {
    if (typeof v === 'number') return proibidos.has(v)
    if (typeof v === 'string') return proibidos.has(Number(v))
    if (Array.isArray(v)) return v.some(temNumero)
    if (v !== null && typeof v === 'object') return Object.values(v).some(temNumero)
    return false
  }
  const procurar = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(procurar)
    if (v === null || typeof v !== 'object') return false
    const valores: unknown[] = Object.values(v)
    if (valores.some((x) => x === MONSTRO) && temNumero(v)) return true
    return valores.some(procurar)
  }
  return procurar(JSON.parse(JSON.stringify(valor)))
}

describe('recorte do jogador — barra de vida da ficha do sistema', () => {
  it('a própria ficha de jogador chega com a proporção em centésimos, sem os pontos', () => {
    const map = cena([ficha(HEROI, 400, { characterId: 'p-lu' })])
    expect(recebida(map, HEROI)?.health).toEqual({ current: 60, max: 100, shownToPlayers: true })
  })

  it('a ficha de jogador de um COLEGA também chega com a barra', () => {
    const map = cena([ficha(HEROI, 400, { characterId: 'p-lu' }), ficha(COLEGA, 500, { characterId: 'p-bia' })])
    expect(recebida(map, COLEGA)?.health).toEqual({ current: 75, max: 100, shownToPlayers: true })
  })

  it('NPC que ele não controla: a ficha chega (está na visão), mas SEM o campo de vida, e os números não viajam', () => {
    const map = cena([ficha(HEROI, 400, { characterId: 'p-lu' }), ficha(MONSTRO, 550, { characterId: 'p-og', npc: true })])
    const monstro = recebida(map, MONSTRO)
    expect(monstro, 'o monstro está a 150 px do herói, dentro da visão: a ficha tem de chegar').toBeDefined()
    expect(monstro && 'health' in monstro).toBe(false)
    expect(numerosDoMonstroNoJson(recorte(map))).toBe(false)
  })

  it('NPC que ele CONTROLA: a barra chega, só a proporção (173 de 419 vira 41 de 100)', () => {
    const map = cena([ficha(HEROI, 400, { characterId: 'p-lu' }), ficha(MONSTRO, 550, { characterId: 'p-og', npc: true })])
    const monstro = recebida(map, MONSTRO, { [JOGADOR]: [HEROI, MONSTRO] })
    expect(monstro?.health).toEqual({ current: 41, max: 100, shownToPlayers: true })
    expect(numerosDoMonstroNoJson(recorte(map, { [JOGADOR]: [HEROI, MONSTRO] }))).toBe(false)
  })

  it('a vida antiga gravada no token (decisão 4.4) não viaja, nem a que dizia "jogadores veem"', () => {
    const antiga = { current: OCULTA.atual, max: OCULTA.maximo, shownToPlayers: true }
    const map = cena([ficha(HEROI, 400), ficha(MONSTRO, 550, { health: antiga })])
    expect(recebida(map, MONSTRO)?.health).toBeUndefined()
    expect(numerosDoMonstroNoJson(recorte(map))).toBe(false)
  })

  it('sem ficha ligada, sem barra; sem barras do host (mapa solto), nenhuma', () => {
    const map = cena([ficha(HEROI, 400)])
    expect(recebida(map, HEROI)?.health).toBeUndefined()
    const semHost = filterMapForPlayer(cena([ficha(HEROI, 400, { characterId: 'p-lu' })]), JOGADOR, { [JOGADOR]: [HEROI] }, 700)
    expect(semHost.map.tokens[0]?.health).toBeUndefined()
  })

  it('ficha de jogador de outro DISFARÇADA (nome para os jogadores) sai sem barra: a barra diria quem está por trás', () => {
    const map = cena([ficha(HEROI, 400, { characterId: 'p-lu' }), ficha(COLEGA, 500, { characterId: 'p-bia', publicName: 'Encapuzado' })])
    expect(recebida(map, COLEGA)?.health).toBeUndefined()
  })

  it('CONTROLE: o recorte não mexe no mapa do mestre — a vida antiga continua no arquivo', () => {
    const antiga = { current: OCULTA.atual, max: OCULTA.maximo, shownToPlayers: false }
    const map = cena([ficha(HEROI, 400), ficha(MONSTRO, 550, { health: antiga })])
    recorte(map)
    expect(map.tokens[1]?.health).toEqual(antiga)
  })
})
