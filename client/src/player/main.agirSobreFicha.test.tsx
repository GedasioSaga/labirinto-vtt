/**
 * AGIR SOBRE UMA FICHA montado na página do jogador (`main.tsx`), de ponta a
 * ponta sem navegador: o toque na ficha alheia abre o cartão, "Enviar ao
 * mestre" manda o pedido, o aviso "Aguardando…" aparece, e a resposta do
 * mestre chega — em texto, num cartão que fica até o jogador fechar. Os outros
 * testes provam cada peça sozinha; este quebra se a costura sair de
 * `main.tsx` (o `onTokenOpen`, o cartão da ficha, o aviso ou o cartão da resposta).
 *
 * Mesmo molde de `main.pistas.test.tsx`: a `PlayerView` (Pixi pede WebGL)
 * vira uma lista de botões, um por ficha, que chama o mesmo `onTokenOpen`; e o
 * `WebSocket` vira um falso que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ map, onTokenOpen }: PlayerViewProps) => (
    <div data-testid="mapa">
      {map.tokens.map((token) => (
        <button key={token.id} type="button" onClick={() => onTokenOpen?.(token.id)}>
          {`ficha ${token.id}`}
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

function ficha(id: string, name: string, x: number): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null }
}

function botao(nome: string, dentro: ParentNode = document): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

function dialogo(): HTMLElement {
  const aberto = document.querySelector<HTMLElement>('[role="dialog"]')
  if (!aberto) throw new Error('nenhum cartão aberto')
  return aberto
}

function digita(campo: HTMLInputElement, valor: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(campo, valor)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Os avisos de baixo da tela (`pp-notice`), pelo texto. */
function avisos(): string[] {
  return Array.from(document.querySelectorAll('.pp-notice')).map((p) => p.textContent ?? '')
}

/** O `reqId` do último pedido de ação que a página mandou. */
function ultimoReqId(): string {
  const ultimo = mestre().enviados('token.action').at(-1)
  if (typeof ultimo !== 'object' || ultimo === null || !('reqId' in ultimo) || typeof ultimo.reqId !== 'string') throw new Error('nenhum pedido de ação saiu')
  return ultimo.reqId
}

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
    mestre().manda({
      type: 'snapshot',
      rev: 1,
      map: { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [ficha('lanterna', 'Gabi', 100), ficha('severa', 'Mulher de capuz', 200)] },
      vision: [],
      ownTokens: ['lanterna'],
      concealed: [],
    })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: agir sobre uma ficha de ponta a ponta', () => {
  it('tocar na PRÓPRIA ficha não abre cartão nenhum', () => {
    act(() => botao('ficha lanterna').click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('tocar na ficha alheia abre o cartão; "Enviar ao mestre" manda o pedido e mostra "Aguardando…"', () => {
    act(() => botao('ficha severa').click())
    expect(dialogo().getAttribute('aria-label')).toBe('Ficha: Mulher de capuz')
    act(() => botao('Falar', dialogo()).click())
    const campo = dialogo().querySelector('input')
    if (!(campo instanceof HTMLInputElement)) throw new Error('sem o campo do que ele diz')
    digita(campo, 'Você viu o Lemos?')
    act(() => botao('Enviar ao mestre', dialogo()).click())

    expect(mestre().enviados('token.action')).toEqual([{ type: 'token.action', reqId: expect.any(String), tokenId: 'severa', action: 'falar', text: 'Você viu o Lemos?' }])
    // Enviado, o cartão sai e o mapa volta à vista.
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(avisos()).toContain('Pedido ao mestre: Falar com Mulher de capuz. Aguardando…')
  })

  it('a resposta em texto do mestre chega num cartão só para ela, e fica até o jogador fechar', () => {
    act(() => mestre().manda({ type: 'token.action.answer', reqId: ultimoReqId(), accepted: true, reply: 'Ela aponta a torre: "Subiu ontem."' }))
    const cartao = Array.from(document.querySelectorAll('section')).find((s) => s.querySelector('h2')?.textContent === 'O mestre aceitou: Falar com Mulher de capuz')
    if (cartao === undefined) throw new Error('sem o cartão da resposta')
    expect(cartao.textContent).toContain('Ela aponta a torre: "Subiu ontem."')
    // O cartão toma o lugar do aviso "Aguardando…".
    expect(avisos()).toEqual([])
    act(() => botao('Fechar', cartao).click())
    expect(cartao.isConnected).toBe(false)
  })

  it('resposta sem texto vira só o aviso curto: "O mestre recusou: Empurrar Mulher de capuz"', () => {
    act(() => botao('ficha severa').click())
    act(() => botao('Empurrar', dialogo()).click())
    act(() => botao('Enviar ao mestre', dialogo()).click())
    expect(mestre().enviados('token.action')).toHaveLength(2)
    act(() => mestre().manda({ type: 'token.action.answer', reqId: ultimoReqId(), accepted: false }))
    expect(avisos()).toEqual(['O mestre recusou: Empurrar Mulher de capuz'])
  })
})
