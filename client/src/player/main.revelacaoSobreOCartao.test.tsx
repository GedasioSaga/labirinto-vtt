/**
 * REVELAÇÃO DO LOCAL por cima do cartão do pino (`main.tsx`): o pino "!" abre
 * o cartão e, da primeira vez, a revelação por cima dele. Tocar na revelação
 * ("Pular", "Fechar", o painel) é usar a revelação, não "tocar fora" do
 * cartão: ao fechar, o cartão continua ali por baixo, como acontece com o Esc
 * (`CenarioOverlay.tsx`: "a tela escura some e o cartão do pino aparece por
 * baixo"). Achado na conferência no navegador: o clique em "Fechar" fechava o
 * cartão junto, e o "Ver animação" sumia.
 *
 * Mesma costura de `main.pinoDePerto.test.tsx`: a `PlayerView` vira uma lista
 * de botões de pino e o `WebSocket` vira um mestre falso.
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

const POCO: Pin = { id: 'poco', x: 150, y: 100, kind: 'exclamacao', description: 'A água brilha verde.', image: null, nome: 'Poço antigo' }
const ANA: Token = { id: 'heroi', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

/** O toque de verdade: o pointerdown que o cartão ouve na janela, depois o clique. */
function tocar(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    el.click()
  })
}

const cartao = (): Element | null => document.querySelector('.pp-pincard')
/** O botão da revelação ("Pular" que vira "Fechar"); o cartão por baixo tem o próprio "Fechar". */
function botaoDaRevelacao(rotulo: string): HTMLButtonElement {
  const achado = document.querySelector<HTMLButtonElement>('.lb-revelacao__pular')
  if (achado === null || achado.textContent !== rotulo) throw new Error(`a revelação não mostra "${rotulo}"`)
  return achado
}
const revelacao = (): Element | null => document.querySelector('.lb-revelacao-jogo')

beforeAll(async () => {
  vi.useFakeTimers()
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Ana' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./boot')
  })
  act(() => mestre().abre())
  act(() => mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' }))
  act(() => {
    mestre().manda({
      type: 'snapshot',
      rev: 1,
      map: { ...createEmptyMap('m1', '', 10, 10, GRID), pins: [POCO], tokens: [ANA] },
      vision: [],
      ownTokens: ['heroi'],
      concealed: [],
    })
  })
})

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: a revelação do local por cima do cartão do pino', () => {
  it('tocar em "Pular" e em "Fechar" fecha só a revelação; o cartão continua por baixo', () => {
    act(() => botao('pino poco').click())
    expect(revelacao(), 'o pino "!" sem imagem abre a revelação da primeira vez').not.toBeNull()
    expect(cartao(), 'o cartão abre junto, por baixo').not.toBeNull()

    tocar(botaoDaRevelacao('Pular'))
    expect(cartao(), 'tocar em "Pular" não é tocar fora do cartão').not.toBeNull()

    tocar(botaoDaRevelacao('Fechar'))
    act(() => vi.advanceTimersByTime(1000))
    expect(revelacao(), '"Fechar" fecha a revelação').toBeNull()
    expect(cartao(), 'o cartão do pino continua aberto depois da revelação').not.toBeNull()
  })
})
