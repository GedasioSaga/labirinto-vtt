/**
 * RECADO PARA QUEM ESTÁ FORA montado na página do jogador (`main.tsx`): o
 * `notes.away` da volta abre o cartão "Enquanto você esteve fora (N)" com os
 * recados em ordem, como TEXTO; "Fechar" tira o cartão. Só o que o jsdom não
 * tem é trocado: a `PlayerView` (Pixi pede WebGL) e o `WebSocket`.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => <div data-testid="mapa" />,
}))

const CODE = 'ABC123'
const AS_20_30 = new Date(2026, 8, 24, 20, 30).getTime()

/** O mestre do outro lado do fio: entrega o que o teste manda. */
class MestreFalso {
  static ultimo: MestreFalso | null = null
  readonly url: string
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(url: string) {
    this.url = url
    MestreFalso.ultimo = this
  }
  send(): void {}
  close(): void {
    this.readyState = 3
  }
  abre(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  manda(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

function cartaoDeFora(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('section.pp-note')).find((s) => /Enquanto você esteve fora/.test(s.textContent ?? '')) ?? null
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Bruno' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Bruno' })
    mestre().manda({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: Enquanto você esteve fora', () => {
  it('sem fila, sem cartão', () => {
    expect(cartaoDeFora()).toBeNull()
  })

  it('a fila da volta abre o cartão com a contagem e os recados em ordem, como texto; "Fechar" tira', () => {
    act(() =>
      mestre().manda({
        type: 'notes.away',
        notes: [
          { id: 'n1', text: 'a guarda troca à meia-noite', at: AS_20_30 },
          { id: 'n2', text: '<b>a chave</b> está no balde', at: AS_20_30 + 60_000 },
        ],
      }),
    )
    const cartao = cartaoDeFora()
    if (cartao === null) throw new Error('o cartão "Enquanto você esteve fora" não abriu')
    expect(cartao.querySelector('h2')?.textContent).toBe('Enquanto você esteve fora (2)')
    const itens = Array.from(cartao.querySelectorAll('li')).map((li) => li.textContent)
    expect(itens).toEqual(['20:30 · Mestre: a guarda troca à meia-noite', '20:31 · Mestre: <b>a chave</b> está no balde'])
    // HTML do mestre aparece literal: nenhum <b> criado.
    expect(cartao.querySelector('b')).toBeNull()

    const fechar = Array.from(cartao.querySelectorAll('button')).find((b) => b.textContent === 'Fechar')
    if (!fechar) throw new Error('sem o botão Fechar')
    act(() => fechar.click())
    expect(cartaoDeFora()).toBeNull()
  })
})
