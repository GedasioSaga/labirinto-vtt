/**
 * "Vai junto de": a lista de a quem a ficha selecionada pode ser presa é
 * refeita em todo render do App, e no arrasto o App re-renderiza a cada
 * pointermove. A regra antiga fazia, PARA CADA candidata, dois `find` e um
 * `filter` no mapa inteiro — O(n²): com 800 fichas, ~4 ms por pointermove só
 * nessa conta. Agora cada ficha é lida um número fixo de vezes, e a lista sai
 * igual: as mesmas fichas, na mesma ordem (a mais perto primeiro; no empate,
 * a ordem do mapa).
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { carriedBy, carrierOf, carryCandidates, sameCarryRefs } from './carry'
import { createEmptyMap } from './mapFactory'

const GRID = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('cena', 'Cena', 80, 80, GRID), tokens }
}

/** A regra de antes, sem tirar nem pôr: o oráculo da lista nova. */
function candidatasDeAntes(map: MapData, tokenId: string): Token[] {
  const podeLevar = (carriedId: string, carrierId: string): boolean => {
    if (carriedId === carrierId) return false
    const carried = map.tokens.find((t) => t.id === carriedId)
    const carrier = map.tokens.find((t) => t.id === carrierId)
    if (carried === undefined || carrier === undefined) return false
    return carrierOf(map, carrier) === null && carriedBy(map, carriedId).length === 0
  }
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return []
  const distancia = (t: Token): number => Math.hypot(t.x - token.x, t.y - token.y)
  return map.tokens.filter((t) => podeLevar(tokenId, t.id)).sort((a, b) => distancia(a) - distancia(b))
}

/** As fichas que saíram, como posições no mapa: compara por identidade, e ids repetidos não se confundem. */
function posicoes(map: MapData, lista: Token[]): number[] {
  return lista.map((t) => map.tokens.indexOf(t))
}

/** Gerador com semente (mulberry32): o mesmo sorteio em toda execução. */
function sorteador(semente: number): () => number {
  let estado = semente >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Um mapa "do disco": ids repetidos, vínculo para si mesma, para ficha que
 * sumiu, vazio ou nulo, quem leva e quem é levado misturados, posições que
 * empatam na distância e até coordenada NaN.
 */
function mapaSorteado(sorteio: () => number): MapData {
  const n = Math.floor(sorteio() * 30)
  const ids = Array.from({ length: n }, (_, i) => (sorteio() < 0.1 && i > 0 ? `f${Math.floor(sorteio() * i)}` : `f${i}`))
  const tokens = ids.map((id) => {
    const x = sorteio() < 0.05 ? Number.NaN : Math.floor(sorteio() * 8) * GRID
    const y = Math.floor(sorteio() * 8) * GRID
    const sorte = sorteio()
    if (sorte < 0.4) return ficha(id, x, y)
    if (sorte < 0.5) return ficha(id, x, y, { levadoPor: null })
    if (sorte < 0.55) return ficha(id, x, y, { levadoPor: '' })
    if (sorte < 0.6) return ficha(id, x, y, { levadoPor: id })
    if (sorte < 0.9 && n > 0) return ficha(id, x, y, { levadoPor: ids[Math.floor(sorteio() * n)] })
    return ficha(id, x, y, { levadoPor: 'sumiu' })
  })
  return mapaCom(tokens)
}

const INDICE_DO_ARRAY = /^\d+$/

/** As fichas atrás de um Proxy que conta cada leitura de posição (`find`, `filter` e `for…of` passam por ele). */
function contandoLeituras(tokens: Token[]): { tokens: Token[]; leituras: () => number } {
  let leituras = 0
  const vigiadas = new Proxy(tokens, {
    get(alvo, chave, receptor) {
      if (typeof chave === 'string' && INDICE_DO_ARRAY.test(chave)) leituras += 1
      return Reflect.get(alvo, chave, receptor)
    },
  })
  return { tokens: vigiadas, leituras: () => leituras }
}

/** Teto de leituras por ficha: poucas passadas pelo mapa, nunca uma passada por candidata. */
const LEITURAS_POR_FICHA = 6

describe('carryCandidates: custo', () => {
  it('lê cada ficha um número fixo de vezes, não uma vez por candidata', () => {
    const n = 400
    const soltas = Array.from({ length: n }, (_, i) => ficha(`f${i}`, (i % 20) * GRID, Math.floor(i / 20) * GRID))
    const { tokens, leituras } = contandoLeituras(soltas)
    expect(carryCandidates(mapaCom(tokens), 'f0')).toHaveLength(n - 1)
    // A regra antiga lia ~1,5·n² = 240 000 vezes aqui.
    expect(leituras()).toBeLessThanOrEqual(LEITURAS_POR_FICHA * n)
  })

  it('quem leva alguém não tem candidata, e a resposta sai sem varrer o mapa por candidata', () => {
    const n = 400
    const fichas = Array.from({ length: n }, (_, i) => ficha(`f${i}`, (i % 20) * GRID, Math.floor(i / 20) * GRID))
    fichas[1] = ficha('f1', GRID, 0, { levadoPor: 'f0' })
    const { tokens, leituras } = contandoLeituras(fichas)
    expect(carryCandidates(mapaCom(tokens), 'f0')).toEqual([])
    expect(leituras()).toBeLessThanOrEqual(LEITURAS_POR_FICHA * n)
  })
})

describe('carryCandidates: a mesma lista de antes', () => {
  it('em 400 mapas sorteados, para cada ficha (e para um id que não existe): mesmas fichas, mesma ordem', () => {
    const sorteio = sorteador(20261001)
    let comparadas = 0
    for (let rodada = 0; rodada < 400; rodada += 1) {
      const map = mapaSorteado(sorteio)
      for (const id of [...new Set(map.tokens.map((t) => t.id)), 'sumiu']) {
        expect(posicoes(map, carryCandidates(map, id)), `rodada ${rodada}, ficha ${id}`).toEqual(posicoes(map, candidatasDeAntes(map, id)))
        comparadas += 1
      }
    }
    // O sorteio cobriu casos de verdade, não só mapas vazios.
    expect(comparadas).toBeGreaterThan(4000)
  })

  it('empate na distância fica na ordem do mapa', () => {
    const map = mapaCom([ficha('ferido', 0, 0), ficha('leste', GRID, 0), ficha('norte', 0, -GRID), ficha('oeste', -GRID, 0)])
    expect(carryCandidates(map, 'ferido').map((t) => t.id)).toEqual(['leste', 'norte', 'oeste'])
  })
})

describe('sameCarryRefs', () => {
  const ANA = { id: 'ana', name: 'Ana' }
  const BRUNO = { id: 'bruno', name: 'Bruno' }

  it('mesmas fichas, mesmos nomes e mesma ordem são a mesma lista, mesmo em arrays e objetos novos', () => {
    expect(sameCarryRefs([ANA, BRUNO], [{ ...ANA }, { ...BRUNO }])).toBe(true)
    expect(sameCarryRefs([], [])).toBe(true)
  })

  it('ordem trocada, nome trocado, ficha a mais ou a menos: outra lista', () => {
    expect(sameCarryRefs([ANA, BRUNO], [BRUNO, ANA])).toBe(false)
    expect(sameCarryRefs([ANA, BRUNO], [{ id: 'ana', name: 'Ana Clara' }, BRUNO])).toBe(false)
    expect(sameCarryRefs([ANA, BRUNO], [ANA])).toBe(false)
    expect(sameCarryRefs([ANA], [ANA, BRUNO])).toBe(false)
  })
})
