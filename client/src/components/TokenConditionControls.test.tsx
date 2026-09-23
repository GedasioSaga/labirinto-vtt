import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOKEN_CONDITION_SYMBOLS } from '../lib/tokenConditions'
import { TokenConditionControls } from './TokenConditionControls'

/**
 * CONDIÇÃO NA FICHA, lado do PAINEL do mestre. Com a ficha selecionada, as
 * cinco condições ficam à vista como botões de ligar/desligar, cada um com o
 * nome que a pessoa lê e a mesma pastilha que sai no mapa; o marcado diz que
 * está marcado (`aria-pressed`), e clicar pede para alternar.
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

function botoes(): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')]
}

function botao(nome: string): HTMLButtonElement {
  const achado = botoes().find((b) => b.textContent?.trim() === nome)
  if (!achado) throw new Error(`sem o botão "${nome}"`)
  return achado
}

describe('TokenConditionControls', () => {
  it('as cinco condições, pelo nome, como botões de ligar/desligar num grupo com rótulo', () => {
    render(<TokenConditionControls conditions={[]} onToggleCondition={vi.fn()} />)
    expect(botoes().map((b) => b.textContent?.trim())).toEqual(['Envenenado', 'Caído', 'Dormindo', 'Atordoado', 'Invisível'])
    for (const b of botoes()) {
      expect(b.getAttribute('type')).toBe('button')
      expect(b.getAttribute('aria-pressed')).toBe('false')
    }
    const grupo = container.querySelector('[role="group"]')
    expect(grupo?.getAttribute('aria-label')).toBe('Condições da ficha')
    expect(container.querySelector('h2')?.textContent).toBe('Condições')
  })

  it('o que está marcado na ficha aparece pressionado; o resto não', () => {
    render(<TokenConditionControls conditions={['caido', 'invisivel']} onToggleCondition={vi.fn()} />)
    expect(botao('Caído').getAttribute('aria-pressed')).toBe('true')
    expect(botao('Invisível').getAttribute('aria-pressed')).toBe('true')
    expect(botao('Envenenado').getAttribute('aria-pressed')).toBe('false')
  })

  it('clicar pede para alternar AQUELA condição (marcar e desmarcar são o mesmo gesto)', () => {
    const onToggleCondition = vi.fn()
    render(<TokenConditionControls conditions={['caido']} onToggleCondition={onToggleCondition} />)
    act(() => botao('Envenenado').click())
    act(() => botao('Caído').click())
    expect(onToggleCondition.mock.calls).toEqual([['envenenado'], ['caido']])
  })

  it('cada botão mostra a pastilha do mapa (a cor dela), decorativa para o leitor de tela', () => {
    render(<TokenConditionControls conditions={[]} onToggleCondition={vi.fn()} />)
    const cores = botoes().map((b) => {
      const arte = b.querySelector('svg')
      expect(arte?.getAttribute('aria-hidden')).toBe('true')
      return arte?.querySelector('circle')?.getAttribute('fill')
    })
    expect(cores).toEqual(['envenenado', 'caido', 'dormindo', 'atordoado', 'invisivel'].map((c) => TOKEN_CONDITION_SYMBOLS[c as keyof typeof TOKEN_CONDITION_SYMBOLS].fill))
  })

  it('diz onde a marca aparece — inclusive para os jogadores', () => {
    render(<TokenConditionControls conditions={[]} onToggleCondition={vi.fn()} />)
    expect(container.textContent).toMatch(/jogador/i)
  })
})
