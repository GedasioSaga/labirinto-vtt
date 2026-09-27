import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { buildWallFromDraft } from '../lib/drawingFactory'
import { useMapStore } from './mapStore'

/**
 * PAREDE LIVRE. A Sala livre ganha a variação "Parede": o mestre traça ponto a
 * ponto como na Sala, mas o que nasce são só paredes soltas, sem sala. Um
 * traçado de vários trechos é UM desenho: um Ctrl+Z tira todos de uma vez.
 */
const TRECHOS = [
  buildWallFromDraft('pl0', { x: 64, y: 64 }, { x: 320, y: 64 }, 'interior'),
  buildWallFromDraft('pl1', { x: 320, y: 64 }, { x: 320, y: 256 }, 'interior'),
  buildWallFromDraft('pl2', { x: 320, y: 256 }, { x: 128, y: 320 }, 'interior'),
]

describe('addWalls (Parede livre)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: createEmptyMap('m_parede_livre', 'Parede livre', 40, 20, 64),
      selection: [],
      past: [],
      future: [],
      pisoAtivo: 0,
    })
  })

  it('todas as paredes do traçado entram num passo só de histórico', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().addWalls(TRECHOS)

    const { map, past } = useMapStore.getState()
    expect(map.walls.map((wall) => wall.id)).toEqual(['pl0', 'pl1', 'pl2'])
    expect(past).toHaveLength(1)
    expect(past[0]).toBe(antes)
  })

  it('um Ctrl+Z desfaz o traçado inteiro, não trecho por trecho', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().addWalls(TRECHOS)
    useMapStore.getState().undo()

    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().map.walls).toEqual([])
  })

  it('não cria sala nem região: só as paredes', () => {
    useMapStore.getState().addWalls(TRECHOS)
    expect(useMapStore.getState().map.regions).toEqual([])
  })

  it('traçado vazio não mexe no mapa nem gasta passo de histórico', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().addWalls([])

    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toEqual([])
  })

  it('as paredes nascem no piso em edição, como as da ferramenta Parede', () => {
    useMapStore.setState({ pisoAtivo: 1 })
    useMapStore.getState().addWalls(TRECHOS)
    expect(useMapStore.getState().map.walls.map((wall) => wall.piso)).toEqual([1, 1, 1])
  })
})

describe('preferências da Sala livre (criar sala ou parede; arredondar)', () => {
  beforeEach(() => {
    useMapStore.setState({ past: [], future: [], roomFreeKind: 'sala', roomFreeRounded: false })
  })

  it('o padrão é Sala com cantos vivos: quem não mexe no menu desenha como hoje', () => {
    const { roomFreeKind, roomFreeRounded } = useMapStore.getInitialState()
    expect(roomFreeKind).toBe('sala')
    expect(roomFreeRounded).toBe(false)
  })

  it('trocar para Parede e ligar Arredondar não entra no histórico do mapa', () => {
    useMapStore.getState().setRoomFreeKind('parede')
    useMapStore.getState().setRoomFreeRounded(true)

    const { roomFreeKind, roomFreeRounded, past } = useMapStore.getState()
    expect(roomFreeKind).toBe('parede')
    expect(roomFreeRounded).toBe(true)
    expect(past).toEqual([])
  })
})
