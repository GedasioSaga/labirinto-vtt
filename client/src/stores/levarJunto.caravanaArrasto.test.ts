import { beforeEach, describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { createEmptyMap } from '../lib/mapFactory'
import { createHostSession, type HostSession } from '../net/hostSession'
import { useMapStore } from './mapStore'

/**
 * LEVAR FICHA JUNTO na CARAVANA do mapa-mundi: quando a ficha LEVADA também é
 * da caravana, o passo da caravana não pode virar um laço. Antes, o mestre
 * arrastava a Bia (levada pela Ana); a caravana puxava a Ana até a Bia, e o
 * passo da Ana arrastava a Bia mais um deslocamento. Cada broadcast repetia o
 * puxão e a caravana disparava sozinha pelo mapa, parando só na borda (e no
 * caminho podia cair em cima de uma cidade e oferecer "Desembarcar").
 *
 * Ligado como o App liga: `followCaravans` da sessão e os passos aplicados por
 * `setTokenPositionsLive`, repetido como cada broadcast repete.
 */
const GRID = 64
const CODE = 'AB12CD'

const ficha = (id: string, x: number, y: number, extra: Partial<Token> = {}): Token => ({
  id,
  characterId: null,
  name: `ficha-${id}`,
  x,
  y,
  size: 1,
  image: null,
  ...extra,
})

const posicao = (id: string): string => {
  const t = useMapStore.getState().map.tokens.find((token) => token.id === id)
  return t === undefined ? `${id}:sumiu` : `${id}:${t.x},${t.y}`
}

function sala(tokens: Token[], jogadores: string[]): HostSession {
  useMapStore.setState({
    map: { ...createEmptyMap('m-mundo', 'Continente', 30, 20, GRID), worldMap: true, tokens },
    past: [],
    future: [],
  })
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 400, now: () => 0, randomId: () => `id-${(n += 1)}` })
  jogadores.forEach((tokenId, i) => {
    const welcome = s.handleMessage(`c${i + 1}`, { type: 'join', code: CODE, name: `J${i + 1}` }, useMapStore.getState().map).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
  })
  return s
}

/** Um broadcast: a caravana segue e os passos entram pela store, sem desfazer (como o App). Devolve quantas fichas andaram. */
function broadcast(s: HostSession): number {
  const { moves } = s.followCaravans(useMapStore.getState().map)
  if (moves.length > 0) useMapStore.getState().setTokenPositionsLive(moves.map(({ tokenId, x, y }) => ({ id: tokenId, x, y })))
  return moves.length
}

/** Oito broadcasts seguidos, sem ninguém tocar: a trilha de onde as fichas estão depois de cada um. */
function trilha(s: HostSession, ids: string[]): string[] {
  const passos: string[] = []
  for (let i = 0; i < 8; i += 1) {
    broadcast(s)
    passos.push(ids.map(posicao).join(' '))
  }
  return passos
}

describe('caravana com a ficha levada que também é da caravana', () => {
  beforeEach(() => useMapStore.setState({ past: [], future: [] }))

  it('o mestre arrasta a Bia (levada pela Ana): a caravana vai até ela e para ali', () => {
    const s = sala([ficha('ana', 100, 100), ficha('bia', 100, 100, { levadoPor: 'ana' })], ['ana', 'bia'])
    expect(broadcast(s)).toBe(0)

    useMapStore.getState().moveToken('bia', 200, 100)
    expect(posicao('bia')).toBe('bia:200,100')

    const passos = trilha(s, ['ana', 'bia'])
    expect(passos).toEqual(Array.from({ length: 8 }, () => 'ana:200,100 bia:200,100'))
    // Parada: o broadcast seguinte não acha nada a mover.
    expect(broadcast(s)).toBe(0)
    // O vínculo continua.
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 'bia')?.levadoPor).toBe('ana')
  })

  it('o mestre arrasta o Caio: a Bia vem ANTES da Ana na ordem do mapa, e mesmo assim os três param juntos', () => {
    const s = sala(
      [ficha('bia', 100, 100, { levadoPor: 'ana' }), ficha('ana', 100, 100), ficha('caio', 100, 100)],
      ['bia', 'ana', 'caio'],
    )
    expect(broadcast(s)).toBe(0)

    useMapStore.getState().moveToken('caio', 200, 100)

    const passos = trilha(s, ['ana', 'bia', 'caio'])
    expect(passos).toEqual(Array.from({ length: 8 }, () => 'ana:200,100 bia:200,100 caio:200,100'))
    expect(broadcast(s)).toBe(0)
  })

  it('o ferido (NPC, fora da caravana) preso à Ana continua indo junto quando a caravana puxa a Ana', () => {
    const s = sala(
      [ficha('ana', 100, 100), ficha('caio', 100, 100), ficha('ferido', 100, 300, { levadoPor: 'ana' })],
      ['ana', 'caio'],
    )
    expect(broadcast(s)).toBe(0)

    useMapStore.getState().moveToken('caio', 200, 100)

    const passos = trilha(s, ['ana', 'caio', 'ferido'])
    expect(passos).toEqual(Array.from({ length: 8 }, () => 'ana:200,100 caio:200,100 ferido:200,300'))
    expect(broadcast(s)).toBe(0)
  })
})
