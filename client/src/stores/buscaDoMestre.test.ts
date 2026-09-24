import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPin, createEmptyMap } from '../lib/mapFactory'
import type { PlayerInfo } from '../net/hostSession'
import type { MapData, Region, Token } from '../types/map'
import { useAdventureStore } from './adventureStore'
import { fontesDaBusca, irAoAchado, mandarFichaPara, type PonteDeMandar } from './buscaDoMestre'
import { useFollowStore } from './followStore'
import { useMapStore } from './mapStore'
import { useSessionStore } from './sessionStore'

/**
 * BUSCA DO MESTRE, do lado das stores: de onde a busca lê as outras cenas, o
 * "Ir lá" que troca de cena e seleciona o achado, e o "Mandar ficha para cá",
 * que leva a ficha do jogador até a sala ou o pino achado — de outra cena pela
 * travessia de sempre (`sendPlayer`), da mesma cena só andando.
 */

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#8c1e8c',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

const TRONO = sala('r-trono', 'Sala do Trono', 128, 128, 640, 640)
const ADEGA = sala('r-adega', 'Adega', 768, 128, 1152, 512)

/** Vale aberto (com a Adega e a ficha da Ana); a Cripta de fundo, DENTRO do Vale, com a Sala do Trono e um pino. */
function montarAventura(): { vale: string; cripta: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap({ ...createEmptyMap('map_vale', 'Vale', 30, 20, 64), regions: [ADEGA] })
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('grog', 128, 1088))
  const cripta = useAdventureStore.getState().createScene('Cripta Rubra', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)
  useAdventureStore.getState().updateBackgroundScene(cripta, (map) =>
    addPin({ ...map, regions: [TRONO] }, { id: 'p-altar', x: 1500, y: 900, kind: 'exclamacao', description: 'Altar partido', image: null }),
  )
  useAdventureStore.getState().moveScene(cripta, vale)
  return { vale, cripta }
}

function jogadora(sceneId: string, tokenIds: string[] = ['grog']): PlayerInfo {
  return { clientId: 'c1', playerId: 'ana', name: 'Ana', status: 'playing', connected: true, tokenIds, visionRadius: 300, sceneId, sceneName: 'Vale' }
}

/** A ponte de mentira: a travessia é a de verdade da aventura (`transferToken`), sem rede. */
function ponteFalsa(player: PlayerInfo, deOnde: string): PonteDeMandar & { sendPlayer: ReturnType<typeof vi.fn> } {
  return {
    players: () => [player],
    sendPlayer: vi.fn((_playerId: string, toSceneId: string, _pinId: string | null, at?: { x: number; y: number }) => {
      if (at === undefined) return false
      return useAdventureStore.getState().transferToken('grog', deOnde, toSceneId, at.x, at.y)
    }),
  }
}

function mapaDe(sceneId: string): MapData {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map
  const slot = cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`a cena ${sceneId} não está no cache`)
  return slot.map
}

function dentroDe(region: Region, token: Token | undefined): boolean {
  if (token === undefined) return false
  const xs = region.points.map((p) => p.x)
  const ys = region.points.map((p) => p.y)
  return token.x > Math.min(...xs) && token.x < Math.max(...xs) && token.y > Math.min(...ys) && token.y < Math.max(...ys)
}

beforeEach(() => {
  useFollowStore.setState({ playerId: null })
})

describe('fontesDaBusca', () => {
  it('as OUTRAS cenas, com o caminho das pastas de fora e o nome; a aberta fica com a lista de sempre', () => {
    const { vale, cripta } = montarAventura()
    const fontes = fontesDaBusca(useAdventureStore.getState())
    expect(fontes.map((f) => [f.sceneId, f.path])).toEqual([[cripta, ['Vale', 'Cripta Rubra']]])
    expect(fontes[0].map.regions.map((r) => r.id)).toEqual(['r-trono'])
    expect(fontes.some((f) => f.sceneId === vale)).toBe(false)
  })

  it('mapa solto: não há outra cena onde buscar', () => {
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(createEmptyMap('map_solto', 'Solto', 10, 10, 50))
    expect(fontesDaBusca(useAdventureStore.getState())).toEqual([])
  })
})

