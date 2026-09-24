import { beforeEach, describe, expect, it } from 'vitest'
import type { Token, Wall } from '../types/map'
import { selectionOfItem } from '../lib/selectionModel'
import { useMapStore } from './mapStore'

/**
 * LEVAR FICHA JUNTO nos caminhos de movimento do MESTRE: a seta com a ficha de
 * quem leva selecionada e o arrasto da seleção (`moveSelectionBy` /
 * `moveSelectionLive`, que não passam por `setTokenPosition`), e o arrasto da
 * ficha (`moveToken`), que agora checa a parede no trajeto do ferido também.
 */
const GRID = 50
const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 225, y: 225, size: 1, image: null }
const FERIDO: Token = { id: 'ferido', characterId: null, name: 'Ferido', x: 275, y: 225, size: 1, image: null, levadoPor: 'ana' }
/** Em cima do ferido, não da Ana. */
const PAREDE: Wall = { id: 'parede', x1: 250, y1: 200, x2: 400, y2: 200, blocksLight: true, blocksMove: true, door: null }

const posicao = (id: string): { x: number; y: number } | undefined => {
  const t = useMapStore.getState().map.tokens.find((token) => token.id === id)
  return t === undefined ? undefined : { x: t.x, y: t.y }
}

function mesa(walls: Wall[]): void {
  useMapStore.setState({
    map: { ...useMapStore.getState().map, grid: GRID, tokens: [ANA, FERIDO], regions: [], walls, lights: [], props: [], stairs: [], drawings: [] },
    past: [],
    future: [],
  })
  useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id: 'ana' }))
}

describe('mapStore: o ferido acompanha a seta e o arrasto da seleção', () => {
  beforeEach(() => mesa([]))

  it('seta para a direita com a Ana selecionada: os dois andam uma casa, num passo só do desfazer', () => {
    useMapStore.getState().moveSelectionBy(GRID, 0)
    expect(posicao('ana')).toEqual({ x: 275, y: 225 })
    expect(posicao('ferido')).toEqual({ x: 325, y: 225 })
    useMapStore.getState().undo()
    expect(posicao('ana')).toEqual({ x: 225, y: 225 })
    expect(posicao('ferido')).toEqual({ x: 275, y: 225 })
  })

  it('arrasto da seleção (ao vivo): o ferido vem junto a cada trecho', () => {
    useMapStore.getState().moveSelectionLive(0, GRID)
    useMapStore.getState().moveSelectionLive(0, GRID)
    expect(posicao('ana')).toEqual({ x: 225, y: 325 })
    expect(posicao('ferido')).toEqual({ x: 275, y: 325 })
  })
})

describe('mapStore: o ferido não atravessa parede no movimento do mestre', () => {
  beforeEach(() => mesa([PAREDE]))

  it('arrasto da ficha da Ana para o norte: ela passa, o ferido fica atrás da parede', () => {
    useMapStore.getState().moveToken('ana', 225, 125)
    expect(posicao('ana')).toEqual({ x: 225, y: 125 })
    expect(posicao('ferido')).toEqual({ x: 275, y: 225 })
  })

  it('seta para o norte com a Ana selecionada: mesma regra', () => {
    useMapStore.getState().moveSelectionBy(0, -2 * GRID)
    expect(posicao('ana')).toEqual({ x: 225, y: 125 })
    expect(posicao('ferido')).toEqual({ x: 275, y: 225 })
  })
})
