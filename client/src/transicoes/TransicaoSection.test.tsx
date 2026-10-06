import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TransicaoSection } from './TransicaoSection'
import type { TransicaoEscolhida } from './catalogo'

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

const botao = (texto: string) => {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === texto || (b.textContent ?? '').includes(texto))
  if (!achado) throw new Error(`sem o botão "${texto}"`)
  return achado
}

function render(transicao: TransicaoEscolhida | undefined, onChange = vi.fn()) {
  act(() => root.render(<TransicaoSection transicao={transicao} onChange={onChange} origem="pino" />))
  return onChange
}

describe('TransicaoSection', () => {
  it('lista Nenhuma e as transições do catálogo, com a escolhida marcada', () => {
    render({ id: 'porta' })
    expect(container.textContent).toContain('Nenhuma')
    expect(container.textContent).toContain('Porta rangendo')
    expect(container.textContent).toContain('Escadaria de pedra')
    expect(botao('Porta rangendo').getAttribute('aria-pressed')).toBe('true')
    expect(botao('Nenhuma').getAttribute('aria-pressed')).toBe('false')
  })

  it('escolher uma transição grava sem duração (completa); Nenhuma tira', () => {
    const onChange = render(undefined)
    act(() => botao('Escadaria de pedra').click())
    expect(onChange).toHaveBeenLastCalledWith({ id: 'escada-pedra' })
    render({ id: 'porta' }, onChange)
    act(() => botao('Nenhuma').click())
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('sem transição escolhida não há campo de duração', () => {
    render(undefined)
    expect(container.querySelector('input')).toBeNull()
  })

  it('duração: grava ao sair do campo, presa ao teto; vazio volta à completa', () => {
    const onChange = render({ id: 'porta' })
    const campo = container.querySelector('input') as HTMLInputElement
    const digitar = (valor: string) => {
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(campo, valor)
        campo.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    }
    digitar('4,5')
    expect(onChange).toHaveBeenLastCalledWith({ id: 'porta', duracaoS: 4.5 })
    digitar('500')
    expect(onChange).toHaveBeenLastCalledWith({ id: 'porta', duracaoS: 30 })
    digitar('')
    expect(onChange).toHaveBeenLastCalledWith({ id: 'porta' })
  })

  it('o botão de expandir abre a janela da animação e Fechar some com ela', () => {
    render({ id: 'porta' })
    act(() => botao('Assistir Porta rangendo').click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Porta rangendo')
    act(() => botao('Fechar').click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
