import { describe, expect, it } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { createHostSession, DOOR_TOGGLE_MIN_INTERVAL_MS, type HostResult, type HostScene, type HostWorld } from './hostSession'

/**
 * JUNÇÃO DO GRUPO MUNDO: a ALAVANCA (grupo mundo) com a PAUSA POR CENA e o
 * "QUEM VÊ" do pino (grupos já juntados). A alavanca mexe numa porta, então
 * para na cena pausada como o toque na porta; e a alavanca escolhida só para
 * outro jogador não se puxa, como o item que não chega a ele não se pega.
 */

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

const PORTA: Wall = { id: 'porta-cripta', x1: 500, y1: 0, x2: 500, y2: 1000, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
const ALAVANCA: Pin = { ...buildPin('alav', { x: 200, y: 200 }, 'alavanca'), description: 'Alavanca', portaLigada: 'porta-cripta' }

const CRIPTA: HostScene = {
  sceneId: 's-cripta',
  name: 'Cripta',
  map: { ...createEmptyMap('m-cripta', 'Cripta', 1000, 1000, 40), walls: [PORTA], pins: [ALAVANCA], tokens: [ficha('diego', 180, 200), ficha('bruno', 220, 240)] } satisfies MapData,
}
const mundo: HostWorld = { open: CRIPTA, background: [] }

function mesa() {
  let clock = 0
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => clock, randomId: () => `id-${(n += 1)}` })
  const ids: Record<string, string> = {}
  for (const [clientId, nome, tokenId] of [
    ['c1', 'Diego', 'diego'],
    ['c2', 'Bruno', 'bruno'],
  ] as const) {
    const joined = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, mundo).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    ids[tokenId] = joined.playerId
    s.assignToken(joined.playerId, tokenId)
  }
  s.broadcast(mundo)
  return {
    s,
    ids,
    puxar: (clientId: string): HostResult => {
      clock += DOOR_TOGGLE_MIN_INTERVAL_MS
      return s.handleMessage(clientId, { type: 'pin.lever', pinId: 'alav' }, mundo)
    },
  }
}

describe('junção do grupo mundo: alavanca com pausa e "quem vê"', () => {
  it('controle: fora da pausa e sem lista, Diego encostado puxa e a porta ligada mexe', () => {
    const { puxar } = mesa()
    expect(puxar('c1').applyDoor).toMatchObject({ wallId: 'porta-cripta' })
  })

  it('cena pausada: a alavanca morre em silêncio; despausada, volta a valer', () => {
    const { s, puxar } = mesa()
    s.setScenePaused('s-cripta', true, mundo)
    const pausada = puxar('c1')
    expect(pausada.applyDoor).toBeUndefined()
    expect(pausada.outbound).toEqual([])
    s.setScenePaused('s-cripta', false, mundo)
    expect(puxar('c1').applyDoor).toMatchObject({ wallId: 'porta-cripta' })
  })

  it('alavanca escolhida só para Bruno: Diego não puxa, e a recusa é a genérica', () => {
    const { s, ids, puxar } = mesa()
    s.setPinAudience('alav', [ids.bruno])
    const doDiego = puxar('c1')
    expect(doDiego.applyDoor).toBeUndefined()
    expect(doDiego.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.lever.rejected', reason: 'unavailable' } }])
    // Todos de novo: Diego puxa.
    s.setPinAudience('alav', null)
    expect(puxar('c1').applyDoor).toMatchObject({ wallId: 'porta-cripta' })
  })
})
