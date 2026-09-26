import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { LoanTerms, PlayerInfo } from '../net/hostSession'
import { RoomPanel, type RoomPanelToken } from './RoomPanel'

/**
 * AJUDANTE CONTRATADO no painel do mestre: "Emprestar como ajudante…" no card
 * do jogador escolhe a ficha livre, a tarefa, o prazo e se ele vê pelos olhos
 * do NPC. A ficha emprestada aparece no card com "ajudante até 21:30".
 */
const TOKENS: RoomPanelToken[] = [
  { id: 'arco', name: 'Arco' },
  { id: 'tiziu', name: 'Tiziu', npc: true },
  { id: 'machado', name: 'Machado' },
]
const AS_21_30 = new Date(2026, 8, 24, 21, 30).getTime()
const ROOM = { code: 'AJUD01', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

function jogador(overrides: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c1', playerId: 'p1', name: 'Duda', status: 'playing', connected: true, tokenIds: ['arco'], visionRadius: 700, visionFactor: 1, ...overrides }
}

describe('RoomPanel: emprestar ficha como ajudante', () => {
  let container: HTMLDivElement
  let root: Root
  let onLend: ReturnType<typeof vi.fn<(playerId: string, tokenId: string, terms: LoanTerms) => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onLend = vi.fn<(playerId: string, tokenId: string, terms: LoanTerms) => void>()
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
          tokens={TOKENS}
          tunnel={IDLE}
          onStart={noop}
          onStop={noop}
          onStartTunnel={noop}
          onStopTunnel={noop}
          onAssign={noop}
          onUnassign={noop}
          onLend={onLend}
          onKick={noop}
          onVisionRadiusChange={noop}
          onVisionFactorChange={noop}
          clues={{ rows: [], onCenter: noop, onToggle: noop }}
          onRevealPlan={noop}
          onHidePlan={noop}
        />,
      ),
    )
  }

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === texto)
    if (achado === undefined) throw new Error(`sem botão "${texto}"`)
    return achado
  }

  function campo<T extends HTMLElement>(rotulo: string, tipo: { new (): T; prototype: T }): T {
    const label = Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').trim() === rotulo)
    const id = label?.getAttribute('for')
    const el = id ? document.getElementById(id) : null
    if (!(el instanceof tipo)) throw new Error(`sem o campo "${rotulo}"`)
    return el
  }

  function muda(el: HTMLInputElement | HTMLSelectElement, valor: string): void {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    act(() => {
      setter?.call(el, valor)
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }

  it('empresta o Tiziu à Duda com tarefa, 30 minutos e sem os olhos dele', () => {
    render([jogador({})])
    act(() => botao('Emprestar como ajudante…').click())
    const ficha = campo('Ficha do ajudante', HTMLSelectElement)
    // Só fichas livres: a Duda já tem o Arco.
    expect(Array.from(ficha.options).map((o) => o.value)).toEqual(['tiziu', 'machado'])
    muda(ficha, 'tiziu')
    muda(campo('Tarefa', HTMLInputElement), 'levar o recado')
    muda(campo('Prazo', HTMLSelectElement), '30')
    expect(campo('Vê com os olhos dele', HTMLInputElement).checked).toBe(false)
    act(() => botao('Emprestar').click())
    expect(onLend).toHaveBeenCalledWith('p1', 'tiziu', { tarefa: 'levar o recado', minutos: 30, visao: false })
    // Emprestou, o formulário fecha.
    expect(() => campo('Tarefa', HTMLInputElement)).toThrow()
  })

  it('"Até eu tirar" e "vê com os olhos dele" marcados viram prazo nulo e visão', () => {
    render([jogador({})])
    act(() => botao('Emprestar como ajudante…').click())
    muda(campo('Prazo', HTMLSelectElement), 'manual')
    act(() => campo('Vê com os olhos dele', HTMLInputElement).click())
    act(() => botao('Emprestar').click())
    expect(onLend).toHaveBeenCalledWith('p1', 'tiziu', { tarefa: '', minutos: null, visao: true })
  })

  it('Cancelar fecha sem emprestar', () => {
    render([jogador({})])
    act(() => botao('Emprestar como ajudante…').click())
    act(() => botao('Cancelar').click())
    expect(onLend).not.toHaveBeenCalled()
    expect(() => campo('Tarefa', HTMLInputElement)).toThrow()
  })

  it('a ficha emprestada aparece no card com o prazo, e "Remover" continua ali', () => {
    render([jogador({ tokenIds: ['arco', 'tiziu'], loans: { tiziu: { tarefa: 'levar o recado', ate: AS_21_30, visao: false } } })])
    expect(container.textContent).toContain('Tiziu — ajudante até 21:30 · levar o recado')
    expect(botao('Remover Tiziu')).toBeDefined()
  })
})
