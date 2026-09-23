import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addToken, createEmptyMap } from '../lib/mapFactory'
import { RESUME_STORAGE_KEY } from './playerConnection'

/**
 * RECONEXÃO AUTOMÁTICA, a página do jogador (`main.tsx`): o véu
 * "Reconectando…" cobre o mapa E a tela de espera sem tirar nenhum dos dois,
 * e a rede que volta (`online`) ou a tela que acende (`visibilitychange`)
 * tentam NA HORA, sem esperar a espera crescente.
 *
 * O teste sobe a página inteira, como o navegador: `#root`, o resume na aba
 * (a página retoma sozinha) e um WebSocket falso no lugar do real. Só o canvas
 * Pixi sai — ele não desenha no jsdom e não é o que está em teste aqui.
 */

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_COLOR: 0x3b82f6,
  PlayerView: () => createElement('div', { 'data-testid': 'mapa' }),
}))

const CODE = 'ABC123'

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
  /** A rede sumiu COM aviso (o navegador fecha o socket). */
  drop(): void {
    this.readyState = 3
    act(() => this.onclose?.(new CloseEvent('close')))
  }
}

function ultimo(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (socket === undefined) throw new Error('a página não abriu socket')
  return socket
}

function mapa() {
  return addToken(createEmptyMap('m1', 'Mapa', 10, 10, 50), { id: 't1', characterId: null, name: 'Gina', x: 10, y: 10, size: 1, image: null })
}

const veu = () => document.querySelector('.pp-reconnecting')

beforeEach(() => {
  vi.useFakeTimers()
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  // A aba já estava na sala: a página retoma sozinha, sem o formulário.
  window.localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Gina' }))
  window.sessionStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify({ code: CODE, token: 'tok' }))
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('página do jogador: véu "Reconectando…" e volta na hora', () => {
  it('cobre a espera e o mapa sem tirá-los; online e visibilitychange tentam na hora', async () => {
    await act(async () => {
      await import('./main')
    })
    expect(FakeWebSocket.instances).toHaveLength(1)
    const primeiro = ultimo()
    primeiro.open()
    expect(primeiro.sent[0]).toEqual({ type: 'join', code: CODE, name: 'Gina', resume: 'tok' })
    primeiro.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gina' })
    expect(document.body.textContent).toContain('Aguardando o mestre atribuir um personagem.')
    expect(veu()).toBeNull()

    // Cai na tela de espera: a espera fica, e o véu vem por cima.
    primeiro.drop()
    expect(veu()?.textContent).toContain('Reconectando…')
    expect(document.body.textContent).toContain('Aguardando o mestre atribuir um personagem.')
    // Antes do 30 s não há o que decidir: sem "Reconectar".
    expect(veu()?.querySelector('button')).toBeNull()

    // A rede voltou: tenta AGORA, sem esperar a primeira espera.
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(FakeWebSocket.instances).toHaveLength(2)
    const segundo = ultimo()
    segundo.open()
    expect(segundo.sent[0]).toEqual({ type: 'join', code: CODE, name: 'Gina', resume: 'tok' })
    segundo.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gina' })
    segundo.receive({ type: 'snapshot', rev: 3, map: mapa(), vision: [], ownTokens: ['t1'] })
    expect(document.querySelector('[data-testid="mapa"]')).not.toBeNull()
    expect(veu()).toBeNull()

    // Cai jogando: o mapa CONTINUA na tela, esmaecido pelo véu.
    segundo.drop()
    expect(document.querySelector('[data-testid="mapa"]')).not.toBeNull()
    expect(veu()?.textContent).toContain('Reconectando…')

    // A tela acendeu (celular desbloqueado): tenta AGORA.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(FakeWebSocket.instances).toHaveLength(3)
    const terceiro = ultimo()
    terceiro.open()
    terceiro.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gina' })
    expect(veu()).toBeNull()
    expect(document.querySelector('[data-testid="mapa"]')).not.toBeNull()
  })
})
