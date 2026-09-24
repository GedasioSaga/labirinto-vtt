import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerDoorNotice, doorRequestText } from './PlayerDoorNotice'

describe('PlayerDoorNotice (aviso da porta na tela do jogador)', () => {
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

  const botoes = () => [...container.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent)

  it('"Trancada" oferece Bater, Forçar e Usar chave, e cada botão pede do seu jeito', () => {
    const onRequest = vi.fn()
    const onClose = vi.fn()
    act(() => root.render(<PlayerDoorNotice notice={{ id: 1, reason: 'locked', wallId: 'escritorio' }} onRequest={onRequest} onClose={onClose} />))
    expect(container.textContent).toContain('Trancada')
    expect(botoes()).toEqual(['Bater', 'Forçar', 'Usar chave', 'Fechar aviso'])
    const forcar = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Forçar')
    act(() => forcar?.click())
    expect(onRequest).toHaveBeenCalledWith('escritorio', 'force')
    const fechar = container.querySelector('button[aria-label="Fechar aviso"]')
    act(() => (fechar instanceof HTMLButtonElement ? fechar.click() : undefined))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('as outras recusas continuam uma linha só, sem botões', () => {
    act(() => root.render(<PlayerDoorNotice notice={{ id: 2, reason: 'far', wallId: 'escritorio' }} onRequest={vi.fn()} onClose={vi.fn()} />))
    expect(container.textContent).toBe('Chegue mais perto da porta')
    expect(botoes()).toEqual([])
  })

  it('textos da resposta do pedido', () => {
    expect(doorRequestText('sent')).toBe('Pedido enviado')
    expect(doorRequestText('opened')).toBe('O mestre abriu')
    expect(doorRequestText('denied')).toBe('O mestre disse não')
    expect(doorRequestText('pending')).toBe('Seu pedido anterior ainda espera o mestre')
  })
})
