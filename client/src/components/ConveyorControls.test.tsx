import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConveyorControls } from './ConveyorControls'

/**
 * MOVIMENTO IMPOSTO, lado do PAINEL do mestre: com a Sala selecionada, o
 * mestre marca a esteira (direção e passo) e aperta "Avançar esteiras" — o
 * apito que move todas as esteiras da cena. Sem ficha para mover, o botão fica
 * indisponível e diz por quê.
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

function passo(): HTMLSelectElement {
  const rotulo = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Passo (casas)')
  const alvo = rotulo === undefined ? null : document.getElementById(rotulo.htmlFor)
  if (!(alvo instanceof HTMLSelectElement)) throw new Error('o rótulo "Passo (casas)" não aponta para um <select>')
  return alvo
}

describe('ConveyorControls', () => {
  it('sem esteira: só a escolha, com "Nenhuma" marcada, e nada de passo nem de Avançar', () => {
    render(<ConveyorControls direction={null} stepCells={3} canAdvance={false} onChange={() => {}} onAdvance={() => {}} />)
    const grupo = container.querySelector('[role="radiogroup"]')
    expect(grupo?.getAttribute('aria-label')).toBe('Esteira na sala')
    const marcados = [...container.querySelectorAll('[role="radio"][aria-checked="true"]')].map((b) => b.textContent?.trim())
    expect(marcados).toEqual(['Nenhuma'])
    expect([...container.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Avançar esteiras')).toBe(false)
    expect(container.querySelector('select')).toBeNull()
  })

  it('escolher a direção liga a esteira com o passo atual; "Nenhuma" desliga', () => {
    const onChange = vi.fn()
    render(<ConveyorControls direction={null} stepCells={3} canAdvance={false} onChange={onChange} onAdvance={() => {}} />)
    act(() => botao('Leste').click())
    expect(onChange).toHaveBeenLastCalledWith({ direction: 'leste', stepCells: 3 })

    render(<ConveyorControls direction="leste" stepCells={3} canAdvance onChange={onChange} onAdvance={() => {}} />)
    act(() => botao('Nenhuma').click())
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('trocar o passo mantém a direção', () => {
    const onChange = vi.fn()
    render(<ConveyorControls direction="sul" stepCells={3} canAdvance onChange={onChange} onAdvance={() => {}} />)
    expect(passo().value).toBe('3')
    act(() => {
      passo().value = '5'
      passo().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith({ direction: 'sul', stepCells: 5 })
  })

  it('Avançar esteiras chama o apito; sem ficha para mover fica indisponível e diz por quê', () => {
    const onAdvance = vi.fn()
    render(<ConveyorControls direction="leste" stepCells={3} canAdvance onChange={() => {}} onAdvance={onAdvance} />)
    act(() => botao('Avançar esteiras').click())
    expect(onAdvance).toHaveBeenCalledTimes(1)

    render(<ConveyorControls direction="leste" stepCells={3} canAdvance={false} onChange={() => {}} onAdvance={onAdvance} />)
    const parado = botao('Avançar esteiras')
    expect(parado.disabled).toBe(true)
    const dica = document.getElementById(parado.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('Nenhuma ficha em esteira pode andar')
  })
})
