/**
 * CONGELAR FICHA montado na página do jogador (`main.tsx`): com a PRÓPRIA
 * ficha congelada, um aviso fixo diz "Congelado pelo mestre" — é o que
 * explica por que ela volta ao lugar —, e o cartão do pino apaga o pedido de
 * passagem com o mesmo motivo. Descongelar tira os dois.
 *
 * Mesma costura de `main.desistir.test.tsx`: a `PlayerView` vira uma lista de
 * botões de pino e o `WebSocket` vira um mestre falso.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ map, onPinOpen }: PlayerViewProps) => (
    <div data-testid="mapa">
      {map.pins.map((pin) => (
        <button key={pin.id} type="button" data-pin={pin.id} onClick={() => onPinOpen?.(pin.id)}>
          {`pino ${pin.id}`}
        </button>
      ))}
    </div>
  ),
}))

const CODE = 'ABC123'

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

const PORTA: Pin = { id: 'porta', x: 100, y: 100, kind: 'viagem', description: 'Porta do porão', image: null }

function heroi(extra: Partial<Token> = {}): Token {
  return { id: 'heroi', characterId: null, name: 'Ana', x: 150, y: 100, size: 1, image: null, ...extra }
}

function manda(rev: number, ficha: Token): void {
  act(() => mestre().manda({ type: 'snapshot', rev, map: { ...createEmptyMap('m1', '', 10, 10, 50), pins: [PORTA], tokens: [ficha] }, vision: [], ownTokens: ['heroi'], concealed: [] }))
}

function botao(nome: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll('button')).find((b) => b.textContent === nome) ?? null
}

const avisoFixo = (): HTMLElement | null => document.querySelector<HTMLElement>('.pp-notice--congelado')

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Ana' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' }))
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: ficha congelada pelo mestre', () => {
  it('o aviso fixo diz "Congelado pelo mestre" para leitor de tela também', () => {
    manda(1, heroi({ congelado: true }))
    const aviso = avisoFixo()
    expect(aviso?.textContent).toBe('Congelado pelo mestre')
    expect(aviso?.getAttribute('role')).toBe('status')
  })

  it('o cartão do pino apaga o pedido de passagem com o mesmo motivo', () => {
    act(() => botao('pino porta')?.click())
    const pedir = botao('Congelado pelo mestre')
    expect(pedir).not.toBeNull()
    expect(pedir?.disabled).toBe(true)
    expect(botao('Pedir para passar')).toBeNull()
  })

  it('descongelar tira o aviso e acende o pedido no cartão aberto', () => {
    manda(2, heroi())
    expect(avisoFixo()).toBeNull()
    const pedir = botao('Pedir para passar')
    expect(pedir).not.toBeNull()
    expect(pedir?.disabled).toBe(false)
  })
})
