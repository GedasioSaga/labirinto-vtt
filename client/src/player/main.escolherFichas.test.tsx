/**
 * ESCOLHER FICHAS NO PINO montado na página do jogador (`main.tsx`): o cartão
 * do pino oferece só as fichas DELE que estão no grupo do pino (a mais perto e
 * as vizinhas), nunca a de outro jogador nem a dele que está longe, e o pedido
 * leva as marcadas.
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

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

const ESCOTILHA: Pin = { id: 'escotilha', x: 300, y: 200, kind: 'viagem', description: 'Escotilha', image: null }

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
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Enzo' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./boot')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Enzo' })
    mestre().manda({
      type: 'snapshot',
      rev: 1,
      map: {
        ...createEmptyMap('m1', '', 40, 10, 50),
        pins: [ESCOTILHA],
        // Rufo é a mais perto; Tito é dele mas está longe; Bia é de outra jogadora, colada no pino.
        tokens: [ficha('enzo', 'Enzo', 240, 200), ficha('rufo', 'Rufo', 270, 200), ficha('longe', 'Tito', 1200, 200), ficha('bia', 'Bia', 310, 200)],
      },
      vision: [],
      ownTokens: ['enzo', 'rufo', 'longe'],
      concealed: [],
    })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: escolher quais fichas passam pelo pino', () => {
  it('o cartão oferece Rufo e Enzo (nem Tito, longe, nem Bia, de outra); desmarcar Rufo manda só o Enzo', () => {
    act(() => botao('pino escotilha').click())
    act(() => botao('Pedir para passar').click())
    const nomes = Array.from(document.querySelectorAll('fieldset label')).map((l) => l.textContent)
    expect(nomes).toEqual(['Rufo', 'Enzo'])
    const rufo = Array.from(document.querySelectorAll('fieldset label')).find((l) => l.textContent === 'Rufo')
    act(() => rufo?.querySelector('input')?.click())
    act(() => botao('Pedir').click())
    expect(mestre().enviados('pin.travel.request')).toEqual([{ type: 'pin.travel.request', pinId: 'escotilha', tokenIds: ['enzo'] }])
  })
})
