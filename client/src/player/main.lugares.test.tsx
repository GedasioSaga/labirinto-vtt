/**
 * LUGARES montado na página do jogador (`main.tsx`), sem navegador: tocar num
 * ponto conhecido da aba Lugares vira um pedido de câmera para a PlayerView —
 * `focusPoint` no pino com um `seq` novo (senão a câmera não se mexe), o mesmo
 * pedido que "Minhas notas" usa. O teste do painel prova só o callback; este
 * quebra se a costura `onFocusPoint` → `focusPoint` sair de `main.tsx`, ou se
 * notas e lugares voltarem a mandar dois `focusPoint` para a mesma PlayerView.
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira um
 * div que expõe o pedido de câmera que recebeu; e o `WebSocket` vira um falso
 * que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin } from '../types/map'
import { PERSONAL_NOTES_KEY, type PersonalNote } from './personalNotes'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ focusTokenId, focusPoint, focusSeq }: PlayerViewProps) => (
    <div
      data-testid="mapa"
      data-focus-token={focusTokenId ?? ''}
      data-focus-point={focusPoint ? `${focusPoint.x},${focusPoint.y}` : ''}
      data-focus-point-seq={focusPoint ? String(focusPoint.seq) : ''}
      data-focus-seq={String(focusSeq)}
    />
  ),
}))

const CODE = 'ABC123'

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor() {
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

const TEMPLO: Pin = { id: 'pt', x: 300, y: 150, kind: 'exclamacao', description: 'Portas do Templo\nGrandes, de bronze.', image: null }
const POCO: Pin = { id: 'pp', x: 40, y: 400, kind: 'interrogacao', description: 'Poço seco', image: null }

/** Nota pessoal já no aparelho, nesta cena: aparece em Minhas notas, no Caderno. */
const NOTA: PersonalNote = { id: 'n-bau', mapId: 'm-templo', x: 520, y: 610, text: 'Baú trancado' }

const MAPA: MapData = {
  ...createEmptyMap('m-templo', '', 10, 10, 50),
  pins: [TEMPLO, POCO],
  tokens: [{ id: 'eva', characterId: null, name: 'Eva', x: 100, y: 100, size: 1, image: null }],
}

function mapa(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-testid="mapa"]')
  if (!el) throw new Error('a página não montou o mapa')
  return el
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nome,
  )
  if (!achado) throw new Error(`sem o botão "${nome}"`)
  return achado
}

function aba(nome: string): void {
  const achada = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent === nome)
  if (!achada) throw new Error(`sem a aba ${nome}`)
  act(() => achada.click())
}

const abaLugares = (): void => aba('Lugares')
const abaCaderno = (): void => aba('Caderno')

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Eva' }))
  localStorage.setItem(PERSONAL_NOTES_KEY, JSON.stringify([NOTA]))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Eva' })
    mestre().manda({ type: 'snapshot', rev: 1, map: MAPA, vision: [], ownTokens: ['eva'], concealed: [] })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})


describe('main.tsx: ponto conhecido da aba Lugares vira pedido de câmera', () => {
  it('antes de qualquer toque a câmera não recebe pedido nenhum', () => {
    expect(mapa().dataset.focusSeq).toBe('0')
    expect(mapa().dataset.focusPoint).toBe('')
    expect(mapa().dataset.focusToken).toBe('')
  })

  it('"Portas do Templo" manda o ponto do pino com um pedido novo, sem pedir a ficha', () => {
    abaLugares()
    act(() => botao('Centralizar em Portas do Templo').click())
    expect(mapa().dataset.focusPoint).toBe('300,150')
    expect(mapa().dataset.focusPointSeq).toBe('1')
    expect(mapa().dataset.focusToken).toBe('')
    expect(mapa().dataset.focusSeq).toBe('0')
  })

  it('tocar de novo no MESMO ponto é outro pedido (a câmera volta a ele mesmo depois de arrastada)', () => {
    act(() => botao('Centralizar em Portas do Templo').click())
    expect(mapa().dataset.focusPoint).toBe('300,150')
    expect(mapa().dataset.focusPointSeq).toBe('2')
  })

  it('ficha e ponto são pedidos separados: o ponto depois da ficha não refaz o pedido da ficha', () => {
    act(() => botao('Centralizar em Eva').click())
    expect(mapa().dataset.focusToken).toBe('eva')
    expect(mapa().dataset.focusSeq).toBe('1')

    abaLugares()
    act(() => botao('Centralizar em Poço seco').click())
    expect(mapa().dataset.focusPoint).toBe('40,400')
    expect(mapa().dataset.focusPointSeq).toBe('3')
    // O pedido da ficha ficou parado: a PlayerView só move a câmera com seq novo.
    expect(mapa().dataset.focusSeq).toBe('1')
  })

  it('"Minhas notas" e "Pontos conhecidos" dividem o MESMO pedido de ponto: um não apaga o outro', () => {
    // Com anotacao-pessoal no grupo, os dois mandam `focusPoint`; se cada um tivesse o seu,
    // o JSX ficaria com dois `focusPoint` e só o último valeria.
    abaCaderno()
    act(() => botao(`Centralizar em ${NOTA.text}`).click())
    expect(mapa().dataset.focusPoint).toBe('520,610')
    expect(mapa().dataset.focusPointSeq).toBe('4')

    abaLugares()
    act(() => botao('Centralizar em Portas do Templo').click())
    expect(mapa().dataset.focusPoint).toBe('300,150')
    expect(mapa().dataset.focusPointSeq).toBe('5')
  })
})
