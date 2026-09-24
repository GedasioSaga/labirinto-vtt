/**
 * "Teste secreto" na aba Jogo: o mestre escreve o teste, marca quem faz e
 * pede. As respostas aparecem só aqui, uma linha por jogador pedido.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SECRET_CHECK_LABEL_MAX_LENGTH } from '../net/protocol'
import type { SecretCheckState } from '../net/hostSession'
import { SECRET_CHECK_ERRORS, SecretCheckSection, secretCheckFeedbackText, type SecretCheckSectionProps } from './SecretCheckSection'

const JOGADORES = [
  { playerId: 'p-ana', name: 'Ana', playing: true },
  { playerId: 'p-bruno', name: 'Bruno', playing: true },
  { playerId: 'p-dora', name: 'Dora', playing: false },
]

describe('SecretCheckSection', () => {
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

  function render(props: Partial<SecretCheckSectionProps> = {}): void {
    act(() => root.render(<SecretCheckSection players={JOGADORES} checks={[]} onAsk={() => 0} onClose={() => {}} {...props} />))
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  }

  function caixa(nome: string): HTMLInputElement | undefined {
    return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((c) => container.querySelector(`label[for="${c.id}"]`)?.textContent === nome)
  }

  function campoTeste(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>('input[type="text"]')
    if (input === null) throw new Error('sem campo do teste')
    return input
  }

  function digita(valor: string): void {
    const input = campoTeste()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('só quem joga pode ser escolhido; "Pedir teste" pede nome e alguém marcado', () => {
    const onAsk = vi.fn(() => 2)
    render({ onAsk })
    expect(caixa('Ana')).toBeDefined()
    expect(caixa('Bruno')).toBeDefined()
    expect(caixa('Dora')).toBeUndefined()
    expect(campoTeste().maxLength).toBe(SECRET_CHECK_LABEL_MAX_LENGTH)
    expect(container.querySelector(`label[for="${campoTeste().id}"]`)?.textContent).toBe('Teste')

    act(() => botao('Pedir teste')?.click())
    digita('Percepção')
    act(() => botao('Pedir teste')?.click())
    expect(onAsk).not.toHaveBeenCalled()
    act(() => caixa('Ana')?.click())
    act(() => caixa('Bruno')?.click())
    act(() => botao('Pedir teste')?.click())
    expect(onAsk).toHaveBeenCalledWith('Percepção', ['p-ana', 'p-bruno'])
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Teste pedido a 2 jogadores')
    // O nome do teste sai do campo (não reenvia sem querer); a escolha fica.
    expect(campoTeste().value).toBe('')
    expect(caixa('Ana')?.checked).toBe(true)
  })

  it('pedir sem nome ou sem ninguém marcado diz o que falta junto ao campo e leva o foco ao primeiro erro', () => {
    render()
    const alertas = () => Array.from(container.querySelectorAll('[role="alert"]')).map((a) => a.textContent)
    expect(alertas()).toEqual([])
    act(() => botao('Pedir teste')?.click())
    expect(alertas()).toEqual([SECRET_CHECK_ERRORS.label, SECRET_CHECK_ERRORS.who])
    expect(campoTeste().getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(campoTeste())
    // Enter no campo também tenta: com o nome, o foco vai para o grupo sem ninguém marcado.
    digita('Percepção')
    expect(alertas()).toEqual([SECRET_CHECK_ERRORS.who])
    expect(campoTeste().getAttribute('aria-invalid')).toBeNull()
    act(() => {
      campoTeste().form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(document.activeElement).toBe(caixa('Ana'))
    act(() => caixa('Ana')?.click())
    expect(alertas()).toEqual([])
  })

  it('as respostas aparecem por jogador; quem falta fica "aguardando" e "Encerrar" fecha o teste', () => {
    const onClose = vi.fn()
    const checks: SecretCheckState[] = [
      { id: 't1', label: 'Furtividade', asked: ['p-ana'], answers: { 'p-ana': 4 }, open: false },
      { id: 't2', label: 'Percepção', asked: ['p-ana', 'p-bruno'], answers: { 'p-ana': 17 }, open: true },
    ]
    render({ checks, onClose })
    const itens = Array.from(container.querySelectorAll('li.lb-secret-check__item'))
    // O mais novo em cima.
    expect(itens.map((li) => li.querySelector('.lb-secret-check__label')?.textContent)).toEqual(['Percepção', 'Furtividade'])
    expect(itens[0]?.textContent).toContain('Ana: 17')
    expect(itens[0]?.textContent).toContain('Bruno: aguardando')
    act(() => botao('Encerrar Percepção')?.click())
    expect(onClose).toHaveBeenCalledWith('t2')
    // Encerrado não tem botão.
    expect(botao('Encerrar Furtividade')).toBeUndefined()
  })

  it('o aviso diz por que o pedido não saiu', () => {
    expect(secretCheckFeedbackText(null)).toBe('Não deu: a sala não está aberta.')
    expect(secretCheckFeedbackText(0)).toBe('Ninguém escolhido está jogando agora.')
    expect(secretCheckFeedbackText(1)).toBe('Teste pedido a 1 jogador')
  })

  it('ninguém jogando: diz isso em vez da lista vazia', () => {
    render({ players: [{ playerId: 'p-dora', name: 'Dora', playing: false }] })
    expect(container.textContent).toContain('Ninguém jogando agora.')
  })
})
