import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * PORTA COM UMA FICHA ALHEIA NA CASA DO LADO, na PlayerView montada. O toque
 * curto é o único jeito que o jogador tem de abrir ou fechar a porta; o alvo
 * engordado da ficha alheia (raio + folga do dedo) cobria a porta inteira, e o
 * toque nela abria o cartão da ficha em vez de alternar a porta.
 *
 * Mesmo molde de `PlayerView.pinca.test.tsx`: só o que o jsdom não tem é
 * trocado (o `Application`, que pede WebGL, e a medida do texto), e o dedo
 * entra pelo palco do Pixi na ordem do EventBoundary.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[], largura: 800, altura: 600 }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    readonly renderer = { resolution: 1 }
    readonly ticker = { add: () => {}, remove: () => {} }
    readonly canvas = document.createElement('canvas')
    constructor() {
      tela.palcos.push(this.stage)
    }
    async init(): Promise<void> {}
    resize(): void {}
    destroy(): void {
      this.canvas.remove()
    }
  }
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

type Ponto = { x: number; y: number }
type Props = Parameters<typeof PlayerView>[0]

const GRADE = 50
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 375, y: 375, size: 1, image: null }
/** O NPC no meio da casa (100..150, 100..150): o disco dele encosta na parede x = 150. */
const SEVERA: Token = { id: 'tok-severa', characterId: null, name: 'Severa', x: 125, y: 125, size: 1, image: null }
/** A porta na parede da direita da casa do NPC, de ponta a ponta da casa. */
const PORTA: Wall = { id: 'porta', x1: 150, y1: 100, x2: 150, y2: 150, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }

function quadrado(lado: number): RegionPoint[][] {
  return [
    [
      { x: 0, y: 0 },
      { x: lado, y: 0 },
      { x: lado, y: lado },
      { x: 0, y: lado },
    ],
  ]
}

function mapa(): MapData {
  return { ...createEmptyMap('m-porta', '', 10, 10, GRADE), walls: [PORTA], tokens: [SEVERA, ANA] }
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('a PlayerView não criou o Application')
  return p
}

/** O `world` do jogador: o primeiro filho do palco. */
function mundo(): Container {
  const world = palco().children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

function naTela(p: Ponto): Ponto {
  const w = mundo()
  return { x: w.x + p.x * w.scale.x, y: w.y + p.y * w.scale.y }
}

function dedo(p: Ponto): FederatedPointerEvent {
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'touch'
  e.pointerId = 1
  e.isPrimary = true
  e.global.set(p.x, p.y)
  return e
}

/** Toque curto e parado no chão (o palco é o alvo: a ficha alheia não pega o toque). */
function tocar(pontoDoMundo: Ponto): void {
  const p = naTela(pontoDoMundo)
  act(() => {
    const desce = dedo(p)
    palco().emit('pointerdowncapture', desce)
    palco().emit('pointerdown', desce)
    palco().emit('pointerup', dedo(p))
  })
}

describe('PlayerView — porta com ficha alheia na casa vizinha', () => {
  let raiz: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    tela.palcos.length = 0
    raiz = document.createElement('div')
    document.body.appendChild(raiz)
    root = createRoot(raiz)
  })

  afterEach(() => {
    act(() => root.unmount())
    raiz.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function monta(onDoorToggle: (id: string) => void, onTokenOpen: (id: string) => void): Promise<void> {
    const limites = vi.fn()
    const props: Props = {
      map: mapa(),
      vision: quadrado(500),
      ownTokens: [ANA.id],
      settings: DEFAULT_PLAYER_SETTINGS,
      focusTokenId: null,
      focusSeq: 0,
      onMove: () => {},
      onDoorToggle,
      onTokenOpen,
      onZoomLimitsChange: limites,
    }
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
    // O setup assíncrono termina avisando os limites do zoom: só então o palco ouve o dedo.
    await vi.waitFor(() => expect(limites).toHaveBeenCalled())
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    expect(el.dataset.tokensCount).toBe('2')
  }

  it('o toque no meio da porta alterna a porta, e não abre o cartão do NPC encostado nela', async () => {
    const onDoorToggle = vi.fn()
    const onTokenOpen = vi.fn()
    await monta(onDoorToggle, onTokenOpen)

    tocar({ x: 150, y: 125 })

    expect(onDoorToggle).toHaveBeenCalledTimes(1)
    expect(onDoorToggle).toHaveBeenCalledWith('porta')
    expect(onTokenOpen).not.toHaveBeenCalled()
  })

  it('as pontas da porta e o lado de fora dela também alternam a porta', async () => {
    const onDoorToggle = vi.fn()
    const onTokenOpen = vi.fn()
    await monta(onDoorToggle, onTokenOpen)

    tocar({ x: 150, y: 102 })
    tocar({ x: 150, y: 148 })
    tocar({ x: 160, y: 125 })

    expect(onDoorToggle.mock.calls).toEqual([['porta'], ['porta'], ['porta']])
    expect(onTokenOpen).not.toHaveBeenCalled()
  })

  it('o toque no meio do NPC continua abrindo o cartão dele, mesmo com a porta ao lado', async () => {
    const onDoorToggle = vi.fn()
    const onTokenOpen = vi.fn()
    await monta(onDoorToggle, onTokenOpen)

    tocar({ x: 125, y: 125 })
    tocar({ x: 132, y: 118 })

    expect(onTokenOpen.mock.calls).toEqual([[SEVERA.id], [SEVERA.id]])
    expect(onDoorToggle).not.toHaveBeenCalled()
  })
})
