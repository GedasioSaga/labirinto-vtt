import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState, Wall } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { DoorContextMenu } from './DoorContextMenu'

/**
 * Clique direito na porta: Abrir/Fechar e Trancar/Destrancar sem trocar de
 * ferramenta nem ir ao painel. Destrancar custava 4-5 gestos (Selecionar,
 * clicar na porta, achar o interruptor, voltar à ferramenta).
 */
const TRANCADA: DoorState = { open: false, locked: true, kind: 'normal' }
const porta = (door: DoorState): Wall => ({ id: 'porta', x1: 100, y1: 0, x2: 150, y2: 0, blocksLight: true, blocksMove: true, door })

const portaNoMapa = (): DoorState | null | undefined => useMapStore.getState().map.walls.find((w) => w.id === 'porta')?.door

describe('DoorContextMenu', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [porta(TRANCADA)] },
      past: [],
      future: [],
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const abrir = (onClose: () => void) => act(() => root.render(<DoorContextMenu wallId="porta" x={40} y={60} onClose={onClose} />))
  const itens = (): HTMLButtonElement[] => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  const item = (nome: string): HTMLButtonElement | undefined => itens().find((el) => el.textContent === nome)

  it('porta trancada: oferece Abrir e Destrancar, com o foco já no primeiro item', () => {
    abrir(() => {})
    expect(container.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('Porta')
    expect(itens().map((el) => el.textContent)).toEqual(['Abrir', 'Destrancar'])
    expect(document.activeElement).toBe(itens()[0])
  })

  it('Destrancar muda a porta (um passo do desfazer) e fecha o menu', () => {
    const onClose = vi.fn<() => void>()
    abrir(onClose)
    act(() => item('Destrancar')?.click())
    expect(portaNoMapa()).toEqual({ ...TRANCADA, locked: false })
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc fecha sem mudar nada', () => {
    const onClose = vi.fn<() => void>()
    const antes = useMapStore.getState().map
    abrir(onClose)
    act(() => {
      itens()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('porta aberta: Fechar fecha; Trancar numa aberta tranca e fecha junto', () => {
    useMapStore.setState({ map: { ...useMapStore.getState().map, walls: [porta({ ...TRANCADA, open: true, locked: false })] } })
    abrir(() => {})
    expect(itens().map((el) => el.textContent)).toEqual(['Fechar', 'Trancar'])
    act(() => item('Trancar')?.click())
    expect(portaNoMapa()).toEqual({ ...TRANCADA, open: false, locked: true })
  })

  it('setas andam entre os itens, com volta', () => {
    abrir(() => {})
    const [primeiro, segundo] = itens()
    act(() => {
      primeiro.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(document.activeElement).toBe(segundo)
    act(() => {
      segundo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(document.activeElement).toBe(primeiro)
  })

  it('porta que sumiu do mapa (Ctrl+Z por baixo do menu) fecha o menu', () => {
    const onClose = vi.fn<() => void>()
    abrir(onClose)
    act(() => useMapStore.setState({ map: { ...useMapStore.getState().map, walls: [] } }))
    expect(onClose).toHaveBeenCalled()
    expect(itens()).toHaveLength(0)
  })
})
