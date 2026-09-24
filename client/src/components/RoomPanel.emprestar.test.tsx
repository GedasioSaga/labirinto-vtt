import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo } from '../net/hostSession'
import { RoomPanel, type RoomPanelProps } from './RoomPanel'

/**
 * EMPRESTAR A FICHA DE QUEM SAIU, o card do jogador: quem está fora com ficha
 * ganha "Emprestar ficha a" (uma lista com quem está conectado). Emprestada, o
 * card diz com quem ela está e oferece "Tomar de volta"; o card de quem a joga
 * diz de quem é.
 */

const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }
const TOKENS = [{ id: 'f-lirio', name: 'Lírio' }, { id: 'f-escudo', name: 'Escudo' }]

function player(overrides: Partial<PlayerInfo> = {}): PlayerInfo {
  return { clientId: 'c2', playerId: 'p-ana', name: 'Ana', status: 'playing', connected: true, tokenIds: ['f-lirio'], visionRadius: 700, ...overrides }
}

const ANA_FORA = player({ clientId: null, connected: false })
const CARLA = player({ clientId: 'c3', playerId: 'p-carla', name: 'Carla', tokenIds: ['f-escudo'] })
const BRUNO_FORA = player({ clientId: null, playerId: 'p-bruno', name: 'Bruno', connected: false, tokenIds: [] })

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

function render(players: PlayerInfo[], extra: Partial<RoomPanelProps>) {
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

/** A lista "Emprestar ficha a" do card de `playerId`, achada pelo rótulo (como o leitor de tela a acha). */
function listaEmprestar(playerId: string): HTMLSelectElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent === 'Emprestar ficha a' && l.htmlFor.endsWith(playerId))
  if (label === undefined) return null
  const alvo = document.getElementById(label.htmlFor)
  return alvo instanceof HTMLSelectElement ? alvo : null
}

