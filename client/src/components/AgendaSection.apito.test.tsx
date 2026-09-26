/**
 * O APITO DO MESTRE move o movimento imposto: "Próximo apito" da Agenda é a
 * unidade de tempo da mesa, e as esteiras e as cabines andam uma vez a cada
 * apito (o mesmo Avançar do botão "Avançar esteiras"). "Próximo dia" pula
 * para a Aurora seguinte: não é um apito, então não move ninguém.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgendaDaCampanha } from '../lib/agendaDaCampanha'
import { useToastStore } from '../stores/toastStore'
import { AgendaSection } from './AgendaSection'

describe('AgendaSection — o apito move as esteiras', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    for (const toast of useToastStore.getState().toasts) useToastStore.getState().dismiss(toast.id)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(onApito: (() => void) | undefined): { agenda: () => AgendaDaCampanha } {
    let agenda: AgendaDaCampanha = { agora: { dia: 1, apito: 'aurora' }, eventos: [] }
    const desenhar = () =>
      root.render(
        <AgendaSection
          agenda={agenda}
          onChange={(nova) => {
            agenda = nova
            desenhar()
          }}
          onApito={onApito}
        />,
      )
    act(() => desenhar())
    return { agenda: () => agenda }
  }

  function clica(nome: string): void {
    const botao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === nome)
    if (botao === undefined) throw new Error(`sem botão "${nome}"`)
    act(() => botao.click())
  }

  it('cada "Próximo apito" avança a hora E dispara um Avançar', () => {
    const onApito = vi.fn()
    const { agenda } = render(onApito)
    clica('Próximo apito')
    expect(onApito).toHaveBeenCalledTimes(1)
    expect(agenda().agora).not.toEqual({ dia: 1, apito: 'aurora' })
    clica('Próximo apito')
    expect(onApito).toHaveBeenCalledTimes(2)
  })

  it('"Próximo dia" não é um apito: a hora anda, as esteiras não', () => {
    const onApito = vi.fn()
    const { agenda } = render(onApito)
    clica('Próximo dia')
    expect(onApito).not.toHaveBeenCalled()
    expect(agenda().agora).toEqual({ dia: 2, apito: 'aurora' })
  })

  it('sem quem mova as esteiras, o apito continua só andando a hora', () => {
    const { agenda } = render(undefined)
    clica('Próximo apito')
    expect(agenda().agora.dia).toBe(1)
    expect(agenda().agora.apito).not.toBe('aurora')
  })
})
