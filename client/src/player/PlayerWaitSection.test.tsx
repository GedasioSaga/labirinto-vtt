import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerWaitSection, type PlayerWaitSectionProps } from './PlayerWaitSection'

/**
 * ENCONTRO MARCADO na tela do jogador: "Esperar aqui" com quem, onde e até
 * quando; esperando, a frase com o que falta e "Parar de esperar".
 */
describe('PlayerWaitSection', () => {
  let container: HTMLDivElement
  let root: Root
  const T0 = 2_000_000

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function render(props: Partial<PlayerWaitSectionProps> = {}): { onStart: ReturnType<typeof vi.fn>; onStop: ReturnType<typeof vi.fn> } {
    const onStart = vi.fn()
    const onStop = vi.fn()
    act(() => root.render(<PlayerWaitSection wait={undefined} onStart={onStart} onStop={onStop} {...props} />))
    return { onStart, onStop }
  }

  function field(label: string): HTMLInputElement | HTMLSelectElement {
    const found = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === label)
    const id = found?.htmlFor ?? ''
    const el = id === '' ? null : document.getElementById(id)
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) throw new Error(`sem campo "${label}"`)
    return el
  }

  function button(text: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)
    if (!found) throw new Error(`sem botão "${text}"`)
    return found
  }

  /** O React ouve `input`/`change` pelo setter nativo: é assim que se digita num campo controlado. */
  function type(el: HTMLInputElement | HTMLSelectElement, value: string): void {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    act(() => {
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }

  it('cada campo tem rótulo; "Até" oferece os prazos em minutos', () => {
    render()
    expect(field('Por quem').tagName).toBe('INPUT')
    expect(field('Onde').tagName).toBe('INPUT')
    const ate = field('Até')
    expect(ate.tagName).toBe('SELECT')
    expect(Array.from((ate as HTMLSelectElement).options).map((o) => o.textContent)).toEqual(['5 min', '10 min', '15 min', '30 min', '1 hora'])
    expect(ate.value).toBe('15')
  })

  it('"Esperar aqui" leva quem, onde e o prazo escolhido', () => {
    const { onStart } = render()
    type(field('Por quem'), 'Bia')
    type(field('Onde'), 'no portão')
    type(field('Até'), '30')
    act(() => button('Esperar aqui').click())
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(30, 'Bia', 'no portão')
  })

  it('Enter num campo também marca a espera (é um formulário)', () => {
    const { onStart } = render()
    const quem = field('Por quem')
    type(quem, 'Bia')
    const form = quem.closest('form')
    expect(form).not.toBeNull()
    act(() => form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(onStart).toHaveBeenCalledWith(15, 'Bia', '')
  })

  it('esperando: a frase diz quem, onde e quanto falta, e o botão para', () => {
    const { onStop } = render({ wait: { who: 'Bia', where: 'no portão', until: T0 + 12 * 60_000 } })
    const status = container.querySelector('[role="status"]')
    expect(status?.textContent).toBe('Esperando Bia · no portão · faltam 12 min')
    expect(container.querySelector('form')).toBeNull()
    act(() => button('Parar de esperar').click())
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('o que falta anda sozinho com o relógio', () => {
    render({ wait: { who: 'Bia', until: T0 + 2 * 60_000 } })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Esperando Bia · faltam 2 min')
    act(() => {
      vi.advanceTimersByTime(61_000)
    })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Esperando Bia · falta 1 min')
  })
})
