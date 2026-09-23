import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TokenHealth } from '../types/map'
import { TokenHealthControls } from './TokenHealthControls'

/**
 * BARRA DE VIDA, lado do PAINEL da ficha: "Vida atual" e "Vida máxima" (o
 * número vale ao sair do campo) e, com vida, o interruptor "Jogadores veem a
 * barra" — desligado de fábrica. Nomes e gestos são os da régua
 * `e2e/task-jornada-barra-de-vida.spec.ts`: clique, Ctrl+A, dígitos, Tab.
 */

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

/** O painel com estado de verdade: o que o controle grava volta para ele, como no App. */
function Painel({ inicial, gravou }: { inicial: TokenHealth | null; gravou: (h: TokenHealth | null) => void }) {
  const [health, setHealth] = useState(inicial)
  return (
    <TokenHealthControls
      health={health}
      onHealthChange={(h) => {
        gravou(h)
        setHealth(h)
      }}
    />
  )
}

function montar(inicial: TokenHealth | null = null) {
  const gravou = vi.fn()
  act(() => root.render(<Painel inicial={inicial} gravou={gravou} />))
  return gravou
}

/** O campo pelo rótulo que o mestre lê — é por ele que a régua acha o campo. */
function campo(rotulo: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
  const input = label ? document.getElementById(label.htmlFor) : null
  if (!(input instanceof HTMLInputElement)) throw new Error(`o painel da ficha não tem o campo "${rotulo}"`)
  return input
}

/** O interruptor pelo texto do rótulo que o envolve (o `Toggle` da casa). */
function interruptor(rotulo: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label.lb-switch')].find((l) => l.textContent?.trim() === rotulo)
  return label?.querySelector('input[type="checkbox"]') ?? null
}

function botao(texto: string): HTMLButtonElement | null {
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto) ?? null
}

/** Digita como o React vê: muda o valor pelo setter nativo e dispara `input`. */
function digitar(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function sair(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
}

function tecla(input: HTMLInputElement, key: string, shiftKey = false) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
  })
}

const vida = (current: number, max: number, shownToPlayers = false): TokenHealth => ({ current, max, shownToPlayers })

describe('TokenHealthControls — ficha sem vida', () => {
  it('mostra "Vida atual" e "Vida máxima" como campos de número, vazios, e diz o que acontece ao preencher', () => {
    montar()
    expect(campo('Vida atual').type).toBe('number')
    expect(campo('Vida máxima').type).toBe('number')
    expect(campo('Vida atual').value).toBe('')
    expect(campo('Vida máxima').value).toBe('')
    expect(container.textContent).toContain('barra fina aparece sob a ficha')
  })

  it('sem vida não há interruptor de jogadores nem botão de remover: não há barra para mostrar ou tirar', () => {
    montar()
    expect(interruptor('Jogadores veem a barra')).toBeNull()
    expect(botao('Remover barra de vida')).toBeNull()
  })

  it('digitar não grava; sair do campo grava UMA vez — a máxima nasce cheia e só para o mestre', () => {
    const gravou = montar()
    const maxima = campo('Vida máxima')
    digitar(maxima, '4')
    digitar(maxima, '41')
    digitar(maxima, '419')
    expect(gravou).not.toHaveBeenCalled()
    sair(maxima)
    expect(gravou).toHaveBeenCalledTimes(1)
    expect(gravou).toHaveBeenLastCalledWith(vida(419, 419, false))
    expect(maxima.value).toBe('419')
    expect(campo('Vida atual').value).toBe('419')
  })

  it('máxima e depois atual, como a régua faz: 173 de 419', () => {
    const gravou = montar()
    digitar(campo('Vida máxima'), '419')
    sair(campo('Vida máxima'))
    digitar(campo('Vida atual'), '173')
    sair(campo('Vida atual'))
    expect(gravou).toHaveBeenLastCalledWith(vida(173, 419))
    expect(campo('Vida atual').value).toBe('173')
    expect(campo('Vida máxima').value).toBe('419')
  })
})

