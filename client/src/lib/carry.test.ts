/**
 * LEVAR FICHA JUNTO (achado da simulação da torre): o mestre prende uma ficha
 * — o ferido, o NPC escoltado — à ficha de um jogador. Ela anda junto no
 * arrasto e atravessa o pino de viagem junto; o mestre solta com um botão.
 * Aqui, a parte pura: as regras de prender/soltar e o "anda junto".
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { attachCarried, carriedBy, carrierOf, carryCandidates, releaseCarried } from './carry'
import { companionArrivals } from './carryArrival'
import { cloneToken } from './entityClone'
import { createEmptyMap, setTokenPosition } from './mapFactory'

const GRID = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function torre(tokens: Token[]): MapData {
  return { ...createEmptyMap('torre', 'Torre', 40, 20, GRID), tokens }
}

function posicao(map: MapData, id: string): { x: number; y: number } {
  const t = map.tokens.find((token) => token.id === id)
  if (t === undefined) throw new Error(`sem a ficha ${id}`)
  return { x: t.x, y: t.y }
}

describe('carry: prender e soltar', () => {
  it('o mestre prende o ferido à ficha da Ana: o ferido passa a ser levado por ela', () => {
    const map = attachCarried(torre([ficha('ana', 125, 125), ficha('ferido', 175, 125)]), 'ferido', 'ana')
    expect(carrierOf(map, map.tokens[1])?.id).toBe('ana')
    expect(carriedBy(map, 'ana').map((t) => t.id)).toEqual(['ferido'])
  })

  it('soltar tira o vínculo e apaga o campo (ficha volta a ser como antes)', () => {
    const presa = attachCarried(torre([ficha('ana', 125, 125), ficha('ferido', 175, 125)]), 'ferido', 'ana')
    const solta = releaseCarried(presa, 'ferido')
    expect(carriedBy(solta, 'ana')).toEqual([])
    expect('levadoPor' in solta.tokens[1]).toBe(false)
  })

  it('recusa sem mexer no mapa: a si mesma, ficha que não existe, cadeia (quem é levado não leva)', () => {
    const base = torre([ficha('ana', 125, 125), ficha('ferido', 175, 125), ficha('npc', 225, 125)])
    expect(attachCarried(base, 'ana', 'ana')).toBe(base)
    expect(attachCarried(base, 'ferido', 'fantasma')).toBe(base)
    const presa = attachCarried(base, 'ferido', 'ana')
    // O ferido já é levado: não pode levar o NPC.
    expect(attachCarried(presa, 'npc', 'ferido')).toBe(presa)
    // A Ana leva alguém: ela não pode ser levada.
    expect(attachCarried(presa, 'ana', 'npc')).toBe(presa)
  })

  it('vínculo apontando para ficha que sumiu não conta como levado', () => {
    const map = torre([ficha('ferido', 175, 125, { levadoPor: 'apagada' })])
    expect(carrierOf(map, map.tokens[0])).toBeNull()
  })

  it('candidatos a levar: as outras fichas, a mais perto primeiro, sem quem já é levado', () => {
    const map = torre([
      ficha('ferido', 125, 125),
      ficha('longe', 925, 125),
      ficha('perto', 175, 125),
      ficha('levado', 225, 125, { levadoPor: 'longe' }),
    ])
    expect(carryCandidates(map, 'ferido').map((t) => t.id)).toEqual(['perto', 'longe'])
  })

  it('duplicar a ficha levada não duplica o vínculo', () => {
    const levado = ficha('ferido', 175, 125, { levadoPor: 'ana' })
    expect('levadoPor' in cloneToken(levado, { dx: GRID, dy: 0 })).toBe(false)
  })
})

describe('carry: anda junto no arrasto', () => {
  it('mover a Ana leva o ferido pelo mesmo deslocamento; o NPC solto fica', () => {
    const map = attachCarried(torre([ficha('ana', 125, 125), ficha('ferido', 175, 125), ficha('npc', 225, 225)]), 'ferido', 'ana')
    const depois = setTokenPosition(map, 'ana', 425, 325)
    expect(posicao(depois, 'ana')).toEqual({ x: 425, y: 325 })
    expect(posicao(depois, 'ferido')).toEqual({ x: 475, y: 325 })
    expect(posicao(depois, 'npc')).toEqual({ x: 225, y: 225 })
  })

  it('mover o ferido sozinho não arrasta a Ana (o mestre acerta onde ele fica)', () => {
    const map = attachCarried(torre([ficha('ana', 125, 125), ficha('ferido', 175, 125)]), 'ferido', 'ana')
    const depois = setTokenPosition(map, 'ferido', 125, 175)
    expect(posicao(depois, 'ana')).toEqual({ x: 125, y: 125 })
    expect(posicao(depois, 'ferido')).toEqual({ x: 125, y: 175 })
  })

  it('solto, o ferido não acompanha mais', () => {
    const presa = attachCarried(torre([ficha('ana', 125, 125), ficha('ferido', 175, 125)]), 'ferido', 'ana')
    const depois = setTokenPosition(releaseCarried(presa, 'ferido'), 'ana', 425, 325)
    expect(posicao(depois, 'ferido')).toEqual({ x: 175, y: 125 })
  })
})

describe('carry: chegada do outro lado do pino', () => {
  it('cada levado assenta numa casa livre colada à casa de chegada da Ana, nunca em cima dela', () => {
    const destino = torre([])
    const ana = ficha('ana', 125, 125)
    const levados = [ficha('ferido', 175, 125), ficha('npc', 225, 125)]
    const chegadas = companionArrivals(destino, ana, { x: 525, y: 325 }, levados)
    expect(chegadas.map((c) => c.tokenId)).toEqual(['ferido', 'npc'])
    for (const c of chegadas) {
      expect(c.x === 525 && c.y === 325).toBe(false)
      expect(Math.hypot(c.x - 525, c.y - 325)).toBeLessThanOrEqual(GRID * Math.SQRT2 + 0.01)
    }
    expect(chegadas[0].x === chegadas[1].x && chegadas[0].y === chegadas[1].y).toBe(false)
  })
})
