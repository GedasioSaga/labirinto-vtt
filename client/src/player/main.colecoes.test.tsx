/**
 * COLEÇÃO DE PISTAS montada na página do jogador (`main.tsx`): o que o host
 * manda (`colecoes`) tem de aparecer no Caderno, e a casa cheia reabre o
 * cartão da pista. `PlayerColecoes.test.tsx` prova o Painel com `colecoes`
 * passado à mão; este quebra se a costura sair de `main.tsx`.
 *
 * Mesmo arranjo de `main.pistas.test.tsx`: a `PlayerView` (Pixi pede WebGL)
 * vira uma lista de botões e o `WebSocket` vira um mestre falso.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ColecaoProgresso } from '../lib/colecao'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'

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

const AS_21_15 = new Date(2026, 8, 24, 21, 15).getTime()
const CODE = 'ABC123'
const UMA_DE_DUAS: ColecaoProgresso = { nome: 'Letreiro', total: 2, partes: [{ parte: 1, clueId: 'c1' }], completa: false }

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

function pino(id: string, description: string): Pin {
  return { id, x: 100, y: 100, kind: 'exclamacao', description, image: null }
}

function botao(nome: string | RegExp, dentro: ParentNode = document): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) => (typeof nome === 'string' ? b.getAttribute('aria-label') === nome || b.textContent === nome : nome.test(b.textContent ?? '')))
  if (!achado) throw new Error(`sem o botão ${String(nome)}`)
  return achado
}

function dialogo(): HTMLElement {
  const aberto = document.querySelector<HTMLElement>('[role="dialog"]')
  if (!aberto) throw new Error('nenhum cartão aberto')
  return aberto
}

/** Abre a aba Caderno e devolve o painel visível. */
function caderno(): Element {
  const aba = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => /Caderno/.test(b.textContent ?? ''))
  if (!aba) throw new Error('sem a aba Caderno')
  act(() => aba.click())
  const painel = document.querySelector('[role="tabpanel"]:not([hidden])')
  if (!painel) throw new Error('sem o painel do Caderno')
  return painel
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  // A aba já tinha entrado nesta sala: a página volta direto, sem o formulário.
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
      map: { ...createEmptyMap('m1', '', 10, 10, 50), pins: [pino('letra-a', 'Letra A\nUm A de ferro.')] },
      vision: [],
      ownTokens: [],
      concealed: [],
    })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: a coleção de pistas chega ao Caderno', () => {
  it('"Letreiro 1 de 2" aparece no Caderno e a casa cheia reabre o cartão da pista', () => {
    act(() => {
      mestre().manda({ type: 'clue.added', clue: { id: 'c1', title: 'Letra A', text: 'Letra A\nUm A de ferro.', image: null, at: AS_21_15 } })
      mestre().manda({ type: 'colecoes', colecoes: [UMA_DE_DUAS] })
    })
    const painel = caderno()
    const colecoes = painel.querySelector('.pp-colecoes')
    expect(colecoes?.textContent).toContain('Letreiro')
    expect(colecoes?.textContent).toContain('1 de 2')
    expect(painel.querySelector('[aria-label="Peça 2 de 2: falta"]')).not.toBeNull()

    act(() => botao('Peça 1 de 2', painel).click())
    expect(dialogo().querySelector('h2')?.textContent).toBe('Letra A')
    act(() => botao('Fechar', dialogo()).click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('juntou todas: a frase inteira aparece no Caderno', () => {
    act(() => {
      mestre().manda({ type: 'clue.added', clue: { id: 'c2', title: 'Letra S', text: 'Letra S', image: null, at: AS_21_15 } })
      mestre().manda({
        type: 'colecoes',
        colecoes: [{ ...UMA_DE_DUAS, partes: [...UMA_DE_DUAS.partes, { parte: 2, clueId: 'c2' }], completa: true, inteira: 'A BOCA ABRE' }],
      })
    })
    // O Caderno continua aberto desde o teste anterior.
    const painel = document.querySelector('[role="tabpanel"]:not([hidden])')
    expect(painel?.querySelector('.pp-colecao__inteira')?.textContent).toBe('A BOCA ABRE')
  })
})
