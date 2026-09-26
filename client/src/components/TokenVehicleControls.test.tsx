import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VEHICLE_SEATS_DEFAULT, VEHICLE_SEATS_MAX, type VehicleSeatOption } from '../lib/vehicle'
import { TokenVehicleControls } from './TokenVehicleControls'

/**
 * VEÍCULO COM LUGARES, lado do PAINEL do mestre: um interruptor faz da ficha
 * um veículo; ligado, os lugares (menos/mais) e a lista das fichas da cena,
 * uma caixa por ficha, "a bordo" marcado. Cheio, quem está fora fica
 * indisponível e o painel diz por quê.
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

function interruptor(): HTMLInputElement {
  const achado = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Esta ficha é um veículo'))?.querySelector('input')
  if (!(achado instanceof HTMLInputElement)) throw new Error('sem o interruptor do veículo')
  return achado
}

function botao(nome: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === nome)
  if (!(achado instanceof HTMLButtonElement)) throw new Error(`sem o botão ${nome}`)
  return achado
}

function caixa(nome: string): HTMLInputElement {
  const achado = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim().startsWith(nome))?.querySelector('input[type="checkbox"]')
  if (!(achado instanceof HTMLInputElement)) throw new Error(`sem a caixa de ${nome}`)
  return achado
}

const CHEIO: VehicleSeatOption[] = [
  { id: 'gui', nome: 'Gui', aBordo: true, disponivel: true },
  { id: 'bia', nome: 'Bia', aBordo: true, disponivel: true },
  { id: 'caio', nome: 'Caio', aBordo: false, disponivel: false },
]

describe('TokenVehicleControls', () => {
  it('ficha comum: só o interruptor, desligado; ligar pede os lugares de fábrica', () => {
    const onSeatsChange = vi.fn()
    render(<TokenVehicleControls vehicle={null} options={CHEIO} onSeatsChange={onSeatsChange} onPassengerChange={vi.fn()} />)
    expect(interruptor().checked).toBe(false)
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
    act(() => interruptor().click())
    expect(onSeatsChange).toHaveBeenCalledWith(VEHICLE_SEATS_DEFAULT)
  })

  it('cheio: Gui e Bia marcados, Caio indisponível com o motivo à vista', () => {
    render(<TokenVehicleControls vehicle={{ lugares: 2, passageiros: ['gui', 'bia'] }} options={CHEIO} onSeatsChange={vi.fn()} onPassengerChange={vi.fn()} />)
    expect(caixa('Gui').checked).toBe(true)
    expect(caixa('Bia').checked).toBe(true)
    expect(caixa('Caio').checked).toBe(false)
    expect(caixa('Caio').disabled).toBe(true)
    expect(caixa('Gui').disabled).toBe(false)
    expect(container.textContent).toContain('Cheio: 2 de 2 lugares ocupados.')
  })

  it('marcar e desmarcar pedem o embarque e a descida daquela ficha', () => {
    const onPassengerChange = vi.fn()
    const options: VehicleSeatOption[] = [
      { id: 'gui', nome: 'Gui', aBordo: true, disponivel: true },
      { id: 'caio', nome: 'Caio', aBordo: false, disponivel: true },
    ]
    render(<TokenVehicleControls vehicle={{ lugares: 2, passageiros: ['gui'] }} options={options} onSeatsChange={vi.fn()} onPassengerChange={onPassengerChange} />)
    act(() => caixa('Caio').click())
    act(() => caixa('Gui').click())
    expect(onPassengerChange.mock.calls).toEqual([
      ['caio', true],
      ['gui', false],
    ])
    expect(container.textContent).toContain('1 de 2 lugares ocupados.')
  })

  it('mais e menos mudam os lugares; menos para em quem está a bordo e mais no teto', () => {
    const onSeatsChange = vi.fn()
    render(<TokenVehicleControls vehicle={{ lugares: 2, passageiros: ['gui', 'bia'] }} options={CHEIO} onSeatsChange={onSeatsChange} onPassengerChange={vi.fn()} />)
    expect(botao('Menos um lugar').disabled).toBe(true)
    act(() => botao('Mais um lugar').click())
    expect(onSeatsChange).toHaveBeenCalledWith(3)

    render(<TokenVehicleControls vehicle={{ lugares: VEHICLE_SEATS_MAX }} options={[]} onSeatsChange={onSeatsChange} onPassengerChange={vi.fn()} />)
    expect(botao('Mais um lugar').disabled).toBe(true)
    act(() => botao('Menos um lugar').click())
    expect(onSeatsChange).toHaveBeenLastCalledWith(VEHICLE_SEATS_MAX - 1)
  })

  it('desligar pede null; sem outras fichas na cena, diz que não há quem embarcar', () => {
    const onSeatsChange = vi.fn()
    render(<TokenVehicleControls vehicle={{ lugares: 2 }} options={[]} onSeatsChange={onSeatsChange} onPassengerChange={vi.fn()} />)
    expect(container.textContent).toContain('Nenhuma outra ficha nesta cena para embarcar.')
    act(() => interruptor().click())
    expect(onSeatsChange).toHaveBeenCalledWith(null)
  })
})
