import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import { ZOOM_STEP_FACTOR, ZOOM_STEP_MS, type ZoomStepRequest } from './playerZoom'

/**
 * O ZOOM SE REFAZ UMA VEZ POR QUADRO, na TELA do jogador. O trackpad e a pinça
 * mandam vários eventos dentro do mesmo quadro (a pinça, um por dedo), e só o
 * último chega à tela. O mundo escala já em cada evento — o ponto sob o dedo
 * não atrasa —, mas grade, paredes, portas, pinos e nomes, que têm tamanho em
 * px de tela, se refazem uma vez, no quadro, na escala do último evento. O
 * degrau animado do + continua refazendo no próprio quadro: o traço não fica
 * um quadro atrás da escala.
 *
 * A prova lê as paredes: `drawWalls` recebe a escala para a qual calcula a
 * largura de tela. Sem navegador, como em `PlayerView.pinca.test.tsx`: o
 * `Application` (WebGL) e a medida do texto são trocados, e o ticker é do
 * teste — cada quadro roda quando o teste pede.
 */

const tela = vi.hoisted(() => ({
  palcos: new Array<Container>(),
  quadros: new Array<() => void>(),
  /** A escala de cada desenho das paredes, na ordem em que saíram. */
  paredes: new Array<number>(),
}))

vi.mock('../pixi/drawWalls', async (importOriginal) => {
  const original = await importOriginal<typeof import('../pixi/drawWalls')>()
  return {
    ...original,
    drawWalls: (...args: Parameters<typeof original.drawWalls>): void => {
      // Sem escala no argumento vale o padrão da assinatura, 1.
      tela.paredes.push(args[3] ?? 1)
      original.drawWalls(...args)
    },
  }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = {
      add: (quadro: () => void) => {
        tela.quadros.push(quadro)
      },
      remove: (quadro: () => void) => {
        const i = tela.quadros.indexOf(quadro)
        if (i >= 0) tela.quadros.splice(i, 1)
      },
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
/** Um quadro de 60 Hz, em ms. */
const QUADRO_MS = 16
/** Um passo pequeno de trackpad: o `deltaY` que ele manda várias vezes por quadro. */
const PASSO_DA_RODA = -12
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 500, y: 500, size: 1, image: null, color: '#3cff00' }

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Salão de 25 x 25 quadrados (1000 x 1000 px de mundo), com uma sala de 4 paredes em volta da Ana. */
function salao(): MapData {
  return {
    ...createEmptyMap('m-salao', '', 25, 25, GRADE),
    tokens: [ANA],
    walls: [parede('n', 300, 300, 700, 300), parede('l', 700, 300, 700, 700), parede('s', 300, 700, 700, 700), parede('o', 300, 300, 300, 700)],
  }
}

/** A Ana enxerga o salão inteiro: as quatro paredes entram no desenho. */
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
]

const BASE: Props = {
  map: salao(),
  vision: VISAO,
  ownTokens: [ANA.id],
  settings: DEFAULT_PLAYER_SETTINGS,
  focusTokenId: null,
  focusSeq: 0,
  onMove: () => {},
}

/** Um toque no + (animado, como o dedo pede). */
const MAIS: ZoomStepRequest = { direction: 1, animate: true, seq: 1 }

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('a PlayerView não criou o Application')
  return p
}