describe('TokenHealthControls — ficha com vida', () => {
  it('"Jogadores veem a barra" nasce DESLIGADO e ligar grava a escolha', () => {
    const gravou = montar(vida(6, 10))
    const chave = interruptor('Jogadores veem a barra')
    expect(chave, 'com vida, o painel deveria oferecer o interruptor').not.toBeNull()
    expect(chave?.checked).toBe(false)
    act(() => chave?.click())
    expect(gravou).toHaveBeenLastCalledWith(vida(6, 10, true))
    expect(interruptor('Jogadores veem a barra')?.checked).toBe(true)
  })

  it('a frase sob o interruptor diz quem vê: só o mestre, ou a mesa sem os números', () => {
    montar(vida(6, 10))
    const chave = interruptor('Jogadores veem a barra')
    const antes = document.getElementById(chave?.getAttribute('aria-describedby') ?? '')?.textContent ?? ''
    expect(antes).toContain('Só você')
    act(() => chave?.click())
    const depois = document.getElementById(interruptor('Jogadores veem a barra')?.getAttribute('aria-describedby') ?? '')?.textContent ?? ''
    expect(depois).toContain('sem os números')
  })

  it('Enter grava sem sair do campo; a atual acima da máxima para na máxima', () => {
    const gravou = montar(vida(6, 10))
    const atual = campo('Vida atual')
    digitar(atual, '12')
    tecla(atual, 'Enter')
    expect(gravou).toHaveBeenLastCalledWith(vida(10, 10))
    expect(atual.value).toBe('10')
  })

  it('Esc desiste do que foi digitado e não deixa o Esc largar a ficha; sem digitação o Esc segue viagem', () => {
    const gravou = montar(vida(6, 10))
    const atual = campo('Vida atual')
    const aoWindow = vi.fn()
    window.addEventListener('keydown', aoWindow)
    digitar(atual, '2')
    tecla(atual, 'Escape')
    expect(atual.value).toBe('6')
    expect(aoWindow).not.toHaveBeenCalled()
    tecla(atual, 'Escape')
    window.removeEventListener('keydown', aoWindow)
    expect(aoWindow).toHaveBeenCalledTimes(1)
    expect(gravou).not.toHaveBeenCalled()
  })

  it('seta para baixo tira 1 ponto na hora (Shift: 5); para cima cura, sem passar da máxima', () => {
    const gravou = montar(vida(6, 10))
    tecla(campo('Vida atual'), 'ArrowDown')
    expect(gravou).toHaveBeenLastCalledWith(vida(5, 10))
    tecla(campo('Vida atual'), 'ArrowDown', true)
    expect(gravou).toHaveBeenLastCalledWith(vida(0, 10))
    tecla(campo('Vida atual'), 'ArrowUp', true)
    tecla(campo('Vida atual'), 'ArrowUp', true)
    tecla(campo('Vida atual'), 'ArrowUp', true)
    expect(gravou).toHaveBeenLastCalledWith(vida(10, 10))
  })

  it('passar pelo campo sem trocar o número não grava nada (nenhum Ctrl+Z vazio)', () => {
    const gravou = montar(vida(6, 10))
    const atual = campo('Vida atual')
    digitar(atual, '6')
    sair(atual)
    digitar(atual, '')
    sair(atual)
    expect(gravou).not.toHaveBeenCalled()
    expect(atual.value).toBe('6')
  })

  it('"Remover barra de vida" tira a vida da ficha e o painel volta ao vazio', () => {
    const gravou = montar(vida(6, 10, true))
    act(() => botao('Remover barra de vida')?.click())
    expect(gravou).toHaveBeenLastCalledWith(null)
    expect(campo('Vida atual').value).toBe('')
    expect(interruptor('Jogadores veem a barra')).toBeNull()
  })

  it('trocar de ficha com número digitado e não confirmado: o número vai para a ficha DO CAMPO', () => {
    const doOgro = vi.fn()
    const doHeroi = vi.fn()
    act(() => root.render(<TokenHealthControls key="og" health={vida(7, 10)} onHealthChange={doOgro} />))
    digitar(campo('Vida atual'), '3')
    act(() => root.render(<TokenHealthControls key="lu" health={vida(6, 10)} onHealthChange={doHeroi} />))
    expect(doOgro).toHaveBeenCalledWith(vida(3, 10))
    expect(doHeroi).not.toHaveBeenCalled()
    expect(campo('Vida atual').value).toBe('6')
  })
})
