import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { RESUME_STORAGE_KEY } from './playerConnection'

/**
 * SOM DA MESA na página do jogador (pedido "sons", fatia 3): o alto-falante é
 * controle do mapa — aparece com o jogo na tela, na pilha do canto (`.pp-som`,
 * player.css), e não no formulário de entrada nem na espera.
 */

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => createElement('div', { 'data-testid': 'mapa' }),
}))

class FakeWebSocket {
  static readonly instances: FakeWebSocket[] = []
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(): void {}
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

function socket(): FakeWebSocket {
  const ultimo = FakeWebSocket.instances.at(-1)
  if (ultimo === undefined) throw new Error('a página não abriu socket')
  return ultimo
}

function altoFalante(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('button[aria-label="Som"]')
}

beforeEach(() => {
  vi.useFakeTimers()
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  window.localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: 'ABC123', name: 'Gina' }))
  window.sessionStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify({ code: 'ABC123', token: 'tok' }))
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('página do jogador: alto-falante do som da mesa', () => {
  it('aparece com o mapa, na pilha do canto ao lado do zoom, e não antes do jogo', async () => {
    await act(async () => {
      await import('./boot')
    })
    socket().open()
    expect(altoFalante()).toBeNull()
    socket().receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gina' })
    socket().receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', 'Mapa', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    const botao = altoFalante()
    expect(botao).not.toBeNull()
    const raiz = botao?.closest('.lb-som')
    expect(raiz?.classList.contains('pp-som')).toBe(true)
    expect(raiz?.classList.contains('lb-som--flutuante')).toBe(true)
    // Logo depois do zoom na ordem do Tab: os dois controles de pedra do mapa.
    expect(raiz?.previousElementSibling?.classList.contains('pp-zoom')).toBe(true)
  })
})