describe('irAoAchado', () => {
  it('sala de outra cena: abre a cena, seleciona a sala e pede a câmera no meio dela', () => {
    const { cripta } = montarAventura()
    expect(irAoAchado({ sceneId: cripta, objectKey: 'room:r-trono' })).toBe(true)
    expect(useAdventureStore.getState().activeSceneId).toBe(cripta)
    expect(useMapStore.getState().selection).toEqual([{ kind: 'region', id: 'r-trono' }])
    expect(useAdventureStore.getState().cameraRequest).toMatchObject({ focus: { x: 384, y: 384 }, fit: { minX: 128, minY: 128, maxX: 640, maxY: 640 } })
  })

  it('pino de outra cena: abre a cena e o pino fica aberto no painel', () => {
    const { cripta } = montarAventura()
    expect(irAoAchado({ sceneId: cripta, objectKey: 'pin:p-altar' })).toBe(true)
    expect(useAdventureStore.getState().activeSceneId).toBe(cripta)
    expect(useMapStore.getState().selectedPinId).toBe('p-altar')
  })

  it('achado que saiu do mapa: não troca de cena nem mexe na seleção', () => {
    const { vale, cripta } = montarAventura()
    expect(irAoAchado({ sceneId: cripta, objectKey: 'room:nao-existe' })).toBe(false)
    expect(useAdventureStore.getState().activeSceneId).toBe(vale)
    expect(useMapStore.getState().selection).toEqual([])
  })

  it('"Ir lá" desliga o Seguir: é o mestre escolhendo para onde olhar', () => {
    const { cripta } = montarAventura()
    useFollowStore.setState({ playerId: 'ana' })
    irAoAchado({ sceneId: cripta, objectKey: 'room:r-trono' })
    expect(useFollowStore.getState().playerId).toBeNull()
  })
})

describe('mandarFichaPara', () => {
  it('de outra cena: a ficha da Ana atravessa pela ponte e assenta dentro da Sala do Trono; o mestre vai junto', () => {
    const { vale, cripta } = montarAventura()
    const ponte = ponteFalsa(jogadora(vale), vale)
    const resultado = mandarFichaPara('ana', { sceneId: cripta, objectKey: 'room:r-trono', name: 'Sala do Trono' }, ponte)
    expect(resultado).toEqual({ ok: true, mensagem: 'Ana foi para Sala do Trono.' })
    expect(ponte.sendPlayer).toHaveBeenCalledTimes(1)
    expect(ponte.sendPlayer.mock.calls[0].slice(0, 3)).toEqual(['ana', cripta, null])
    expect(useAdventureStore.getState().activeSceneId).toBe(cripta)
    expect(mapaDe(vale).tokens.map((t) => t.id)).toEqual([])
    expect(dentroDe(TRONO, mapaDe(cripta).tokens.find((t) => t.id === 'grog'))).toBe(true)
  })

  it('na mesma cena: a ficha só anda até a Adega, sem travessia', () => {
    const { vale } = montarAventura()
    const ponte = ponteFalsa(jogadora(vale), vale)
    const resultado = mandarFichaPara('ana', { sceneId: null, objectKey: 'room:r-adega', name: 'Adega' }, ponte)
    expect(resultado.ok).toBe(true)
    expect(ponte.sendPlayer).not.toHaveBeenCalled()
    expect(dentroDe(ADEGA, mapaDe(vale).tokens.find((t) => t.id === 'grog'))).toBe(true)
  })

  it('jogador sem ficha em cena: nada anda e o mestre sabe por quê', () => {
    const { vale, cripta } = montarAventura()
    const ponte = ponteFalsa(jogadora(vale, []), vale)
    const resultado = mandarFichaPara('ana', { sceneId: cripta, objectKey: 'room:r-trono', name: 'Sala do Trono' }, ponte)
    expect(resultado).toEqual({ ok: false, mensagem: 'Ana não tem ficha em cena.' })
    expect(ponte.sendPlayer).not.toHaveBeenCalled()
    expect(mapaDe(vale).tokens.map((t) => t.id)).toEqual(['grog'])
  })

  it('jogador que saiu da sala: nada anda', () => {
    const { vale, cripta } = montarAventura()
    const ponte = ponteFalsa(jogadora(vale), vale)
    const resultado = mandarFichaPara('outro', { sceneId: cripta, objectKey: 'room:r-trono', name: 'Sala do Trono' }, ponte)
    expect(resultado).toEqual({ ok: false, mensagem: 'Esse jogador não está mais na sala.' })
    expect(useAdventureStore.getState().activeSceneId).toBe(vale)
  })

  it('a travessia recusada pela ponte vira aviso, e a ficha fica onde estava', () => {
    const { vale, cripta } = montarAventura()
    const ponte = ponteFalsa(jogadora(vale), vale)
    ponte.sendPlayer.mockReturnValue(false)
    const resultado = mandarFichaPara('ana', { sceneId: cripta, objectKey: 'room:r-trono', name: 'Sala do Trono' }, ponte)
    expect(resultado.ok).toBe(false)
    expect(resultado.mensagem).toContain('Não deu para mandar Ana')
    expect(mapaDe(vale).tokens.map((t) => t.id)).toEqual(['grog'])
  })
})
