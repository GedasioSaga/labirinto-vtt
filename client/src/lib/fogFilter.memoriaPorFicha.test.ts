import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer, playerEyeTokens } from './fogFilter'
import { pointInRing } from './floorContour'
import type { MapData, Token, Wall } from '../types/map'

/**
 * MEMÓRIA POR FICHA no recorte: `eyes` diz o que CADA ficha vê, para o host
 * gravar na memória dela. Não sai no mapa enviado.
 */
function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function duasSalas(): MapData {
  return {
    ...createEmptyMap('m', 'M', 25, 25, 40),
    walls: [wall('meio', 500, 0, 500, 1000), wall('porta-esq', 100, 900, 200, 900, { open: false, locked: false, kind: 'normal' })],
    tokens: [token('lia', 200, 500), token('caio', 800, 500), token('vulto', 300, 300, { hidden: true })],
  }
}

describe('fogFilter — olhos por ficha', () => {
  it('cada ficha traz o próprio anel e só as portas que ela vê', () => {
    const map = duasSalas()
    const view = filterMapForPlayer(map, 'p1', { p1: ['lia', 'caio', 'vulto'] }, 700)
    expect(view.eyes.map((e) => e.tokenId)).toEqual(['lia', 'caio'])
    const [lia, caio] = view.eyes
    expect(pointInRing({ x: 250, y: 450 }, lia.vision)).toBe(true)
    expect(pointInRing({ x: 800, y: 450 }, lia.vision)).toBe(false)
    expect(pointInRing({ x: 800, y: 450 }, caio.vision)).toBe(true)
    expect(lia.doorIds).toEqual(['porta-esq'])
    expect(caio.doorIds).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain('eyes')
  })

  it('playerEyeTokens: ficha escondida e ajudante sem visão não são olhos', () => {
    const map = duasSalas()
    const loans = new Map([['caio', { tarefa: 'Vigiar', ate: null, visao: false }]])
    expect(playerEyeTokens(map, 'p1', { p1: ['lia', 'caio', 'vulto'] }, loans).map((t) => t.id)).toEqual(['lia'])
    expect(playerEyeTokens(map, 'p2', { p1: ['lia'] }).map((t) => t.id)).toEqual([])
  })
})
