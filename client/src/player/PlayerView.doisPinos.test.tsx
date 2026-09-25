import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { PIN_HEAD_OFFSET } from '../lib/pins'
import type { MapData, Pin, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * DOIS PINOS NO MESMO PONTO na PlayerView montada: o toque curto do jogador
 * que acha mais de um pino sob o dedo vai para `onPinsChoose` (a folha "Aqui
 * há 2 coisas"), e não para `onPinOpen` do pino de cima. `pinChooser.test.ts`
 * prova a conta (`escolhaDoToque`, `findPlayerPinsAt`); aqui a prova é o
 * desvio no fim do gesto — quebra se o `onPinsChoose` sair do toque.
 *
 * Mesmo molde de `PlayerView.pinca.test.tsx`: só o que o jsdom não tem é
 * trocado — o `Application` (pede WebGL) e a medida do texto — e o dedo entra
 * pelo palco do Pixi na ordem do EventBoundary.
 */

const tela = vi.hoisted(() => ({
  palcos: [] as Container[],
  largura: 800,
  altura: 600,
}))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    readonly renderer = { resolution: 1 }
    readonly ticker = {
      add: (): void => {},
      remove: (): void => {},
    }
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

const GRADE = 40
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 500, y: 500, size: 1, image: null, color: '#3cff00' }
/** Onde os pinos estão cravados: longe da Ana, para o toque não cair na ficha. */
const PONTO: Ponto = { x: 300, y: 300 }
const BILHETE: Pin = { id: 'bilhete', x: PONTO.x, y: PONTO.y, kind: 'exclamacao', description: 'Bilhete', image: null }
const BAU: Pin = { id: 'bau', x: PONTO.x, y: PONTO.y, kind: 'interrogacao', description: 'Baú', image: null }

function quadrado(largura: number, altura: number): RegionPoint[][] {
  return [
    [
      { x: 0, y: 0 },
      { x: largura, y: 0 },
      { x: largura, y: altura },
      { x: 0, y: altura },
    ],
  ]
}

/** Salão de 25 x 25 quadrados, com a Ana e os pinos pedidos. */
function salao(pins: Pin[]): MapData {
  return { ...createEmptyMap('m-salao', '', 25, 25, GRADE), tokens: [ANA], pins }
}

function props(pins: Pin[], extra: Partial<Props>): Props {
  return {
    map: salao(pins),
    vision: quadrado(1000, 1000),
    ownTokens: [ANA.id],
    settings: DEFAULT_PLAYER_SETTINGS,
    focusTokenId: null,
    focusSeq: 0,
    onMove: () => {},
    ...extra,
  }
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

/** Onde um ponto do mundo aparece na tela agora. */
function naTela(p: Ponto): Ponto {
  const w = mundo()
  return { x: w.x + p.x * w.scale.x, y: w.y + p.y * w.scale.y }
}

/** O centro da cabeça do pino cravado em `PONTO`, na tela. */
function cabecaDosPinos(): Ponto {
  return naTela({ x: PONTO.x, y: PONTO.y - PIN_HEAD_OFFSET })
}

function dedo(p: Ponto): FederatedPointerEvent {
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'touch'
  e.pointerId = 1
  e.isPrimary = true
  e.global.set(p.x, p.y)
  return e
}

/** Toque curto e parado no chão (o palco é o alvo): encosta e solta no mesmo ponto. */
function tocar(p: Ponto): void {
  act(() => {
    const e = dedo(p)
    palco().emit('pointerdowncapture', e)
    palco().emit('pointerdown', e)
  })
  act(() => {
    palco().emit('pointerup', dedo(p))
  })
}

describe('PlayerView — toque em dois pinos no mesmo ponto', () => {
  let raiz: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    // O jsdom não tem ResizeObserver, e a PlayerView acompanha o tamanho do contêiner com ele.
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

  /** Espera o `setup` assíncrono chegar ao fim: o último passo dele avisa os limites do zoom. */
  async function monta(p: Props): Promise<void> {
    const limites = vi.fn()
    await act(async () => {
      root.render(<PlayerView {...p} onZoomLimitsChange={limites} />)
    })
    await vi.waitFor(() => expect(limites).toHaveBeenCalledWith({ canZoomIn: true, canZoomOut: true }))
  }

  it('dois pinos sob o dedo: o toque pede a escolha com os dois, o de cima primeiro, e não abre cartão', async () => {
    const onPinsChoose = vi.fn()
    const onPinOpen = vi.fn()
    await monta(props([BILHETE, BAU], { onPinsChoose, onPinOpen }))

    tocar(cabecaDosPinos())

    expect(onPinsChoose).toHaveBeenCalledTimes(1)
    expect(onPinsChoose).toHaveBeenCalledWith(['bau', 'bilhete'])
    expect(onPinOpen).not.toHaveBeenCalled()
  })

  it('um pino só sob o dedo: abre o cartão direto, sem escolha', async () => {
    const onPinsChoose = vi.fn()
    const onPinOpen = vi.fn()
    await monta(props([BILHETE], { onPinsChoose, onPinOpen }))

    tocar(cabecaDosPinos())

    expect(onPinOpen).toHaveBeenCalledTimes(1)
    expect(onPinOpen).toHaveBeenCalledWith('bilhete')
    expect(onPinsChoose).not.toHaveBeenCalled()
  })

  it('toque no chão longe dos pinos: nem escolha nem cartão', async () => {
    const onPinsChoose = vi.fn()
    const onPinOpen = vi.fn()
    await monta(props([BILHETE, BAU], { onPinsChoose, onPinOpen }))

    tocar(naTela({ x: 100, y: 800 }))

    expect(onPinsChoose).not.toHaveBeenCalled()
    expect(onPinOpen).not.toHaveBeenCalled()
  })
})
