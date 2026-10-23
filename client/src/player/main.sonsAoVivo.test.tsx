import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { RESUME_STORAGE_KEY, type PlayerConnection } from './playerConnection'

/**
 * SONS AO VIVO (F5) nas duas páginas que tocam: a do jogador (`PlayerApp`) e a
 * tela da mesa (`TableApp`). Os sons nascem e morrem com a conexão da sessão
 * (uma instalação viva por vez, mesmo com o StrictMode), e a faixinha "Toque
 * para ouvir" é montada pela página, não pelo `PlayerView`. O instalador é
 * trocado por um registro (o que ele toca está em `sonsAoVivoDoJogador.test.ts`).
 */

const registro = vi.hoisted(() => {
  const instalacoes: { conexao: PlayerConnection; esperando: number; ouvintes: Set<() => void>; viva: boolean }[] = []
  return { instalacoes }
})

vi.mock('./sonsAoVivoDoJogador', () => ({
  instalarSonsAoVivo: (conexao: PlayerConnection) => {
    const instalacao = { conexao, esperando: 0, ouvintes: new Set<() => void>(), viva: true }
    registro.instalacoes.push(instalacao)
    return {
      esperando: () => instalacao.esperando,
      assinar: (ouvinte: () => void) => {
        instalacao.ouvintes.add(ouvinte)
        return () => instalacao.ouvintes.delete(ouvinte)
      },
      tocarParaOuvir: () => undefined,
      desinstalar: () => {
        instalacao.viva = false
      },
    }
  },
}))

vi.mock('./sonsDoJogador', () => ({ instalarSonsDoJogador: () => () => undefined }))

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

const vivas = () => registro.instalacoes.filter((instalacao) => instalacao.viva)

/** Um som do mestre esperando o gesto na instalação viva: a faixinha deve aparecer. */
function somEsperando(): void {
  const [viva] = vivas()
  if (viva === undefined) throw new Error('nenhuma instalação viva')
  act(() => {
    viva.esperando = 1
    for (const ouvinte of viva.ouvintes) ouvinte()
  })
}

const faixa = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Toque para ouvir')

let raiz: Root

beforeEach(() => {
  vi.useFakeTimers()
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  registro.instalacoes.length = 0
  FakeWebSocket.instances.length = 0
  document.body.innerHTML = '<div id="root"></div>'
  const alvo = document.getElementById('root')
  if (alvo === null) throw new Error('sem #root')
  raiz = createRoot(alvo)
})

afterEach(() => {
  act(() => raiz.unmount())
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.sessionStorage.clear()
  window.localStorage.clear()
})

describe('sons ao vivo montados nas páginas que tocam', () => {
  it('PlayerApp: uma instalação viva na conexão da sessão, a faixinha aparece, e sair desinstala', async () => {
    window.localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Gina' }))
    window.sessionStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify({ code: CODE, token: 'tok' }))
    const { PlayerApp } = await import('./main')
    const { StrictMode } = await import('react')
    act(() => raiz.render(createElement(StrictMode, null, createElement(PlayerApp))))
    expect(vivas()).toHaveLength(1)
    const socket = FakeWebSocket.instances.at(-1)
    if (socket === undefined) throw new Error('a página não abriu socket')
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gina' })
    socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', 'Mapa', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    expect(vivas()[0]?.conexao.getState().playerId).toBe('p1')
    expect(faixa()).toBeUndefined()
    somEsperando()
    expect(faixa()).toBeDefined()
    // Fora do PlayerView: a página o monta (o PlayerView aqui é de mentira e não desenha botão nenhum).
    expect(document.querySelector('[data-testid="mapa"]')?.contains(faixa() ?? null)).toBe(false)

    socket.receive({ type: 'kicked' })
    const voltar = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Voltar')
    act(() => voltar?.click())
    expect(vivas()).toHaveLength(0)
    expect(faixa()).toBeUndefined()
  })

  it('TableApp: a tela da mesa instala os sons na conexão dela e mostra a faixinha', async () => {
    const { TableApp } = await import('./TableScreen')
    act(() => raiz.render(createElement(TableApp, { initialCode: CODE, tableKey: 'chave-da-tv' })))
    expect(vivas()).toHaveLength(1)
    expect(FakeWebSocket.instances).toHaveLength(1)
    somEsperando()
    expect(faixa()).toBeDefined()
    act(() => raiz.render(createElement('div')))
    expect(vivas()).toHaveLength(0)
  })
})
