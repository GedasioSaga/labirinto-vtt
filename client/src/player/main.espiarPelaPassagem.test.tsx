/**
 * ESPIAR PELA PASSAGEM na página do jogador (`main.tsx`): o caminho inteiro
 * que o jogador usa. O cartão do pino que dá vista oferece "Espiar"; o toque
 * manda `pin.peek`, o cartão sai e, quando o host responde, o quadro do outro
 * lado aparece por cima — sem entrar no mapa (o recorte do mapa não ganha a
 * ficha de lá). A recusa do host vira o aviso que diz o que fazer.
 *
 * Mesma costura de `main.pinoDePerto.test.tsx`: a `PlayerView` vira uma lista
 * de botões de pino (mais a contagem de fichas do mapa) e o `WebSocket` vira
 * um mestre falso.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Espiada } from '../lib/espiar'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ map, onPinOpen }: PlayerViewProps) => (
    <div data-testid="mapa" data-fichas={map.tokens.length}>
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

const GRADE: Pin = { id: 'grade', x: 300, y: 100, kind: 'viagem', description: 'Grade no chão', image: null, daVista: 3 }
const HEROI: Token = { id: 'heroi', characterId: null, name: 'Ana', x: GRADE.x - GRID, y: GRADE.y, size: 1, image: null }

/** O recorte do outro lado: uma ficha de lá, que nunca pode cair no mapa do jogador. */
const VISTA: Espiada = {
  raio: 150,
  grid: GRID,
  vision: [
    [
      { x: -150, y: 0 },
      { x: 0, y: -150 },
      { x: 150, y: 0 },
      { x: 0, y: 150 },
    ],
  ],
  walls: [{ x1: 60, y1: -100, x2: 60, y2: 100 }],
  doors: [],
  tokens: [{ x: 0, y: -80, size: 1, color: '#c0392b' }],
  concealed: [],
  roofs: [],
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

function temBotao(nome: string): boolean {
  return Array.from(document.querySelectorAll('button')).some((b) => b.textContent === nome)
}

const quadro = (): Element | null => document.querySelector('[aria-label="Espiando pela passagem"]')
const aviso = (): string => document.querySelector('.pp-notice')?.textContent ?? ''
const fichasNoMapa = (): string | null => document.querySelector('[data-testid="mapa"]')?.getAttribute('data-fichas') ?? null

/** Abre o cartão da grade e toca "Espiar". */
function espiar(): void {
  act(() => botao('pino grade').click())
  expect(document.body.textContent).toContain('Grade no chão')
  act(() => botao('Espiar').click())
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
  act(() => {
    mestre().manda({
      type: 'snapshot',
      rev: 1,
      map: { ...createEmptyMap('m1', '', 10, 10, GRID), pins: [GRADE], tokens: [HEROI] },
      vision: [],
      ownTokens: ['heroi'],
      concealed: [],
    })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: espiar pela passagem', () => {
  it('o cartão oferece "Espiar"; o toque pede ao host e o cartão sai', () => {
    espiar()
    expect(mestre().enviados('pin.peek')).toEqual([{ type: 'pin.peek', pinId: 'grade' }])
    // O cartão saiu para o quadro tomar o lugar dele.
    expect(document.body.textContent).not.toContain('Grade no chão')
    expect(temBotao('Espiar')).toBe(false)
    // Ainda esperando: nada de quadro.
    expect(quadro()).toBeNull()
  })

  it('o cartão reaberto durante a espera diz "Olhando…" e não deixa pedir de novo', () => {
    act(() => botao('pino grade').click())
    const olhando = botao('Olhando…')
    expect(olhando.disabled).toBe(true)
    act(() => olhando.click())
    expect(mestre().enviados('pin.peek').length).toBe(1)
    act(() => botao('Fechar').click())
    expect(document.body.textContent).not.toContain('Grade no chão')
  })

  it('o host responde: o quadro do outro lado aparece, e a ficha de lá não entra no mapa', () => {
    act(() => mestre().manda({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: VISTA }))
    expect(quadro()).not.toBeNull()
    expect(document.querySelectorAll('.pp-peek__token').length).toBe(1)
    expect(document.querySelectorAll('.pp-peek__wall').length).toBe(1)
    // Sem guardar na memória: o mapa continua só com a ficha da Ana.
    expect(fichasNoMapa()).toBe('1')
  })

  it('"Fechar" tira o quadro, e o mapa segue sem nada do outro lado', () => {
    act(() => botao('Fechar').click())
    expect(quadro()).toBeNull()
    expect(fichasNoMapa()).toBe('1')
  })

  it('o host recusa: o cartão sai e o aviso diz para encostar a ficha', () => {
    espiar()
    expect(mestre().enviados('pin.peek').length).toBe(2)
    act(() => mestre().manda({ type: 'pin.peek.rejected', pinId: 'grade', reason: 'unavailable' }))
    expect(quadro()).toBeNull()
    expect(aviso()).toBe('Não dá para espiar daqui. Encoste a ficha na passagem.')
  })

  it('logo depois da recusa dá para pedir de novo, e "cedo demais" tem aviso próprio', () => {
    espiar()
    expect(mestre().enviados('pin.peek').length).toBe(3)
    act(() => mestre().manda({ type: 'pin.peek.rejected', pinId: 'grade', reason: 'too_soon' }))
    expect(aviso()).toBe('Espere um instante para espiar de novo.')
  })
})
