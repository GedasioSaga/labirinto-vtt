/**
 * VISOR DO ITEM montado na página do jogador (`main.tsx`), de ponta a ponta sem
 * navegador: o texto que o mestre escreveu no item chega ao jogador só no PINO
 * (`description`, quando a ficha consegue ler). Pegar tira o pino do mapa e a
 * mochila leva só `{ id, nome }` — então a página guarda o que o jogador leu,
 * pelo id do pino (que é o id do item), e o visor do inventário mostra esse
 * texto depois. Nada novo sai do host: o teste só manda o que o recorte já
 * manda (`fogFilter.ts`, `pinForPlayer` e a mochila do dono).
 *
 * Mesmo molde de `main.inventario.test.tsx`: a `PlayerView` (Pixi pede WebGL)
 * vira um marcador, e o `WebSocket` vira um falso no papel do mestre.
 */
import { act, createElement } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => createElement('div', { 'data-testid': 'mapa' }),
}))

const CODE = 'ABC123'
const TEXTO_DA_CHAVE = 'Uma chave pesada, com um escudo gravado.'

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

/** O pino da chave como o recorte manda: legível, com o texto do mestre e o item. */
function pinoDaChave(extra: Partial<Pin> = {}): Pin {
  return { ...buildPin('chave-1', { x: 125, y: 100 }, 'exclamacao'), description: TEXTO_DA_CHAVE, item: { nome: 'Chave do Escudo', livre: true }, ...extra }
}

function recorte(rev: number, pins: Pin[], mochila: Token['mochila']): unknown {
  return {
    type: 'snapshot',
    rev,
    map: {
      ...createEmptyMap('m1', '', 12, 6, 50),
      pins,
      tokens: [ficha('jill', 'Jill', 100, { mochila }), ficha('diego', 'Diego', 150)],
    },
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

function inventario(): HTMLElement {
  const achado = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find((d) => document.getElementById(d.getAttribute('aria-labelledby') ?? '')?.textContent === 'Inventário')
  if (achado === undefined) throw new Error('o inventário não abriu')
  return achado
}

function vaga(rotulo: string): HTMLButtonElement {
  const achado = inventario().querySelector<HTMLButtonElement>(`[role="gridcell"] button[aria-label="${rotulo}"]`)
  if (achado === null) throw new Error(`sem a vaga "${rotulo}"`)
  return achado
}

function textoDoVisor(): string | null | undefined {
  return inventario().querySelector('.pp-inv__detalhe-texto')?.textContent
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
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Jill' })
    // A chave ainda no chão, perto da Jill: o recorte manda o texto do mestre.
    mestre().manda(recorte(1, [pinoDaChave()], [{ id: 'isqueiro-1', nome: 'Isqueiro' }]))
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: o visor do item mostra o texto que o jogador leu no chão', () => {
  it('depois de pegar, o pino some e a mochila só diz o nome; o visor ainda traz o texto do mestre', () => {
    act(() => mestre().manda(recorte(2, [], [{ id: 'isqueiro-1', nome: 'Isqueiro' }, { id: 'chave-1', nome: 'Chave do Escudo' }])))
    act(() => botaoDoInventario().click())
    act(() => vaga('Chave do Escudo').click())
    expect(textoDoVisor()).toBe(TEXTO_DA_CHAVE)
  })

  it('item que o jogador nunca leu no chão: o texto do visor sai do tipo, nunca "na sua mochila"', () => {
    act(() => vaga('Isqueiro').click())
    expect(textoDoVisor()).toBe('Para usar, diga ao mestre o que quer fazer com ele.')
    expect(textoDoVisor()).not.toMatch(/mochila|bolsa/i)
  })

  it('devolvido ao chão e visto de longe (pino vazio), o texto que o jogador já leu não se perde', () => {
    tecla('Escape')
    act(() => mestre().manda(recorte(3, [pinoDaChave({ description: '', longe: true })], [{ id: 'isqueiro-1', nome: 'Isqueiro' }])))
    act(() => mestre().manda(recorte(4, [], [{ id: 'isqueiro-1', nome: 'Isqueiro' }, { id: 'chave-1', nome: 'Chave do Escudo' }])))
    act(() => botaoDoInventario().click())
    act(() => vaga('Chave do Escudo').click())
    expect(textoDoVisor()).toBe(TEXTO_DA_CHAVE)
  })
})
