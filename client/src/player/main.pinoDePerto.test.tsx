/**
 * PINO SÓ DE PERTO na página do jogador (`main.tsx`): de longe o cartão da
 * passagem abre para leitura, mas o botão fica apagado com "Chegue mais perto
 * para passar"; quando a ficha encosta (snapshot novo do host), o botão acende
 * sozinho. A recusa `far` do host vira um aviso que diz o que fazer.
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
const GRID = 50

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readonly url: string
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(url: string) {
    this.url = url
    MestreFalso.ultimo = this
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }
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
  enviados(tipo: string): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === tipo)
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

const PORTA: Pin = { id: 'porta', x: 300, y: 100, kind: 'viagem', description: 'Porta do porão', image: null }

function heroi(x: number, y: number): Token {
  return { id: 'heroi', characterId: null, name: 'Ana', x, y, size: 1, image: null }
}

/** O host manda o recorte com a ficha da Ana em (`x`, `y`). */
function snapshot(rev: number, ficha: Token): void {
  act(() => {
    mestre().manda({
      type: 'snapshot',
      rev,
      map: { ...createEmptyMap('m1', '', 10, 10, GRID), pins: [PORTA], tokens: [ficha] },
      vision: [],
      ownTokens: ['heroi'],
      concealed: [],
    })
  })
}

function botaoQueComeca(prefixo: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find((b) => (b.textContent ?? '').startsWith(prefixo))
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

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
  // Quatro casas da porta: vê, mas não alcança.
  snapshot(1, heroi(PORTA.x - 4 * GRID, PORTA.y))
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: pino de viagem só de perto', () => {
  it('de longe o cartão abre para ler, com o botão apagado dizendo para chegar mais perto', () => {
    act(() => botao('pino porta').click())
    expect(document.body.textContent).toContain('Porta do porão')
    const apagado = botao('Chegue mais perto para passar')
    expect(apagado.disabled).toBe(true)
    expect(botaoQueComeca('Pedir para passar')).toBeUndefined()
    act(() => apagado.click())
    expect(mestre().enviados('pin.travel.request')).toEqual([])
  })

  it('a ficha encosta: o botão acende sozinho, sem fechar o cartão, e o pedido sai', () => {
    snapshot(2, heroi(PORTA.x - GRID, PORTA.y))
    const pedir = botao('Pedir para passar')
    expect(pedir.disabled).toBe(false)
    expect(botaoQueComeca('Chegue mais perto')).toBeUndefined()
    act(() => pedir.click())
    act(() => botao('Pedir').click())
    expect(mestre().enviados('pin.travel.request')).toEqual([{ type: 'pin.travel.request', pinId: 'porta' }])
  })

  it('o host recusa por distância: o aviso diz para chegar mais perto', () => {
    act(() => mestre().manda({ type: 'pin.travel.rejected', reason: 'far' }))
    expect(document.querySelector('.pp-notice--travel')?.textContent).toBe('Chegue mais perto da passagem')
  })
})
