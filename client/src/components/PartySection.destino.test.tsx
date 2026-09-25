import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { masterDestinationMarks, partyMembers } from '../lib/party'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { MapData, Token } from '../types/map'
import { DESTINATION_MARKED_LABEL, VIEW_DESTINATION_LABEL } from './PartySection'
import { RoomPanel, roomPanelTokensOf } from './RoomPanel'

/**
 * MARCA "VAMOS PARA CÁ" no painel Grupo do mestre: a linha de quem marcou
 * diz "destino marcado" e o "Ver" leva a câmera até a marca.
 */

function ficha(id: string, color: string, x = 100, y = 100): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, color }
}

function mundo(): HostWorld {
  const salao: MapData = { ...createEmptyMap('m-a', 'Salao', 30, 10, 50), tokens: [ficha('lanterna', '#3cff00', 120, 80), ficha('adaga', '#2255ff')] }
  const cripta: MapData = { ...createEmptyMap('m-b', 'Cripta', 30, 10, 50), tokens: [ficha('machado', '#e53935', 725, 225)] }
  return { open: { sceneId: 's-a', name: 'Salao', map: salao }, background: [{ sceneId: 's-b', name: 'Cripta', map: cripta }] }
}

function jogador(over: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: 'X', status: 'playing', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...over }
}

const JOGADORES: PlayerInfo[] = [
  jogador({ playerId: 'elisa', name: 'Elisa', tokenIds: ['lanterna'], sceneId: 's-a', sceneName: 'Salao', destination: { x: 400, y: 300, color: '#3cff00' } }),
  jogador({ playerId: 'caio', name: 'Caio', tokenIds: ['adaga'], sceneId: 's-a', sceneName: 'Salao' }),
  jogador({ playerId: 'bruno', name: 'Bruno', tokenIds: ['machado'], sceneId: 's-b', sceneName: 'Cripta', destination: { x: 50, y: 60, color: '#e53935' } }),
]

describe('lib/party: destino marcado', () => {
  it('a linha leva a marca de quem marcou; quem não marcou fica sem', () => {
    const linhas = partyMembers(JOGADORES, mundo())
    expect(linhas.map((m) => [m.name, m.destination ?? null])).toEqual([
      ['Elisa', { x: 400, y: 300 }],
      ['Caio', null],
      ['Bruno', { x: 50, y: 60 }],
    ])
  })

  it('o canvas do mestre desenha só as marcas da cena aberta, com nome e cor', () => {
    expect(masterDestinationMarks(JOGADORES, 's-a')).toEqual([{ x: 400, y: 300, from: 'Elisa', color: '#3cff00', mine: false }])
    expect(masterDestinationMarks(JOGADORES, 's-b')).toEqual([{ x: 50, y: 60, from: 'Bruno', color: '#e53935', mine: false }])
    // Mapa solto: ninguém tem `sceneId`, e a cena aberta (null) é a de todos.
    const solto = [jogador({ playerId: 'ana', name: 'Ana', destination: { x: 1, y: 2, color: '#123456' } })]
    expect(masterDestinationMarks(solto, null)).toEqual([{ x: 1, y: 2, from: 'Ana', color: '#123456', mine: false }])
  })
})

describe('PartySection: destino marcado', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('"destino marcado" com "Ver" só na linha de quem marcou; "Ver" centra na marca', () => {
    const onViewDestination = vi.fn()
    const world = mundo()
    const party = { members: partyMembers(JOGADORES, world), destinations: [], onGoTo: vi.fn(), onSend: vi.fn(() => true), onViewDestination }
    const noop = vi.fn()
    const handlers = {
      onStart: noop,
      onStop: noop,
      onStartTunnel: noop,
      onStopTunnel: noop,
      onAssign: noop,
      onUnassign: noop,
      onKick: noop,
      onVisionRadiusChange: noop,
      onVisionFactorChange: noop,
      onRevealPlan: noop,
      onHidePlan: noop,
      clues: { rows: [], onCenter: noop, onToggle: noop },
    }
    // O Grupo é a lista única da aba Jogo (RoomPanel): uma linha por jogador em jogo.
    act(() => {
      root.render(<RoomPanel room={{ code: 'GRUPO1', urls: [], qrSvg: '<svg/>' }} players={JOGADORES} tokens={roomPanelTokensOf(world)} party={party} tunnel={{ kind: 'idle' }} {...handlers} />)
    })
    const linhas = [...container.querySelectorAll('li.lb-party__item')]
    expect(linhas).toHaveLength(3)
    const [elisa, caio] = linhas
    expect(elisa?.textContent).toContain(DESTINATION_MARKED_LABEL)
    expect(caio?.textContent).not.toContain(DESTINATION_MARKED_LABEL)
    const ver = [...(elisa?.querySelectorAll('button') ?? [])].find((b) => b.textContent === VIEW_DESTINATION_LABEL)
    expect(ver).toBeDefined()
    expect(ver?.getAttribute('aria-label')).toBe('Ver o destino marcado por Elisa')
    act(() => ver?.click())
    expect(onViewDestination).toHaveBeenCalledTimes(1)
    expect(onViewDestination.mock.calls[0]?.[0]).toMatchObject({ playerId: 'elisa', sceneId: 's-a', destination: { x: 400, y: 300 } })
  })
})
