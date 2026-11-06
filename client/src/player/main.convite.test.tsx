import { act, createElement } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * ENTRAR PELO LOBBY (`main.tsx`, B5b): a página do jogador aberta pelo botão
 * "Entrar na mesa agora" traz o bilhete em `#entrar=`. Ele sai da URL assim
 * que é lido, a tela diz só "Entrando como Gina…", e o `join` leva o código e
 * o nome tirados do bilhete, com o `ticket` e sem PIN nem aparelho. Recusado
 * pelo mestre, cai no formulário dizendo que o convite venceu.
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

function base64Url(texto: string): string {
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Um bilhete v1 com a forma certa (`lib/nuvem/bilhete.ts`). A assinatura é de
 * mentira: o jogador não confere (não tem a chave), quem confere é o mestre.
 */
const BILHETE = `v1.${base64Url(JSON.stringify({ s: 'ABC123', c: 'conta_gina', n: 'Gina', j: 'A'.repeat(22), e: Date.now() + 120_000 }))}.${'A'.repeat(43)}`

/** A primeira importação transforma a página inteira (main.tsx e o que ela puxa): com a máquina disputada, passa dos 5 s do `it`. */
const PRAZO_DA_IMPORTACAO_MS = 60_000

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  window.localStorage.clear()
  window.sessionStorage.clear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  window.history.replaceState(null, '', `/player#entrar=${BILHETE}`)
  document.body.innerHTML = '<div id="root"></div>'
  await act(async () => {
    await import('./boot')
  })
}, PRAZO_DA_IMPORTACAO_MS)

afterAll(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('entrar pelo convite do Lobby', () => {
  it('o bilhete some da URL, o join leva o ticket sem PIN, e a recusa volta ao formulário', () => {
    // Lido e apagado: nem no endereço, nem no histórico do Voltar.
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain('entrar')
    expect(window.location.pathname).toBe('/player')
    // Nada do bilhete foi para storage.
    const guardado = [window.localStorage, window.sessionStorage].flatMap((s) => Object.keys(s).map((k) => s.getItem(k) ?? ''))
    expect(guardado.some((valor) => valor.includes(BILHETE))).toBe(false)

    expect(document.querySelector('[role="status"]')?.textContent).toBe('Entrando como Gina…')
    // Sem formulário: nada de código, nome ou PIN para digitar.
    expect(document.getElementById('lb-join-code')).toBeNull()

    const socket = FakeWebSocket.instances.at(-1)
    if (socket === undefined) throw new Error('a página não abriu socket')
    socket.open()
    expect(socket.sent[0]).toEqual({ type: 'join', code: 'ABC123', name: 'Gina', ticket: BILHETE })

    // O mestre recusou (vencido, já usado, conta que não existe — é tudo `invalid`).
    socket.receive({ type: 'account.refused', reason: 'invalid' })
    expect(document.querySelector('.pe-notice--error')?.textContent).toBe('O convite venceu: volte ao Lobby e clique de novo.')
    const codigo = document.getElementById('lb-join-code')
    if (!(codigo instanceof HTMLInputElement)) throw new Error('o formulário não voltou')
    expect(codigo.value).toBe('ABC123')
  })
})
