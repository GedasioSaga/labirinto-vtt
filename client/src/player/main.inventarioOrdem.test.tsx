/**
 * ORDEM ESTÁVEL DA GRADE na página do jogador (`main.tsx`): o mapa novo que
 * chega do host não embaralha as vagas. O host acrescenta cada item no fim da
 * mochila e a vaga da bolsa só existe com saldo, na frente de tudo; sem a
 * memória da página, ganhar as primeiras moedas empurrava todos os itens uma
 * casa, e dar a primeira de duas Ervas mandava a Erva para depois da Chave.
 * Nada muda no host: a página só lembra a ordem que já mostrou.
 *
 * Mesmo molde de `main.inventario.test.tsx`: a `PlayerView` (Pixi pede WebGL)
 * vira um marcador, e o `WebSocket` vira um falso no papel do mestre.
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
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

/** O mapa que o mestre manda: a Jill (a ficha do jogador) com esta mochila, e o Diego ao lado. */
function snapshot(rev: number, jill: Partial<Token>): unknown {
  return {
    type: 'snapshot',
    rev,
    map: { ...createEmptyMap('m1', '', 12, 6, 50), tokens: [ficha('jill', 'Jill', 100, jill), ficha('diego', 'Diego', 150)] },
    vision: [],
    ownTokens: ['jill'],
    partyTokens: ['diego'],
    concealed: [],
  }
}

function botaoDoInventario(): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll<HTMLButtonElement>('.pp-bar button')).find((b) => b.getAttribute('aria-keyshortcuts') === 'I')
  if (achado === undefined) throw new Error('a barra não tem o botão do inventário')
  return achado
}

/** As vagas da grade aberta, na ordem em que aparecem: o rótulo que o leitor de tela lê. */
function vagas(): string[] {
  return Array.from(document.querySelectorAll('.pp-inv [role="gridcell"] button')).map((b) => b.getAttribute('aria-label') ?? '')
}

function tecla(key: string, alvo: Element = document.activeElement ?? document.body): void {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
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
    await import('./boot')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Jill' })
    mestre().manda(
      snapshot(1, {
        mochila: [
          { id: 'erva-1', nome: 'Erva verde' },
          { id: 'chave-1', nome: 'Chave do Escudo' },
          { id: 'erva-2', nome: 'Erva verde' },
        ],
      }),
    )
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: a grade do inventário não embaralha quando o mapa muda', () => {
  it('na primeira vez, a grade segue a ordem em que os itens foram pegos', () => {
    act(() => botaoDoInventario().click())
    expect(vagas()).toEqual(['Erva verde, 2 unidades', 'Chave do Escudo'])
  })

  it('com o inventário aberto, dar uma Erva e ganhar moedas e uma Faca: quem estava fica, o novo entra no fim', () => {
    // O host tirou a erva-1 (dada a um colega), creditou 5 moedas e a Jill pegou uma Faca.
    act(() => {
      mestre().manda(
        snapshot(2, {
          moedas: 5,
          mochila: [
            { id: 'chave-1', nome: 'Chave do Escudo' },
            { id: 'erva-2', nome: 'Erva verde' },
            { id: 'faca-1', nome: 'Faca' },
          ],
        }),
      )
    })
    expect(vagas()).toEqual(['Erva verde', 'Chave do Escudo', 'Moedas: 5', 'Faca'])
  })

  it('fechar e abrir de novo não reordena', () => {
    tecla('Escape')
    expect(document.querySelector('.pp-inv')).toBeNull()
    act(() => botaoDoInventario().click())
    expect(vagas()).toEqual(['Erva verde', 'Chave do Escudo', 'Moedas: 5', 'Faca'])
  })
})
