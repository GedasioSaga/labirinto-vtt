import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { createEmptyMap, setTokenPosition } from './mapFactory'
import { boardVehicle, passengerIdsOf } from './vehicle'

/**
 * ARRASTO DENTRO DA MESMA CASA (achado da trilha C1, 01/10/2026): o canvas
 * chama `moveTokenLive` a cada pointermove com a posição JÁ ENCAIXADA na
 * grade, e ela só muda quando o ponteiro troca de casa. Pôr a ficha onde ela
 * já está não muda nada no mapa, então `setTokenPosition` devolve o MESMO
 * objeto. É pela referência que a store (`moveTokenLive`: `next !== map`), o
 * histórico (`commitDragHistory`), a ponte do host (`mapChangeCause`) e a cena
 * de fundo (`updateBackgroundScene`) sabem que nada mudou. Antes saía um mapa
 * novo a cada pointermove e o App inteiro re-renderizava à toa.
 */

const GRADE = 50

/** Ficha mínima: nenhum campo opcional (sem levadoPor, veiculo, piso, npc...). */
function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

/** Tudo o que anda junto com a Ana: a tocha presa nela, o ferido que ela leva e a carroça presa nela. */
function mesa(): MapData {
  return {
    ...createEmptyMap('m', 'Estrada', 40, 40, GRADE),
    tokens: [ficha('ana', 125, 125), ficha('ferido', 175, 125, { levadoPor: 'ana' })],
    lights: [{ id: 'tocha', x: 125, y: 125, radius: 100, color: '#ffcc66', intensity: 1, attachedTokenId: 'ana' }],
    pins: [{ id: 'carroca', x: 125, y: 175, kind: 'exclamacao', description: 'Carroça', image: null, presoA: 'ana' }],
  }
}

/** O cesto (2 lugares) com o Gui a bordo, encostado nele. */
function cestoComGui(): MapData {
  const cena: MapData = {
    ...createEmptyMap('m', 'Poço', 20, 20, GRADE),
    tokens: [ficha('cesto', 325, 325, { npc: true, veiculo: { lugares: 2 } }), ficha('gui', 275, 325)],
  }
  const embarque = boardVehicle(cena, 'cesto', 'gui')
  if (!embarque.ok) throw new Error(`o Gui não embarcou: ${embarque.motivo}`)
  return embarque.map
}

function posicao(map: MapData, id: string): { x: number; y: number } | undefined {
  const achado = map.tokens.find((t) => t.id === id)
  return achado === undefined ? undefined : { x: achado.x, y: achado.y }
}

describe('setTokenPosition no lugar onde a ficha já está: o MESMO mapa', () => {
  it('ficha sem nenhum campo opcional, num mapa sem luz, pino nem veículo', () => {
    const antes: MapData = { ...createEmptyMap('m', 'Vazio', 10, 10, GRADE), tokens: [ficha('t1', 75, 75)] }
    expect(setTokenPosition(antes, 't1', 75, 75)).toBe(antes)
  })

  it('a Ana parada com a tocha, o ferido e a carroça: nada anda', () => {
    const antes = mesa()
    expect(setTokenPosition(antes, 'ana', 125, 125)).toBe(antes)
  })

  it('a ficha levada parada no lugar dela: o mesmo mapa, e continua levada pela Ana', () => {
    const antes = mesa()
    const depois = setTokenPosition(antes, 'ferido', 175, 125)
    expect(depois).toBe(antes)
    expect(depois.tokens.find((t) => t.id === 'ferido')?.levadoPor).toBe('ana')
  })

  it('o veículo parado com gente a bordo: o mesmo mapa, e ninguém desce', () => {
    const antes = cestoComGui()
    const depois = setTokenPosition(antes, 'cesto', 325, 325)
    expect(depois).toBe(antes)
    expect(passengerIdsOf(depois, 'cesto')).toEqual(['gui'])
  })

  it('o passageiro parado no lugar dele: o mesmo mapa, e continua a bordo', () => {
    const antes = cestoComGui()
    const depois = setTokenPosition(antes, 'gui', 275, 325)
    expect(depois).toBe(antes)
    expect(passengerIdsOf(depois, 'cesto')).toEqual(['gui'])
  })
})

describe('saindo do lugar, a ficha anda como sempre', () => {
  it('a Ana desce uma casa: mapa novo, e a tocha, o ferido e a carroça vão junto', () => {
    const antes = mesa()
    const depois = setTokenPosition(antes, 'ana', 125, 175)
    expect(depois).not.toBe(antes)
    expect(posicao(depois, 'ana')).toEqual({ x: 125, y: 175 })
    expect(posicao(depois, 'ferido')).toEqual({ x: 175, y: 175 })
    expect(depois.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 125, y: 175 })
    expect(depois.pins.find((p) => p.id === 'carroca')).toMatchObject({ x: 125, y: 225 })
  })

  it('só o x muda, ou só o y: é passo, não o mesmo lugar', () => {
    const antes: MapData = { ...createEmptyMap('m', 'Vazio', 10, 10, GRADE), tokens: [ficha('t1', 75, 75)] }
    const soX = setTokenPosition(antes, 't1', 125, 75)
    const soY = setTokenPosition(antes, 't1', 75, 125)
    expect(soX).not.toBe(antes)
    expect(posicao(soX, 't1')).toEqual({ x: 125, y: 75 })
    expect(soY).not.toBe(antes)
    expect(posicao(soY, 't1')).toEqual({ x: 75, y: 125 })
  })

  it('o veículo anda uma casa: leva o Gui junto, que continua a bordo', () => {
    const antes = cestoComGui()
    const depois = setTokenPosition(antes, 'cesto', 375, 325)
    expect(depois).not.toBe(antes)
    expect(posicao(depois, 'gui')).toEqual({ x: 325, y: 325 })
    expect(passengerIdsOf(depois, 'cesto')).toEqual(['gui'])
  })
})
