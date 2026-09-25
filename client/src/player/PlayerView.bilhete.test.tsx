import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, MarcaNoLugar, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * BILHETE NO LUGAR, a leitura na PlayerView montada: quem passa depois TOCA no
 * bilhete do chão e a tela avisa `onMarkOpen` com o id dele — é o que abre o
 * cartão "Bilhete deixado aqui" (`PlayerMarkCard.test.tsx`). A seta não tem o
 * que ler, o toque longe não abre nada e arrastar o mapa a partir do bilhete é
 * arrasto, não leitura.
 *
 * Mesma troca de `PlayerView.pinca.test.tsx`: só o que o jsdom não tem (o
 * `Application`, que pede WebGL, e a medida do texto) é substituído; os dedos
 * entram pelo palco do Pixi na ordem do EventBoundary.
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

const GRADE = 40
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 500, y: 500, size: 1, image: null }
const BILHETE: MarcaNoLugar = { id: 'b-escada', tipo: 'bilhete', x: 300, y: 300, texto: 'Fui pela escada' }
const SETA: MarcaNoLugar = { id: 's-leste', tipo: 'seta', x: 700, y: 300, rumo: 'l' }

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

function salao(marcas: MarcaNoLugar[] | undefined): MapData {
  return { ...createEmptyMap('m-salao', '', 25, 25, GRADE), tokens: [ANA], ...(marcas === undefined ? {} : { marcas }) }
}

function base(map: MapData, onMarkOpen: Props['onMarkOpen']): Props {
  return {
    map,
    vision: quadrado(1000, 1000),
    ownTokens: [ANA.id],
    settings: DEFAULT_PLAYER_SETTINGS,
    focusTokenId: null,
    focusSeq: 0,
    onMove: () => {},
    onMarkOpen,
  }
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

/** Onde um ponto do mundo aparece na tela agora. */
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

function encostar(p: Ponto): void {
  const e = dedo(p)
  act(() => {
    palco().emit('pointerdowncapture', e)
    palco().emit('pointerdown', e)
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

function tocar(p: Ponto): void {
  encostar(p)
  soltar(p)
}

describe('PlayerView — tocar no bilhete do chão abre a leitura', () => {
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

  /** Espera o `setup` assíncrono terminar (o último passo avisa os limites do zoom). */
  async function monta(props: Props): Promise<void> {
    const limites = vi.fn()
    await act(async () => {
      root.render(<PlayerView {...props} onZoomLimitsChange={limites} />)
    })
    await vi.waitFor(() => expect(limites).toHaveBeenCalled())
  }

  it('toque rápido em cima do bilhete: onMarkOpen com o id dele, uma vez', async () => {
    const onMarkOpen = vi.fn<(markId: string) => void>()
    await monta(base(salao([BILHETE, SETA]), onMarkOpen))

    tocar(naTela(BILHETE))

    expect(onMarkOpen).toHaveBeenCalledTimes(1)
    expect(onMarkOpen).toHaveBeenCalledWith(BILHETE.id)
  })

  it('a poucos pixels de tela do bilhete ainda abre (folga de dedo, como a do pino)', async () => {
    const onMarkOpen = vi.fn<(markId: string) => void>()
    await monta(base(salao([BILHETE]), onMarkOpen))
    const alvo = naTela(BILHETE)

    tocar({ x: alvo.x + 6, y: alvo.y - 6 })

    expect(onMarkOpen).toHaveBeenCalledWith(BILHETE.id)
  })

  it('a seta de giz não abre nada, e o chão vazio também não', async () => {
    const onMarkOpen = vi.fn<(markId: string) => void>()
    await monta(base(salao([BILHETE, SETA]), onMarkOpen))

    tocar(naTela(SETA))
    tocar(naTela({ x: 800, y: 800 }))

    expect(onMarkOpen).not.toHaveBeenCalled()
  })

  it('arrastar o mapa começando no bilhete é arrasto: não abre a leitura', async () => {
    const onMarkOpen = vi.fn<(markId: string) => void>()
    await monta(base(salao([BILHETE]), onMarkOpen))
    const inicio = naTela(BILHETE)
    const fim = { x: inicio.x + 120, y: inicio.y }

    encostar(inicio)
    arrastar(fim)
    soltar(fim)

    expect(onMarkOpen).not.toHaveBeenCalled()
  })

  it('mapa sem o campo de marcas (mapa antigo): tocar ali não abre nada nem quebra', async () => {
    const onMarkOpen = vi.fn<(markId: string) => void>()
    await monta(base(salao(undefined), onMarkOpen))

    tocar(naTela(BILHETE))

    expect(onMarkOpen).not.toHaveBeenCalled()
  })

  it('o bilhete que chega DEPOIS da montagem (outro jogador deixou) também abre', async () => {
    const onMarkOpen = vi.fn<(markId: string) => void>()
    await monta(base(salao([]), onMarkOpen))
    tocar(naTela(BILHETE))
    expect(onMarkOpen).not.toHaveBeenCalled()

    await act(async () => {
      root.render(<PlayerView {...base(salao([BILHETE]), onMarkOpen)} />)
    })
    tocar(naTela(BILHETE))

    expect(onMarkOpen).toHaveBeenCalledWith(BILHETE.id)
  })
})
