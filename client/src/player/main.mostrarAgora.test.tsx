/**
 * "MOSTRAR AGORA A…" montado na página do jogador (`main.tsx`), sem navegador:
 * o `pin.show` do mestre abre sozinho o cartão na tela de quem recebeu, mesmo
 * sem o pino no mapa dela; "Fechar" fecha; e, com um recado aberto embaixo, o
 * Escape fecha primeiro o cartão de cima. `playerConnection.mostrarPista.test.ts`
 * prova o estado; este quebra se a costura sair de `main.tsx`.
 *
 * Só o que o jsdom não tem é trocado, como em `main.doisPinos.test.tsx`: a
 * `PlayerView` (Pixi pede WebGL) vira um div, e o `WebSocket` vira um falso
 * que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => <div data-testid="mapa" />,
}))

const CODE = 'ABC123'
const TEXTO_DA_CARTA = 'Querido irmão, o cofre fica atrás do quadro.'

/** O mestre do outro lado do fio: guarda o que o jogador mandou e entrega o que o teste manda. */
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

function manda(message: unknown): void {
  act(() => mestre().manda(message))
}

function dialogos(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
}

function cartaoDoPino(): HTMLElement | null {
  return dialogos().find((d) => d.classList.contains('pp-pincard')) ?? null
}

function botao(nome: string, dentro: ParentNode): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) => b.textContent?.trim() === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

function escape(): void {
  act(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  // A aba já tinha entrado nesta sala: a página volta direto, sem o formulário.
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Ana' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
  // O mapa dela não tem pino nenhum: a carta está numa sala que ela nunca viu.
  manda({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: o cartão que o mestre mostrou', () => {
  it('pin.show abre o cartão sozinho, com o texto, sem o pino estar no mapa; "Fechar" fecha', () => {
    expect(cartaoDoPino()).toBeNull()
    manda({ type: 'pin.show', pin: { id: 'carta', kind: 'exclamacao', description: TEXTO_DA_CARTA, image: null } })
    const cartao = cartaoDoPino()
    if (cartao === null) throw new Error('o cartão mostrado pelo mestre deveria abrir sozinho')
    expect(cartao.querySelector('.pp-pincard__text')?.textContent).toBe(TEXTO_DA_CARTA)
    // Mostrado não é tocado: o jogador não pede nada ao mestre por abrir.
    expect(mestre().sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'clue.read')).toEqual([])
    act(() => botao('Fechar', cartao).click())
    expect(cartaoDoPino()).toBeNull()
  })

  it('com o recado do mestre aberto, o cartão mostrado fica por cima: o Escape fecha só ele, e o recado continua', () => {
    manda({ type: 'scene.note', id: 'n1', text: 'Ouve-se um grito no andar de cima.' })
    manda({ type: 'pin.show', pin: { id: 'carta', kind: 'exclamacao', description: TEXTO_DA_CARTA, image: null } })
    expect(cartaoDoPino()).not.toBeNull()
    escape()
    expect(cartaoDoPino()).toBeNull()
    expect(document.body.textContent).toContain('Ouve-se um grito no andar de cima.')
  })
})
