/**
 * MINHAS PISTAS montado na página do jogador (`main.tsx`), de ponta a ponta
 * sem navegador: o que liga o toque no pino ao Caderno e o Caderno aos dois
 * cartões de pista. Os outros testes provam cada peça sozinha (host, conexão,
 * componentes); este quebra se a costura sair de `main.tsx` — o `onPinOpen`
 * que manda `clue.read`, o `clues`/`onOpenClue` do Painel, o cartão da pista
 * reaberta com "Mostrar para…" e o cartão "Gabi mostrou".
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira
 * uma lista de botões, um por pino, que chama o mesmo `onPinOpen`; e o
 * `WebSocket` vira um falso que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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

const FOTO = 'data:image/png;base64,QklMSEVURQ=='
const AS_21_15 = new Date(2026, 8, 23, 21, 15).getTime()
const CODE = 'ABC123'

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
  enviados(tipo: string): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === tipo)
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

function pino(id: string, description: string, image: string | null = null): Pin {
  return { id, x: 100, y: 100, kind: 'exclamacao', description, image }
}

function botao(nome: string | RegExp, dentro: ParentNode = document): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) =>
    typeof nome === 'string' ? b.textContent === nome : nome.test(b.textContent ?? ''),
  )
  if (!achado) throw new Error(`sem o botão ${String(nome)}`)
  return achado
}

function dialogo(): HTMLElement {
  const aberto = document.querySelector<HTMLElement>('[role="dialog"]')
  if (!aberto) throw new Error('nenhum cartão aberto')
  return aberto
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
      map: { ...createEmptyMap('m1', '', 10, 10, 50), pins: [pino('bilhete', 'Bilhete\nEncontre-me na torre.', FOTO)] },
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

describe('main.tsx: Minhas pistas de ponta a ponta', () => {
  it('abrir o pino no mapa é ler: a página pede ao mestre para guardar a pista', () => {
    expect(mestre().sent[0]).toEqual({ type: 'join', code: CODE, name: 'Gabi', resume: 'tok' })
    act(() => botao('pino bilhete').click())
    expect(mestre().enviados('clue.read')).toEqual([{ type: 'clue.read', pinId: 'bilhete' }])
    act(() => botao('Fechar', dialogo()).click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('a pista guardada aparece no Caderno e reabre com a foto; "Mostrar para…" chega a Ana', () => {
    act(() => mestre().manda({ type: 'clue.added', clue: { id: 'c1', title: 'Bilhete', text: 'Bilhete\nEncontre-me na torre.', image: FOTO, at: AS_21_15 } }))
    const caderno = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => /Caderno/.test(b.textContent ?? ''))
    if (!caderno) throw new Error('sem a aba Caderno')
    act(() => caderno.click())
    const painel = document.querySelector('[role="tabpanel"]:not([hidden])')
    if (!painel) throw new Error('sem o painel do Caderno')
    expect(painel.textContent).toContain('Minhas pistas')
    act(() => botao(/^Bilhete/, painel).click())

    const cartao = dialogo()
    expect(cartao.querySelector('h2')?.textContent).toBe('Bilhete')
    expect(cartao.querySelector('img')?.getAttribute('src')).toBe(FOTO)
    expect(cartao.textContent).toContain('Encontre-me na torre.')

    act(() => botao('Mostrar para…', cartao).click())
    expect(mestre().enviados('clue.peers')).toEqual([{ type: 'clue.peers' }])
    act(() => mestre().manda({ type: 'clue.peers', names: ['Ana'] }))
    act(() => botao('Ana', dialogo()).click())
    expect(mestre().enviados('clue.show')).toEqual([{ type: 'clue.show', clueId: 'c1', to: 'Ana' }])
    act(() => mestre().manda({ type: 'clue.show.result', to: 'Ana', ok: true }))
    expect(dialogo().textContent).toContain('Mostrado para Ana.')
    act(() => botao('Fechar', dialogo()).click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('um colega mostrou: abre o cartão "Ana mostrou: Chave", sem "Mostrar para…"', () => {
    act(() => mestre().manda({ type: 'clue.shown', from: 'Ana', clue: { id: 'c2', title: 'Chave', text: 'Chave torta', image: null, at: AS_21_15, from: 'Ana' } }))
    const cartao = dialogo()
    expect(cartao.querySelector('h2')?.textContent).toBe('Ana mostrou: Chave')
    expect(Array.from(cartao.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Fechar'])
  })
})
