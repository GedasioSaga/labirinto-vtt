import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemTransformControls, OCULTO_NO_EDITOR_HINT, ROTACAO_DA_FICHA_HINT, type ItemTransformControlsProps } from './ItemTransformControls'

/**
 * Travar, girar e esconder o item selecionado. Por padrão (Objeto, Sala,
 * Região) tudo à vista, como sempre. No modo "raros no Avançado", que só a
 * ficha liga, Travado e "Oculto para jogadores" ficam à vista e Rotação e
 * "Oculto no editor" vão para um Avançado recolhido no fim da mesma seção.
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

function render(extra: Partial<ItemTransformControlsProps> = {}) {
  const props: ItemTransformControlsProps = {
    title: 'Token',
    rotation: 0,
    onRotationChange: vi.fn(),
    locked: false,
    onLockedChange: vi.fn(),
    hidden: false,
    onHiddenChange: vi.fn(),
    secret: false,
    onSecretChange: vi.fn(),
    ...extra,
  }
  act(() => root.render(<ItemTransformControls {...props} />))
  return props
}

const texto = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
const interruptor = (rotulo: string) => Array.from(container.querySelectorAll('label.lb-switch')).find((l) => texto(l) === rotulo) ?? null
const caixa = (rotulo: string) => interruptor(rotulo)?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
const rotacao = () => {
  const label = Array.from(container.querySelectorAll('label')).find((l) => texto(l) === 'Rotação')
  return label === undefined ? null : (document.getElementById(label.htmlFor) as HTMLInputElement | null)
}
const avancado = () => container.querySelector<HTMLButtonElement>('h3 > button')
const recolhido = () => document.getElementById(avancado()?.getAttribute('aria-controls') ?? 'sem-id')

function digitar(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('ItemTransformControls', () => {
  it('padrão (Objeto): Rotação, Travado, "Oculto no editor" e "Oculto para jogadores" à vista, sem Avançado', () => {
    render({ title: 'Objeto' })
    expect(rotacao()).not.toBeNull()
    expect(Array.from(container.querySelectorAll('label.lb-switch')).map(texto)).toEqual(['Travado', 'Oculto no editor', 'Oculto para jogadores'])
    expect(avancado()).toBeNull()
    expect(container.querySelector('[hidden]')).toBeNull()
  })

  it('raros no Avançado: Travado e "Oculto para jogadores" à vista; Rotação e "Oculto no editor" no Avançado fechado', () => {
    render({ rarosNoAvancado: true })
    const secao = container.querySelector('section')
    const aVista = Array.from(secao?.querySelectorAll(':scope > label.lb-switch') ?? []).map(texto)
    expect(aVista).toEqual(['Travado', 'Oculto para jogadores'])
    expect(texto(avancado())).toBe('Avançado')
    expect(avancado()?.getAttribute('aria-expanded')).toBe('false')
    expect(recolhido()?.hidden).toBe(true)
    expect(recolhido()?.contains(rotacao())).toBe(true)
    expect(recolhido()?.contains(interruptor('Oculto no editor'))).toBe(true)
    // O Avançado é a última linha da própria seção, depois dos interruptores à vista.
    expect(secao?.lastElementChild?.contains(avancado())).toBe(true)
  })

  it('abrir o Avançado mostra os dois raros, e eles gravam como antes', () => {
    const props = render({ rarosNoAvancado: true })
    act(() => avancado()?.click())
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
    expect(recolhido()?.hidden).toBe(false)
    const campo = rotacao()
    if (campo === null) throw new Error('sem o campo Rotação')
    digitar(campo, '45')
    expect(props.onRotationChange).toHaveBeenCalledWith(45)
    act(() => caixa('Oculto no editor')?.click())
    expect(props.onHiddenChange).toHaveBeenCalledWith(true)
  })

  it('cada raro diz o que faz, ligado ao controle por aria-describedby', () => {
    render({ rarosNoAvancado: true })
    // A frase existe no DOM (a dica sob demanda a mostra ao pairar ou focar) e
    // diz o efeito na ficha: sem as duas checagens de existência, frase ausente
    // e constante ausente passariam juntas como `undefined`.
    const dicaDaRotacao = document.getElementById(rotacao()?.getAttribute('aria-describedby') ?? 'sem-id')
    expect(dicaDaRotacao, 'a Rotação sem frase ligada').not.toBeNull()
    expect(dicaDaRotacao?.textContent).toBe(ROTACAO_DA_FICHA_HINT)
    expect(ROTACAO_DA_FICHA_HINT).toMatch(/foto/)
    const dicaDoOculto = document.getElementById(caixa('Oculto no editor')?.getAttribute('aria-describedby') ?? 'sem-id')
    expect(dicaDoOculto, '"Oculto no editor" sem frase ligada').not.toBeNull()
    expect(dicaDoOculto?.textContent).toBe(OCULTO_NO_EDITOR_HINT)
    expect(OCULTO_NO_EDITOR_HINT).toMatch(/editor/)
  })

  it('ficha girada ou oculta no editor: o Avançado nasce aberto (o que está na ficha não se esconde)', () => {
    render({ rarosNoAvancado: true, rotation: 90 })
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
    act(() => root.unmount())
    root = createRoot(container)
    render({ rarosNoAvancado: true, hidden: true })
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
  })

  it('desligar o raro com o Avançado aberto não o recolhe debaixo do ponteiro', () => {
    render({ rarosNoAvancado: true, hidden: true })
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
    render({ rarosNoAvancado: true, hidden: false })
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
  })

  it('um raro que volta com o Avançado fechado (Ctrl+Z) abre o Avançado', () => {
    render({ rarosNoAvancado: true })
    expect(avancado()?.getAttribute('aria-expanded')).toBe('false')
    render({ rarosNoAvancado: true, rotation: 180 })
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
  })

  it('sem rotação nem "Oculto no editor" no item (Região), o modo não deixa um Avançado vazio', () => {
    render({ rarosNoAvancado: true, rotation: undefined, onRotationChange: undefined, hidden: undefined, onHiddenChange: undefined })
    expect(avancado()).toBeNull()
    expect(interruptor('Travado')).not.toBeNull()
  })
})
