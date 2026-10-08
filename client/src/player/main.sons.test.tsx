import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { RESUME_STORAGE_KEY, type PlayerConnection } from './playerConnection'

/**
 * SONS DO JOGADOR na página (`main.tsx`): a conexão nasce no `join()`, fora
 * de efeito, e o `join()` roda de novo a cada entrada. Os sons têm de nascer e
 * morrer com a conexão de cada sessão: uma instalação viva por vez, na conexão
 * que está na tela — nunca a da sessão anterior junto (o mesmo som tocaria
 * duas vezes), nem uma a mais pelo StrictMode.
 *
 * O teste sobe a página inteira, como no navegador; o instalador é trocado por
 * um registro (o que ele toca já está em `sonsDoJogador.test.ts`).
 */

const registro = vi.hoisted(() => {
  const conexoes: PlayerConnection[] = []
  return { ativas: new Set<object>(), conexoes }
})

vi.mock('./sonsDoJogador', () => ({
  instalarSonsDoJogador: (conexao: PlayerConnection) => {
    const instalacao = {}
    registro.ativas.add(instalacao)
    registro.conexoes.push(conexao)
    return () => {
      registro.ativas.delete(instalacao)
    }
  },
}))

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => createElement('div', { 'data-testid': 'mapa' }),
}))

const CODE = 'ABC123'

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

function ultimo(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (socket === undefined) throw new Error('a página não abriu socket')
  return socket
}

function botao(nome: string): HTMLButtonElement {
  const achado = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

beforeEach(() => {
  vi.useFakeTimers()
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  // A aba já estava na sala: a página retoma sozinha, sem o formulário.
  window.localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Gina' }))
  window.sessionStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify({ code: CODE, token: 'tok' }))
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('página do jogador: sons presos à conexão da sessão', () => {
  it('uma instalação viva por sessão; sair desinstala; entrar de novo instala na conexão nova', async () => {
    await act(async () => {
      await import('./boot')
    })
    // StrictMode monta os efeitos duas vezes: mesmo assim, uma instalação viva só.
    expect(registro.ativas.size).toBe(1)
    expect(FakeWebSocket.instances).toHaveLength(1)
    const primeira = registro.conexoes.at(-1)
    ultimo().open()
    ultimo().receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gina' })
    ultimo().receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', 'Mapa', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    expect(primeira?.getState().playerId).toBe('p1')

    // O mestre remove o jogador; "Voltar" leva ao formulário: a sessão acabou, os sons também.
    ultimo().receive({ type: 'kicked' })
    act(() => botao('Voltar').click())
    expect(registro.ativas.size).toBe(0)

    // Entra de novo (outra conexão, outro socket): os sons vão com ela, e só com ela.
    act(() => botao('Entrar').click())
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(registro.ativas.size).toBe(1)
    const segunda = registro.conexoes.at(-1)
    expect(segunda).not.toBe(primeira)
    ultimo().open()
    ultimo().receive({ type: 'welcome', playerId: 'p2', resumeToken: 'tok2', name: 'Gina' })
    expect(segunda?.getState().playerId).toBe('p2')
  })
})
