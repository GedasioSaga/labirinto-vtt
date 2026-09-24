/**
 * DESISTIR DO PEDIDO montado na página do jogador (`main.tsx`): o aviso
 * "Aguardando o mestre…" ganha o botão "Desistir", que manda
 * `pin.travel.cancel`, mostra que está desistindo e, quando o host confirma,
 * troca o aviso por "Pedido retirado". O pedido que cai porque a ficha se
 * afastou diz isso.
 *
 * Mesma costura de `main.pistas.test.tsx`: a `PlayerView` vira uma lista de
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

const PORTA: Pin = { id: 'porta', x: 100, y: 100, kind: 'viagem', description: 'Porta do porão', image: null }

function botao(nome: string, dentro: ParentNode = document): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

/** O aviso da viagem, embaixo da tela. */
function avisoDaViagem(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.pp-notice--travel')
}

/** Toca o pino e confirma o pedido: o aviso de espera aparece. */
function pedirPassagem(): void {
  act(() => botao('pino porta').click())
  act(() => botao('Pedir para passar').click())
  act(() => botao('Pedir').click())
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
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
    // A ficha da Ana encostada na porta: de longe o cartão não deixa pedir.
    const ficha: Token = { id: 'heroi', characterId: null, name: 'Ana', x: 150, y: 100, size: 1, image: null }
    mestre().manda({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('m1', '', 10, 10, 50), pins: [PORTA], tokens: [ficha] }, vision: [], ownTokens: ['heroi'], concealed: [] })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: desistir do pedido de passagem', () => {
  it('o aviso de espera tem "Desistir"; tocar manda a desistência e o botão mostra que está desistindo', () => {
    pedirPassagem()
    const aviso = avisoDaViagem()
    if (aviso === null) throw new Error('sem o aviso de espera')
    expect(aviso.textContent).toContain('Aguardando o mestre…')
    const desistir = botao('Desistir', aviso)
    expect(desistir.disabled).toBe(false)

    act(() => desistir.click())
    expect(mestre().enviados('pin.travel.cancel')).toEqual([{ type: 'pin.travel.cancel' }])
    const desistindo = botao('Desistindo…', avisoDaViagem() ?? document)
    expect(desistindo.disabled).toBe(true)
  })

  it('o host confirma: o aviso diz "Pedido retirado" e o botão sai', () => {
    act(() => mestre().manda({ type: 'pin.travel.cancelled', reason: 'player' }))
    const aviso = avisoDaViagem()
    expect(aviso?.textContent).toBe('Pedido retirado')
    expect(aviso?.querySelector('button')).toBeNull()
  })

  it('a ficha se afastou: o aviso diz que o pedido caiu por isso', () => {
    pedirPassagem()
    expect(mestre().enviados('pin.travel.request')).toHaveLength(2)
    act(() => mestre().manda({ type: 'pin.travel.cancelled', reason: 'far' }))
    expect(avisoDaViagem()?.textContent).toBe('Você se afastou da passagem. Pedido retirado')
  })
})
