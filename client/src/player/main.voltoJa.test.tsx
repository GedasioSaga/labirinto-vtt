/**
 * "VOLTO JÁ" na página do jogador (`main.tsx`), de ponta a ponta sem
 * navegador: o botão do Painel avisa o mestre, a tela vira "Você está fora da
 * mesa · Voltar", a queda da conexão nesse meio-tempo não vira "A conexão
 * caiu", e o "Voltar" religa, retoma a mesma sessão e devolve o mapa com o
 * pedido que esperava o mestre.
 *
 * Mesmo arranjo de `main.pistas.test.tsx`: a `PlayerView` (Pixi pede WebGL)
 * vira uma marca simples, e o `WebSocket` vira um falso que faz o mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => <div data-testid="mapa">mapa</div>,
}))

const CODE = 'ABC123'
const HEROI: Token = { id: 'heroi', characterId: null, name: 'Gabi', x: 100, y: 100, size: 1, image: null }

class MestreFalso {
  static ultimo: MestreFalso | null = null
  static criados = 0
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
    MestreFalso.criados += 1
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
  cai(): void {
    this.readyState = 3
    this.onclose?.(new CloseEvent('close'))
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

function snapshot(rev: number) {
  return { type: 'snapshot', rev, map: { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [HEROI] }, vision: [], ownTokens: ['heroi'], concealed: [] }
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

const texto = (): string => document.body.textContent ?? ''
const mapaNaTela = (): boolean => document.querySelector('[data-testid="mapa"]') !== null

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Gabi' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' })
    mestre().manda(snapshot(1))
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: Volto já de ponta a ponta', () => {
  it('o botão do Painel avisa o mestre e a tela vira "fora da mesa", sem o mapa', () => {
    expect(mapaNaTela()).toBe(true)
    act(() => botao('Volto já').click())
    expect(mestre().enviados('away')).toEqual([{ type: 'away', away: true }])
    act(() => mestre().manda({ type: 'away', away: true }))
    expect(texto()).toContain('Você está fora da mesa')
    expect(botao('Voltar').disabled).toBe(false)
    expect(mapaNaTela()).toBe(false)
  })

  it('a conexão cai durante o Volto já: nada de aviso de queda', () => {
    act(() => mestre().cai())
    expect(texto()).not.toContain('A conexão com o mestre caiu')
    expect(texto()).toContain('Você está fora da mesa')
  })

  it('"Voltar" religa, retoma a mesma sessão, sai do Volto já e devolve o mapa com o pedido que esperava', () => {
    const antes = MestreFalso.criados
    act(() => botao('Voltar').click())
    expect(MestreFalso.criados).toBe(antes + 1)
    act(() => mestre().abre())
    expect(mestre().sent[0]).toEqual({ type: 'join', code: CODE, name: 'Gabi', resume: 'tok' })
    act(() => {
      mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' })
      // O mestre ainda a tem como fora: é o aviso que vem antes do mapa na retomada.
      mestre().manda({ type: 'away', away: true, travelPending: true })
      mestre().manda(snapshot(2))
    })
    // Quem apertou "Voltar" não fica preso no "fora": a página pede a volta sozinha.
    expect(mestre().enviados('away')).toEqual([{ type: 'away', away: false }])
    act(() => mestre().manda({ type: 'away', away: false, travelPending: true }))
    expect(mapaNaTela()).toBe(true)
    expect(texto()).not.toContain('Você está fora da mesa')
    expect(texto()).toContain('Aguardando o mestre…')
  })

  it('com a conexão de pé, "Voltar" só avisa o mestre — sem socket novo', () => {
    act(() => botao('Volto já').click())
    expect(texto()).toContain('Você está fora da mesa')
    const antes = MestreFalso.criados
    act(() => botao('Voltar').click())
    expect(MestreFalso.criados).toBe(antes)
    expect(mestre().enviados('away')).toEqual([
      { type: 'away', away: false },
      { type: 'away', away: true },
      { type: 'away', away: false },
    ])
    expect(mapaNaTela()).toBe(true)
  })
})
