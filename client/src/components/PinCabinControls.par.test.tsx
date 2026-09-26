import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinCabinControls } from './PinCabinControls'

/**
 * CABINE CONTÍNUA no pino de VIAGEM: as paradas são os pares (um por saída
 * ligada), e o pino ainda sem par diz o que falta — ligar a outra cena —, não
 * "crave outro pino nesta cena", que no pino de viagem não adianta.
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

const LIGUE = 'Ligue este pino a um par em outra cena para a cabine levar até lá.'

describe('PinCabinControls no pino de viagem', () => {
  it('sem par, diz o que falta e trava a escolha', () => {
    act(() => root.render(<PinCabinControls target={null} targets={[]} emptyHint={LIGUE} canAdvance={false} onChange={vi.fn()} onAdvance={vi.fn()} />))
    expect(container.textContent).toContain(LIGUE)
    expect(container.textContent).not.toContain('Crave outro pino')
    expect(container.querySelector('select')?.disabled).toBe(true)
  })

  it('com o par, o mestre liga a cabine a ele', () => {
    const onChange = vi.fn()
    act(() =>
      root.render(
        <PinCabinControls target={null} targets={[{ id: 'poco-porao', label: 'Par em Porão' }]} emptyHint={LIGUE} canAdvance={false} onChange={onChange} onAdvance={vi.fn()} />,
      ),
    )
    const select = container.querySelector('select')
    if (select === null) throw new Error('sem o <select> da cabine')
    expect([...select.options].map((o) => o.textContent)).toEqual(['Nenhuma', 'Par em Porão'])
    act(() => {
      select.value = 'poco-porao'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('poco-porao')
  })
})
