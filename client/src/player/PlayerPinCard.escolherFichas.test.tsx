import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * ESCOLHER FICHAS NO PINO no cartão: com duas ou mais fichas do jogador junto
 * do pino, a pergunta de confirmar ganha "Quem passa?" com uma caixa por
 * ficha, todas marcadas (é o grupo que já passaria). O pedido leva as
 * marcadas; nenhuma marcada, o botão de pedir desliga. Com uma ficha só, o
 * cartão é o de sempre.
 */

const ESCOTILHA: Pin = { id: 'escotilha', x: 200, y: 100, kind: 'viagem', description: 'Escotilha', image: null }
const DUAS = [
  { id: 'enzo', name: 'Enzo' },
  { id: 'rufo', name: 'Rufo' },
]

type Props = Parameters<typeof PlayerPinCard>[0]

describe('PlayerPinCard: "Quem passa?"', () => {
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

  function abre(extra: Partial<Props> = {}) {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={ESCOTILHA} onClose={() => {}} stairs={[]} onRequestTravel={onRequestTravel} {...extra} />))
    const botao = (texto: string): HTMLButtonElement => {
      const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)
      if (achado === undefined) throw new Error(`sem o botão "${texto}"`)
      return achado
    }
    const caixas = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    return { onRequestTravel, botao, caixas }
  }

  it('duas fichas: a pergunta mostra "Quem passa?" com as duas marcadas, e o pedido leva as duas', () => {
    const t = abre({ travelers: DUAS })
    // Antes de pedir, nada de caixa: a escolha é parte da confirmação.
    expect(t.caixas()).toHaveLength(0)
    act(() => t.botao('Pedir para passar').click())
    const grupo = container.querySelector('fieldset')
    expect(grupo?.querySelector('legend')?.textContent).toBe('Quem passa?')
    expect(t.caixas().map((c) => [c.labels?.[0]?.textContent, c.checked])).toEqual([
      ['Enzo', true],
      ['Rufo', true],
    ])
    act(() => t.botao('Pedir').click())
    expect(t.onRequestTravel).toHaveBeenCalledWith(undefined, ['enzo', 'rufo'])
  })

  it('desmarcar Enzo manda só o Rufo', () => {
    const t = abre({ travelers: DUAS })
    act(() => t.botao('Pedir para passar').click())
    act(() => t.caixas()[0]?.click())
    act(() => t.botao('Pedir').click())
    expect(t.onRequestTravel).toHaveBeenCalledWith(undefined, ['rufo'])
  })

  it('nenhuma marcada: "Pedir" desliga e nada sai', () => {
    const t = abre({ travelers: DUAS })
    act(() => t.botao('Pedir para passar').click())
    for (const caixa of t.caixas()) act(() => caixa.click())
    expect(t.botao('Pedir').disabled).toBe(true)
    act(() => t.botao('Pedir').click())
    expect(t.onRequestTravel).not.toHaveBeenCalled()
  })

  it('encruzilhada: a saída e as fichas vão juntas', () => {
    const t = abre({
      pin: { ...ESCOTILHA, escolhas: [{ id: 'beiral', rotulo: 'Beiral' }, { id: 'porao', rotulo: 'Porão' }] },
      travelers: DUAS,
    })
    act(() => t.botao('Beiral').click())
    act(() => t.caixas()[1]?.click())
    act(() => t.botao('Pedir').click())
    expect(t.onRequestTravel).toHaveBeenCalledWith('beiral', ['enzo'])
  })

  it('uma ficha só (ou nenhuma lista): cartão de sempre, sem caixas, e o pedido sem lista', () => {
    const t = abre({ travelers: [{ id: 'enzo', name: 'Enzo' }] })
    act(() => t.botao('Pedir para passar').click())
    expect(container.querySelector('fieldset')).toBeNull()
    expect(t.caixas()).toHaveLength(0)
    act(() => t.botao('Pedir').click())
    expect(t.onRequestTravel).toHaveBeenCalledTimes(1)
    expect(t.onRequestTravel.mock.calls[0]).toEqual([])
  })
})
