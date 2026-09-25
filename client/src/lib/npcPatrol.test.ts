/**
 * ROTA DE PATRULHA — regras puras. O mestre marca os pontos da rota com a
 * ficha do NPC em cima de cada um ("Marcar ponto aqui"); "Avançar patrulha"
 * leva o NPC ao ponto seguinte, e do último volta ao primeiro (ronda em
 * circuito). A rota é do MESTRE: nunca vai para quem joga.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, TokenPatrol } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { applyPatrolOp, PATROL_MAX_POINTS, readTokenPatrol, tokenPatrolOf } from './npcPatrol'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function mesa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 50), tokens }
}

function npc(map: MapData, id = 'guarda'): Token {
  const achado = map.tokens.find((t) => t.id === id)
  if (achado === undefined) throw new Error(`sem a ficha ${id}`)
  return achado
}

const RONDA: TokenPatrol = {
  pontos: [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 400 },
  ],
  atual: 2,
}

describe('readTokenPatrol — o mapa do disco chega cru', () => {
  it('ficha comum (sem campo, null, texto) não tem rota', () => {
    expect(readTokenPatrol(undefined)).toBe(null)
    expect(readTokenPatrol(null)).toBe(null)
    expect(readTokenPatrol('ronda')).toBe(null)
    expect(readTokenPatrol({ pontos: [], atual: 0 })).toBe(null)
  })

  it('ponto torto sai, "atual" fora da faixa volta para dentro, e campo estranho fica de fora', () => {
    const lida = readTokenPatrol({
      pontos: [{ x: 10, y: 20 }, { x: 'a', y: 1 }, null, { x: 30, y: Number.NaN }, { x: 40, y: 50, rotulo: 'segredo' }],
      atual: 7,
      nota: 'do mestre',
    })
    expect(lida).toEqual({ pontos: [{ x: 10, y: 20 }, { x: 40, y: 50 }], atual: 1 })
  })

  it('"atual" que não é inteiro válido vira o primeiro ponto', () => {
    expect(readTokenPatrol({ pontos: [{ x: 1, y: 1 }, { x: 2, y: 2 }], atual: 'dois' })?.atual).toBe(0)
    expect(readTokenPatrol({ pontos: [{ x: 1, y: 1 }, { x: 2, y: 2 }], atual: 1.6 })?.atual).toBe(1)
    expect(readTokenPatrol({ pontos: [{ x: 1, y: 1 }, { x: 2, y: 2 }], atual: -3 })?.atual).toBe(0)
  })

  it('tokenPatrolOf lê a rota gravada na ficha', () => {
    expect(tokenPatrolOf(ficha('g', 0, 0, { patrulha: RONDA }))).toEqual(RONDA)
    expect(tokenPatrolOf(ficha('g', 0, 0))).toBe(null)
  })
})

describe('applyPatrolOp — marcar os pontos da rota', () => {
  it('"marcar" grava a posição ATUAL da ficha como próximo ponto, e o NPC está nele', () => {
    const inicio = mesa([ficha('guarda', 100, 100)])
    const um = applyPatrolOp(inicio, 'guarda', 'marcar')
    expect(tokenPatrolOf(npc(um))).toEqual({ pontos: [{ x: 100, y: 100 }], atual: 0 })

    const andou = { ...um, tokens: um.tokens.map((t) => ({ ...t, x: 300, y: 100 })) }
    const dois = applyPatrolOp(andou, 'guarda', 'marcar')
    expect(tokenPatrolOf(npc(dois))).toEqual({ pontos: [{ x: 100, y: 100 }, { x: 300, y: 100 }], atual: 1 })
  })

  it('rota cheia não ganha ponto: o mapa volta pela mesma referência', () => {
    const pontos = Array.from({ length: PATROL_MAX_POINTS }, (_, i) => ({ x: i, y: i }))
    const cheia = mesa([ficha('guarda', 999, 999, { patrulha: { pontos, atual: 0 } })])
    expect(applyPatrolOp(cheia, 'guarda', 'marcar')).toBe(cheia)
    expect(tokenPatrolOf(npc(cheia))?.pontos).toHaveLength(PATROL_MAX_POINTS)
  })

  it('"desfazer" tira o último ponto; tirar o único apaga a rota (a ficha volta a ser comum)', () => {
    const tres = mesa([ficha('guarda', 300, 400, { patrulha: RONDA })])
    const dois = applyPatrolOp(tres, 'guarda', 'desfazer')
    expect(tokenPatrolOf(npc(dois))).toEqual({ pontos: RONDA.pontos.slice(0, 2), atual: 1 })

    const um = mesa([ficha('guarda', 0, 0, { patrulha: { pontos: [{ x: 5, y: 5 }], atual: 0 } })])
    const nenhum = applyPatrolOp(um, 'guarda', 'desfazer')
    expect('patrulha' in npc(nenhum)).toBe(false)
  })

  it('"apagar" tira a rota inteira; ficha sem rota não muda o mapa', () => {
    const comRota = mesa([ficha('guarda', 300, 400, { patrulha: RONDA })])
    expect('patrulha' in npc(applyPatrolOp(comRota, 'guarda', 'apagar'))).toBe(false)
    const semRota = mesa([ficha('guarda', 0, 0)])
    expect(applyPatrolOp(semRota, 'guarda', 'apagar')).toBe(semRota)
    expect(applyPatrolOp(semRota, 'guarda', 'desfazer')).toBe(semRota)
  })
})

describe('applyPatrolOp — Avançar patrulha', () => {
  it('um passo leva o NPC ao ponto seguinte; do último volta ao primeiro', () => {
    let map = mesa([ficha('guarda', 300, 400, { patrulha: RONDA }), ficha('heroi', 50, 50)])
    map = applyPatrolOp(map, 'guarda', 'avancar')
    expect([npc(map).x, npc(map).y]).toEqual([100, 100])
    expect(tokenPatrolOf(npc(map))?.atual).toBe(0)

    map = applyPatrolOp(map, 'guarda', 'avancar')
    expect([npc(map).x, npc(map).y]).toEqual([300, 100])
    expect(tokenPatrolOf(npc(map))?.atual).toBe(1)

    map = applyPatrolOp(map, 'guarda', 'avancar')
    expect([npc(map).x, npc(map).y]).toEqual([300, 400])
    // Só o NPC da rota anda.
    expect([npc(map, 'heroi').x, npc(map, 'heroi').y]).toEqual([50, 50])
  })

  it('NPC arrastado para fora da rota volta ao ponto seguinte ao último alcançado', () => {
    const fora = mesa([ficha('guarda', 700, 700, { patrulha: { ...RONDA, atual: 0 } })])
    const depois = applyPatrolOp(fora, 'guarda', 'avancar')
    expect([npc(depois).x, npc(depois).y]).toEqual([300, 100])
  })

  it('sem rota, com um ponto só, ou ficha que não existe: nada anda e o mapa volta pela mesma referência', () => {
    const semRota = mesa([ficha('guarda', 0, 0)])
    expect(applyPatrolOp(semRota, 'guarda', 'avancar')).toBe(semRota)
    const umPonto = mesa([ficha('guarda', 0, 0, { patrulha: { pontos: [{ x: 9, y: 9 }], atual: 0 } })])
    expect(applyPatrolOp(umPonto, 'guarda', 'avancar')).toBe(umPonto)
    const comRota = mesa([ficha('guarda', 300, 400, { patrulha: RONDA })])
    expect(applyPatrolOp(comRota, 'nao-existe', 'avancar')).toBe(comRota)
  })
})

// A rota nunca sai do mestre: provado no recorte inteiro, `fogFilter.patrulha.test.ts`.
