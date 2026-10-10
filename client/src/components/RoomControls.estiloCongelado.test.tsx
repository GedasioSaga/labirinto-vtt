import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap, setTipoDeMapa } from '../lib/mapFactory'
import { roomLabelStyleOf, type RoomLabelStyle } from '../lib/roomLabelStyle'
import { useMapStore } from '../stores/mapStore'
import type { Region } from '../types/map'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/*
 * Continente antigo com estilo próprio: os controles do título aparecem junto
 * com a dica da pílula. A decisão vale pela sala SELECIONADA, não pelo valor
 * de cada render: arrastar o tamanho de volta a 100% (ou clicar "Padrão")
 * deixa o estilo igual ao padrão, e os controles não podem sumir no meio do
 * gesto, levando o foco e o valor junto.
 */

function sala(id: string, labelScale?: number): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
    ],
    tag: 'region',
    fillColor: '#76c577',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'polygon', name: 'Capital', ...(labelScale === undefined ? {} : { labelScale }) },
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const base = setTipoDeMapa(createEmptyMap('m-congelado', 'Mundo', 30, 30, 40), 'continente')
  useMapStore.setState({ map: { ...base, regions: [sala('a', 1.2), sala('b')] }, past: [], future: [], pisoAtivo: 0 })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(salaId: string, labelStyle: RoomLabelStyle): void {
  const props: RoomControlsProps = {
    name: 'Capital',
    onNameChange: vi.fn(),
    shape: 'polygon',
    axisAligned: false,
    width: 400,
    height: 300,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    salaId,
    labelStyle,
    onLabelStyleChange: vi.fn(),
  }
  act(() => root.render(<RoomControls {...props} />))
}

const estilo = () => container.querySelector('[role="group"][aria-label="Título no mapa"]')

describe('estilo próprio congelado pela sala selecionada', () => {
  it('o tamanho volta a 100% no meio do arrasto: os controles continuam montados', () => {
    render('a', roomLabelStyleOf(sala('a', 1.2).room))
    const antes = estilo()
    expect(antes).not.toBeNull()
    render('a', roomLabelStyleOf(sala('a').room))
    expect(estilo()).toBe(antes)
  })

  it('outra sala, sem estilo próprio: a decisão é refeita e fica só a dica', () => {
    render('a', roomLabelStyleOf(sala('a', 1.2).room))
    render('b', roomLabelStyleOf(sala('b').room))
    expect(estilo()).toBeNull()
  })
})
