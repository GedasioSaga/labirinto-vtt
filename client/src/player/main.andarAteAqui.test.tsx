/**
 * ANDAR ATÉ AQUI montado na página do jogador (`main.tsx`), sem navegador: o
 * toque longo no mapa abre o menu do ponto; "Andar até aqui" manda ao mestre
 * o PRIMEIRO trecho do caminho pelas ruas conhecidas (a esquina, não o beco);
 * na área preta o item fica esmaecido e nada sai pelo fio.
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira
 * um botão por ponto que chama o mesmo `onLongPress` (o gancho único do toque
 * longo, o mesmo que as ações no ponto usam); e o `WebSocket` vira um falso
 * que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration, markRings } from '../lib/exploration'
import type { MapData, Wall } from '../types/map'
import { WALK_LEG_PAUSE_MS } from './playerConnection'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

/** Onde o dedo segura, em px de mundo; a tela usa o mesmo número (a câmera não importa aqui). */
const PONTOS = { beco: { x: 700, y: 300 }, escuro: { x: 900, y: 550 }, praca: { x: 300, y: 300 } }

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ onLongPress, onDestination }: PlayerViewProps) => (
    <div data-testid="mapa">
      {Object.entries(PONTOS).map(([nome, p]) => (
        <button key={nome} type="button" onClick={() => onLongPress?.(p.x, p.y, p.x, p.y)}>
          {`segurar ${nome}`}
        </button>
      ))}
      {/* O toque com "Marcar destino" ligado: o mesmo ramo do pointerdown que vem antes do toque longo. */}
      <button type="button" onClick={() => onDestination?.(PONTOS.praca.x, PONTOS.praca.y)}>
        tocar destino praca
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
  movimentos(): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'token.move')
  }
  destinos(): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'destination')
  }
  sinais(): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'signal')
  }
  trechos(): { reqId: string; x: number; y: number }[] {
    return this.movimentos().flatMap((m) => {
      if (typeof m !== 'object' || m === null || !('reqId' in m) || !('x' in m) || !('y' in m)) return []
      const { reqId, x, y } = m
      return typeof reqId === 'string' && typeof x === 'number' && typeof y === 'number' ? [{ reqId, x, y }] : []
    })
  }
}

/** Pedidos de movimento que o mestre falso já respondeu. */
const respondidos = new Set<string>()

/** O mestre responde, em ordem, a todo trecho ainda sem resposta. */
function respondeTrechos(resposta: 'aceita' | 'recusa'): void {
  for (const { reqId, x, y } of mestre().trechos()) {
    if (respondidos.has(reqId)) continue
    respondidos.add(reqId)
    act(() => {
      if (resposta === 'aceita') mestre().manda({ type: 'token.move.accepted', reqId, x, y })
      else mestre().manda({ type: 'token.move.rejected', reqId, reason: 'wall' })
    })
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
  it('segurar no chão é UM gesto: sai um sinal só e abre um menu só, com "Andar até aqui"', () => {
    const sinaisAntes = mestre().sinais().length
    act(() => botao('segurar praca').click())
    // O sinal do toque longo continua saindo, uma vez, no ponto segurado.
    expect(mestre().sinais()).toHaveLength(sinaisAntes + 1)
    expect(mestre().sinais().at(-1)).toEqual({ type: 'signal', x: PONTOS.praca.x, y: PONTOS.praca.y })
    // Um menu só no ponto: o item mora no menu do toque longo, não num segundo menu.
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1)
    expect(itemDoMenu().textContent).toBe('Andar até aqui')
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('"Marcar destino" e o toque longo convivem: o toque de destino vai ao mestre como marca, sem menu nem sinal, e o toque longo segue abrindo o menu', () => {
    const sinaisAntes = mestre().sinais().length
    act(() => botao('tocar destino praca').click())
    expect(mestre().destinos()).toEqual([{ type: 'destination', x: PONTOS.praca.x, y: PONTOS.praca.y }])
    // A marca não abre o menu do ponto nem vira sinal: são gestos diferentes.
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(mestre().sinais()).toHaveLength(sinaisAntes)

    act(() => botao('segurar praca').click())
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1)
    expect(itemDoMenu().textContent).toBe('Andar até aqui')
    expect(mestre().sinais()).toHaveLength(sinaisAntes + 1)
    expect(mestre().destinos()).toHaveLength(1)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

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

  it('menu aberto enquanto a ficha anda: o caminho sai de onde a ficha ESTÁ ao tocar no item, não de onde estava ao abrir', () => {
    vi.useFakeTimers()
    try {
      // O que ficou sem resposta no teste de cima volta: Enzo em (300,300), sem caminhada.
      respondeTrechos('recusa')
      act(() => botao('segurar beco').click())
      act(() => itemDoMenu().click())
      respondeTrechos('aceita')
      // Parado na esquina de cima, a oeste do prédio: dali a praça é linha reta.
      const esquina = mestre().trechos().at(-1)
      expect(esquina?.x).toBeLessThanOrEqual(400)
      expect(esquina?.y).toBeLessThan(150)
      expect(esquina).toBeDefined()

      act(() => botao('segurar praca').click())
      expect(itemDoMenu().getAttribute('aria-disabled')).toBeNull()
      // Com o menu aberto a caminhada segue, trecho a trecho, até o beco.
      for (let volta = 0; volta < 5; volta++) {
        act(() => vi.advanceTimersByTime(WALK_LEG_PAUSE_MS))
        respondeTrechos('aceita')
      }
      expect(mestre().trechos().at(-1)).toMatchObject(PONTOS.beco)
      expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1)

      const antes = mestre().trechos().length
      act(() => itemDoMenu().click())
      const trechos = mestre().trechos()
      expect(trechos).toHaveLength(antes + 1)
      const primeiro = trechos.at(-1)
      // Do beco à praça a reta atravessa o prédio (o host recusaria com 'wall'): sai a esquina de uma rua.
      expect(primeiro).not.toMatchObject(PONTOS.praca)
      expect(primeiro !== undefined && (primeiro.y < 150 || primeiro.y > 450)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
