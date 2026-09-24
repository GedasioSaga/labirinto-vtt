import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo } from '../net/hostSession'
import { RoomPanel } from './RoomPanel'

/**
 * VOLTAR É A MESMA PESSOA, o card do jogador: quem foi embora (fora) ganha
 * "Guardar ficha" (tira a ficha do mapa até ele voltar) e "Dispensar" (tira o
 * card). Quem está conectado continua só com "Expulsar".
 */

const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }
const TOKENS = [{ id: 'f-escudo', name: 'Escudo' }]

function player(overrides: Partial<PlayerInfo> = {}): PlayerInfo {
  return { clientId: 'c2', playerId: 'p-fabio', name: 'Fábio', status: 'playing', connected: true, tokenIds: ['f-escudo'], visionRadius: 700, ...overrides }
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

function render(players: PlayerInfo[], extra: { onStoreTokens?: (playerId: string) => void; onDismiss?: (playerId: string) => void }) {
  const noop = vi.fn()
  act(() => {
    root.render(
      <RoomPanel
        room={ROOM}
        players={players}
        tokens={TOKENS}
        tunnel={IDLE}
        onStart={noop}
        onStop={noop}
        onStartTunnel={noop}
        onStopTunnel={noop}
        onAssign={noop}
        onUnassign={noop}
        onKick={noop}
        onVisionRadiusChange={noop}
        onRevealPlan={noop}
        onHidePlan={noop}
        {...extra}
      />,
    )
  })
}

function botao(label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent === label)
}

describe('RoomPanel: quem foi embora', () => {
  it('fora com ficha: "Guardar ficha" e "Dispensar" chamam o mestre com o id dele', () => {
    const onStoreTokens = vi.fn()
    const onDismiss = vi.fn()
    render([player({ clientId: null, connected: false })], { onStoreTokens, onDismiss })
    const guardar = botao('Guardar ficha')
    const dispensar = botao('Dispensar')
    if (guardar === undefined || dispensar === undefined) throw new Error('esperava "Guardar ficha" e "Dispensar"')
    act(() => guardar.click())
    act(() => dispensar.click())
    expect(onStoreTokens).toHaveBeenCalledWith('p-fabio')
    expect(onDismiss).toHaveBeenCalledWith('p-fabio')
    // Fora não se expulsa: não há conexão para derrubar.
    expect(botao('Expulsar')).toBeUndefined()
  })

  it('fora com a ficha já guardada: diz qual, e não oferece guardar de novo', () => {
    render([player({ clientId: null, connected: false, status: 'waiting', tokenIds: [], storedTokenNames: ['Escudo'] })], { onStoreTokens: vi.fn(), onDismiss: vi.fn() })
    expect(container.textContent).toContain('Ficha guardada: Escudo')
    expect(botao('Guardar ficha')).toBeUndefined()
    expect(botao('Dispensar')).toBeDefined()
  })

  it('conectado: sem "Guardar ficha" nem "Dispensar"; o "Expulsar" de sempre', () => {
    render([player()], { onStoreTokens: vi.fn(), onDismiss: vi.fn() })
    expect(botao('Guardar ficha')).toBeUndefined()
    expect(botao('Dispensar')).toBeUndefined()
    // Na lista única do Grupo (aba-jogo-compacta) o "Expulsar" mora no "…" da linha.
    const mais = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Mais de Fábio')
    if (mais === undefined) throw new Error('esperava o "…" da linha de Fábio')
    act(() => mais.click())
    expect(botao('Expulsar')).toBeDefined()
  })
})
