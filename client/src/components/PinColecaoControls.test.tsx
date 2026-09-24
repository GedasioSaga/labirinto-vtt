import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinColecao } from '../types/map'
import { PinColecaoControls } from './PinColecaoControls'

/**
 * Painel do mestre para a COLEÇÃO DE PISTAS: marcar o pino como "peça 5 de 12
 * do Letreiro" e escrever a frase inteira, que só quem juntar todas lê.
 */

describe('PinColecaoControls', () => {
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

  function render(colecao: PinColecao | null, onChange: (colecao: PinColecao | undefined) => void, nomes: string[] = []): void {
    act(() => root.render(<PinColecaoControls colecao={colecao} onChange={onChange} nomes={nomes} />))
  }

  function mudar(el: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter === undefined) throw new Error('jsdom sem setter de value')
    act(() => {
      setter.call(el, valor)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function campo<T extends HTMLElement>(id: string): T {
    const achado = container.querySelector<T>(`#${id}`)
    if (achado === null) throw new Error(`sem o campo ${id}`)
    return achado
  }

  function interruptor(): HTMLInputElement {
    const achado = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((i) => i.closest('label')?.textContent?.includes('Peça de coleção'))
    if (achado === undefined) throw new Error('sem interruptor')
    return achado
  }

  it('desligada: só o interruptor; ligar cria a peça 1 de 2 sem nome', () => {
    const onChange = vi.fn()
    render(null, onChange)
    expect(container.querySelector('#lb-pin-colecao-nome')).toBeNull()
    act(() => interruptor().click())
    expect(onChange).toHaveBeenCalledWith({ nome: '', parte: 1, total: 2 })
  })

  it('ligada: nome, número, total e frase inteira gravam no pino; desligar tira a coleção', () => {
    const onChange = vi.fn()
    const peca: PinColecao = { nome: 'Letreiro', parte: 1, total: 12 }
    render(peca, onChange, ['Letreiro', 'Mapa de Drenagem'])
    mudar(campo<HTMLInputElement>('lb-pin-colecao-nome'), 'Letras')
    expect(onChange).toHaveBeenLastCalledWith({ ...peca, nome: 'Letras' })
    mudar(campo<HTMLInputElement>('lb-pin-colecao-parte'), '5')
    expect(onChange).toHaveBeenLastCalledWith({ ...peca, parte: 5 })
    mudar(campo<HTMLInputElement>('lb-pin-colecao-total'), '20')
    expect(onChange).toHaveBeenLastCalledWith({ ...peca, total: 20 })
    mudar(campo<HTMLTextAreaElement>('lb-pin-colecao-inteira'), 'A BOCA ABRE')
    expect(onChange).toHaveBeenLastCalledWith({ ...peca, inteira: 'A BOCA ABRE' })
    act(() => interruptor().click())
    expect(onChange).toHaveBeenLastCalledWith(undefined)
    // As coleções que já existem nesta cena viram sugestão do campo de nome.
    const opcoes = [...container.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'))
    expect(opcoes).toEqual(['Letreiro', 'Mapa de Drenagem'])
  })

  it('apagar o número para digitar outro não grava nada até ele ficar válido', () => {
    const onChange = vi.fn()
    render({ nome: 'Letreiro', parte: 5, total: 12 }, onChange)
    const parte = campo<HTMLInputElement>('lb-pin-colecao-parte')
    mudar(parte, '')
    expect(onChange).not.toHaveBeenCalled()
    expect(parte.value).toBe('')
    mudar(parte, '0')
    expect(onChange).not.toHaveBeenCalled()
    mudar(parte, '7')
    expect(onChange).toHaveBeenCalledWith({ nome: 'Letreiro', parte: 7, total: 12 })
  })

  it('peça que não conta (sem nome, ou número acima do total) diz por quê', () => {
    render({ nome: '', parte: 1, total: 2 }, vi.fn())
    expect(container.textContent).toContain('Sem nome, a peça não conta.')
    render({ nome: 'Letreiro', parte: 5, total: 3 }, vi.fn())
    expect(container.textContent).toContain('A peça 5 não cabe numa coleção de 3.')
    render({ nome: 'Letreiro', parte: 2, total: 3 }, vi.fn())
    expect(container.textContent).toContain('Quem lê esta peça ganha a casa 2 de “Letreiro” no Caderno.')
  })
})
