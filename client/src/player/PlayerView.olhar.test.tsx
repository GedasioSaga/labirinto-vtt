import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * MODO OLHAR da Visão de jogador, na PlayerView montada: o mestre arrasta a
 * câmera à vontade, mas nenhum toque age como o jogador — pegar a própria
 * ficha, a porta, a ficha alheia e o segurar viram o recado (`onAcaoNoOlhar`).
 *
 * Mesmo molde de `PlayerView.portaFicha.test.tsx`: só o `Application` (WebGL)
 * e a medida do texto são trocados, e o dedo entra pelo palco do Pixi.
 */

const tela = vi.hoisted(() => {
  const palcos: Container[] = []
  return { palcos, largura: 800, altura: 600 }
})

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
/** Tempo do toque longo com folga (o da PlayerView é menor que um segundo). */
const SEGURAR_MS = 1_500
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 375, y: 375, size: 1, image: null }
const SEVERA: Token = { id: 'tok-severa', characterId: null, name: 'Severa', x: 125, y: 125, size: 1, image: null }
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
  return { ...createEmptyMap('m-olhar', '', 10, 10, GRADE), walls: [PORTA], tokens: [SEVERA, ANA] }
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

/** A ficha da Ana: a da camada de fichas que está no ponto dela. */
function fichaDaAna(): Container {
  const ficha = mundo()
    .children.at(-1)
    ?.children.find((filho) => filho.x === ANA.x && filho.y === ANA.y)
  if (!(ficha instanceof Container)) throw new Error('a ficha da Ana não está no mundo')
  return ficha
}

function naTela(p: Ponto): Ponto {
  const w = mundo()
  return { x: w.x + p.x * w.scale.x, y: w.y + p.y * w.scale.y }
}

function dedo(p: Ponto, opcoes: { alt?: boolean } = {}): FederatedPointerEvent {
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'touch'
  e.pointerId = 1
  e.isPrimary = true
  e.altKey = opcoes.alt === true
  e.global.set(p.x, p.y)
  return e
}

/** Encosta: a captura do palco, o alvo (a ficha, quando é ela) e a subida até o palco se ninguém parou. */
function encostar(p: Ponto, alvo: Container | null = null, opcoes: { alt?: boolean } = {}): void {
  const e = dedo(p, opcoes)
  act(() => {
    palco().emit('pointerdowncapture', e)
    if (alvo !== null) alvo.emit('pointerdown', e)
    if (!e.propagationStopped) palco().emit('pointerdown', e)
  })
}

function arrastar(p: Ponto): void {
  act(() => {
    palco().emit('globalpointermove', dedo(p))
  })
}

function soltar(p: Ponto): void {
  act(() => {
    palco().emit('pointerup', dedo(p))
  })
}

function tocar(pontoDoMundo: Ponto): void {
  const p = naTela(pontoDoMundo)
  encostar(p)
  soltar(p)
}

describe('PlayerView — modo Olhar da Visão de jogador', () => {
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
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  interface Espias {
    recado: Mock<() => void>
    mover: Mock<Props['onMove']>
    porta: Mock<(wallId: string) => void>
    fichaAlheia: Mock<(tokenId: string) => void>
    segurar: Mock<(x: number, y: number, screenX: number, screenY: number) => void>
  }

  async function monta(olhar: boolean): Promise<Espias> {
    const espias: Espias = { recado: vi.fn(), mover: vi.fn(), porta: vi.fn(), fichaAlheia: vi.fn(), segurar: vi.fn() }
    const limites = vi.fn()
    const props: Props = {
      map: mapa(),
      vision: quadrado(500),
      ownTokens: [ANA.id],
      settings: DEFAULT_PLAYER_SETTINGS,
      focusTokenId: null,
      focusSeq: 0,
      onMove: espias.mover,
      onDoorToggle: espias.porta,
      onTokenOpen: espias.fichaAlheia,
      onLongPress: espias.segurar,
      onZoomLimitsChange: limites,
      onAcaoNoOlhar: olhar ? espias.recado : undefined,
    }
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
    await vi.waitFor(() => expect(limites).toHaveBeenCalled())
    return espias
  }

  it('o mapa leva a marca de câmera livre só no Olhar', async () => {
    await monta(true)
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    expect(el.hasAttribute('data-camera-livre')).toBe(true)

    await act(async () => {
      root.render(<PlayerView map={mapa()} vision={quadrado(500)} ownTokens={[ANA.id]} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />)
    })
    expect(raiz.firstElementChild?.hasAttribute('data-camera-livre')).toBe(false)
  })

  it('tocar na porta e na ficha alheia dá o recado e não age', async () => {
    const espias = await monta(true)

    tocar({ x: 150, y: 125 })
    tocar({ x: 125, y: 125 })

    expect(espias.recado).toHaveBeenCalledTimes(2)
    expect(espias.porta).not.toHaveBeenCalled()
    expect(espias.fichaAlheia).not.toHaveBeenCalled()
  })

  it('tocar no chão vazio não dá recado nenhum', async () => {
    const espias = await monta(true)

    tocar({ x: 300, y: 250 })

    expect(espias.recado).not.toHaveBeenCalled()
  })

  it('pegar a própria ficha dá o recado, e arrastar e soltar não pede movimento', async () => {
    const espias = await monta(true)
    const inicio = naTela(ANA)

    encostar(inicio, fichaDaAna())
    arrastar({ x: inicio.x + 120, y: inicio.y })
    soltar({ x: inicio.x + 120, y: inicio.y })

    expect(espias.recado).toHaveBeenCalledTimes(1)
    expect(espias.mover).not.toHaveBeenCalled()
    expect(fichaDaAna().x).toBe(ANA.x)
  })

  it('arrastar o chão move a câmera, sem recado', async () => {
    const espias = await monta(true)
    const antes = mundo().x

    encostar({ x: 400, y: 300 })
    arrastar({ x: 460, y: 300 })
    soltar({ x: 460, y: 300 })

    expect(mundo().x).toBe(antes + 60)
    expect(espias.recado).not.toHaveBeenCalled()
  })

  it('segurar no mapa e o Alt+clique dão o recado no lugar do sinal e do menu', async () => {
    const espias = await monta(true)
    vi.useFakeTimers()

    encostar({ x: 300, y: 250 })
    act(() => {
      vi.advanceTimersByTime(SEGURAR_MS)
    })
    soltar({ x: 300, y: 250 })
    encostar({ x: 320, y: 250 }, null, { alt: true })
    soltar({ x: 320, y: 250 })

    expect(espias.recado).toHaveBeenCalledTimes(2)
    expect(espias.segurar).not.toHaveBeenCalled()
  })

  it('sem o Olhar, o mesmo toque na porta age como sempre', async () => {
    const espias = await monta(false)

    tocar({ x: 150, y: 125 })

    expect(espias.porta).toHaveBeenCalledWith('porta')
    expect(espias.recado).not.toHaveBeenCalled()
  })
})
