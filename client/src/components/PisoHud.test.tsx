import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PisoHud } from './PisoHud'
import { LevarAoPisoControls, PisoControls } from './PisoControls'

/**
 * PISOS NA MESMA CENA — os caminhos do mestre para outro piso: o piso em
 * edição no canto do canvas, "Editar o 1º piso" na escada e "Levar ao piso"
 * na seleção.
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

function botao(nome: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  if (found === undefined) throw new Error(`sem o botão "${nome}"`)
  return found
}

describe('PisoHud', () => {
  it('mostra o piso em edição e sobe/desce um piso pelos botões', () => {
    const onPisoChange = vi.fn()
    act(() => root.render(<PisoHud piso={0} onPisoChange={onPisoChange} />))
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Piso em edição')
    expect(container.textContent).toContain('Térreo')
    act(() => botao('Editar o 1º piso').click())
    act(() => botao('Editar o 1º subsolo').click())
    expect(onPisoChange.mock.calls).toEqual([[1], [-1]])
  })

  it('no último piso aceito, o botão de subir fica desabilitado', () => {
    act(() => root.render(<PisoHud piso={999} onPisoChange={() => undefined} />))
    expect(container.textContent).toContain('999º piso')
    expect(botao('Editar o 1000º piso').disabled).toBe(true)
    expect(botao('Editar o 998º piso').disabled).toBe(false)
  })
})

describe('PisoControls — a escada leva o editor ao outro lado', () => {
  it('do térreo, "Editar o 1º piso"; do 1º piso, "Editar o térreo"; escada de enfeite não tem o botão', () => {
    const onEditarPiso = vi.fn()
    const base = { piso: 0, onPisoChange: () => undefined, levaAoPiso: 1, onLevaAoPisoChange: () => undefined, onEditarPiso }
    act(() => root.render(<PisoControls {...base} pisoAtivo={0} />))
    act(() => botao('Editar o 1º piso').click())
    act(() => root.render(<PisoControls {...base} pisoAtivo={1} />))
    act(() => botao('Editar o térreo').click())
    expect(onEditarPiso.mock.calls).toEqual([[1], [0]])
    act(() => root.render(<PisoControls {...base} levaAoPiso={null} pisoAtivo={0} />))
    expect(container.textContent).not.toContain('Editar o')
  })
})

describe('LevarAoPisoControls', () => {
  it('leva a seleção ao piso de cima ou de baixo do piso em edição', () => {
    const onLevar = vi.fn()
    act(() => root.render(<LevarAoPisoControls pisoAtivo={1} onLevar={onLevar} />))
    act(() => botao('Levar ao 2º piso').click())
    act(() => botao('Levar ao térreo').click())
    expect(onLevar.mock.calls).toEqual([[2], [0]])
  })
})
