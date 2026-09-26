/**
 * INVENTÁRIO ESTILO RESIDENT EVIL montado na página do jogador (`main.tsx`),
 * de ponta a ponta sem navegador: o botão "Inventário" da barra e a tecla I
 * abrem, Esc fecha e devolve o foco, o I digitado num campo não abre, e o
 * "Sim" do "Dar a…" sai pelo socket como o mesmo `item.give` do "Comigo".
 *
 * Mesmo molde de `main.agirSobreFicha.test.tsx`: a `PlayerView` (Pixi pede
 * WebGL) vira um marcador, e o `WebSocket` vira um falso no papel do mestre.
 */
import { act, createElement } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => createElement('div', { 'data-testid': 'mapa' }),
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

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

function botaoDoInventario(): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll<HTMLButtonElement>('.pp-bar button')).find((b) => b.getAttribute('aria-keyshortcuts') === 'I')
  if (achado === undefined) throw new Error('a barra não tem o botão do inventário')
  return achado
}

function inventario(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find((d) => document.getElementById(d.getAttribute('aria-labelledby') ?? '')?.textContent === 'Inventário') ?? null
}

function tecla(key: string, alvo: Element = document.activeElement ?? document.body): void {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

function botao(texto: string, dentro: ParentNode): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)
  if (!(achado instanceof HTMLButtonElement)) throw new Error(`sem o botão "${texto}"`)
  return achado
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Jill' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Jill' })
    mestre().manda({
      type: 'snapshot',
      rev: 1,
      map: {
        ...createEmptyMap('m1', '', 12, 6, 50),
        tokens: [
          ficha('jill', 'Jill', 100, { moedas: 15, mochila: [{ id: 'chave-1', nome: 'Chave do Escudo' }], health: { current: 20, max: 100, shownToPlayers: true } }),
          ficha('diego', 'Diego', 150),
        ],
      },
      vision: [],
      ownTokens: ['jill'],
      partyTokens: ['diego'],
      concealed: [],
    })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: o inventário de ponta a ponta', () => {
  it('a barra de cima tem "Inventário"; o clique abre o inventário com a ficha dele', () => {
    const abrir = botaoDoInventario()
    expect(abrir.textContent).toContain('Inventário')
    expect(abrir.getAttribute('aria-haspopup')).toBe('dialog')
    act(() => abrir.focus())
    act(() => abrir.click())
    const aberto = inventario()
    expect(aberto).not.toBeNull()
    expect(aberto?.querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe('Itens de Jill')
    expect(aberto?.querySelector('.pp-inv-ecg')?.getAttribute('aria-label')).toBe('Condição: Perigo')
  })

  it('Esc fecha e o foco volta ao botão da barra', () => {
    tecla('Escape')
    expect(inventario()).toBeNull()
    expect(document.activeElement).toBe(botaoDoInventario())
  })

  it('a tecla I abre sem animação; I de novo fecha', () => {
    act(() => botaoDoInventario().blur())
    tecla('i', document.body)
    expect(inventario()).not.toBeNull()
    expect(document.querySelector('.pp-inv')?.hasAttribute('data-instant')).toBe(true)
    tecla('I')
    expect(inventario()).toBeNull()
  })

  it('o I digitado num campo de texto não abre nada', () => {
    const campo = document.querySelector<HTMLInputElement>('input[type="text"]')
    if (campo === null) throw new Error('esperava o campo do nome no painel')
    act(() => campo.focus())
    tecla('i', campo)
    expect(inventario()).toBeNull()
  })

  it('"Dar a…" → Diego → Sim manda o mesmo item.give do "Comigo"', () => {
    act(() => botaoDoInventario().click())
    const aberto = inventario()
    if (aberto === null) throw new Error('o inventário não abriu')
    const chave = aberto.querySelector<HTMLButtonElement>('[role="gridcell"] button[aria-label="Chave do Escudo"]')
    if (chave === null) throw new Error('sem a vaga da chave')
    act(() => chave.click())
    act(() => botao('Dar a…', aberto).click())
    act(() => botao('Diego', aberto).click())
    act(() => botao('Sim', aberto).click())
    expect(mestre().enviados('item.give')).toEqual([{ type: 'item.give', itemId: 'chave-1', toTokenId: 'diego' }])
  })
})
