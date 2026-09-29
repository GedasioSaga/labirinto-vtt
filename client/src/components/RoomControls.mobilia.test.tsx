import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * MOBÍLIA DESENHADA, lado do PAINEL: a sala selecionada oferece "Barril",
 * "Caixa", "Baú", "Cama", "Mesa" e "Cadeira". Cada botão pede o móvel daquele tipo; sem quem ponha o
 * móvel (painel montado sem mapa), a seção não aparece.
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

function render(overrides: Partial<RoomControlsProps> = {}): RoomControlsProps {
  const props: RoomControlsProps = {
    name: 'Dormitório',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 128,
    height: 384,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
  return props
}

function grupoMobilia(): HTMLElement | null {
  return container.querySelector('[role="group"][aria-label="Pôr mobília na sala"]')
}

function botao(texto: string): HTMLButtonElement {
  const achado = [...(grupoMobilia()?.querySelectorAll('button') ?? [])].find((b) => b.textContent === texto)
  if (!achado) throw new Error(`a seção Mobília não tem o botão "${texto}"`)
  return achado
}

describe('RoomControls — Mobília', () => {
  it('mostra os seis móveis, e cada um pede o móvel do seu tipo', () => {
    const onAddMobilia = vi.fn()
    render({ onAddMobilia })
    expect(grupoMobilia()).not.toBeNull()
    const nomes = ['Barril', 'Caixa', 'Baú', 'Cama', 'Mesa', 'Cadeira']
    expect([...(grupoMobilia()?.querySelectorAll('button') ?? [])].map((b) => b.textContent)).toEqual(nomes)

    for (const nome of nomes) act(() => botao(nome).click())
    expect(onAddMobilia.mock.calls).toEqual([['barril'], ['caixa'], ['bau'], ['catre'], ['mesa'], ['cadeira']])
  })

  it('são botões de verdade (teclado e leitor de tela), com o que fazem no nome', () => {
    render({ onAddMobilia: vi.fn() })
    const cama = botao('Cama')
    expect(cama.type).toBe('button')
    expect(cama.getAttribute('title')).toBe('Pôr uma cama no centro da sala')
    expect(botao('Barril').getAttribute('title')).toBe('Pôr um barril no centro da sala')
  })

  it('sem quem ponha o móvel, a seção não aparece', () => {
    render()
    expect(grupoMobilia()).toBeNull()
    expect(container.textContent).not.toContain('Mobília')
  })
})
