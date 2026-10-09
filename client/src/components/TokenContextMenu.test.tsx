import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../stores/toastStore'
import { TokenContextMenu, type JogadorDoToken, type TokenContextMenuProps } from './TokenContextMenu'

/**
 * Clique direito no token que um jogador controla: Congelar/Descongelar e
 * "Enviar mensagem…" (o recado só para ele) sem ir ao painel do token nem à
 * linha dele no Grupo.
 */
const AIRA: JogadorDoToken = { playerId: 'p-aira', name: 'Aira' }

describe('TokenContextMenu', () => {
  let container: HTMLDivElement
  let root: Root
  let aberturas = 0

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    for (const toast of useToastStore.getState().toasts) useToastStore.getState().dismiss(toast.id)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function abrir(props: Partial<TokenContextMenuProps> = {}) {
    const completas: TokenContextMenuProps = {
      tokenName: 'Aira',
      x: 40,
      y: 60,
      congelado: false,
      onCongelar: vi.fn(),
      jogadores: [AIRA],
      onMensagem: vi.fn(() => 'sent' as const),
      onClose: vi.fn(),
      ...props,
    }
    // `key` nova a cada abertura, como o App faz: o menu reabre do começo.
    aberturas += 1
    act(() => root.render(<TokenContextMenu key={aberturas} {...completas} />))
    return completas
  }

  const itens = (): string[] => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).map((b) => b.textContent ?? '')
  const item = (rotulo: string): HTMLButtonElement => {
    const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((b) => b.textContent === rotulo)
    if (achado === undefined) throw new Error(`item "${rotulo}" não está no menu`)
    return achado
  }

  it('diz em qual token o mestre clicou e oferece Congelar e Enviar mensagem, com o foco no primeiro', () => {
    abrir()
    expect(container.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('Token: Aira')
    expect(container.querySelector('.lb-tokenmenu__titulo')?.textContent).toBe('Aira')
    expect(itens()).toEqual(['Congelar', 'Enviar mensagem…'])
    expect(document.activeElement).toBe(item('Congelar'))
  })

  it('"Congelar" congela e fecha; já congelado, o item é "Descongelar"', () => {
    const props = abrir()
    act(() => item('Congelar').click())
    expect(props.onCongelar).toHaveBeenCalledWith(true)
    expect(props.onClose).toHaveBeenCalled()
    const congelado = abrir({ congelado: true })
    act(() => item('Descongelar').click())
    expect(congelado.onCongelar).toHaveBeenCalledWith(false)
  })

  it('"Enviar mensagem…" abre o campo só para ela; Enviar manda a ela, avisa e fecha', () => {
    const props = abrir()
    act(() => item('Enviar mensagem…').click())
    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(container.textContent).toContain('Mensagem só para Aira')
    const campo = container.querySelector('textarea')
    if (campo === null) throw new Error('sem o campo da mensagem')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(campo, 'Pare de mexer no baú.')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const enviar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Enviar')
    act(() => enviar?.click())
    expect(props.onMensagem).toHaveBeenCalledWith('p-aira', 'Pare de mexer no baú.')
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({ kind: 'info', text: 'Mensagem enviada a Aira' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('jogador fora da sala recebe ao voltar; sala fechada não tem o item de mensagem', () => {
    abrir({ onMensagem: () => 'queued' })
    act(() => item('Enviar mensagem…').click())
    const campo = container.querySelector('textarea')
    act(() => {
      if (campo === null) return
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(campo, 'Oi')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Enviar')?.click())
    expect(useToastStore.getState().toasts.at(-1)?.text).toBe('Aira recebe a mensagem ao voltar')
    abrir({ onMensagem: undefined })
    expect(itens()).toEqual(['Congelar'])
  })

  it('dois jogadores no mesmo token: uma mensagem para cada, pelo nome', () => {
    abrir({ jogadores: [AIRA, { playerId: 'p-bia', name: 'Bia' }] })
    expect(itens()).toEqual(['Congelar', 'Mensagem para Aira…', 'Mensagem para Bia…'])
  })

  it('Esc fecha sem mudar nada', () => {
    const props = abrir()
    act(() => item('Congelar').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(props.onClose).toHaveBeenCalled()
    expect(props.onCongelar).not.toHaveBeenCalled()
  })
})
