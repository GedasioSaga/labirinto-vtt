import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinLock } from '../types/map'
import { PinLockControls } from './PinLockControls'

/**
 * Painel do mestre para a FECHADURA COM SEGREDO: ligar, gravar a combinação,
 * escolher teclado ou volantes, a porta que ela destranca junto e trancar de
 * novo depois que um jogador abriu.
 */

const PORTAS = [
  { id: 'porta-a', label: 'Porta trancada a 2 quadros' },
  { id: 'porta-b', label: 'Porta trancada a 7 quadros' },
]

describe('PinLockControls', () => {
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

  function render(lock: PinLock | null, onChange: (lock: PinLock | undefined) => void): void {
    act(() => root.render(<PinLockControls lock={lock} onChange={onChange} doors={PORTAS} />))
  }

  function mudar(el: HTMLInputElement | HTMLSelectElement, valor: string): void {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter === undefined) throw new Error('jsdom sem setter de value')
    act(() => {
      setter.call(el, valor)
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }

  function interruptor(): HTMLInputElement {
    const achado = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((i) => i.closest('label')?.textContent?.includes('Fechadura com segredo'))
    if (achado === undefined) throw new Error('sem interruptor')
    return achado
  }

  it('desligada: só o interruptor; ligar cria a fechadura vazia de teclado', () => {
    const onChange = vi.fn()
    render(null, onChange)
    expect(container.querySelector('#lb-pin-lock-answer')).toBeNull()
    act(() => interruptor().click())
    expect(onChange).toHaveBeenCalledWith({ resposta: '', forma: 'teclado' })
  })

  it('grava a combinação, a forma e a porta ligada', () => {
    const onChange = vi.fn()
    const lock: PinLock = { resposta: '12', forma: 'teclado' }
    render(lock, onChange)
    const campo = container.querySelector<HTMLInputElement>('#lb-pin-lock-answer')
    if (campo === null) throw new Error('sem campo')
    expect(container.querySelector('label[for="lb-pin-lock-answer"]')?.textContent).toBe('Combinação')
    mudar(campo, '9-3-8-2')
    expect(onChange).toHaveBeenLastCalledWith({ resposta: '9-3-8-2', forma: 'teclado' })

    const volantes = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent === 'Volantes')
    if (volantes === undefined) throw new Error('sem opção Volantes')
    act(() => volantes.click())
    expect(onChange).toHaveBeenLastCalledWith({ resposta: '12', forma: 'volantes' })

    const porta = container.querySelector<HTMLSelectElement>('#lb-pin-lock-door')
    if (porta === null) throw new Error('sem escolha de porta')
    expect([...porta.options].map((o) => o.textContent)).toEqual(['Nenhuma porta', 'Porta trancada a 2 quadros', 'Porta trancada a 7 quadros'])
    mudar(porta, 'porta-b')
    expect(onChange).toHaveBeenLastCalledWith({ resposta: '12', forma: 'teclado', abrePorta: 'porta-b' })
  })

  it('"Nenhuma porta" desliga a porta ligada sem gravar o campo vazio', () => {
    const onChange = vi.fn()
    render({ resposta: '12', forma: 'teclado', abrePorta: 'porta-a' }, onChange)
    const porta = container.querySelector<HTMLSelectElement>('#lb-pin-lock-door')
    if (porta === null) throw new Error('sem escolha de porta')
    expect(porta.value).toBe('porta-a')
    mudar(porta, '')
    expect(onChange).toHaveBeenLastCalledWith({ resposta: '12', forma: 'teclado' })
    expect(Object.keys(onChange.mock.lastCall?.[0] ?? {})).toEqual(['resposta', 'forma'])
  })

  it('volantes com letras avisa que o jogador vai digitar', () => {
    render({ resposta: 'lua', forma: 'volantes' }, () => {})
    expect(container.textContent).toContain('Volante só gira números')
  })

  it('sem combinação, diz que a fechadura ainda não tranca nada', () => {
    render({ resposta: '', forma: 'teclado' }, () => {})
    expect(container.textContent).toContain('Sem combinação, a fechadura não tranca nada.')
  })

  it('aberta por um jogador: diz isso e oferece trancar de novo', () => {
    const onChange = vi.fn()
    render({ resposta: '12', forma: 'teclado', aberta: true, abrePorta: 'porta-a' }, onChange)
    expect(container.textContent).toContain('Aberta')
    const trancar = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Trancar de novo')
    if (trancar === undefined) throw new Error('sem Trancar de novo')
    act(() => trancar.click())
    expect(onChange).toHaveBeenLastCalledWith({ resposta: '12', forma: 'teclado', abrePorta: 'porta-a' })
  })

  it('desligar tira a fechadura', () => {
    const onChange = vi.fn()
    render({ resposta: '12', forma: 'teclado' }, onChange)
    act(() => interruptor().click())
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})
