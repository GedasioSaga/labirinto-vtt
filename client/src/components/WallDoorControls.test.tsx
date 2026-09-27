import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState } from '../types/map'
import { WallDoorControls } from './WallDoorControls'

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

function renderDoor(door: DoorState | null) {
  const handlers = { onToggleDoor: vi.fn(), onToggleOpen: vi.fn(), onToggleLocked: vi.fn(), onToggleSemEspiar: vi.fn(), onToggleSecret: vi.fn(), onRevealPassage: vi.fn(), onOpensFromChange: vi.fn() }
  act(() => root.render(<WallDoorControls door={door} {...handlers} />))
  return handlers
}

function checkboxLabeled(text: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(text))
  return label?.querySelector('input[type="checkbox"]') ?? null
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent === text)
}

describe('WallDoorControls: porta secreta', () => {
  it("'Secreta' mostra o estado e liga pelo clique", () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal' })
    const secreta = checkboxLabeled('Secreta')
    expect(secreta).not.toBeNull()
    expect(secreta?.checked).toBe(false)
    act(() => secreta?.click())
    expect(handlers.onToggleSecret).toHaveBeenCalledTimes(1)
    // Porta comum não tem o que revelar.
    expect(buttonByText('Revelar passagem')).toBeUndefined()
  })

  it("porta secreta: 'Revelar passagem' aparece e dispara num clique", () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal', secret: true })
    expect(checkboxLabeled('Secreta')?.checked).toBe(true)
    const revelar = buttonByText('Revelar passagem')
    expect(revelar).toBeDefined()
    act(() => revelar?.click())
    expect(handlers.onRevealPassage).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleSecret).not.toHaveBeenCalled()
  })

  it('parede sem porta não mostra os controles de segredo', () => {
    renderDoor(null)
    expect(checkboxLabeled('Secreta')).toBeNull()
    expect(buttonByText('Revelar passagem')).toBeUndefined()
  })
})

function radioByText(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent === text)
}

describe('WallDoorControls: porta de um lado', () => {
  it("'Abre por' mostra 'Os dois lados' marcado na porta comum e troca para 'Só deste lado'", () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal' })
    const grupo = container.querySelector('[role="radiogroup"][aria-label="Abre por"]')
    expect(grupo).not.toBeNull()
    expect(radioByText('Os dois lados')?.getAttribute('aria-checked')).toBe('true')
    expect(radioByText('Só deste lado')?.getAttribute('aria-checked')).toBe('false')
    // Sem lado escolhido, não há o que trocar.
    expect(buttonByText('Trocar o lado')).toBeUndefined()
    act(() => radioByText('Só deste lado')?.click())
    expect(handlers.onOpensFromChange).toHaveBeenCalledWith('right')
  })

  it("com um lado só: 'Só deste lado' marcado, 'Trocar o lado' inverte, 'Os dois lados' desliga", () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal', opensFrom: 'right' })
    expect(radioByText('Só deste lado')?.getAttribute('aria-checked')).toBe('true')
    expect(container.textContent).toContain('A seta no mapa mostra o lado que abre')
    act(() => buttonByText('Trocar o lado')?.click())
    expect(handlers.onOpensFromChange).toHaveBeenLastCalledWith('left')
    act(() => radioByText('Os dois lados')?.click())
    expect(handlers.onOpensFromChange).toHaveBeenLastCalledWith(null)
  })

  it('parede sem porta não mostra o controle', () => {
    renderDoor(null)
    expect(container.querySelector('[aria-label="Abre por"]')).toBeNull()
  })
})

/**
 * "Jogador pode espiar": o mestre escolhe, porta por porta, se a ficha
 * encostada espia pela fechadura. O rótulo nomeia o estado LIGADO (pode
 * espiar), então marcado = `semEspiar` ausente.
 */
describe('WallDoorControls: jogador pode espiar', () => {
  it('porta comum: marcado, e o clique pede para desligar sem mexer no cadeado', () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal' })
    const espiar = checkboxLabeled('Jogador pode espiar')
    expect(espiar).not.toBeNull()
    expect(espiar?.checked).toBe(true)
    act(() => espiar?.click())
    expect(handlers.onToggleSemEspiar).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleLocked).not.toHaveBeenCalled()
  })

  it('porta marcada sem espiar: desmarcado', () => {
    renderDoor({ open: false, locked: false, kind: 'normal', semEspiar: true })
    expect(checkboxLabeled('Jogador pode espiar')?.checked).toBe(false)
  })

  it('porta trancada também oferece a escolha (espiar pela fechadura é o caso)', () => {
    renderDoor({ open: false, locked: true, kind: 'normal' })
    expect(checkboxLabeled('Jogador pode espiar')?.checked).toBe(true)
  })

  it('porta secreta: sem a escolha (para o jogador é parede)', () => {
    renderDoor({ open: false, locked: false, kind: 'normal', secret: true })
    expect(checkboxLabeled('Jogador pode espiar')).toBeNull()
  })

  it('parede sem porta: sem a escolha', () => {
    renderDoor(null)
    expect(checkboxLabeled('Jogador pode espiar')).toBeNull()
  })
})
