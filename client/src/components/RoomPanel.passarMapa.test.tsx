/**
 * "Passar o mapa de Ana a…" no painel Sala do mestre: no card de quem joga,
 * uma lista com os outros jogadores. Escolher passa o que a Ana explorou na
 * cena onde está ao escolhido, e a linha de status conta se deu certo.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo } from '../net/hostSession'
import { RoomPanel, SHARE_MAP_HINT } from './RoomPanel'

function jogador(overrides: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: '?', status: 'waiting', connected: true, tokenIds: [], visionRadius: 700, ...overrides }
}

const ANA = jogador({ clientId: 'c1', playerId: 'p1', name: 'Ana', status: 'playing', tokenIds: ['tok-a'] })
const BRUNO = jogador({ clientId: 'c2', playerId: 'p2', name: 'Bruno', status: 'playing', tokenIds: ['tok-b'] })
const GINA = jogador({ clientId: 'c3', playerId: 'p3', name: 'Gina' })
const ROOM = { code: 'LIVR01', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

describe('RoomPanel: passar o mapa de um jogador a outro', () => {
  let container: HTMLDivElement
  let root: Root
  let onShareMap: ReturnType<typeof vi.fn<(fromPlayerId: string, toPlayerId: string) => boolean>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onShareMap = vi.fn<(fromPlayerId: string, toPlayerId: string) => boolean>(() => true)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(players: PlayerInfo[]): void {
    const noop = (): void => {}
    act(() =>
      root.render(
        <RoomPanel
          room={ROOM}
          players={players}
          tokens={[
            { id: 'tok-a', name: 'Lanterna' },
            { id: 'tok-b', name: 'Machado' },
          ]}
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
          onShareMap={onShareMap}
        />,
      ),
    )
  }

  function card(nome: string): HTMLElement {
    const achado = Array.from(container.querySelectorAll<HTMLElement>('.lb-field')).find((el) => (el.textContent ?? '').includes(`${nome} —`))
    if (achado === undefined) throw new Error(`sem card de ${nome}`)
    return achado
  }

  function listaDePassar(nome: string): HTMLSelectElement | null {
    const label = Array.from(card(nome).querySelectorAll('label')).find((l) => (l.textContent ?? '').startsWith('Passar o mapa de'))
    const id = label?.htmlFor
    return id === undefined ? null : container.querySelector<HTMLSelectElement>(`select[id="${id}"]`)
  }

  function escolhe(select: HTMLSelectElement, value: string): void {
    act(() => {
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('no card da Ana: rótulo ligado à lista, com os OUTROS jogadores (ela não), e a dica', () => {
    render([ANA, BRUNO, GINA])
    const select = listaDePassar('Ana')
    if (select === null) throw new Error('sem lista de passar o mapa')
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Escolher…', 'Bruno', 'Gina'])
    expect(card('Ana').textContent).toContain(SHARE_MAP_HINT)
  })

  it('escolher Bruno passa o mapa da Ana a ele e confirma; a lista volta ao "Escolher…"', () => {
    render([ANA, BRUNO, GINA])
    const select = listaDePassar('Ana')
    if (select === null) throw new Error('sem lista de passar o mapa')
    escolhe(select, 'p2')
    expect(onShareMap).toHaveBeenCalledWith('p1', 'p2')
    expect(card('Ana').querySelector('[role="status"]')?.textContent).toBe('Mapa de Ana passado a Bruno.')
    expect(select.value).toBe('')
  })

  it('sem nada para passar, diz por quê em vez de fingir que passou', () => {
    onShareMap.mockReturnValue(false)
    render([ANA, BRUNO, GINA])
    const select = listaDePassar('Ana')
    if (select === null) throw new Error('sem lista de passar o mapa')
    escolhe(select, 'p3')
    expect(onShareMap).toHaveBeenCalledWith('p1', 'p3')
    expect(card('Ana').querySelector('[role="status"]')?.textContent).toBe('Nada passou: Ana ainda não explorou a cena onde está.')
  })

  it('quem aguarda sem ficha não tem mapa para passar: o card da Gina não mostra a lista', () => {
    render([ANA, BRUNO, GINA])
    expect(listaDePassar('Gina')).toBeNull()
    expect(listaDePassar('Bruno')).not.toBeNull()
  })

  it('sozinho na sala, não há a quem passar: sem lista', () => {
    render([ANA])
    expect(listaDePassar('Ana')).toBeNull()
  })
})
