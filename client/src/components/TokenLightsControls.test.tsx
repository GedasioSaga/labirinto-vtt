// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TokenLightsControls, type TokenLightsControlsProps } from './TokenLightsControls'

// React 19 só aplica `act` sem aviso quando o ambiente declara que é de teste.
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

function montar(overrides: Partial<TokenLightsControlsProps> = {}) {
  const props: TokenLightsControlsProps = {
    lights: [{ id: 'tocha', attached: true }],
    onSelectLight: vi.fn(),
    onDetach: vi.fn(),
    ...overrides,
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  const r = createRoot(host)
  root = r
  act(() => r.render(<TokenLightsControls {...props} />))
  return props
}

function botao(nome: RegExp): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll('button')).find((b) => nome.test((b.textContent ?? '').trim())) ?? null
}

describe('TokenLightsControls — a tocha presa alcançável pelo painel da ficha', () => {
  it('com a luz presa, "Soltar a luz" solta ESSA luz e "Ajustar a luz" a seleciona', () => {
    const props = montar()
    const soltar = botao(/^Soltar/)
    const ajustar = botao(/^Ajustar a luz$/)
    expect(soltar?.textContent).toBe('Soltar a luz')
    expect(ajustar).not.toBeNull()
    act(() => soltar?.click())
    expect(props.onDetach).toHaveBeenCalledWith('tocha')
    act(() => ajustar?.click())
    expect(props.onSelectLight).toHaveBeenCalledWith('tocha')
  })

  it('luz solta embaixo da ficha: só "Ajustar a luz" (não há o que soltar)', () => {
    montar({ lights: [{ id: 'solta', attached: false }] })
    expect(botao(/^Ajustar a luz$/)).not.toBeNull()
    expect(botao(/^Soltar/)).toBeNull()
  })

  it('sem luz na ficha, o bloco não aparece', () => {
    montar({ lights: [] })
    expect(host?.childElementCount).toBe(0)
  })

  it('com duas luzes, cada botão leva um número e aponta para a sua luz', () => {
    const props = montar({ lights: [{ id: 'a', attached: true }, { id: 'b', attached: true }] })
    expect(Array.from(document.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Ajustar a luz 1',
      'Soltar a luz 1',
      'Ajustar a luz 2',
      'Soltar a luz 2',
    ])
    act(() => botao(/^Soltar a luz 2$/)?.click())
    expect(props.onDetach).toHaveBeenCalledWith('b')
  })
})
