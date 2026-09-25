import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HazardControls } from './HazardControls'

/**
 * ZONA DE PERIGO, lado do PAINEL do mestre: com a Sala selecionada, o mestre
 * escolhe o perigo que a toma (ou "Nenhum") e aperta "Avançar um passo". Sem
 * porta aberta para o perigo passar, o botão fica indisponível e diz por quê.
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

function render(node: React.ReactNode) {
  act(() => root.render(node))
}

function botao(nome: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === nome)
  if (!achado) throw new Error(`sem o botão "${nome}"`)
  return achado
}

describe('HazardControls — o que a fumaça e o vapor fazem', () => {
  it.each(['fumaca', 'vapor'] as const)('%s: o painel conta ao mestre que encurta a visão e esconde quem está dentro', (kind) => {
    render(<HazardControls kind={kind} roomCount={1} canAdvance={false} onKindChange={() => {}} onAdvance={() => {}} />)
    const dica = container.querySelector('.lb-field__hint')?.textContent ?? ''
    expect(dica).toContain('Quem está dentro enxerga só 2 casas')
    expect(dica).toContain('some para quem está fora')
  })

  it('fogo não promete esconder ninguém', () => {
    render(<HazardControls kind="fogo" roomCount={1} canAdvance={false} onKindChange={() => {}} onAdvance={() => {}} />)
    const dica = container.querySelector('.lb-field__hint')?.textContent ?? ''
    expect(dica).toContain('Fogo em 1 sala')
    expect(dica).not.toContain('enxerga')
  })
})

describe('HazardControls', () => {
  it('mostra os cinco estados num grupo de escolha única, com o atual marcado', () => {
    render(<HazardControls kind="fumaca" roomCount={2} canAdvance onKindChange={() => {}} onAdvance={() => {}} />)
    const grupo = container.querySelector('[role="radiogroup"]')
    expect(grupo?.getAttribute('aria-label')).toBe('Perigo na sala')
    const opcoes = [...container.querySelectorAll('[role="radio"]')].map((o) => [o.textContent?.trim(), o.getAttribute('aria-checked')])
    expect(opcoes).toEqual([
      ['Nenhum', 'false'],
      ['Fogo', 'false'],
      ['Fumaça', 'true'],
      ['Vapor', 'false'],
      ['Água', 'false'],
    ])
    expect(container.textContent).toContain('2 salas')
  })

  it('escolher pede a troca; "Nenhum" pede para apagar', () => {
    const onKindChange = vi.fn()
    render(<HazardControls kind={null} roomCount={0} canAdvance={false} onKindChange={onKindChange} onAdvance={() => {}} />)
    act(() => botao('Fogo').click())
    act(() => botao('Nenhum').click())
    expect(onKindChange.mock.calls).toEqual([['fogo'], [null]])
  })

  it('sem perigo na sala não há o que avançar', () => {
    render(<HazardControls kind={null} roomCount={0} canAdvance={false} onKindChange={() => {}} onAdvance={() => {}} />)
    expect([...container.querySelectorAll('button')].some((b) => b.textContent?.includes('Avançar'))).toBe(false)
  })

  it('"Avançar um passo" chama o avanço; sem porta aberta fica indisponível e diz por quê', () => {
    const onAdvance = vi.fn()
    render(<HazardControls kind="fogo" roomCount={1} canAdvance onKindChange={() => {}} onAdvance={onAdvance} />)
    act(() => botao('Avançar um passo').click())
    expect(onAdvance).toHaveBeenCalledTimes(1)

    render(<HazardControls kind="fogo" roomCount={1} canAdvance={false} onKindChange={() => {}} onAdvance={onAdvance} />)
    const parado = botao('Avançar um passo')
    expect(parado.disabled).toBe(true)
    const dica = document.getElementById(parado.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('porta aberta')
  })
})
