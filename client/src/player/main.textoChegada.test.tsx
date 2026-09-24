import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { ARRIVAL_CARD_TITLE } from './PlayerNoteCard'
import { RESUME_STORAGE_KEY } from './playerConnection'

/**
 * TEXTO DE CHEGADA na tela do jogador, pela página inteira (`main.tsx`): o
 * `scene.changed` com `chegada` que chega pelo socket vira o cartão "Ao
 * chegar" na sessão; o recado do mestre que chegou junto espera e aparece
 * depois que o jogador fecha o cartão. O canvas (Pixi) não roda em jsdom e
 * não entra no que está sendo provado: só ele é trocado.
 */
vi.mock('./PlayerView', () => ({ OWN_TOKEN_COLOR: 0x3b82f6, OWN_TOKEN_CSS: '#3b82f6', PlayerView: () => null }))

/** O WebSocket do navegador, do lado do jogador: o teste faz o papel do mestre. */
class FakeWebSocket {
  static readonly instances: FakeWebSocket[] = []
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readonly sent: string[] = []
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.readyState = 3
  }
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

const CODIGO = 'ABC123'

function socketDoJogador(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (socket === undefined) throw new Error('a página não abriu socket')
  return socket
}

function cartoes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('section.pp-note'))
}

function tituloDe(cartao: HTMLElement): string | null | undefined {
  return cartao.querySelector('h2')?.textContent
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  // Aba com sessão viva nesta sala: a página volta direto para a sala, sem formulário.
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODIGO, name: 'Ana' }))
  sessionStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify({ code: CODIGO, token: 'tok' }))
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  await act(async () => {
    await import('./main')
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('texto de chegada na sessão do jogador (main.tsx)', () => {
  it('scene.changed com chegada abre o cartão "Ao chegar"; o recado aparece depois de fechar', () => {
    const socket = socketDoJogador()
    act(() => socket.open())
    act(() => socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' }))
    act(() => socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] }))
    expect(cartoes()).toHaveLength(0)

    // O mestre deixou passar: chega a cena nova com o texto dela, o mapa novo e, no meio, um recado.
    act(() => socket.receive({ type: 'scene.changed', chegada: 'Frio e silêncio.' }))
    act(() => socket.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m2', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] }))
    act(() => socket.receive({ type: 'scene.note', id: 'n1', text: 'Cuidado com a porta.' }))

    const [chegada, ...outros] = cartoes()
    expect(outros).toHaveLength(0)
    if (chegada === undefined) throw new Error('o cartão de chegada não apareceu')
    expect(tituloDe(chegada)).toBe(ARRIVAL_CARD_TITLE)
    expect(chegada.querySelector('.pp-note__text')?.textContent).toBe('Frio e silêncio.')

    const fechar = Array.from(chegada.querySelectorAll('button')).find((botao) => botao.textContent === 'Fechar')
    if (fechar === undefined) throw new Error('cartão de chegada sem Fechar')
    act(() => fechar.click())

    const [recado, ...resto] = cartoes()
    expect(resto).toHaveLength(0)
    if (recado === undefined) throw new Error('o recado guardado não apareceu depois de fechar a chegada')
    expect(tituloDe(recado)).toBe('Recado do mestre')
    expect(recado.querySelector('.pp-note__text')?.textContent).toBe('Cuidado com a porta.')
    expect(document.body.textContent).not.toContain('Frio e silêncio.')
  })

  it('chegar noutra cena sem texto não abre cartão de chegada', () => {
    const socket = socketDoJogador()
    act(() => socket.receive({ type: 'scene.changed', by: 'master' }))
    act(() => socket.receive({ type: 'snapshot', rev: 3, map: createEmptyMap('m3', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] }))
    const titulos = cartoes().map(tituloDe)
    expect(titulos).not.toContain(ARRIVAL_CARD_TITLE)
    expect(titulos).toEqual(['Recado do mestre'])
  })
})
