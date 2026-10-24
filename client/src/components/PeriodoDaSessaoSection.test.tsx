/**
 * DIA/TARDE/NOITE no painel do mestre: três rádios de botão com o período da
 * sessão marcado, a marca de cena externa da cena aberta e a frase do que ela
 * mostra agora (externa segue, fixa fica, interior fica de dia).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PeriodoDaSessaoSection, type PeriodoDaSessaoSectionProps } from './PeriodoDaSessaoSection'
import { useTintaNoEditor } from '../stores/tintaNoEditor'

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

function render(props: Partial<PeriodoDaSessaoSectionProps> = {}) {
  const onPeriodoChange = vi.fn()
  const onExternaChange = vi.fn()
  act(() => root.render(<PeriodoDaSessaoSection periodo="dia" externa={false} onPeriodoChange={onPeriodoChange} onExternaChange={onExternaChange} {...props} />))
  return { onPeriodoChange, onExternaChange }
}

function radios(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]'))
}

function estado(): string {
  return container.querySelector('[role="status"]')?.textContent ?? ''
}

describe('PeriodoDaSessaoSection', () => {
  it('três botões em português, com o período da sessão marcado', () => {
    render({ periodo: 'tarde' })
    expect(radios().map((r) => r.textContent)).toEqual(['Dia', 'Tarde', 'Noite'])
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-labelledby')).toBe(container.querySelector('h3')?.id)
  })

  it('apertar Noite pede a troca', () => {
    const { onPeriodoChange } = render()
    act(() => radios()[2]?.click())
    expect(onPeriodoChange).toHaveBeenCalledWith('noite')
  })

  it('a marca de cena externa liga e desliga', () => {
    const { onExternaChange } = render()
    const marca = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    act(() => marca?.click())
    expect(onExternaChange).toHaveBeenCalledWith(true)
  })

  it('"Ver como jogador" (Luz L4b) liga a tinta cheia no editor e desliga de novo', () => {
    useTintaNoEditor.setState({ comoJogador: false })
    render()
    const marcas = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    const ver = marcas.find((m) => m.closest('label')?.textContent?.includes('Ver como jogador'))
    expect(ver?.checked).toBe(false)
    act(() => ver?.click())
    expect(useTintaNoEditor.getState().comoJogador).toBe(true)
    expect(ver?.checked).toBe(true)
    act(() => ver?.click())
    expect(useTintaNoEditor.getState().comoJogador).toBe(false)
  })

  it('a frase diz o que a cena aberta mostra agora', () => {
    render({ periodo: 'noite', externa: false })
    expect(estado()).toBe('Esta cena é interior: fica sempre de dia.')
    render({ periodo: 'noite', externa: true })
    expect(estado()).toBe('Esta cena segue o período: agora está à noite.')
    render({ periodo: 'noite', externa: true, periodoFixo: 'tarde' })
    expect(estado()).toBe('Esta cena fica sempre à tarde.')
  })
})
