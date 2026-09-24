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
  const handlers = { onToggleDoor: vi.fn(), onToggleOpen: vi.fn(), onToggleLocked: vi.fn(), onToggleSecret: vi.fn(), onRevealPassage: vi.fn() }
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
