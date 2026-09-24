/**
 * DADO ROLADO NA SALA na tela do JOGADOR: a aba "Dados" do painel abre o
 * formulário (d4 a d20, Quantidade, Modificador, Rolar). Rolar escondido é
 * só do mestre: o jogador não tem essa caixa.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiceRequest } from '../lib/dice'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

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

function render(onRollDice?: (request: DiceRequest) => void): void {
  act(() =>
    root.render(
      <PlayerPanel
        characters={[{ id: 'tok-ana', name: 'Lanterna' }]}
        characterColor="#3b82f6"
        settings={DEFAULT_PLAYER_SETTINGS}
        onSettingsChange={() => {}}
        onFocusToken={() => {}}
        signalArmed={false}
        onToggleSignal={() => {}}
        measureArmed={false}
        onToggleMeasure={() => {}}
        laserArmed={false}
        onToggleLaser={() => {}}
        onRenameToken={() => {}}
        onChangeTokenPhoto={async () => {}}
        notebook={[]}
        notebookUnread={false}
        onReadNotebook={() => {}}
        onRollDice={onRollDice}
      />,
    ),
  )
}

const abaDados = (): HTMLButtonElement | undefined =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => (b.textContent ?? '').trim() === 'Dados')

function painelDados(): HTMLElement {
  const aba = abaDados()
  // `getElementById`, e não seletor: o id do `useId` tem dois-pontos.
  const painel = aba ? document.getElementById(aba.getAttribute('aria-controls') ?? '') : null
  if (painel === null) throw new Error('sem painel da aba Dados')
  return painel
}

describe('PlayerPanel: aba Dados', () => {
  it('a aba "Dados" abre o painel de nome "Dados", com os seis dados e sem "Rolar escondido"', () => {
    render(() => {})
    const aba = abaDados()
    if (aba === undefined) throw new Error('sem aba Dados')
    expect(painelDados().hidden).toBe(true)
    act(() => aba.click())
    const painel = painelDados()
    expect(painel.hidden).toBe(false)
    expect(painel.getAttribute('role')).toBe('tabpanel')
    expect(painel.getAttribute('aria-labelledby')).toBe(aba.id)
    const nomes = Array.from(painel.querySelectorAll('button')).map((b) => (b.textContent ?? '').trim())
    expect(nomes).toEqual(expect.arrayContaining(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'Rolar']))
    expect(painel.querySelector('input[type="checkbox"]')).toBeNull()
    expect(painel.textContent).not.toMatch(/escondid/i)
  })

  it('Rolar pede ao host o que foi escolhido', () => {
    const onRollDice = vi.fn<(request: DiceRequest) => void>()
    render(onRollDice)
    act(() => abaDados()?.click())
    const d6 = Array.from(painelDados().querySelectorAll('button')).find((b) => b.textContent === 'd6')
    act(() => d6?.click())
    expect(onRollDice).not.toHaveBeenCalled()
    const rolar = Array.from(painelDados().querySelectorAll('button')).find((b) => b.textContent === 'Rolar')
    act(() => rolar?.click())
    expect(onRollDice).toHaveBeenCalledWith({ count: 1, sides: 6, modifier: 0 })
  })

  it('sem quem role (tela antiga), a aba nem aparece', () => {
    render(undefined)
    expect(abaDados()).toBeUndefined()
  })
})
