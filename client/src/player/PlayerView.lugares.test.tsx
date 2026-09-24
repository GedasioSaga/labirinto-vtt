import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { freeAreaCenter, type Bounds } from '../pixi/world'
import type { MapData, RegionPoint } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * PONTO CONHECIDO (aba Lugares) na TELA do jogador: `focusPoint` com um
 * `focusSeq` novo e sem ficha leva o pino ao meio do que o painel deixa livre,
 * no zoom de agora. `main.lugares.test.tsx` prova que o toque no painel vira
 * esse pedido; aqui a prova é que a PlayerView de verdade move a câmera.
 *
 * Sem navegador, como em `PlayerView.frente.test.tsx`: só o `Application`
 * (pede WebGL) é trocado, com uma tela fixa de 800 x 600.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[] }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
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
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

const TELA = { width: 800, height: 600 }
const EVA = 'ficha-eva'
/** Templo aberto de 1000 x 1000 px de mundo; a Eva no meio, a "Portas do Templo" num canto. */
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
]
const PORTAS: RegionPoint = { x: 900, y: 150 }

const MAPA: MapData = {
  ...createEmptyMap('m-templo', '', 25, 25, 40),
  tokens: [{ id: EVA, characterId: null, name: 'Eva', x: 500, y: 500, size: 1, image: null }],
}

/** O `world` do jogador: o primeiro filho do palco (`app.stage.addChild(world, …)`). */
function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

/** Onde um ponto do mundo aparece na tela agora. */
function naTela(ponto: RegionPoint): { x: number; y: number } {
  const p = mundo().toGlobal(ponto)
  return { x: p.x, y: p.y }
}

describe('PlayerView — tocar num ponto conhecido centra a câmera nele', () => {
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
  })

  interface Foco {
    focusTokenId?: string | null
    focusPoint?: RegionPoint | null
    focusSeq: number
    obstaculos?: Bounds[]
  }

  async function mostra({ focusTokenId = null, focusPoint = null, focusSeq, obstaculos = [] }: Foco): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView
          map={MAPA}
          vision={VISAO}
          ownTokens={[EVA]}
          settings={DEFAULT_PLAYER_SETTINGS}
          focusTokenId={focusTokenId}
          focusPoint={focusPoint}
          focusSeq={focusSeq}
          focusObstacles={() => obstaculos}
          onMove={() => {}}
        />,
      )
    })
  }

  /** Primeiro snapshot: espera o `setup` assíncrono (o `init` do Application) chegar ao primeiro desenho. */
  async function monta(foco: Foco): Promise<void> {
    await mostra(foco)
    await vi.waitFor(() => {
      const el = raiz.firstElementChild
      expect(el instanceof HTMLElement ? el.dataset.tokensCount : undefined).toBe('1')
    })
  }

  it('"Portas do Templo": o pino vai ao meio da tela, no mesmo zoom', async () => {
    await monta({ focusSeq: 0 })
    const zoom = mundo().scale.x
    // Na chegada o pino está longe do meio: a prova não passa por acaso.
    const antes = naTela(PORTAS)
    expect(Math.hypot(antes.x - TELA.width / 2, antes.y - TELA.height / 2)).toBeGreaterThan(100)

    await mostra({ focusPoint: PORTAS, focusSeq: 1 })
    const depois = naTela(PORTAS)
    // Pixel físico inteiro (applyCamera): meio pixel de folga.
    expect(depois.x).toBeCloseTo(TELA.width / 2, 0)
    expect(depois.y).toBeCloseTo(TELA.height / 2, 0)
    expect(mundo().scale.x).toBe(zoom)
  })

  it('com o painel cobrindo a direita, o pino vai ao meio do que sobra livre', async () => {
    const painel: Bounds = { minX: 500, minY: 0, maxX: 800, maxY: 600 }
    await monta({ focusSeq: 0, obstaculos: [painel] })
    await mostra({ focusPoint: PORTAS, focusSeq: 1, obstaculos: [painel] })
    const livre = freeAreaCenter(TELA, [painel])
    const depois = naTela(PORTAS)
    expect(livre.x).toBeLessThan(painel.minX)
    expect(depois.x).toBeCloseTo(livre.x, 0)
    expect(depois.y).toBeCloseTo(livre.y, 0)
    expect(depois.x).toBeGreaterThanOrEqual(0)
  })

  it('o ponto só vale com pedido novo: o mesmo focusSeq não puxa a câmera de volta', async () => {
    await monta({ focusSeq: 0 })
    await mostra({ focusPoint: PORTAS, focusSeq: 1 })
    const centrada = { x: mundo().x, y: mundo().y }
    // O jogador arrasta o mapa para longe; um snapshot qualquer re-renderiza com o mesmo pedido.
    mundo().position.set(centrada.x - 250, centrada.y + 120)
    await mostra({ focusPoint: PORTAS, focusSeq: 1 })
    expect(mundo().x).toBe(centrada.x - 250)
    expect(mundo().y).toBe(centrada.y + 120)
  })

  it('ficha e ponto juntos: a ficha manda (o ponto é para quando não há ficha)', async () => {
    await monta({ focusSeq: 0 })
    await mostra({ focusTokenId: EVA, focusPoint: PORTAS, focusSeq: 1 })
    const eva = naTela({ x: 500, y: 500 })
    expect(eva.x).toBeCloseTo(TELA.width / 2, 0)
    expect(eva.y).toBeCloseTo(TELA.height / 2, 0)
    expect(Math.hypot(naTela(PORTAS).x - TELA.width / 2, naTela(PORTAS).y - TELA.height / 2)).toBeGreaterThan(100)
  })
})
