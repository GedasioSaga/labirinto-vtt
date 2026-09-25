import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { PIN_HEAD_OFFSET, PIN_HEIGHT, PIN_MIN_SCREEN_HEIGHT, pinSizeScale } from '../lib/pins'
import type { MapData, Pin, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import { ZOOM_STEP_FACTOR, ZOOM_STEP_MS, type ZoomStepRequest } from './playerZoom'

/**
 * PINO COM TAMANHO MÍNIMO NO ZOOM AFASTADO, na PlayerView montada (relato dos
 * jogadores, torre-lote-5 #485 e #517): com a cena inteira na janela, o pino
 * desenhado em px de mundo virava um risco de 2 px, e a folga do toque — fixa
 * em px de TELA — abria esse pino invisível com o dedo a várias casas dele.
 *
 * Mesmo arranjo de `PlayerView.pinca.test.tsx`: só o `Application` (WebGL) e a
 * medida do texto saem do jsdom; o ticker e o relógio são do teste.
 */

const tela = vi.hoisted(() => ({
  palcos: [] as Container[],
  quadros: [] as (() => void)[],
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
/** Cena grande: 250 x 250 casas (10.000 px de mundo) numa tela de 800 x 600 — o enquadramento fica perto de 5%. */
const CASAS = 250
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 1000, y: 1000, size: 1, image: null, color: '#3cff00' }
const PINO: Pin = { id: 'p-bau', x: 5000, y: 5000, kind: 'exclamacao', description: 'Baú velho', image: null }

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

function cena(): MapData {
  return { ...createEmptyMap('m-torre', '', CASAS, CASAS, GRADE), tokens: [ANA], pins: [PINO] }
}

const BASE: Props = {
  map: cena(),
  vision: quadrado(CASAS * GRADE),
  ownTokens: [ANA.id],
  settings: DEFAULT_PLAYER_SETTINGS,
  focusTokenId: null,
  focusSeq: 0,
  onMove: () => {},
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('a PlayerView não criou o Application')
  return p
}

function mundo(): Container {
  const world = palco().children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

/** O desenho dos pinos: a camada logo abaixo das fichas (`world.addChild(…, roofs, pins, tokens)`). */
function desenhoDosPinos(): Graphics {
  const desenho = mundo().children.at(-2)?.children[0]
  if (!(desenho instanceof Graphics)) throw new Error('a camada de pinos não tem o Graphics dos pinos')
  return desenho
}

/** Altura do pino desenhado, em px de TELA (contorno incluído). */
function alturaDoPinoNaTela(): number {
  return desenhoDosPinos().getLocalBounds().height * mundo().scale.y
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

/** Toque curto e parado de um dedo no chão do mapa. */
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

describe('PlayerView — pino com tamanho mínimo no zoom afastado', () => {
  let raiz: HTMLDivElement
  let root: Root
  let agora = 0

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
    tela.quadros.length = 0
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

  async function mostra(props: Props): Promise<void> {
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
  }

  async function monta(props: Props): Promise<void> {
    const limites = vi.fn()
    await mostra({ ...props, onZoomLimitsChange: limites })
    await vi.waitFor(() => expect(limites).toHaveBeenCalled())
    vi.spyOn(performance, 'now').mockImplementation(() => agora)
  }

  function quadro(ms: number): void {
    agora += ms
    act(() => {
      for (const q of [...tela.quadros]) q()
    })
  }

  it('cena inteira na janela: o pino continua com a altura mínima na tela, em vez de virar um risco', async () => {
    await monta(BASE)
    const escala = mundo().scale.x
    // O cenário é o do relato: o pino de tamanho de mundo teria uns 3 px de tela.
    expect(PIN_HEIGHT * escala).toBeLessThan(4)
    expect(PIN_HEIGHT * escala).toBeGreaterThan(0)

    const altura = alturaDoPinoNaTela()
    expect(altura).toBeGreaterThanOrEqual(PIN_MIN_SCREEN_HEIGHT)
    // Só a espessura do contorno passa do mínimo: o pino não cresce além do alvo.
    expect(altura).toBeLessThan(PIN_MIN_SCREEN_HEIGHT * 1.5)
  })

  it('um degrau do + ainda longe: o pino é redesenhado e segue com a altura mínima, sem crescer junto com o zoom', async () => {
    await monta(BASE)
    const escala0 = mundo().scale.x
    const altura0 = alturaDoPinoNaTela()

    const mais: ZoomStepRequest = { direction: 1, animate: true, seq: 1 }
    await mostra({ ...BASE, zoomStep: mais })
    quadro(ZOOM_STEP_MS * 2)
    expect(mundo().scale.x).toBeCloseTo(escala0 * ZOOM_STEP_FACTOR, 9)
    expect(pinSizeScale(mundo().scale.x)).toBeGreaterThan(1)

    // Sem o redesenho no zoom, o pino teria crescido na mesma razão do degrau (x1,41).
    expect(alturaDoPinoNaTela()).toBeGreaterThanOrEqual(PIN_MIN_SCREEN_HEIGHT)
    expect(alturaDoPinoNaTela()).toBeCloseTo(altura0, 0)
  })

  it('toque na cabeça desenhada abre o cartão do pino', async () => {
    const onPinOpen = vi.fn()
    await monta({ ...BASE, onPinOpen })
    const escala = mundo().scale.x
    const ponta = naTela(PINO)
    const cabeca = { x: ponta.x, y: ponta.y - PIN_HEAD_OFFSET * pinSizeScale(escala) * escala }

    tocar(cabeca)
    expect(onPinOpen).toHaveBeenCalledTimes(1)
    expect(onPinOpen).toHaveBeenCalledWith(PINO.id)
  })

  it('toque ao lado do pino, fora do que está desenhado, não abre pino nenhum', async () => {
    const onPinOpen = vi.fn()
    await monta({ ...BASE, onPinOpen })
    const ponta = naTela(PINO)

    // 16 px de tela à esquerda da ponta: fora do pino desenhado e da folga de
    // dedo proporcional a ele. Antes, os 18 px fixos de folga abriam o pino daqui.
    tocar({ x: ponta.x - 16, y: ponta.y })
    expect(onPinOpen).not.toHaveBeenCalled()

    // O mesmo dedo, na ponta cravada, abre: o toque continua funcionando.
    tocar(ponta)
    expect(onPinOpen).toHaveBeenCalledWith(PINO.id)
  })
})
