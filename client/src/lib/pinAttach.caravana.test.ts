import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostWorld } from '../net/hostSession'
import { useMapStore } from '../stores/mapStore'
import { createExploration, markAll } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap, setTokenPosition } from './mapFactory'

/**
 * PINO PRESO A UMA FICHA no MAPA-MUNDI (caravana, `lib/caravan.ts`). As duas
 * peças mexem no mesmo caminho: a caravana empilha as fichas do grupo no ponto
 * dela antes do recorte e move os seguidores pela store; o pino preso decide
 * se sai pelo que o recorte entrega e anda com `setTokenPosition`. Estes
 * testes são o encontro das duas, não cada uma sozinha.
 */

const RAIO = 300
const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: `pino-${id}`, image: null, ...extra }
}

/** Campo aberto de 1500 x 500 px, sem parede. */
function mundo(tokens: Token[], pins: Pin[], worldMap: boolean): MapData {
  const base: MapData = { ...createEmptyMap('m-mundo', 'Continente', 30, 10, 50), tokens, pins }
  return worldMap ? { ...base, worldMap: true } : base
}

function pino(map: MapData, id: string): Pin {
  const achado = map.pins.find((p) => p.id === id)
  if (achado === undefined) throw new Error(`sem o pino ${id}`)
  return achado
}

function exploradoInteiro(map: MapData) {
  const explorado = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
  markAll(explorado)
  return explorado
}

const OWNERSHIP = { p1: ['ana'], p2: ['bia'] }

describe('mapa-mundi: o pino preso segue o que o recorte da CARAVANA entrega', () => {
  // Ana é o ponto da caravana. Bia ficou esquecida longe, ao lado do navio
  // (NPC) com a prancha presa. O chão todo já foi explorado.
  const tokens = [ficha('ana', 100, 100), ficha('bia', 1200, 400), ficha('navio', 1250, 400)]
  const pins = [viagem('prancha', 1270, 400, { presoA: 'navio' }), viagem('boia', 1300, 300)]

  it('navio fora da visão da caravana: a prancha não sai, mesmo com a Bia (esquecida) ao lado dele', () => {
    const map = mundo(tokens, pins, true)
    const view = filterMapForPlayer(map, 'p2', OWNERSHIP, RAIO, exploradoInteiro(map))
    expect(view.map.tokens.map((t) => t.id)).toEqual(['caravana'])
    // A boia (solta) sai pelo explorado; a prancha contaria onde o navio está.
    expect(view.map.pins.map((p) => p.id)).toEqual(['boia'])
    expect(JSON.stringify(view)).not.toContain('prancha')
  })

  it('controle: a mesma cena sem a marca de mapa-mundi — a Bia enxerga o navio e a prancha sai', () => {
    const map = mundo(tokens, pins, false)
    const view = filterMapForPlayer(map, 'p2', OWNERSHIP, RAIO, exploradoInteiro(map))
    expect(view.map.tokens.map((t) => t.id)).toEqual(['bia', 'navio'])
    expect(view.map.pins.map((p) => p.id)).toEqual(['prancha', 'boia'])
    expect(view.map.pins[0]).not.toHaveProperty('presoA')
  })

  it('pino preso a uma ficha DO GRUPO sai com a caravana, sem dizer a qual ficha está preso', () => {
    const map = mundo([ficha('ana', 100, 100), ficha('bia', 100, 100)], [viagem('porta', 120, 100, { presoA: 'bia' })], true)
    const view = filterMapForPlayer(map, 'p1', OWNERSHIP, RAIO)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['caravana'])
    expect(view.map.pins.map((p) => [p.id, p.x, p.y])).toEqual([['porta', 120, 100]])
    const texto = JSON.stringify(view)
    expect(texto).not.toContain('presoA')
    expect(texto).not.toContain('"bia"')
    expect(texto).not.toContain('nome-bia')
  })
})

describe('mapa-mundi: o seguidor da caravana leva o pino preso a ele', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: mundo(
        [ficha('ana', 100, 100), ficha('bia', 100, 100)],
        [viagem('porta', 120, 100, { presoA: 'bia' }), viagem('bandeira', 90, 100, { presoA: 'ana' })],
        true,
      ),
      past: [],
      future: [],
    })
  })

  function mesaDaStore(): HostWorld {
    return { open: { sceneId: 's-mundo', name: 'Continente', map: useMapStore.getState().map }, background: [] }
  }

  function sala() {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 400, now: () => 0, randomId: () => `id-${(n += 1)}` })
    for (const [clientId, nome, tokenId] of [['c1', 'Ana', 'ana'], ['c2', 'Bia', 'bia']] as const) {
      const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, mesaDaStore()).outbound[0]?.msg
      if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
      s.assignToken(welcome.playerId, tokenId)
    }
    return s
  }

  it('o mestre arrasta a Ana; a Bia segue pela store e a porta presa a ela vai junto', () => {
    const s = sala()
    // Caravana formada, ninguém fora do ponto.
    expect(s.followCaravans(mesaDaStore()).moves).toEqual([])

    useMapStore.getState().moveToken('ana', 600, 100)
    const arrastada = useMapStore.getState().map
    expect(arrastada.tokens.find((t) => t.id === 'ana')).toMatchObject({ x: 600, y: 100 })
    expect(pino(arrastada, 'bandeira')).toMatchObject({ x: 590, y: 100, presoA: 'ana' })

    const follow = s.followCaravans(mesaDaStore())
    expect(follow.moves).toEqual([{ tokenId: 'bia', x: 600, y: 100 }])
    // O caminho do App (`applyCaravanMoves`) para a cena aberta.
    useMapStore.getState().setTokenPositionsLive(follow.moves.map(({ tokenId, x, y }) => ({ id: tokenId, x, y })))

    const depois = useMapStore.getState().map
    expect(depois.tokens.find((t) => t.id === 'bia')).toMatchObject({ x: 600, y: 100 })
    expect(pino(depois, 'porta')).toMatchObject({ x: 620, y: 100, presoA: 'bia' })
    // Seguir não gasta desfazer: um Ctrl+Z volta ao retrato de antes do arrasto.
    expect(useMapStore.getState().past).toHaveLength(1)
  })

  it('cena de fundo: o mesmo passo por setTokenPosition também leva o pino preso', () => {
    const fundo = setTokenPosition(useMapStore.getState().map, 'bia', 700, 250)
    expect(pino(fundo, 'porta')).toMatchObject({ x: 720, y: 250, presoA: 'bia' })
    expect(pino(fundo, 'bandeira')).toMatchObject({ x: 90, y: 100 })
  })
})
