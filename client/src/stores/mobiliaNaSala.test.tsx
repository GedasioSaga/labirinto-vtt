import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls } from '../components/RoomControls'
import { useMapStore } from './mapStore'
import { porMobiliaNaSala } from './mobiliaNaSala'
import type { Region } from '../types/map'

/**
 * MOBÍLIA DESENHADA, do BOTÃO ao MAPA: o painel da sala DE VERDADE, com a
 * mesma ligação que o App passa (`porMobiliaNaSala`), e o clique em "Catre"
 * põe no mapa um catre no centro da sala, no giro dela, já selecionado.
 */

const GRADE = 50

/** Sala 200 x 100 com centro em (200, 150), já girada 90°. */
function sala(extra: Partial<Region> = {}): Region {
  return {
    id: 'dormitorio',
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 200 },
      { x: 100, y: 200 },
    ],
    tag: '',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Dormitório', rotation: 90 },
    ...extra,
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const { map } = useMapStore.getState()
  useMapStore.setState({ map: { ...map, grid: GRADE, props: [], regions: [sala()] }, selection: [], past: [] })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/** O painel da sala como o App monta, com a ligação de verdade no lugar do `vi.fn()`. */
function renderPainel(region: Region | null): void {
  act(() =>
    root.render(
      <RoomControls
        name="Dormitório"
        onNameChange={vi.fn()}
        shape="rect"
        axisAligned={true}
        width={200}
        height={100}
        onWidthChange={vi.fn()}
        onHeightChange={vi.fn()}
        rotation={90}
        onRotationChange={vi.fn()}
        onRotateBy={vi.fn()}
        locked={false}
        onAddMobilia={porMobiliaNaSala(region, () => 'movel-1')}
      />,
    ),
  )
}

function clicar(texto: string): void {
  const botao = [...container.querySelectorAll('[role="group"][aria-label="Pôr mobília na sala"] button')].find(
    (b) => b.textContent === texto,
  )
  if (!(botao instanceof HTMLButtonElement)) throw new Error(`o painel não tem o botão "${texto}"`)
  act(() => botao.click())
}

describe('Mobília: do botão da sala ao mapa', () => {
  it('clicar em "Catre" põe o catre no centro da sala, no giro dela, e o deixa selecionado', () => {
    renderPainel(sala())
    clicar('Catre')

    const { map, selection } = useMapStore.getState()
    expect(map.props).toEqual([
      {
        id: 'movel-1',
        src: '',
        x: 200,
        y: 150,
        width: GRADE,
        height: 2 * GRADE,
        linkedMapPath: null,
        mobilia: 'catre',
        rotation: 90,
      },
    ])
    expect(selection).toEqual([{ kind: 'prop', id: 'movel-1' }])
  })

  it('sala nunca girada: o móvel nasce sem campo de giro (igual a objeto comum)', () => {
    const semGiro = sala({ room: { shape: 'rect', name: 'Dormitório' } })
    renderPainel(semGiro)
    clicar('Baú')

    const [bau] = useMapStore.getState().map.props
    expect(bau?.mobilia).toBe('bau')
    expect(bau !== undefined && 'rotation' in bau).toBe(false)
    expect([bau?.x, bau?.y]).toEqual([200, 150])
  })

  it('um passo só no desfazer: o Ctrl+Z tira o móvel inteiro', () => {
    renderPainel(sala())
    clicar('Mesa')
    expect(useMapStore.getState().map.props).toHaveLength(1)

    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map.props).toEqual([])
  })

  it('região que não é sala (ou nada selecionado) não oferece mobília', () => {
    expect(porMobiliaNaSala(null)).toBeUndefined()
    const { room: _semSala, ...regiao } = sala()
    expect(porMobiliaNaSala(regiao)).toBeUndefined()
    renderPainel(null)
    expect(container.querySelector('[role="group"][aria-label="Pôr mobília na sala"]')).toBeNull()
  })
})
