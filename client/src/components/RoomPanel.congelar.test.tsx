import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { partyMembers } from '../lib/party'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { MapData, Token } from '../types/map'
import type { PartySectionProps } from './PartySection'
import { RoomPanel, roomPanelTokensOf } from './RoomPanel'

/**
 * CONGELAR FICHA no Grupo: "Congelar todos" e "Descongelar todos" no alto da
 * lista, onde o mestre já cuida da mesa, e a marca "congelado" na linha de
 * quem está congelado — o mestre não guarda de cabeça quem ele segurou.
 */
const IDLE: TunnelState = { kind: 'idle' }
const noop = vi.fn()
const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onVisionFactorChange: noop, onRevealPlan: noop, onHidePlan: noop, clues: { rows: [], onCenter: noop, onToggle: noop } }

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x: 100, y: 100, size: 1, image: null, ...extra }
}

function jogador(over: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: 'X', status: 'playing', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, sceneId: 's-a', sceneName: 'Salão', ...over }
}

const JOGADORES = [jogador({ playerId: 'ana', name: 'Ana', clientId: 'c1', tokenIds: ['lanterna'] }), jogador({ playerId: 'bia', name: 'Bia', clientId: 'c2', tokenIds: ['brasa'] })]

function mundo(lanterna: Partial<Token> = {}): HostWorld {
  const salao: MapData = { ...createEmptyMap('m-a', 'Salão', 30, 10, 50), tokens: [ficha('lanterna', lanterna), ficha('brasa', { x: 300 })] }
  return { open: { sceneId: 's-a', name: 'Salão', map: salao }, background: [] }
}

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

function render(world: HostWorld, congelar: PartySectionProps['congelar']): void {
  const party: PartySectionProps = { members: partyMembers(JOGADORES, world), destinations: [], onGoTo: vi.fn(), onSend: vi.fn(() => true), congelar }
  act(() => root.render(<RoomPanel room={{ code: 'GELO01', urls: [], qrSvg: '<svg/>' }} players={JOGADORES} tokens={roomPanelTokensOf(world)} party={party} tunnel={IDLE} {...handlers} />))
}

const texto = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
const botao = (nome: string) => Array.from(container.querySelectorAll('button')).find((b) => texto(b) === nome) ?? null
const cabecaDoGrupo = () => container.querySelector('.lb-party__head')

describe('Grupo — congelar a mesa', () => {
  it('ninguém congelado: só "Congelar todos", no alto do Grupo; o clique congela', () => {
    const onChange = vi.fn()
    render(mundo(), { todas: false, alguma: false, onChange })
    const congelar = botao('Congelar todos')
    expect(congelar).not.toBeNull()
    expect(cabecaDoGrupo()?.contains(congelar ?? null)).toBe(true)
    expect(botao('Descongelar todos')).toBeNull()
    act(() => congelar?.click())
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('todos congelados: só "Descongelar todos"; o clique solta', () => {
    const onChange = vi.fn()
    render(mundo({ congelado: true }), { todas: true, alguma: true, onChange })
    expect(botao('Congelar todos')).toBeNull()
    act(() => botao('Descongelar todos')?.click())
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('só alguns congelados: os dois botões', () => {
    render(mundo({ congelado: true }), { todas: false, alguma: true, onChange: vi.fn() })
    expect(botao('Congelar todos')).not.toBeNull()
    expect(botao('Descongelar todos')).not.toBeNull()
  })

  it('a linha de quem está congelado diz "congelado"; a de quem não está, não', () => {
    render(mundo({ congelado: true }), { todas: false, alguma: true, onChange: vi.fn() })
    const linhas = Array.from(container.querySelectorAll('li.lb-party__item'))
    const ana = linhas.find((l) => l.textContent?.includes('Ana'))
    const bia = linhas.find((l) => l.textContent?.includes('Bia'))
    expect(ana?.querySelector('.lb-player__congelado')?.textContent).toBe('congelado')
    expect(bia?.querySelector('.lb-player__congelado')).toBeNull()
  })

  it('sem a ligação (sala sem quem congelar): nenhum botão', () => {
    render(mundo(), undefined)
    expect(botao('Congelar todos')).toBeNull()
    expect(botao('Descongelar todos')).toBeNull()
  })
})

describe('lib/party — a linha sabe que a ficha dela está congelada', () => {
  it('`congelado` só na linha cuja ficha está congelada', () => {
    const [ana, bia] = partyMembers(JOGADORES, mundo({ congelado: true }))
    expect(ana?.congelado).toBe(true)
    expect(bia?.congelado).toBeUndefined()
  })
})
