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

  const botao = (texto: string): HTMLButtonElement => {
    const achado = [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === texto)
    if (achado === undefined) throw new Error(`sem o botão "${texto}" em: ${botoes().join(' | ')}`)
    return achado
  }
  const campo = (): HTMLInputElement | null => container.querySelector('input[type="text"]')

  /**
   * Decisão 1 do mestre (12/11/2026): UM "Pedir ao mestre", que abre o campo
   * "O que você faz?" (opcional) com os atalhos "Bater" e "Forçar" que só
   * preenchem o campo; o pedido sai em "Enviar ao mestre", sempre `ask`.
   */
  it('"Trancada" oferece "Pedir ao mestre": o campo é opcional, e "Bater" e "Forçar" só preenchem o texto', () => {
    const onRequest = vi.fn()
    const onClose = vi.fn()
    act(() => root.render(<PlayerDoorNotice notice={{ id: 1, reason: 'locked', wallId: 'escritorio' }} onRequest={onRequest} onClose={onClose} />))
    expect(container.textContent).toContain('Trancada')
    expect(botoes()).toEqual(['Pedir ao mestre', 'Fechar aviso'])

    act(() => botao('Pedir ao mestre').click())
    expect(container.textContent).toContain('O que você faz?')
    expect(container.textContent).toContain('(opcional)')
    expect(botoes()).toEqual(['Bater', 'Forçar', 'Enviar ao mestre', 'Voltar', 'Fechar aviso'])
    act(() => botao('Forçar').click())
    expect(campo()?.value).toBe('Tento forçar a porta')
    // O atalho não manda nada sozinho: o pedido só sai no "Enviar ao mestre".
    expect(onRequest).not.toHaveBeenCalled()
    act(() => botao('Enviar ao mestre').click())
    expect(onRequest).toHaveBeenCalledTimes(1)
    expect(onRequest).toHaveBeenCalledWith('escritorio', 'ask', 'Tento forçar a porta')

    // Voltar limpa o campo; vazio também vale (o mestre lê "<ficha> quer abrir a porta").
    act(() => botao('Voltar').click())
    expect(botoes()).toEqual(['Pedir ao mestre', 'Fechar aviso'])
    act(() => botao('Pedir ao mestre').click())
    expect(campo()?.value).toBe('')
    act(() => botao('Enviar ao mestre').click())
    expect(onRequest).toHaveBeenLastCalledWith('escritorio', 'ask', '')

    act(() => botao('Fechar aviso').click())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('as outras recusas continuam uma linha só, sem botões', () => {
    act(() => root.render(<PlayerDoorNotice notice={{ id: 2, reason: 'far', wallId: 'escritorio' }} onRequest={vi.fn()} onClose={vi.fn()} />))
    expect(container.textContent).toBe('Chegue mais perto da porta')
    expect(botoes()).toEqual([])
  })

  it('porta que o mestre marcou sem espiar: "Não dá para espiar aqui", uma linha só, sem botões', () => {
    act(() => root.render(<PlayerDoorNotice notice={{ id: 3, reason: 'no_peek', wallId: 'escritorio' }} onRequest={vi.fn()} onClose={vi.fn()} />))
    expect(container.textContent).toBe('Não dá para espiar aqui')
    expect(botoes()).toEqual([])
  })

  it('textos da resposta do pedido', () => {
    expect(doorRequestText('sent')).toBe('Pedido enviado')
    expect(doorRequestText('opened')).toBe('O mestre abriu')
    // Caça J14 (12/11/2026): o que aconteceu, não "o mestre disse não".
    expect(doorRequestText('denied')).toBe('A porta não abre')
    expect(doorRequestText('pending')).toBe('Seu pedido anterior ainda espera o mestre')
  })
})
