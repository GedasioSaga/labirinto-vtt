/**
 * CLICAR PARA ANDAR montado na página do jogador (`main.tsx`), sem navegador:
 * o clique simples no chão manda a ficha andar até lá pelas ruas conhecidas,
 * com a marca no destino enquanto anda; a marca some ao chegar. O clique que
 * só fecha o menu do toque longo não anda. Chave da cena desligada: nada vai
 * ao mestre e o aviso diz por quê.
 *
 * A `PlayerView` (Pixi pede WebGL) vira botões que chamam os mesmos ganchos
 * (`onFloorClick`, `onLongPress`, `onMapPointerDown`) e mostram a marca que
 * recebe (`destinoDaCaminhada`); o `WebSocket` vira um mestre falso.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Wall } from '../types/map'
import { WALK_LEG_PAUSE_MS } from './playerConnection'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

const BECO = { x: 700, y: 300 }

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ onFloorClick, onLongPress, onMapPointerDown, destinoDaCaminhada }: PlayerViewProps) => (
    <div data-testid="mapa" data-destino={destinoDaCaminhada === null || destinoDaCaminhada === undefined ? '' : `${destinoDaCaminhada.x},${destinoDaCaminhada.y}`}>
      <button
        type="button"
        onClick={() => {
          onMapPointerDown?.()
          onFloorClick?.(BECO.x, BECO.y)
        }}
      >
        clicar beco
      </button>
      <button type="button" onClick={() => onLongPress?.(BECO.x, BECO.y, BECO.x, BECO.y)}>
        segurar beco
      </button>
    </div>
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
  trechos(): { reqId: string; x: number; y: number; caminhada: unknown }[] {
    return this.sent.flatMap((m) => {
      if (typeof m !== 'object' || m === null || !('type' in m) || m.type !== 'token.move') return []
      if (!('reqId' in m) || !('x' in m) || !('y' in m)) return []
      const { reqId, x, y } = m
      const caminhada = 'caminhada' in m ? m.caminhada : undefined
      return typeof reqId === 'string' && typeof x === 'number' && typeof y === 'number' ? [{ reqId, x, y, caminhada }] : []
    })
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

const respondidos = new Set<string>()

/** O mestre aceita os trechos que saírem, um por vez, até a caminhada acabar. */
function aceitaAteChegar(): void {
  for (let volta = 0; volta < 20; volta += 1) {
    const novo = mestre().trechos().find((t) => !respondidos.has(t.reqId))
    if (novo === undefined) return
    respondidos.add(novo.reqId)
    act(() => mestre().manda({ type: 'token.move.accepted', reqId: novo.reqId, x: novo.x, y: novo.y }))
    act(() => vi.advanceTimersByTime(WALK_LEG_PAUSE_MS))
  }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Praça de 1000 x 600, toda à vista, com um prédio fechado no meio: o traço reto ao beco bate na parede. */
const MAPA: MapData = {
  ...createEmptyMap('capital', '', 20, 12, 50),
  walls: [parede('n', 400, 150, 600, 150), parede('l', 600, 150, 600, 450), parede('s', 600, 450, 400, 450), parede('o', 400, 450, 400, 150)],
  tokens: [{ id: 'enzo', characterId: null, name: 'Enzo', x: 300, y: 300, size: 1, image: null }],
}
const TUDO_A_VISTA = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 600 },
    { x: 0, y: 600 },
  ],
]

function snapshot(rev: number, map: MapData): void {
  act(() => mestre().manda({ type: 'snapshot', rev, map, vision: TUDO_A_VISTA, ownTokens: ['enzo'], concealed: [] }))
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

function marca(): string | null {
  return document.querySelector('[data-testid="mapa"]')?.getAttribute('data-destino') ?? null
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Enzo' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./boot')
  })
  act(() => mestre().abre())
  act(() => mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Enzo' }))
  snapshot(1, MAPA)
})

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: clicar para andar', () => {
  it('clique no chão: a ficha vai pela esquina com a marca no destino; a marca some ao chegar', () => {
    act(() => botao('clicar beco').click())
    const primeiro = mestre().trechos()[0]
    expect(primeiro?.caminhada).toBe(true)
    // A esquina do prédio, não o beco em linha reta (a parede está no meio).
    expect(primeiro).not.toMatchObject(BECO)
    expect(marca()).toBe(`${BECO.x},${BECO.y}`)
    aceitaAteChegar()
    expect(mestre().trechos().at(-1)).toMatchObject(BECO)
    expect(marca()).toBe('')
  })

  it('o clique que fecha o menu do toque longo só fecha: não anda', () => {
    act(() => botao('segurar beco').click())
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    const antes = mestre().trechos().length
    act(() => botao('clicar beco').click())
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(mestre().trechos()).toHaveLength(antes)
  })

  it('chave da cena desligada: nada vai ao mestre, nada de marca, e o aviso diz por quê', () => {
    snapshot(2, { ...MAPA, tokens: [{ id: 'enzo', characterId: null, name: 'Enzo', x: 300, y: 300, size: 1, image: null }], cliqueParaAndar: false })
    const antes = mestre().trechos().length
    act(() => botao('clicar beco').click())
    expect(mestre().trechos()).toHaveLength(antes)
    expect(marca()).toBe('')
    expect(document.body.textContent).toContain('O mestre desligou o clicar para andar nesta cena')
  })
})
