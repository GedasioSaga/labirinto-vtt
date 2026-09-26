/**
 * MOSTRAR UM CAMINHO COM A RÉGUA montado na página do jogador (`main.tsx`),
 * sem navegador. Os outros testes provam cada peça sozinha (host, conexão,
 * componentes); este quebra se a costura sair de `main.tsx` — o
 * `onMeasureSettle` que acende "Mostrar a…", o traço que sai com os pontos da
 * medida, e o `sharedRoute` que chega ao mapa com o aviso "Dispensar".
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira um
 * botão que solta uma medida e um marcador do caminho recebido; o `WebSocket`
 * vira um falso que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

const MEDIDA = [{ x: 100, y: 150 }, { x: 350, y: 150 }]

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ measureArmed, onMeasureSettle, sharedRoute }: PlayerViewProps) => (
    <div data-testid="mapa">
      {measureArmed === true && (
        <button type="button" onClick={() => onMeasureSettle?.(MEDIDA)}>
          soltar medida
        </button>
      )}
      {sharedRoute !== undefined && <p data-testid="caminho">{`${sharedRoute.from} ${sharedRoute.color} ${sharedRoute.points.length}`}</p>}
    </div>
  ),
}))

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

function botao(nome: string, dentro: ParentNode = document): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  // A aba já tinha entrado nesta sala: a página volta direto, sem o formulário.
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Gui' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gui' })
    mestre().manda({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: caminho da régua de ponta a ponta', () => {
  it('sem medida solta, nada de "Mostrar a…"', () => {
    expect(document.querySelector('.pp-route-dock')).toBeNull()
    act(() => botao('Medir').click())
    expect(document.querySelector('.pp-route-dock')).toBeNull()
  })

  it('com a medida solta, "Mostrar a…" pede os colegas e o traço sai para Caio com os pontos da medida', () => {
    act(() => botao('soltar medida').click())
    const painel = document.querySelector('[aria-label="Mostrar este caminho"]')
    if (!painel) throw new Error('sem o "Mostrar a…"')
    act(() => botao('Mostrar a…', painel).click())
    expect(mestre().enviados('clue.peers')).toEqual([{ type: 'clue.peers' }])
    act(() => mestre().manda({ type: 'clue.peers', names: ['Caio'] }))
    act(() => botao('Caio').click())
    expect(mestre().enviados('route.show')).toEqual([{ type: 'route.show', to: 'Caio', points: MEDIDA }])
    act(() => mestre().manda({ type: 'route.show.result', to: 'Caio', ok: true }))
    expect(painel.textContent).toContain('Caminho mostrado a Caio.')
  })

  it('desligar a régua tira o "Mostrar a…" junto', () => {
    act(() => botao('Medir').click())
    expect(document.querySelector('[aria-label="Mostrar este caminho"]')).toBeNull()
  })

  it('o caminho de Ana chega ao mapa com o aviso; "Dispensar" apaga os dois', () => {
    act(() => mestre().manda({ type: 'route.shown', from: 'Ana', color: '#3cff00', points: MEDIDA }))
    expect(document.querySelector('[data-testid="caminho"]')?.textContent).toBe('Ana #3cff00 2')
    const aviso = document.querySelector('.pp-route-notice')
    expect(aviso?.textContent).toMatch(/^Ana mostrou um caminho no mapa\./)
    act(() => botao('Dispensar').click())
    expect(document.querySelector('[data-testid="caminho"]')).toBeNull()
    expect(document.querySelector('.pp-route-notice')).toBeNull()
  })
})
