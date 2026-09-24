import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { noiseCueForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * RUÍDO NO MAPA, o recorte do jogador: do ruído ele recebe só a DIREÇÃO, a
 * partir da ficha DELE mais perto do ruído, e só se ela estiver dentro do
 * alcance. Ficha de outro jogador, ficha escondida e camada oculta não ouvem
 * por ele.
 */

const GRID = 50
const ALCANCE = 600 // 12 casas

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 40, 40, GRID), tokens }
}

const RUIDO = { x: 1000, y: 400 }

describe('noiseCueForPlayer', () => {
  it('a ficha dele dentro do alcance ouve a direção, e só a direção', () => {
    const mapa = mapaCom([ficha('ana', 600, 400)])
    expect(noiseCueForPlayer(mapa, 'ana', { ana: ['ana'] }, RUIDO, ALCANCE)).toBe('e')
  })

  it('fora do alcance não ouve nada', () => {
    const mapa = mapaCom([ficha('ana', 300, 400)])
    expect(noiseCueForPlayer(mapa, 'ana', { ana: ['ana'] }, RUIDO, ALCANCE)).toBeNull()
  })

  it('com duas fichas, decide a mais perto do ruído', () => {
    // A longe (sul, fora do alcance) e a perto (a oeste do ruído): ouve a leste.
    const mapa = mapaCom([ficha('longe', 1000, 1900), ficha('perto', 700, 400)])
    expect(noiseCueForPlayer(mapa, 'ana', { ana: ['longe', 'perto'] }, RUIDO, ALCANCE)).toBe('e')
  })

  it('a ficha de OUTRO jogador perto do ruído não faz este jogador ouvir', () => {
    const mapa = mapaCom([ficha('ana', 100, 100), ficha('bruno', 950, 400)])
    expect(noiseCueForPlayer(mapa, 'ana', { ana: ['ana'], bruno: ['bruno'] }, RUIDO, ALCANCE)).toBeNull()
    expect(noiseCueForPlayer(mapa, 'bruno', { ana: ['ana'], bruno: ['bruno'] }, RUIDO, ALCANCE)).toBe('e')
  })

  it('jogador sem ficha, ficha escondida pelo mestre ou camada de fichas oculta: nada', () => {
    const mapa = mapaCom([ficha('ana', 900, 400)])
    expect(noiseCueForPlayer(mapa, 'caio', { ana: ['ana'] }, RUIDO, ALCANCE)).toBeNull()
    const escondida = mapaCom([ficha('ana', 900, 400, { hidden: true })])
    expect(noiseCueForPlayer(escondida, 'ana', { ana: ['ana'] }, RUIDO, ALCANCE)).toBeNull()
    const semCamada: MapData = { ...mapa, hiddenLayers: ['tokens'] }
    expect(noiseCueForPlayer(semCamada, 'ana', { ana: ['ana'] }, RUIDO, ALCANCE)).toBeNull()
  })

  it('ponto ou alcance que não é número finito positivo: nada', () => {
    const mapa = mapaCom([ficha('ana', 900, 400)])
    expect(noiseCueForPlayer(mapa, 'ana', { ana: ['ana'] }, { x: Number.NaN, y: 400 }, ALCANCE)).toBeNull()
    expect(noiseCueForPlayer(mapa, 'ana', { ana: ['ana'] }, RUIDO, 0)).toBeNull()
    expect(noiseCueForPlayer(mapa, 'ana', { ana: ['ana'] }, RUIDO, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('em cima da ficha: "ao redor", sem direção', () => {
    const mapa = mapaCom([ficha('ana', 1010, 400)])
    expect(noiseCueForPlayer(mapa, 'ana', { ana: ['ana'] }, RUIDO, ALCANCE)).toBe('around')
  })
})
