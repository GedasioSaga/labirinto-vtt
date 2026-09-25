/**
 * PAINEL PISTAS montado na aba Jogo: o RoomPanel mostra "Pistas (N)" com a
 * ligação que o App usa (`hostCluesProps`) — clicar na linha desliga o seguir
 * e centra o pino; clicar na bolinha manda o "Quem vê" novo ao host.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { PartyMember } from '../lib/party'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'
import { RoomPanel } from './RoomPanel'
import { hostCluesProps, type HostCluesWiring } from './CluesSection'

const noop = vi.fn()
const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onVisionFactorChange: noop, onRevealPlan: noop, onHidePlan: noop }
const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

const pino = (id: string, kind: Pin['kind'], description: string, x = 100, y = 100): Pin => ({ id, x, y, kind, description, image: null })

function jogador(playerId: string, name: string): PlayerInfo {
  return { clientId: `c-${playerId}`, playerId, name, status: 'playing', connected: true, tokenIds: [`ficha-${playerId}`], visionRadius: 700, visionFactor: 1 }
}

function membro(playerId: string, name: string): PartyMember {
  return { playerId, name, connected: true, sceneId: 'cena-sala', sceneName: 'Sala', token: { id: `ficha-${playerId}`, color: '#aa3333', x: 0, y: 0 }, travelPending: false, mochila: [] }
}

const JOGADORES = [jogador('p-gabi', 'Gabi'), jogador('p-fabio', 'Fábio')]
const MEMBROS = [membro('p-gabi', 'Gabi'), membro('p-fabio', 'Fábio')]

const MUNDO: HostWorld = {
  open: { sceneId: 'cena-sala', name: 'Sala', map: { ...createEmptyMap('m-sala', 'Sala', 20, 20, 50), pins: [pino('faca', 'exclamacao', 'Faca'), pino('porta', 'viagem', 'Escada')] } },
  background: [{ sceneId: 'cena-andar', name: 'Andar de cima', map: { ...createEmptyMap('m-andar', 'Andar de cima', 20, 20, 50), pins: [pino('bilhete', 'interrogacao', 'Bilhete', 450, 320)] } }],
}

function ligacao(overrides: Partial<HostCluesWiring> = {}): HostCluesWiring {
  return {
    world: MUNDO,
    members: MEMBROS,
    clues: { bilhete: { received: ['p-gabi', 'p-fabio'], read: ['p-gabi'] } },
    audiences: {},
    stopFollow: vi.fn(),
    goToPoint: vi.fn(),
    setPinAudience: vi.fn(),
    ...overrides,
  }
}

describe('RoomPanel: painel Pistas na aba Jogo', () => {
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

  const render = (players: PlayerInfo[], wiring: HostCluesWiring): void =>
    act(() => root.render(<RoomPanel room={ROOM} players={players} tokens={[]} tunnel={IDLE} {...handlers} clues={hostCluesProps(wiring)} />))

  function bolinha(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('.lb-clues__dot')).find((b) => b.getAttribute('aria-label') === nome)
  }

  it('sala com jogadores: "Pistas (2)" (a viagem fica de fora) e a bolinha da Gabi diz que leu', () => {
    render(JOGADORES, ligacao())
    expect(container.querySelector('.lb-clues h3')?.textContent).toBe('Pistas (2)')
    expect(Array.from(container.querySelectorAll('.lb-clues__label')).map((l) => l.textContent)).toEqual(['Faca', 'Bilhete'])
    expect(bolinha('Gabi: leu')).toBeDefined()
    expect(bolinha('Fábio: recebeu')).toBeDefined()
  })

  it('clicar na bolinha esconde a pista do jogador: o host recebe o "Quem vê" novo', () => {
    const setPinAudience = vi.fn()
    render(JOGADORES, ligacao({ setPinAudience }))
    const doFabioNaFaca = container.querySelectorAll<HTMLButtonElement>('.lb-clues__item')[0]?.querySelectorAll<HTMLButtonElement>('.lb-clues__dot')[1]
    expect(doFabioNaFaca?.getAttribute('aria-label')).toBe('Fábio: não recebeu')
    act(() => doFabioNaFaca?.click())
    expect(setPinAudience).toHaveBeenCalledTimes(1)
    expect(setPinAudience).toHaveBeenCalledWith('faca', ['p-gabi'])
  })

  it('bolinha de quem estava escondido: revelar devolve o pino a Todos (null)', () => {
    const setPinAudience = vi.fn()
    render(JOGADORES, ligacao({ audiences: { bilhete: ['p-gabi'] }, setPinAudience }))
    const escondida = bolinha('Fábio: recebeu, escondida')
    expect(escondida?.getAttribute('aria-pressed')).toBe('false')
    act(() => escondida?.click())
    expect(setPinAudience).toHaveBeenCalledWith('bilhete', null)
  })

  it('clicar na linha desliga o seguir e centra o pino na cena dele', () => {
    const calls: string[] = []
    const stopFollow = vi.fn(() => calls.push('stop'))
    const goToPoint = vi.fn(() => calls.push('go'))
    render(JOGADORES, ligacao({ stopFollow, goToPoint }))
    const linhaBilhete = container.querySelectorAll<HTMLButtonElement>('.lb-clues__pin')[1]
    act(() => linhaBilhete?.click())
    expect(goToPoint).toHaveBeenCalledWith('cena-andar', { x: 450, y: 320 })
    // Parar de seguir vem ANTES: senão o seguir puxa a vista de volta para o jogador.
    expect(calls).toEqual(['stop', 'go'])
  })

  it('sala vazia: o painel não aparece', () => {
    render([], ligacao())
    expect(container.querySelector('.lb-clues')).toBeNull()
    expect(container.textContent).not.toContain('Pistas (')
  })
})
