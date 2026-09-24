import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RESUME_STORAGE_KEY } from './playerConnection'

/**
 * VOLTAR É A MESMA PESSOA, a página do jogador (`main.tsx`).
 *
 * A Ana reabre o QR numa ABA NOVA: o resume era da aba velha
 * (`sessionStorage`), a aba nova não o via e a Ana virava "Ana (2)", sem
 * ficha e sem o que já tinha explorado. Agora o retorno é lembrado no
 * APARELHO: a aba nova entra direto, com o resume, como a mesma Ana. E a aba
 * velha, avisada pelo host (`session.replaced`), diz o que houve e oferece
 * "Usar aqui".
 */

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_COLOR: 0x3b82f6,
  PlayerView: () => createElement('div', { 'data-testid': 'mapa' }),
}))

const CODE = 'ABC123'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
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

async function abrePagina(): Promise<void> {
  await act(async () => {
    await import('./main')
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  FakeWebSocket.instances = []
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  window.localStorage.clear()
  window.sessionStorage.clear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('página do jogador: voltar por aba nova é a mesma pessoa', () => {
  it('aba nova (sessionStorage vazio) com o retorno lembrado no aparelho entra direto, com o resume', async () => {
    window.localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Ana' }))
    window.localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify({ code: CODE, token: 'tok' }))
    await abrePagina()
    expect(FakeWebSocket.instances).toHaveLength(1)
    const socket = ultimo()
    socket.open()
    expect(socket.sent[0]).toEqual({ type: 'join', code: CODE, name: 'Ana', resume: 'tok' })
    // Nada de formulário: a Ana não digita nada de novo.
    expect(document.querySelector('form')).toBeNull()
  })

  it('o resume que o mestre dá fica no aparelho, onde a próxima aba o acha', async () => {
    window.localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Ana' }))
    await abrePagina()
    // Sem resume: o formulário, preenchido. Entrar.
    const form = document.querySelector('form')
    if (form === null) throw new Error('esperava o formulário')
    act(() => {
      form.requestSubmit()
    })
    const socket = ultimo()
    socket.open()
    expect(socket.sent[0]).toEqual({ type: 'join', code: CODE, name: 'Ana' })
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok-novo', name: 'Ana' })
    expect(window.localStorage.getItem(RESUME_STORAGE_KEY)).toBe(JSON.stringify({ code: CODE, token: 'tok-novo' }))
  })

  it('a aba velha avisada pelo host explica e oferece "Usar aqui", que entra de novo com o mesmo resume', async () => {
    window.localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Ana' }))
    window.localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify({ code: CODE, token: 'tok' }))
    await abrePagina()
    const velha = ultimo()
    velha.open()
    velha.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
    velha.receive({ type: 'session.replaced' })
    velha.drop()
    expect(document.body.textContent).toContain('Você abriu a sala em outra aba ou aparelho.')
    const usarAqui = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Usar aqui')
    if (usarAqui === undefined) throw new Error('esperava o botão "Usar aqui"')
    act(() => {
      usarAqui.click()
    })
    expect(FakeWebSocket.instances).toHaveLength(2)
    const nova = ultimo()
    nova.open()
    expect(nova.sent[0]).toEqual({ type: 'join', code: CODE, name: 'Ana', resume: 'tok' })
    // O resume continua lá: a aba velha não apagou o da aba nova.
    expect(window.localStorage.getItem(RESUME_STORAGE_KEY)).toBe(JSON.stringify({ code: CODE, token: 'tok' }))
  })
})
