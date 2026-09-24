/**
 * FAIXA "ONDE ESTOU" montada na página do jogador (`main.tsx`), sem navegador:
 * o snapshot do mestre chega, a faixa mostra o caminho da Sala onde está a
 * ficha, acompanha a ficha quando ela anda e, tocada, pede à câmera para
 * centralizar a ficha. Os outros testes provam as peças sozinhas
 * (`whereAmI.test.ts`, `PlayerWhereAmI.test.tsx`); este quebra se a costura
 * sair de `main.tsx`.
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira um
 * espião do foco pedido, e o `WebSocket` vira um falso que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token } from '../types/map'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

/** O último foco que a página pediu à câmera. */
const camera = vi.hoisted(() => ({ tokenId: null as string | null, seq: 0 }))

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ focusTokenId, focusSeq }: PlayerViewProps) => {
    camera.tokenId = focusTokenId
    camera.seq = focusSeq
    return <div data-testid="mapa" />
  },
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

function sala(id: string, name: string, x1: number, y1: number, x2: number, y2: number, parentId?: string): Region {
  const points = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
  return { id, points, tag: '', fillColor: '#333', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...(parentId ? { parentId } : {}) }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: 'Gabi', x, y, size: 1, image: null }
}

/** Como o mestre manda: o nome da cena chega vazio, igual ao recorte de verdade. */
function mapa(x: number, y: number): MapData {
  return {
    ...createEmptyMap('m1', '', 1000, 1000, 50),
    regions: [
      sala('farol', 'Farol', 0, 0, 400, 200),
      sala('piso-5', 'Farol, piso 5', 10, 10, 190, 190, 'farol'),
      sala('faroleiro', 'Sala do Faroleiro', 20, 20, 100, 100, 'piso-5'),
    ],
    tokens: [ficha('gabi', x, y)],
  }
}

let rev = 0
function snapshot(map: MapData): void {
  rev += 1
  act(() => mestre().manda({ type: 'snapshot', rev, map, vision: [], ownTokens: ['gabi'], concealed: [] }))
}

function faixa(): HTMLButtonElement {
  const achada = document.querySelector<HTMLButtonElement>('button.pp-where')
  if (!achada) throw new Error('sem a faixa "Onde estou"')
  return achada
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
  act(() => mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' }))
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: faixa "Onde estou" de ponta a ponta', () => {
  it('mostra prédio › piso › cômodo da Sala onde está a ficha', () => {
    snapshot(mapa(50, 50))
    expect(faixa().getAttribute('aria-label')).toBe('Onde estou: Farol › Farol, piso 5 › Sala do Faroleiro. Centralizar Gabi')
  })

  it('a ficha anda para fora do cômodo: a faixa acompanha', () => {
    snapshot(mapa(150, 150))
    expect(faixa().getAttribute('aria-label')).toBe('Onde estou: Farol › Farol, piso 5. Centralizar Gabi')
    snapshot(mapa(900, 900))
    expect(faixa().textContent).toBe('Fora das salas')
  })

  it('tocar na faixa pede à câmera para centralizar a ficha', () => {
    const antes = camera.seq
    act(() => faixa().click())
    expect(camera.tokenId).toBe('gabi')
    expect(camera.seq).toBe(antes + 1)
  })
})
