/**
 * MACRO POR PONTO na patrulha andando: ao chegar a um ponto, a ficha faz os
 * passos dele em ordem (esperar, olhar, velocidade do próximo trecho, falar,
 * sumir, aparecer, esperar o mestre) e só então segue para o próximo ponto.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { darPassoDaPatrulha, ligarPatrulha, moverPatrulhas, PASSO_DA_PATRULHA_MS, seguirPatrulha, type PatrulhasAndando } from './patrulhaAndando'
import { passoEmPx } from './rotinaAndando'
import type { MapData, PassoDaPatrulha, Token, TokenPatrol } from '../types/map'

const G = 50

function guarda(x: number, y: number, patrulha: TokenPatrol, extra: Partial<Token> = {}): Token {
  return { id: 'guarda', characterId: null, name: 'Guarda', x, y, size: 1, image: null, npc: true, patrulha, ...extra }
}

/** Rota reta: (100,100) → (300,100) → (300,300); o ponto 2 tem os `passos` dados. */
function mesa(passos: PassoDaPatrulha[] | undefined, extra: Partial<Token> = {}): MapData {
  const rota: TokenPatrol = {
    pontos: [{ x: 100, y: 100, passos: [] }, { x: 300, y: 100, ...(passos === undefined ? {} : { passos }) }, { x: 300, y: 300, passos: [] }],
    atual: 0,
  }
  return { ...createEmptyMap('m', 'M', 30, 30, G), tokens: [guarda(100, 100, rota, extra)] }
}

function ficha(map: MapData): Token {
  const t = map.tokens[0]
  if (t === undefined) throw new Error('sem o guarda')
  return t
}

/** Anda tique a tique até a ficha chegar ao ponto 2; devolve o estado logo depois do tique da chegada. */
function ateChegar(map: MapData) {
  let estado: { map: MapData; andando: PatrulhasAndando; now: number } = { map, andando: ligarPatrulha(new Map(), map, 'guarda', 0), now: 0 }
  for (let i = 0; i < 100; i += 1) {
    const r = darPassoDaPatrulha(estado.map, estado.andando, estado.now)
    const depois = moverPatrulhas(estado.map, r.movimentos)
    const chegada = r.movimentos.find((m) => m.atual === 1)
    estado = { map: depois, andando: r.andando, now: estado.now + PASSO_DA_PATRULHA_MS }
    if (chegada !== undefined) return { ...estado, chegouEm: estado.now - PASSO_DA_PATRULHA_MS, movimento: chegada }
  }
  throw new Error('não chegou')
}

