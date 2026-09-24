/**
 * ANDAR ATÉ AQUI montado na página do jogador (`main.tsx`), sem navegador: o
 * toque longo no mapa abre o menu do ponto; "Andar até aqui" manda ao mestre
 * o PRIMEIRO trecho do caminho pelas ruas conhecidas (a esquina, não o beco);
 * na área preta o item fica esmaecido e nada sai pelo fio.
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira
 * um botão por ponto que chama o mesmo `onPointHold`; e o `WebSocket` vira um
 * falso que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration, markRings } from '../lib/exploration'
import type { MapData, Wall } from '../types/map'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

/** Onde o dedo segura, em px de mundo; a tela usa o mesmo número (a câmera não importa aqui). */
const PONTOS = { beco: { x: 700, y: 300 }, escuro: { x: 900, y: 550 } }

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ onPointHold }: PlayerViewProps) => (
    <div data-testid="mapa">
      {Object.entries(PONTOS).map(([nome, p]) => (
        <button key={nome} type="button" onClick={() => onPointHold?.(p, p)}>
          {`segurar ${nome}`}
        </button>
      ))}
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
  movimentos(): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'token.move')
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Praça de 1000 x 600 com um prédio fechado no meio: o traço reto da ficha ao beco bate na parede. */
const MAPA: MapData = {
  ...createEmptyMap('capital', '', 20, 12, 50),
  walls: [parede('n', 400, 150, 600, 150), parede('l', 600, 150, 600, 450), parede('s', 600, 450, 400, 450), parede('o', 400, 450, 400, 150)],
  tokens: [{ id: 'enzo', characterId: null, name: 'Enzo', x: 300, y: 300, size: 1, image: null }],
}

function botao(nome: string | RegExp): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll('button')).find((b) =>
    typeof nome === 'string' ? b.textContent === nome : nome.test(b.textContent ?? ''),
  )
  if (!achado) throw new Error(`sem o botão ${String(nome)}`)
  return achado
}

function itemDoMenu(): HTMLButtonElement {
  const item = document.querySelector<HTMLButtonElement>('[role="menu"] [role="menuitem"]')
  if (!item) throw new Error('menu do ponto fechado')
  return item
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Enzo' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  // Enzo já andou por toda a praça: a memória cobre o mapa inteiro, menos o canto de baixo à direita.
  const memoria = createExploration({ width: 1000, height: 600, grid: 50 })
  markRings(memoria, [
    [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
      { x: 0, y: 500 },
    ],
  ])
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Enzo' })
    mestre().manda({ type: 'snapshot', rev: 1, map: MAPA, vision: [], explored: encodeExploration(memoria), ownTokens: ['enzo'], concealed: [] })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: andar até aqui de ponta a ponta', () => {
  it('área preta: o item aparece esmaecido com "Você não conhece o caminho" e nada vai ao mestre', () => {
    act(() => botao('segurar escuro').click())
    expect(itemDoMenu().getAttribute('aria-disabled')).toBe('true')
    expect(itemDoMenu().textContent).toContain('Você não conhece o caminho')
    act(() => itemDoMenu().click())
    expect(mestre().movimentos()).toEqual([])
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('segura no beco atrás do prédio > "Andar até aqui": sai o primeiro trecho, a esquina, e o menu fecha', () => {
    act(() => botao('segurar beco').click())
    expect(itemDoMenu().getAttribute('aria-disabled')).toBeNull()
    act(() => itemDoMenu().click())
    expect(document.querySelector('[role="menu"]')).toBeNull()
    const enviados = mestre().movimentos()
    expect(enviados).toHaveLength(1)
    const primeiro = enviados[0]
    expect(primeiro).toMatchObject({ type: 'token.move', tokenId: 'enzo' })
    // A esquina fica numa das ruas (acima ou abaixo do prédio), nunca o beco direto.
    expect(primeiro).not.toMatchObject({ x: PONTOS.beco.x, y: PONTOS.beco.y })
    const y = typeof primeiro === 'object' && primeiro !== null && 'y' in primeiro ? primeiro.y : Number.NaN
    expect(typeof y === 'number' && (y < 150 || y > 450)).toBe(true)
  })
})
