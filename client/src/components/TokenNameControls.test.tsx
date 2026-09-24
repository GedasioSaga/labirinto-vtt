import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenNameControls, type TokenNameControlsProps } from './TokenNameControls'

/**
 * "Nome para os jogadores" no painel da ficha: O mesmo | Outro | Nenhum. A
 * ficha sem o campo (mapa antigo, ficha recém-criada) mostra "O mesmo"; com
 * "Outro" aparece a caixa do nome que a mesa lê, que vale ao sair dela.
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

function render(overrides: Partial<TokenNameControlsProps> = {}): TokenNameControlsProps {
  const props: TokenNameControlsProps = {
    name: 'Capataz traidor',
    onNameChange: vi.fn(),
    publicName: undefined,
    onPublicNameChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<TokenNameControls {...props} />))
  return props
}

function grupo(): HTMLElement {
  const achado = container.querySelector('[role="radiogroup"][aria-label="Nome para os jogadores"]')
  if (!(achado instanceof HTMLElement)) throw new Error('o painel não tem o grupo "Nome para os jogadores"')
  return achado
}

function opcao(texto: string): HTMLElement {
  const achado = [...grupo().querySelectorAll('[role="radio"]')].find((r) => r.textContent?.trim() === texto)
  if (!(achado instanceof HTMLElement)) throw new Error(`o grupo não tem a opção "${texto}"`)
  return achado
}

/** A caixa do "Outro", pelo rótulo que o usuário lê. */
function caixaDoOutro(): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => /jogadores|outro nome/i.test(l.textContent ?? ''))
  const input = label ? document.getElementById(label.htmlFor) : null
  return input instanceof HTMLInputElement ? input : null
}

/** Digitar como o React enxerga: setter nativo + evento `input`. */
function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('TokenNameControls: nome para os jogadores', () => {
  it('ficha sem o campo mostra "O mesmo" marcado e nenhuma caixa extra', () => {
    render()
    expect(opcao('O mesmo').getAttribute('aria-checked')).toBe('true')
    expect(opcao('Outro').getAttribute('aria-checked')).toBe('false')
    expect(opcao('Nenhum').getAttribute('aria-checked')).toBe('false')
    expect(caixaDoOutro()).toBeNull()
  })

  it('"Nenhum" grava null; "O mesmo" apaga o campo; "Outro" começa vazio (o nome de trabalho some na hora)', () => {
    const props = render()
    act(() => opcao('Nenhum').click())
    expect(props.onPublicNameChange).toHaveBeenLastCalledWith(null)
    act(() => opcao('Outro').click())
    expect(props.onPublicNameChange).toHaveBeenLastCalledWith('')
    render({ publicName: null, onPublicNameChange: props.onPublicNameChange })
    act(() => opcao('O mesmo').click())
    expect(props.onPublicNameChange).toHaveBeenLastCalledWith(undefined)
  })

  it('com "Outro", a caixa aparece com o valor e grava ao sair dela, não a cada tecla', () => {
    const props = render({ publicName: '' })
    expect(opcao('Outro').getAttribute('aria-checked')).toBe('true')
    const caixa = caixaDoOutro()
    if (caixa === null) throw new Error('com "Outro" deveria aparecer a caixa do nome para os jogadores')
    digitar(caixa, 'Estivador')
    expect(props.onPublicNameChange).not.toHaveBeenCalled()
    expect(caixa.value).toBe('Estivador')
    act(() => caixa.focus())
    act(() => caixa.blur())
    expect(props.onPublicNameChange).toHaveBeenCalledTimes(1)
    expect(props.onPublicNameChange).toHaveBeenLastCalledWith('Estivador')
  })

  it('Esc na caixa desiste do que foi digitado', () => {
    const props = render({ publicName: 'Estivador' })
    const caixa = caixaDoOutro()
    if (caixa === null) throw new Error('sem a caixa do "Outro"')
    act(() => caixa.focus())
    digitar(caixa, 'Outra coisa')
    act(() => {
      caixa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(caixa.value).toBe('Estivador')
    act(() => caixa.blur())
    expect(props.onPublicNameChange).not.toHaveBeenCalled()
  })
})