describe('macro do ponto', () => {
  it('ao chegar, faz os passos em ordem: olhar e falar na hora, e a espera segura a saída', () => {
    const r = ateChegar(mesa([{ tipo: 'olhar', graus: 90 }, { tipo: 'falar', texto: 'Alto!' }, { tipo: 'esperar', segundos: 1 }, { tipo: 'sumir' }]))
    expect(r.movimento).toMatchObject({ x: 300, y: 100, atual: 1, olhar: 90, fala: 'Alto!' })
    expect(ficha(r.map)).toMatchObject({ rotation: 90, fala: 'Alto!' })
    expect(ficha(r.map).hidden).toBeUndefined()
    // Durante a espera, nada.
    const esperando = darPassoDaPatrulha(r.map, r.andando, r.chegouEm + 999)
    expect(esperando.movimentos).toEqual([])
    // Passada a espera: some e sai andando; a fala acaba quando ela volta a andar.
    const saiu = darPassoDaPatrulha(r.map, r.andando, r.chegouEm + 1000)
    expect(saiu.movimentos[0]).toMatchObject({ sumida: true, fala: null, x: 300, y: 100 + passoEmPx(G, 2) })
    const depois = ficha(moverPatrulhas(r.map, saiu.movimentos))
    expect(depois.hidden).toBe(true)
    expect(depois).not.toHaveProperty('fala')
  })

  it('velocidade vale só no trecho seguinte; no ponto de chegada volta à da ficha', () => {
    const r = ateChegar(mesa([{ tipo: 'velocidade', casas: 4 }]))
    const saiu = darPassoDaPatrulha(r.map, r.andando, r.now)
    expect(saiu.movimentos[0]).toMatchObject({ x: 300, y: 100 + passoEmPx(G, 4) })
    // Anda até o ponto 3 e de volta rumo ao 1: agora no passo padrão.
    let estado = { map: moverPatrulhas(r.map, saiu.movimentos), andando: saiu.andando, now: r.now + PASSO_DA_PATRULHA_MS }
    for (let i = 0; i < 40 && ficha(estado.map).patrulha?.atual !== 2; i += 1) {
      const t = darPassoDaPatrulha(estado.map, estado.andando, estado.now)
      estado = { map: moverPatrulhas(estado.map, t.movimentos), andando: t.andando, now: estado.now + PASSO_DA_PATRULHA_MS }
    }
    expect(ficha(estado.map)).toMatchObject({ x: 300, y: 300 })
    const rumoAo1 = darPassoDaPatrulha(estado.map, estado.andando, estado.now)
    const m = rumoAo1.movimentos[0]
    expect(m).toBeDefined()
    if (m !== undefined) expect(Math.hypot(m.x - 300, m.y - 300)).toBeCloseTo(passoEmPx(G, 2))
  })

  it('esperar o mestre: para até "Seguir", por mais tempo que passe', () => {
    const r = ateChegar(mesa([{ tipo: 'esperarMestre' }, { tipo: 'aparecer' }], { hidden: true }))
    expect(r.andando.get('guarda')?.esperandoMestre).toBe(true)
    const muitoDepois = darPassoDaPatrulha(r.map, r.andando, r.now + 3_600_000)
    expect(muitoDepois.movimentos).toEqual([])
    expect(muitoDepois.andando.get('guarda')?.esperandoMestre).toBe(true)
    const seguiu = seguirPatrulha(muitoDepois.andando, 'guarda', r.now + 3_600_000)
    expect(seguiu.get('guarda')?.esperandoMestre).toBeUndefined()
    const t = darPassoDaPatrulha(r.map, seguiu, r.now + 3_600_000)
    expect(t.movimentos[0]).toMatchObject({ sumida: false })
    expect(ficha(moverPatrulhas(r.map, t.movimentos))).not.toHaveProperty('hidden')
  })

  it('"Seguir" em quem não espera o mestre: o mesmo estado', () => {
    const andando: PatrulhasAndando = new Map([['guarda', { destino: 1, sentido: 1, esperaAte: 0 }]])
    expect(seguirPatrulha(andando, 'guarda', 10)).toBe(andando)
    expect(seguirPatrulha(andando, 'outro', 10)).toBe(andando)
  })

  it('ponto sem passos (lista vazia): segue no tique seguinte, sem esperar', () => {
    const r = ateChegar(mesa([]))
    const saiu = darPassoDaPatrulha(r.map, r.andando, r.now)
    expect(saiu.movimentos[0]).toMatchObject({ x: 300, y: 100 + passoEmPx(G, 2) })
  })

  it('ponto de mapa antigo (sem lista): espera 2 s, como antes da macro', () => {
    const r = ateChegar(mesa(undefined))
    expect(darPassoDaPatrulha(r.map, r.andando, r.chegouEm + 1999).movimentos).toEqual([])
    expect(darPassoDaPatrulha(r.map, r.andando, r.chegouEm + 2000).movimentos).toHaveLength(1)
  })

  it('passos repetidos rodam todos, na ordem', () => {
    const r = ateChegar(mesa([{ tipo: 'esperar', segundos: 1 }, { tipo: 'olhar', graus: 180 }, { tipo: 'esperar', segundos: 1 }, { tipo: 'olhar', graus: 270 }]))
    const t1 = darPassoDaPatrulha(r.map, r.andando, r.chegouEm + 1000)
    expect(t1.movimentos[0]).toMatchObject({ olhar: 180 })
    expect(t1.movimentos[0]?.x).toBe(300)
    const t2 = darPassoDaPatrulha(r.map, t1.andando, r.chegouEm + 2000)
    expect(t2.movimentos[0]).toMatchObject({ olhar: 270 })
  })
})

describe('moverPatrulhas — o que os passos mudam na ficha', () => {
  it('olhar gira a ficha e o cone da vigia (0 = leste no cone, 0 = para cima na ficha)', () => {
    const map = mesa([], { vigia: { direcao: 45, abertura: 90, alcance: 6 } })
    const depois = ficha(moverPatrulhas(map, [{ tokenId: 'guarda', x: 100, y: 100, olhar: 90 }]))
    expect(depois.rotation).toBe(90)
    expect(depois.vigia).toEqual({ direcao: 0, abertura: 90, alcance: 6 })
    const norte = ficha(moverPatrulhas(map, [{ tokenId: 'guarda', x: 100, y: 100, olhar: 0 }]))
    expect(norte.vigia?.direcao).toBe(270)
  })

  it('sem vigia, olhar só gira a ficha', () => {
    const depois = ficha(moverPatrulhas(mesa([]), [{ tokenId: 'guarda', x: 100, y: 100, olhar: 180 }]))
    expect(depois.rotation).toBe(180)
    expect(depois).not.toHaveProperty('vigia')
  })
})
