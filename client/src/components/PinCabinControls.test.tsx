import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinCabinControls } from './PinCabinControls'

/**
 * CABINE CONTÍNUA no painel do pino: o mestre escolhe a próxima parada entre
 * os outros pinos da cena e aperta "Avançar esteiras" — o mesmo apito das
 * esteiras. Sem ninguém para levar, o botão fica indisponível e diz por quê.
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

function seletor(): HTMLSelectElement {
  const rotulo = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Cabine contínua: leva a')
  const alvo = rotulo === undefined ? null : document.getElementById(rotulo.htmlFor)
  if (!(alvo instanceof HTMLSelectElement)) throw new Error('o rótulo da cabine não aponta para um <select>')
  return alvo
}

function botao(nome: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === nome)
  if (!achado) throw new Error(`sem o botão "${nome}"`)
  return achado
}

const PARADAS = [
  { id: 'p2', label: 'Cabine do sótão' },
  { id: 'p3', label: 'Pino na coluna 5, linha 5' },
]

describe('PinCabinControls', () => {
  it('lista "Nenhuma" e as outras paradas; escolher chama onChange com o id, "Nenhuma" com null', () => {
    const onChange = vi.fn()
    render(<PinCabinControls target={null} targets={PARADAS} canAdvance={false} onChange={onChange} onAdvance={vi.fn()} />)
    expect([...seletor().options].map((o) => o.textContent)).toEqual(['Nenhuma', 'Cabine do sótão', 'Pino na coluna 5, linha 5'])
    expect(seletor().value).toBe('')
    act(() => {
      seletor().value = 'p3'
      seletor().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith('p3')

    render(<PinCabinControls target="p3" targets={PARADAS} canAdvance={false} onChange={onChange} onAdvance={vi.fn()} />)
    act(() => {
      seletor().value = ''
      seletor().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('sem cabine ligada, o botão de avançar não aparece', () => {
    render(<PinCabinControls target={null} targets={PARADAS} canAdvance onChange={vi.fn()} onAdvance={vi.fn()} />)
    expect([...container.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual([])
  })

  it('ligada: "Avançar esteiras" dispara o apito; sem ninguém para levar, fica indisponível e diz por quê', () => {
    const onAdvance = vi.fn()
    render(<PinCabinControls target="p2" targets={PARADAS} canAdvance onChange={vi.fn()} onAdvance={onAdvance} />)
    expect(seletor().value).toBe('p2')
    act(() => botao('Avançar esteiras').click())
    expect(onAdvance).toHaveBeenCalledTimes(1)

    render(<PinCabinControls target="p2" targets={PARADAS} canAdvance={false} onChange={vi.fn()} onAdvance={onAdvance} />)
    expect(botao('Avançar esteiras').disabled).toBe(true)
    const dica = document.getElementById(botao('Avançar esteiras').getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('Ninguém parado em cabine ou esteira pode andar agora.')
  })

  it('cena sem outro pino: explica que falta a segunda parada', () => {
    render(<PinCabinControls target={null} targets={[]} canAdvance={false} onChange={vi.fn()} onAdvance={vi.fn()} />)
    expect(seletor().disabled).toBe(true)
    expect(container.textContent).toContain('Crave outro pino nesta cena para ser a próxima parada.')
  })
})
