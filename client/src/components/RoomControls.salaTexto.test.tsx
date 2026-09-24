import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * TEXTO DA SALA, lado do mestre: "Ao entrar, o jogador lê" e "Nota do mestre"
 * no painel da Sala. A nota diz, no próprio painel, que nunca sai para o jogador.
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

function render(overrides: Partial<RoomControlsProps> = {}) {
  const props: RoomControlsProps = {
    name: 'Cozinha',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 128,
    height: 128,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    textoAoEntrar: '',
    notaDoMestre: '',
    onTextoAoEntrarChange: vi.fn(),
    onNotaDoMestreChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
  return props
}

/** O campo pelo rótulo que o mestre lê. */
function campo(rotulo: string): HTMLTextAreaElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
  const alvo = label ? document.getElementById(label.htmlFor) : null
  if (!(alvo instanceof HTMLTextAreaElement)) throw new Error(`o painel da sala não tem o campo "${rotulo}"`)
  return alvo
}

function digitar(alvo: HTMLTextAreaElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  act(() => {
    setter?.call(alvo, valor)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('RoomControls: texto ao entrar e nota do mestre', () => {
  it('mostra o que está gravado nos dois campos', () => {
    render({ textoAoEntrar: 'Cheiro de pão.', notaDoMestre: 'Mímico na panela.' })
    expect(campo('Ao entrar, o jogador lê').value).toBe('Cheiro de pão.')
    expect(campo('Nota do mestre').value).toBe('Mímico na panela.')
  })

  it('digitar em cada campo avisa o callback dele, e só o dele', () => {
    const props = render()
    digitar(campo('Ao entrar, o jogador lê'), 'Cheiro de pão.')
    expect(props.onTextoAoEntrarChange).toHaveBeenLastCalledWith('Cheiro de pão.')
    expect(props.onNotaDoMestreChange).not.toHaveBeenCalled()
    digitar(campo('Nota do mestre'), 'Mímico.')
    expect(props.onNotaDoMestreChange).toHaveBeenLastCalledWith('Mímico.')
  })

  it('a nota diz que nunca sai para o jogador, ligada ao campo', () => {
    render()
    const nota = campo('Nota do mestre')
    const dica = document.getElementById(nota.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toMatch(/nunca/i)
  })

  it('sem os callbacks, os campos não aparecem', () => {
    render({ onTextoAoEntrarChange: undefined, onNotaDoMestreChange: undefined })
    expect(container.querySelector('textarea')).toBeNull()
  })
})
