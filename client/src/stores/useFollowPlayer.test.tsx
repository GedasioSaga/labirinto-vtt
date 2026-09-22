import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { Point } from '../pixi/world'
import { useAdventureStore } from './adventureStore'
import { useFollowStore } from './followStore'
import { useFollowPlayer } from './useFollowPlayer'

function mundo(onde: 's-a' | 's-b', x: number, y: number): HostWorld {
  const ficha = { id: 'lanterna', characterId: null, name: 'Lanterna', x, y, size: 1, image: null, color: '#3cff00' }
  const salao = { ...createEmptyMap('m-a', 'Salao', 30, 10, 50), tokens: onde === 's-a' ? [ficha] : [] }
  const cripta = { ...createEmptyMap('m-b', 'Cripta', 30, 10, 50), tokens: onde === 's-b' ? [ficha] : [] }
  return { open: { sceneId: 's-a', name: 'Salao', map: salao }, background: [{ sceneId: 's-b', name: 'Cripta', map: cripta }] }
}

const ANA: PlayerInfo = { clientId: 'c', playerId: 'ana', name: 'Ana', status: 'playing', connected: true, tokenIds: ['lanterna'], visionRadius: 700, sceneId: 's-a' }

function Harness({ players, world }: { players: PlayerInfo[]; world: HostWorld }) {
  useFollowPlayer(players, () => world)
  return null
}

describe('useFollowPlayer', () => {
  let container: HTMLDivElement
  let root: Root
  const originalGoToPoint = useAdventureStore.getState().goToPoint
  let goToPoint: ReturnType<typeof vi.fn<(sceneId: string | null, point: Point) => boolean>>

  const render = (players: PlayerInfo[], world: HostWorld) => {
    act(() => root.render(<Harness players={players} world={world} />))
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    root = createRoot(container)
    // O canvas não existe aqui: o "centro" do seguir faz o que o canvas faria com o
    // pedido de câmera — avisa a câmera aplicada como PEDIDO (ver PixiCanvas `applyCamera`).
    goToPoint = vi.fn((_sceneId: string | null, _point: Point) => {
      useFollowStore.getState().cameraApplied('pedido')
      return true
    })
    useAdventureStore.setState({ goToPoint })
    useFollowStore.setState({ playerId: null })
  })

  afterEach(() => {
    act(() => root.unmount())
    useAdventureStore.setState({ goToPoint: originalGoToPoint })
  })

  it('sem ninguém seguido, não mexe na câmera', () => {
    render([ANA], mundo('s-a', 100, 100))
    expect(goToPoint).not.toHaveBeenCalled()
  })

  it('ligar centra na ficha; a ficha andar centra de novo; re-render parado não puxa a câmera', () => {
    render([ANA], mundo('s-a', 100, 100))
    act(() => useFollowStore.getState().toggle('ana'))
    expect(goToPoint).toHaveBeenLastCalledWith('s-a', { x: 100, y: 100 })
    render([ANA], mundo('s-a', 100, 100))
    expect(goToPoint).toHaveBeenCalledTimes(1)
    render([ANA], mundo('s-a', 400, 100))
    expect(goToPoint).toHaveBeenLastCalledWith('s-a', { x: 400, y: 100 })
    expect(goToPoint).toHaveBeenCalledTimes(2)
  })

  it('o centro que o seguir pediu não desliga o seguir', () => {
    render([ANA], mundo('s-a', 100, 100))
    act(() => useFollowStore.getState().toggle('ana'))
    render([ANA], mundo('s-a', 300, 100))
    expect(goToPoint).toHaveBeenCalledTimes(2)
    expect(useFollowStore.getState().playerId).toBe('ana')
  })

  it('a ficha viajou: o editor vai para a cena nova, com ela no centro', () => {
    render([ANA], mundo('s-a', 100, 100))
    act(() => useFollowStore.getState().toggle('ana'))
    render([ANA], mundo('s-b', 550, 450))
    expect(goToPoint).toHaveBeenLastCalledWith('s-b', { x: 550, y: 450 })
  })

  it('o gesto do mestre desliga, e a ficha andar depois não move mais a câmera', () => {
    render([ANA], mundo('s-a', 100, 100))
    act(() => useFollowStore.getState().toggle('ana'))
    act(() => useFollowStore.getState().cameraApplied('gesto'))
    expect(useFollowStore.getState().playerId).toBeNull()
    render([ANA], mundo('s-a', 600, 100))
    expect(goToPoint).toHaveBeenCalledTimes(1)
  })

  it('o jogador cair desliga o seguir', () => {
    render([ANA], mundo('s-a', 100, 100))
    act(() => useFollowStore.getState().toggle('ana'))
    render([{ ...ANA, connected: false }], mundo('s-a', 100, 100))
    expect(useFollowStore.getState().playerId).toBeNull()
  })
})
