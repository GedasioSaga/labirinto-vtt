import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Region } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { useMapStore } from '../stores/mapStore'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * CHAMINÉ no painel da Sala (MT10): o interruptor mora junto do modelo e da
 * cor do telhado, aparece só com o teto fechado e com a obra do Meio-Termo
 * ligada (com a chave desligada a tela não muda: a chaminé nem seria
 * desenhada, e controle que não faz nada não entra). Grava pela store
 * (`definirChamine`), com Ctrl+Z.
 */

const SALA: Region = {
  id: 'sala',
  points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
  tag: '',
  fillColor: '#123',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Casa', roof: true },
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const mapa = useMapStore.getState().map
  useMapStore.setState({ map: { ...mapa, regions: [SALA], tokens: [], walls: [], lights: [] }, selection: [], past: [], future: [] })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  trocarObraNoTeste(false)
})

function render(overrides: Partial<RoomControlsProps> = {}) {
  const props: RoomControlsProps = {
    name: 'Casa',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 200,
    height: 150,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    roof: true,
    onRoofChange: vi.fn(),
    onRoofStyleChange: vi.fn(),
    salaId: 'sala',
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
  return props
}

function interruptorDaChamine(): HTMLInputElement | null {
  const rotulo = [...container.querySelectorAll('label.lb-switch')].find((l) => l.textContent?.includes('Chaminé'))
  return rotulo?.querySelector('input') ?? null
}

const chamine = () => useMapStore.getState().map.regions[0]?.room?.chamine

describe('RoomControls: chaminé', () => {
  it('com a obra ligada e o teto fechado: o interruptor grava a chaminé e o Ctrl+Z tira', () => {
    trocarObraNoTeste(true)
    render()
    const input = interruptorDaChamine()
    expect(input).not.toBeNull()
    expect(input?.checked).toBe(false)
    act(() => input?.click())
    expect(chamine()).toBe(true)
    expect(interruptorDaChamine()?.checked).toBe(true)
    act(() => useMapStore.getState().undo())
    expect(chamine()).toBeUndefined()
    expect(interruptorDaChamine()?.checked).toBe(false)
  })

  it('desligar tira o campo', () => {
    trocarObraNoTeste(true)
    render()
    act(() => interruptorDaChamine()?.click())
    act(() => interruptorDaChamine()?.click())
    expect('chamine' in (useMapStore.getState().map.regions[0]?.room ?? {})).toBe(false)
  })

  it('com a obra DESLIGADA o interruptor nem aparece (a tela de hoje não muda)', () => {
    render()
    expect(interruptorDaChamine()).toBeNull()
  })

  it('com o teto aberto não aparece (a chaminé segue o teto fechado)', () => {
    trocarObraNoTeste(true)
    render({ roof: false })
    expect(interruptorDaChamine()).toBeNull()
  })

  it('sem a Sala (salaId ausente) não aparece', () => {
    trocarObraNoTeste(true)
    render({ salaId: undefined })
    expect(interruptorDaChamine()).toBeNull()
  })
})