function escolher(select: HTMLSelectElement, value: string): void {
  act(() => {
    // O React escuta o `change` nativo; o setter do protótipo faz o valor valer para ele.
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
    setter?.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('RoomPanel: emprestar a ficha de quem saiu', () => {
  it('fora com ficha: a lista oferece só quem está conectado, e escolher empresta', () => {
    const onLendTokens = vi.fn()
    render([ANA_FORA, CARLA, BRUNO_FORA], { onLendTokens, onEndLoans: vi.fn() })
    const lista = listaEmprestar('p-ana')
    if (lista === null) throw new Error('esperava "Emprestar ficha a" no card da Ana')
    const opcoes = [...lista.options].map((o) => o.textContent)
    expect(opcoes).toEqual(['Escolher…', 'Carla'])
    escolher(lista, 'p-carla')
    expect(onLendTokens).toHaveBeenCalledWith('p-ana', 'p-carla')
    // Quem está conectado não empresta nada: a ficha dele está em jogo com ele.
    expect(listaEmprestar('p-carla')).toBeNull()
    // Fora e sem ficha: nada a emprestar.
    expect(listaEmprestar('p-bruno')).toBeNull()
  })

  it('emprestada: o card do dono diz com quem está e oferece "Tomar de volta"; não guarda a ficha', () => {
    const onEndLoans = vi.fn()
    render([{ ...ANA_FORA, lentTo: ['Carla'] }, { ...CARLA, tokenIds: ['f-escudo', 'f-lirio'], borrowedFrom: ['Ana'] }], {
      onLendTokens: vi.fn(),
      onEndLoans,
      onStoreTokens: vi.fn(),
    })
    expect(container.textContent).toContain('Ficha emprestada a Carla. Volta sozinha quando Ana voltar.')
    expect(container.textContent).toContain('Jogando também a ficha de Ana.')
    expect(listaEmprestar('p-ana')).toBeNull()
    // Guardar tiraria do mapa a ficha que a Carla está jogando.
    expect(botao('Guardar ficha')).toBeUndefined()
    const tomar = botao('Tomar de volta')
    if (tomar === undefined) throw new Error('esperava "Tomar de volta"')
    act(() => tomar.click())
    expect(onEndLoans).toHaveBeenCalledWith('p-ana')
  })

  it('ninguém conectado para receber: sem a lista', () => {
    render([ANA_FORA, BRUNO_FORA], { onLendTokens: vi.fn(), onEndLoans: vi.fn() })
    expect(listaEmprestar('p-ana')).toBeNull()
    expect(container.textContent).not.toContain('Emprestar ficha a')
  })

  it('sem quem empreste (ponte sem o recurso): sem a lista', () => {
    render([ANA_FORA, CARLA], {})
    expect(listaEmprestar('p-ana')).toBeNull()
    expect(botao('Guardar ficha')).toBeUndefined()
  })

  it('quem joga a emprestada caiu: "Guardar ficha" só se tem ficha dele; a emprestada não conta', () => {
    const onStoreTokens = vi.fn()
    const carlaFora = { ...CARLA, clientId: null, connected: false }
    render([{ ...ANA_FORA, lentTo: ['Carla'] }, { ...carlaFora, tokenIds: ['f-escudo', 'f-lirio'], borrowedFrom: ['Ana'], borrowedTokenIds: ['f-lirio'] }], {
      onLendTokens: vi.fn(),
      onEndLoans: vi.fn(),
      onStoreTokens,
    })
    const guardar = botao('Guardar ficha')
    if (guardar === undefined) throw new Error('esperava "Guardar ficha" no card da Carla (o Escudo é dela)')
    act(() => guardar.click())
    expect(onStoreTokens).toHaveBeenCalledWith('p-carla')
    // Só com a emprestada: nada dela a guardar.
    render([{ ...ANA_FORA, lentTo: ['Carla'] }, { ...carlaFora, tokenIds: ['f-lirio'], borrowedFrom: ['Ana'], borrowedTokenIds: ['f-lirio'] }], {
      onLendTokens: vi.fn(),
      onEndLoans: vi.fn(),
      onStoreTokens: vi.fn(),
    })
    expect(botao('Guardar ficha')).toBeUndefined()
  })

  it('quem joga a emprestada caiu: "Emprestar ficha a" só se tem ficha dele; a emprestada não se reempresta', () => {
    const bob = player({ clientId: 'c4', playerId: 'p-bob', name: 'Bob', tokenIds: [] })
    const carlaFora = { ...CARLA, clientId: null, connected: false }
    const onLendTokens = vi.fn()
    // Com o Escudo (dela) e o Lírio (da Ana): a lista vale, e empresta o que é dela.
    render([{ ...ANA_FORA, lentTo: ['Carla'] }, { ...carlaFora, tokenIds: ['f-escudo', 'f-lirio'], borrowedFrom: ['Ana'], borrowedTokenIds: ['f-lirio'] }, bob], {
      onLendTokens,
      onEndLoans: vi.fn(),
    })
    const lista = listaEmprestar('p-carla')
    if (lista === null) throw new Error('esperava "Emprestar ficha a" no card da Carla (o Escudo é dela)')
    expect([...lista.options].map((o) => o.textContent)).toEqual(['Escolher…', 'Bob'])
    escolher(lista, 'p-bob')
    expect(onLendTokens).toHaveBeenCalledWith('p-carla', 'p-bob')
    // Só com a emprestada: a sessão recusaria (a ficha é da Ana), então a lista nem aparece.
    render([{ ...ANA_FORA, lentTo: ['Carla'] }, { ...carlaFora, tokenIds: ['f-lirio'], borrowedFrom: ['Ana'], borrowedTokenIds: ['f-lirio'] }, bob], {
      onLendTokens: vi.fn(),
      onEndLoans: vi.fn(),
    })
    expect(listaEmprestar('p-carla')).toBeNull()
    expect(container.textContent).not.toContain('Emprestar ficha a')
  })
})
