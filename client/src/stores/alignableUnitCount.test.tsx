import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { selectAlignableUnitCount, useMapStore } from './mapStore'
import { AlignDistributeControls } from '../components/AlignDistributeControls'
import { selectEntitiesInArea } from '../lib/areaSelection'
import { selectionFromAreaSelection } from '../lib/selectionModel'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import type { Drawing } from '../types/map'

/**
 * O painel "Alinhar e distribuir" conta BLOCOS que andam, não entradas da
 * seleção: o laço numa Sala sozinha seleciona a região e as 4 paredes (5
 * entradas), mas é 1 bloco só — nenhum botão pode aparecer clicável.
 */

function pilar(id: string, x: number, y: number): Drawing {
  return { id, kind: 'rect', x, y, w: 60, h: 60, color: '#1e32d2', width: 2, filled: true, fillAlpha: 1 }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  const room = buildRoomFromDraft('r1', ['w0', 'w1', 'w2', 'w3'], { x: 100, y: 100 }, { x: 200, y: 200 })
  useMapStore.setState({
    map: {
      ...useMapStore.getState().map,
      tokens: [],
      lights: [],
      stairs: [],
      props: [],
      regions: [room.region],
      walls: room.walls,
      drawings: [pilar('p', 400, 50)],
    },
    selection: [],
    past: [],
    future: [],
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/** Passa o laço pelo retângulo e devolve a seleção que o editor guardaria. */
function laco(x1: number, y1: number, x2: number, y2: number) {
  const area = selectEntitiesInArea(useMapStore.getState().map, { x1, y1, x2, y2 })
  const selection = selectionFromAreaSelection(area)
  useMapStore.setState({ selection })
  return selection
}

/** Monta o painel como o App monta: a contagem vem do seletor da store. */
function montarPainel() {
  const onAlign = vi.fn()
  const onDistribute = vi.fn()
  const count = selectAlignableUnitCount(useMapStore.getState())
  act(() => root.render(<AlignDistributeControls count={count} onAlign={onAlign} onDistribute={onDistribute} />))
  return count
}

function botao(nome: string): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`)
}

describe('painel de alinhar conta blocos, não entradas da seleção', () => {
  it('laço numa Sala sozinha: 5 entradas, 1 bloco, nenhum botão de alinhar clicável', () => {
    const selection = laco(90, 90, 210, 210)
    expect(selection).toHaveLength(5)

    expect(montarPainel()).toBe(1)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('laço numa Sala e num pilar: 6 entradas, 2 blocos — alinhar clicável, distribuir não', () => {
    const selection = laco(90, 40, 470, 210)
    expect(selection).toHaveLength(6)

    expect(montarPainel()).toBe(2)
    expect(botao('Alinhar à esquerda')?.disabled).toBe(false)
    expect(botao('Distribuir na horizontal')?.disabled).toBe(true)
    expect(botao('Distribuir na vertical')?.disabled).toBe(true)
    expect(container.textContent).toContain('3 ou mais itens')

    // E o que ficou clicável anda de fato: alinhar ao topo leva a Sala para y=50.
    useMapStore.getState().alignSelection('top')
    const ys = useMapStore.getState().map.regions[0].points.map((pt) => pt.y)
    expect(Math.min(...ys)).toBe(50)
    expect(useMapStore.getState().past).toHaveLength(1)
  })

  it('seleção vazia conta 0 e o painel não aparece', () => {
    expect(montarPainel()).toBe(0)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
