/**
 * FOGO "Apagar o fogo" na sessão do mestre: o pedido do cartão do pino só vale
 * de quem tem uma ficha encostada (a regra da pesca e do tiro), e o convite
 * volta SOZINHO só para ele. Quem está longe ouve `fogo.recusado` `longe`.
 */
import { describe, expect, it } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { MINIGAME_FOGO_PADRAO } from '../minigames/fogo/tipos'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const PINO = 'pino-fogo'

/** Ana encostada no pino; Bruno longe. */
const ficha = (id: string, x: number, y: number): Token => ({ id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null })

function mesa() {
  let n = 0
  const map: MapData = {
    ...createEmptyMap('m-mata', 'Mata', 1000, 1000, 50),
    pins: [{ ...buildPin(PINO, { x: 300, y: 300 }, 'minigame'), minigame: { ...MINIGAME_FOGO_PADRAO, permitida: 'normal' } }],
    tokens: [ficha('t-ana', 300, 250), ficha('t-bruno', 100, 200)],
  }
  const world: HostWorld = { open: { sceneId: 's-mata', name: 'Mata', map }, background: [] }
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, tokenId: string): void => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
  }
  entra('c-ana', 'Ana', 't-ana')
  entra('c-bruno', 'Bruno', 't-bruno')
  s.broadcast(world)
  return (clientId: string, msg: Record<string, unknown>): HostResult => s.handleMessage(clientId, msg, world)
}

describe('fogo na sessão: "Apagar o fogo" no pino', () => {
  it('encostada, o convite volta sozinho só a ela; longe, recusa com "longe"', () => {
    const de = mesa()
    const pedido = de('c-ana', { type: 'fogo.pedir', pinId: PINO })
    expect(pedido.outbound.map((o) => `${o.clientId}:${o.msg.type}`)).toEqual(['c-ana:fogo.convite'])
    const convite = pedido.outbound[0]?.msg
    expect(convite?.type === 'fogo.convite' && [convite.modo, convite.sozinho, convite.npc]).toEqual(['solo', { permitida: 'normal' }, MINIGAME_FOGO_PADRAO.npc])
    const longe = de('c-bruno', { type: 'fogo.pedir', pinId: PINO })
    expect(longe.outbound.map((o) => o.msg)).toEqual([{ type: 'fogo.recusado', pinId: PINO, motivo: 'longe' }])
  })
})
