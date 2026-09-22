import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * GIRAR SALA, lado do PAINEL: o campo "Rotação" (graus, Enter confirma) e os
 * botões −90°/+90°. O campo não gira a cada tecla — digitar "90" não pode
 * passar por 9° e deixar dois Ctrl+Z para um giro só.
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
    name: 'Cripta',
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

/** O campo pelo rótulo que o usuário lê, como a jornada procura. */
function campoRotacao(): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Rotação')
  // Por id e não por seletor: o id do useId() tem caractere que o CSS não aceita sem escapar.
  const input = label ? document.getElementById(label.htmlFor) : null
  if (!(input instanceof HTMLInputElement)) throw new Error('o painel da sala não tem o campo "Rotação"')
  return input
}

function botao(texto: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.textContent === texto)
  if (!achado) throw new Error(`o painel não tem o botão "${texto}"`)
  return achado
}

/** Digita como o React vê: muda o valor pelo setter nativo e dispara `input`. */
function digitar(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function tecla(input: HTMLInputElement, key: string, shiftKey = false) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
  })
}

describe('RoomControls — Rotação', () => {
  it('mostra o ângulo da sala, e os botões −90° e +90°', () => {
    render({ rotation: -37.5 })
    expect(campoRotacao().value).toBe('-37.5')
    expect(botao('−90°')).toBeDefined()
    expect(botao('+90°')).toBeDefined()
  })

  it('digitar não gira; Enter gira UMA vez, com o número digitado', () => {
    const props = render()
    const campo = campoRotacao()
    digitar(campo, '9')
    digitar(campo, '90')
    expect(props.onRotationChange).not.toHaveBeenCalled()
    tecla(campo, 'Enter')
    expect(props.onRotationChange).toHaveBeenCalledTimes(1)
    expect(props.onRotationChange).toHaveBeenCalledWith(90)
  })

  it('sair do campo confirma como o Enter; campo vazio ou lixo não gira', () => {
    const props = render()
    const campo = campoRotacao()
    digitar(campo, '45')
    act(() => campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(props.onRotationChange).toHaveBeenCalledWith(45)
    digitar(campo, '')
    tecla(campo, 'Enter')
    expect(props.onRotationChange).toHaveBeenCalledTimes(1)
  })

  it('Esc desiste do que foi digitado, volta ao ângulo da sala e não deixa o Esc largar a seleção', () => {
    const props = render({ rotation: 30 })
    const campo = campoRotacao()
    digitar(campo, '120')
    const aoWindow = vi.fn()
    window.addEventListener('keydown', aoWindow)
    tecla(campo, 'Escape')
    window.removeEventListener('keydown', aoWindow)
    expect(campo.value).toBe('30')
    expect(props.onRotationChange).not.toHaveBeenCalled()
    expect(aoWindow).not.toHaveBeenCalled()
  })

  it('trocar de sala pelo mapa com número digitado e não confirmado: o número vai para a sala DO CAMPO', () => {
    // O painel remonta a cada sala (`key` em PropertiesPanel). O clique no mapa
    // seleciona a outra antes de o campo perder o foco — sem isto o `blur`
    // confirmaria o número na sala recém-escolhida.
    const daCasa = vi.fn()
    const doQuarto = vi.fn()
    const base: RoomControlsProps = {
      name: 'Casa', onNameChange: vi.fn(), shape: 'rect', axisAligned: true, width: 128, height: 384,
      onWidthChange: vi.fn(), onHeightChange: vi.fn(), rotation: 0, onRotateBy: vi.fn(), locked: false,
      onRotationChange: daCasa,
    }
    act(() => root.render(<RoomControls key="casa" {...base} />))
    digitar(campoRotacao(), '45')
    act(() => root.render(<RoomControls key="quarto" {...base} name="Quarto" onRotationChange={doQuarto} />))
    expect(daCasa).toHaveBeenCalledWith(45)
    expect(doQuarto).not.toHaveBeenCalled()
    // E o campo novo nasce mostrando o ângulo da sala nova, sem o número pendente.
    expect(campoRotacao().value).toBe('0')
  })

  it('seta para cima/baixo gira 1° na hora; com Shift, 15° (a trava da alça)', () => {
    const props = render({ rotation: 30 })
    const campo = campoRotacao()
    tecla(campo, 'ArrowUp')
    expect(props.onRotationChange).toHaveBeenLastCalledWith(31)
    tecla(campo, 'ArrowDown', true)
    expect(props.onRotationChange).toHaveBeenLastCalledWith(15)
  })

  it('−90° e +90° giram um quarto de volta para cada lado', () => {
    const props = render()
    act(() => botao('+90°').click())
    act(() => botao('−90°').click())
    expect(props.onRotateBy).toHaveBeenNthCalledWith(1, 90)
    expect(props.onRotateBy).toHaveBeenNthCalledWith(2, -90)
  })

  it('sala travada: campo e botões desabilitados, com o motivo escrito e ligado ao campo', () => {
    render({ locked: true })
    const campo = campoRotacao()
    expect(campo.disabled).toBe(true)
    expect(botao('+90°').disabled).toBe(true)
    expect(botao('−90°').disabled).toBe(true)
    const motivo = document.getElementById(campo.getAttribute('aria-describedby') ?? '')
    expect(motivo?.textContent).toContain('Sala travada')
  })

  it('sala retangular torta: some largura/altura, e a frase diz como tê-las de volta', () => {
    render({ axisAligned: false, rotation: 37 })
    expect(container.querySelector('#lb-room-width')).toBeNull()
    expect(container.querySelector('#lb-room-height')).toBeNull()
    const nota = document.getElementById(campoRotacao().getAttribute('aria-describedby') ?? '')
    expect(nota?.textContent).toContain('Largura e altura voltam')
  })

  it('sala reta: largura e altura continuam, sem frase de sala torta', () => {
    render()
    expect(container.querySelector('#lb-room-width')).not.toBeNull()
    expect(container.textContent).not.toContain('Largura e altura voltam')
  })

  it('sala circular: nunca teve largura/altura, e não ganha a frase de sala torta', () => {
    render({ shape: 'polygon', axisAligned: false })
    expect(container.querySelector('#lb-room-width')).toBeNull()
    expect(container.textContent).not.toContain('Largura e altura voltam')
    expect(campoRotacao()).toBeDefined()
  })
})