/** O `world` do jogador: o primeiro filho do palco (`app.stage.addChild(world, …)`). */
function mundo(): Container {
  const world = palco().children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

function roda(deltaY: number): WheelEvent {
  return new WheelEvent('wheel', { deltaY, clientX: 400, clientY: 300, cancelable: true })
}

function dedo(id: number, p: Ponto, primario: boolean): FederatedPointerEvent {
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'touch'
  e.pointerId = id
  e.isPrimary = primario
  e.global.set(p.x, p.y)
  return e
}

/** Dedo encosta no chão, na ordem do EventBoundary do Pixi: captura no palco e o próprio palco como alvo. */
function encostar(id: number, p: Ponto, primario: boolean): void {
  const e = dedo(id, p, primario)
  act(() => {
    palco().emit('pointerdowncapture', e)
    palco().emit('pointerdown', e)
  })
}

function arrastar(id: number, p: Ponto): void {
  act(() => {
    palco().emit('globalpointermove', dedo(id, p, false))
  })
}

function soltar(id: number, p: Ponto): void {
  act(() => {
    palco().emit('pointerup', dedo(id, p, false))
  })
}

describe('PlayerView — o zoom se refaz uma vez por quadro, não uma vez por evento', () => {
  let raiz: HTMLDivElement
  let root: Root
  let agora = 0

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
    tela.quadros.length = 0
    tela.paredes.length = 0
    agora = 0
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

  function conteiner(): HTMLElement {
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    return el
  }

  function canvas(): HTMLCanvasElement {
    const c = conteiner().querySelector('canvas')
    if (c === null) throw new Error('a PlayerView não pôs o canvas no contêiner')
    return c
  }

  async function mostra(props: Props): Promise<void> {
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
  }

  /**
   * Primeiro snapshot: espera o `setup` assíncrono chegar ao fim (a última coisa
   * que ele faz é avisar os botões + e − do limite). Só então o relógio passa a
   * ser o do teste: o `waitFor` mede o próprio prazo.
   */
  async function monta(props: Props): Promise<void> {
    const limites = vi.fn()
    await mostra({ ...props, onZoomLimitsChange: limites })
    await vi.waitFor(() => expect(limites).toHaveBeenCalled())
    expect(conteiner().dataset.wallsDrawn).toBe('4')
    vi.spyOn(performance, 'now').mockImplementation(() => agora)
  }

  /** Um quadro do ticker, `ms` depois do anterior. */
  function quadro(ms: number): void {
    agora += ms
    act(() => {
      for (const q of [...tela.quadros]) q()
    })
  }

  it('dez eventos de roda no mesmo quadro: o mundo escala em cada um, e as paredes se refazem uma vez, no quadro, na escala do último', async () => {
    await monta(BASE)
    const escala0 = mundo().scale.x
    const desenhos = tela.paredes.length

    act(() => {
      for (let i = 0; i < 10; i += 1) canvas().dispatchEvent(roda(PASSO_DA_RODA))
    })
    // O ponto sob o cursor não espera o quadro: o mundo já está na escala do último evento...
    expect(mundo().scale.x).toBeCloseTo(escala0 * Math.exp(-PASSO_DA_RODA * 0.001 * 10), 9)
    // ...e nenhuma volta de paredes saiu dentro dos eventos.
    expect(tela.paredes).toHaveLength(desenhos)

    quadro(QUADRO_MS)
    expect(tela.paredes).toHaveLength(desenhos + 1)
    expect(tela.paredes.at(-1)).toBe(mundo().scale.x)

    // Quadro sem evento: nada a refazer.
    quadro(QUADRO_MS)
    expect(tela.paredes).toHaveLength(desenhos + 1)
  })

  it('pinça: um evento por dedo, e as paredes se refazem uma vez por quadro, na escala daquele quadro', async () => {
    await monta(BASE)
    const escala0 = mundo().scale.x
    encostar(1, { x: 380, y: 300 }, true)
    encostar(2, { x: 420, y: 300 }, false)
    const desenhos = tela.paredes.length

    for (let q = 1; q <= 3; q += 1) {
      // Os dois dedos andam no mesmo quadro: dois eventos, duas câmeras novas.
      arrastar(1, { x: 380 - 20 * q, y: 300 })
      arrastar(2, { x: 420 + 20 * q, y: 300 })
      expect(tela.paredes).toHaveLength(desenhos + q - 1)
      quadro(QUADRO_MS)
      expect(tela.paredes).toHaveLength(desenhos + q)
      expect(tela.paredes.at(-1)).toBe(mundo().scale.x)
    }
    // De 40 px entre os dedos para 160 px: a pinça aproximou quatro vezes.
    expect(mundo().scale.x / escala0).toBeCloseTo(4, 6)

    soltar(1, { x: 320, y: 300 })
    soltar(2, { x: 480, y: 300 })
  })

  it('degrau animado do +: as paredes acompanham a escala no MESMO quadro do ticker, sem ficar um atrás', async () => {
    await monta(BASE)
    const escala0 = mundo().scale.x

    await mostra({ ...BASE, zoomStep: MAIS })
    for (let i = 0; i < 4; i += 1) {
      quadro(ZOOM_STEP_MS / 4)
      expect(mundo().scale.x).toBeGreaterThan(escala0)
      expect(tela.paredes.at(-1)).toBe(mundo().scale.x)
    }
    expect(mundo().scale.x).toBeCloseTo(escala0 * ZOOM_STEP_FACTOR, 9)
  })
})
