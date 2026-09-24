/**
 * RELÓGIO DA CAMPANHA na aba Jogo: o mestre lê a hora e o período, avança por
 * botão (+1 hora ou até o próximo período) e marca a cena aberta como externa.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignClockSection, type CampaignClockSectionProps } from './CampaignClockSection'

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

function props(patch: Partial<CampaignClockSectionProps> = {}): CampaignClockSectionProps {
  return { hour: 8, outdoor: false, onAdvanceHour: vi.fn(), onNextPeriod: vi.fn(), onOutdoorChange: vi.fn(), ...patch }
}

function botao(texto: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent === texto)
  if (found === undefined) throw new Error(`sem botão "${texto}"`)
  return found
}

function interruptorExterna(): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Cena externa'))
  const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (input === null || input === undefined) throw new Error('sem interruptor de cena externa')
  return input
}

describe('CampaignClockSection', () => {
  it('mostra a hora e o período', () => {
    act(() => root.render(<CampaignClockSection {...props({ hour: 8 })} />))
    expect(container.querySelector('.lb-clock__hour')?.textContent).toBe('08:00')
    expect(container.querySelector('.lb-clock__period')?.textContent).toBe('Manhã')
    act(() => root.render(<CampaignClockSection {...props({ hour: 21 })} />))
    expect(container.querySelector('.lb-clock__hour')?.textContent).toBe('21:00')
    expect(container.querySelector('.lb-clock__period')?.textContent).toBe('Noite')
  })

  it('"+1 hora" e "Próximo período" avisam quem guarda o relógio', () => {
    const p = props()
    act(() => root.render(<CampaignClockSection {...p} />))
    act(() => botao('+1 hora').click())
    act(() => botao('Próximo período').click())
    expect(p.onAdvanceHour).toHaveBeenCalledTimes(1)
    expect(p.onNextPeriod).toHaveBeenCalledTimes(1)
  })

  it('marca a cena aberta como externa, e a dica diz o que muda para os jogadores', () => {
    const p = props()
    act(() => root.render(<CampaignClockSection {...p} />))
    const input = interruptorExterna()
    expect(input.checked).toBe(false)
    const hintId = input.getAttribute('aria-describedby')
    expect(hintId).not.toBeNull()
    expect(document.getElementById(hintId ?? '')?.textContent).toContain('enxergam menos')
    act(() => input.click())
    expect(p.onOutdoorChange).toHaveBeenCalledWith(true)
  })

  it('cena externa à noite: o mestre lê que ela está escura agora', () => {
    act(() => root.render(<CampaignClockSection {...props({ hour: 22, outdoor: true })} />))
    expect(interruptorExterna().checked).toBe(true)
    expect(container.querySelector('.lb-clock__dark')?.textContent).toBe('Esta cena está escura agora.')
    act(() => root.render(<CampaignClockSection {...props({ hour: 10, outdoor: true })} />))
    expect(container.querySelector('.lb-clock__dark')).toBeNull()
  })
})
