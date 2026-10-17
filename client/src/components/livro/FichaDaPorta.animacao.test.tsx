import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState } from '../types/map'
import { esquecerAnimacoesDePortaDeFora, registrarAnimacaoDePorta } from '../portas/animacoesDePorta'
import { WallDoorControls } from './WallDoorControls'

/**
 * PORTA ANIMADA: "Animação ao abrir" no painel da porta. A lista vem do
 * registro (embutidas + as do pacote, que aparecem sem reabrir o painel).
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
  esquecerAnimacoesDePortaDeFora()
})

const FECHADA: DoorState = { open: false, locked: false, kind: 'normal' }

function render(door: DoorState, onAnimacaoChange?: (id: string | null) => void) {
  const handlers = { onToggleDoor: vi.fn(), onToggleOpen: vi.fn(), onToggleLocked: vi.fn(), onToggleSemEspiar: vi.fn(), onToggleSecret: vi.fn(), onRevealPassage: vi.fn(), onOpensFromChange: vi.fn() }
  act(() => root.render(<WallDoorControls door={door} {...handlers} onAnimacaoChange={onAnimacaoChange} />))
}

/** O `<select>` que o rótulo "Animação ao abrir" aponta (`htmlFor`). */
function seletor(): HTMLSelectElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent === 'Animação ao abrir')
  const alvo = label === undefined ? null : document.getElementById(label.htmlFor)
  return alvo instanceof HTMLSelectElement ? alvo : null
}

function opcoes(select: HTMLSelectElement): [string, string][] {
  return [...select.options].map((o) => [o.value, o.textContent ?? ''])
}

function escolher(select: HTMLSelectElement, valor: string): void {
  act(() => {
    select.value = valor
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('WallDoorControls: animação ao abrir', () => {
  it('porta sem o campo mostra "Sem animação" e lista as embutidas', () => {
    render(FECHADA, vi.fn())
    const select = seletor()
    expect(select).not.toBeNull()
    if (select === null) return
    expect(select.value).toBe('')
    expect(opcoes(select)).toEqual([
      ['', 'Sem animação'],
      ['girar', 'Girar na dobradiça'],
      ['deslizar', 'Deslizar'],
    ])
  })

  it('escolher uma animação manda o id; "Sem animação" manda null', () => {
    const onAnimacaoChange = vi.fn()
    render(FECHADA, onAnimacaoChange)
    const select = seletor()
    if (select === null) throw new Error('sem o seletor')
    escolher(select, 'girar')
    expect(onAnimacaoChange).toHaveBeenLastCalledWith('girar')

    render({ ...FECHADA, animacao: 'girar' }, onAnimacaoChange)
    expect(select.value).toBe('girar')
    escolher(select, '')
    expect(onAnimacaoChange).toHaveBeenLastCalledWith(null)
  })

  it('id gravado que o app não tem aparece como "Não instalada", sem fingir "Sem animação"', () => {
    render({ ...FECHADA, animacao: 'leque-2' }, vi.fn())
    const select = seletor()
    if (select === null) throw new Error('sem o seletor')
    expect(select.value).toBe('leque-2')
    expect(opcoes(select).at(-1)).toEqual(['leque-2', 'Não instalada (leque-2)'])
  })

  it('animação do pacote registrada com o painel aberto entra na lista na hora', () => {
    render(FECHADA, vi.fn())
    act(() => {
      registrarAnimacaoDePorta({ id: 'leque', nome: 'Abrir em leque', duracaoMs: 300, desenhar: () => {} })
    })
    const select = seletor()
    if (select === null) throw new Error('sem o seletor')
    expect(opcoes(select).at(-1)).toEqual(['leque', 'Abrir em leque'])
  })

  it('sem o handler o seletor não aparece', () => {
    render(FECHADA)
    expect(seletor()).toBeNull()
  })
})
