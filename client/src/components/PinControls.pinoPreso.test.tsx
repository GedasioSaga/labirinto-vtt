import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls, type PinControlsProps } from './PinControls'

/**
 * PINO PRESO A UMA FICHA, lado do PAINEL do mestre: no pino de viagem aberto,
 * "Preso à ficha" escolhe a ficha que ele acompanha (navio, carroça, elevador)
 * ou "Nenhuma". Pino "!"/"?" não oferece a escolha.
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

function base(extra: Partial<PinControlsProps>): PinControlsProps {
  return {
    kind: 'viagem',
    onKindChange: () => {},
    description: '',
    onDescriptionChange: () => {},
    locked: false,
    onLockedChange: () => {},
    marco: false,
    onMarcoChange: () => {},
    lerDePerto: null,
    onLerDePertoChange: () => {},
    image: null,
    onChooseImage: () => {},
    onClearImage: () => {},
    onDelete: () => {},
    ...extra,
  }
}

function render(props: PinControlsProps) {
  act(() => root.render(<PinControls {...props} />))
}

function campo(): HTMLSelectElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Preso à ficha')
  if (!label) throw new Error('sem o rótulo "Preso à ficha"')
  const alvo = document.getElementById(label.htmlFor)
  if (!(alvo instanceof HTMLSelectElement)) throw new Error('o rótulo não aponta para uma lista')
  return alvo
}

function escolher(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const OPCOES = [
  { id: 'navio', label: 'Navio Negro' },
  { id: 'carroca', label: 'Carroça' },
]

describe('PinControls: preso à ficha', () => {
  it('lista "Nenhuma" e as fichas do mapa, com a atual escolhida', () => {
    render(base({ attachment: { value: 'carroca', options: OPCOES, onChange: () => {} } }))
    const select = campo()
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'Nenhuma (fica parado)'],
      ['navio', 'Navio Negro'],
      ['carroca', 'Carroça'],
    ])
    expect(select.value).toBe('carroca')
    expect(container.textContent).toContain('anda junto')
  })

  it('escolher uma ficha prende; escolher "Nenhuma" solta', () => {
    const onChange = vi.fn()
    render(base({ attachment: { value: null, options: OPCOES, onChange } }))
    escolher(campo(), 'navio')
    expect(onChange).toHaveBeenLastCalledWith('navio')
    escolher(campo(), '')
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('ficha que sumiu do mapa aparece como "Nenhuma", sem opção fantasma', () => {
    render(base({ attachment: { value: 'navio-que-partiu', options: OPCOES, onChange: () => {} } }))
    const select = campo()
    expect(select.value).toBe('')
    expect(select.options.length).toBe(3)
  })

  it('mapa sem ficha: a lista fica indisponível e diz o que falta', () => {
    render(base({ attachment: { value: null, options: [], onChange: () => {} } }))
    expect(campo().disabled).toBe(true)
    expect(container.textContent).toContain('Ponha uma ficha no mapa')
  })

  it('pino "!" não oferece a escolha', () => {
    render(base({ kind: 'exclamacao', attachment: null }))
    expect([...container.querySelectorAll('label')].some((l) => l.textContent?.trim() === 'Preso à ficha')).toBe(false)
  })
})
