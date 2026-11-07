import { act, createElement } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PRAZO_DA_IMPORTACAO_MS } from './importacaoDaPagina.testkit'

/**
 * A TELA DE ENTRAR (`main.tsx`, `JoinForm`): o campo de código aceita o link
 * inteiro que o mestre mandou e fica só com o código; e a gaveta "Tenho conta
 * (PIN)", recolhida para quem chega pela primeira vez, abre sozinha quando o
 * mestre responde `account_required`, com o cursor já no PIN.
 *
 * Sobe a página inteira, como o navegador (`boot`), com um WebSocket falso no
 * lugar do real. O canvas Pixi sai: ele não desenha no jsdom.
 */

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => createElement('div', { 'data-testid': 'mapa' }),
}))

class FakeWebSocket {
  static readonly instances: FakeWebSocket[] = []
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }
  close(): void {
    this.readyState = 3
  }
  open(): void {
    this.readyState = 1
    act(() => this.onopen?.(new Event('open')))
  }
  receive(message: unknown): void {
    act(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) })))
  }
}

function campo(id: string): HTMLInputElement {
  const input = document.getElementById(id)
  if (!(input instanceof HTMLInputElement)) throw new Error(`campo #${id} não está na tela`)
  return input
}

/** O que o navegador faz ao colar ou digitar: troca o valor e dispara `input` (o `onChange` do React). */
function escrever(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

const gaveta = () => botao('Tenho conta (PIN)')

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  window.localStorage.clear()
  window.sessionStorage.clear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  document.body.innerHTML = '<div id="root"></div>'
  await act(async () => {
    await import('./boot')
  })
}, PRAZO_DA_IMPORTACAO_MS)

afterAll(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('tela de entrar do jogador', () => {
  it('colar o link inteiro preenche só o código; account_required volta com o PIN aberto e o cursor nele', () => {
    // Primeira vez neste aparelho: o PIN está recolhido e fora do Tab.
    expect(gaveta().getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('lb-join-pin-area')?.hasAttribute('inert')).toBe(true)

    // O link inteiro, como chega pelo grupo: o campo fica só com o código, em maiúscula.
    const codigo = campo('lb-join-code')
    escrever(codigo, 'Entra aí: http://192.168.0.5:7777/player#c=abc123')
    expect(codigo.value).toBe('ABC123')
    // Link SEM código não vira código inventado ("HTTP19"): o campo fica como estava,
    // marcado inválido, e o aviso é região viva — quem usa leitor de tela ouve com o cursor no campo.
    escrever(codigo, 'http://192.168.0.5:7777/player')
    expect(codigo.value).toBe('ABC123')
    expect(codigo.getAttribute('aria-invalid')).toBe('true')
    const aviso = document.querySelector('[role="alert"]')
    expect(aviso?.textContent).toContain('não traz o código')
    expect(codigo.getAttribute('aria-describedby')).toBe(aviso?.id)
    // Colar o mesmo link de novo monta outro aviso, para o leitor falar outra vez.
    escrever(codigo, 'http://192.168.0.5:7777/player')
    expect(document.querySelector('[role="alert"]')).not.toBe(aviso)
    // Digitar o código apaga o tropeço e a dica comum volta, sem região viva.
    escrever(codigo, 'abc123')
    expect(codigo.hasAttribute('aria-invalid')).toBe(false)
    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(codigo.getAttribute('aria-describedby')).toBe('lb-join-code-hint')

    escrever(campo('lb-join-name'), 'Gina')
    act(() => botao('Entrar').click())
    const socket = FakeWebSocket.instances.at(-1)
    if (socket === undefined) throw new Error('a página não abriu socket')
    socket.open()
    // Sem PIN (gaveta fechada), entra só com o nome.
    expect(socket.sent[0]).toEqual({ type: 'join', code: 'ABC123', name: 'Gina' })

    // A sala só aceita conta: de volta ao formulário, a gaveta abriu sozinha.
    socket.receive({ type: 'error', reason: 'account_required' })
    act(() => botao('Corrigir e entrar de novo').click())
    expect(gaveta().getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('lb-join-pin-area')?.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(campo('lb-join-pin'))
    // O que ele digitou continua lá.
    expect(campo('lb-join-code').value).toBe('ABC123')
    expect(campo('lb-join-name').value).toBe('Gina')
  })
})
