/**
 * TELA NÃO APAGA montada na página do jogador (`main.tsx`), sem navegador:
 * Fabi entra na sala pelo celular. Enquanto está na sessão, a página pede ao
 * navegador a tela acesa (Wake Lock) e um selo discreto diz "Tela acesa";
 * quando o navegador solta (aba escondida) o selo some e, ao voltar, a página
 * pede de novo; quando o mestre a tira da sala, a trava é solta.
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira um
 * `div`, o `WebSocket` vira um falso que faz o papel do mestre, e o
 * `navigator.wakeLock` vira um falso que entrega uma trava por pedido.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => <div data-testid="mapa" />,
}))

const CODE = 'ABC123'

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readyState = 0
  sent: string[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor() {
    MestreFalso.ultimo = this
  }
  send(data: string): void {
    this.sent.push(data)
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
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

class TravaFalsa extends EventTarget {
  released = false
  readonly release = vi.fn(async () => {
    if (this.released) return
    this.released = true
    this.dispatchEvent(new Event('release'))
  })
  soltaPeloNavegador(): void {
    this.released = true
    this.dispatchEvent(new Event('release'))
  }
}

const travas: TravaFalsa[] = []
const pedirTela = vi.fn(async (_type: 'screen') => {
  const trava = new TravaFalsa()
  travas.push(trava)
  return trava
})

function ultimaTrava(): TravaFalsa {
  const trava = travas.at(-1)
  if (trava === undefined) throw new Error('a página nunca pediu a tela acesa')
  return trava
}

let visibilidade: DocumentVisibilityState = 'visible'

const MAPA: MapData = {
  ...createEmptyMap('vila', '', 20, 12, 50),
  tokens: [{ id: 'fabi', characterId: null, name: 'Fabi', x: 300, y: 300, size: 1, image: null }],
}

function selo(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('.pp-awake')).find((el) => /Tela acesa/.test(el.textContent ?? '')) ?? null
}

/** Deixa as promessas pendentes (o pedido ao navegador) terminarem dentro do `act`. */
async function assenta(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: pedirTela } })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilidade })
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Fabi' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Fabi' })
    mestre().manda({ type: 'snapshot', rev: 1, map: MAPA, vision: [], ownTokens: ['fabi'], concealed: [] })
  })
  await assenta()
})

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'wakeLock')
  Reflect.deleteProperty(document, 'visibilityState')
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: a tela do celular não apaga durante a sessão', () => {
  it('na sessão: pede a tela acesa ao navegador e o selo "Tela acesa" aparece junto do mapa', () => {
    expect(document.querySelector('[data-testid="mapa"]')).not.toBeNull()
    expect(pedirTela).toHaveBeenCalledWith('screen')
    expect(ultimaTrava().released).toBe(false)
    expect(selo()).not.toBeNull()
  })

  it('o selo é discreto: não pega toque nem entra no Tab', () => {
    const el = selo()
    if (el === null) throw new Error('selo fora da tela')
    expect(el.querySelector('button, a, input')).toBeNull()
    expect(el.getAttribute('tabindex')).toBeNull()
  })

  it('o navegador solta a trava (aba escondida): o selo some; ao voltar à aba, pede de novo e o selo volta', async () => {
    const pedidosAntes = pedirTela.mock.calls.length
    visibilidade = 'hidden'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      ultimaTrava().soltaPeloNavegador()
    })
    expect(selo()).toBeNull()

    visibilidade = 'visible'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await assenta()
    expect(pedirTela.mock.calls.length).toBe(pedidosAntes + 1)
    expect(selo()).not.toBeNull()
  })

  it('o mestre tira Fabi da sala: a trava é solta e o selo some', async () => {
    const trava = ultimaTrava()
    act(() => mestre().manda({ type: 'kicked' }))
    await assenta()
    expect(trava.release).toHaveBeenCalled()
    expect(trava.released).toBe(true)
    expect(selo()).toBeNull()
    expect(document.body.textContent).toContain('Você foi removido da sala')
  })
})
