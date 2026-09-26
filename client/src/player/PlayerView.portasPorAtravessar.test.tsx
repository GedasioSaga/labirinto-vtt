import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { DOOR_TO_CROSS_COLOR } from '../pixi/drawDoors'
import type { MapData, Region, RegionPoint, Token, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * PORTAS POR ATRAVESSAR na PlayerView montada: a costura entre o que chegou
 * (`porAtravessar`, as Salas do recorte) e o desenho. A porta marcada ganha o
 * ponto claro na camada de portas; o prédio mostra, no rótulo, quantos
 * cômodos dele o jogador já viu. Mesmo palco sem GPU de
 * `PlayerView.rotuloDaSala.test.tsx`.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[] }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = { add: () => undefined, remove: () => undefined }
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

type Props = Parameters<typeof PlayerView>[0]

const GRADE = 40

function retangulo(x1: number, y1: number, x2: number, y2: number): RegionPoint[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

function sala(id: string, name: string, points: RegionPoint[], parentId?: string): Region {
  return { id, points, tag: '', fillColor: '#2f5d50', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...(parentId === undefined ? {} : { parentId }) }
}

const PORTA: Wall = { id: 'pa', x1: 400, y1: 400, x2: 440, y2: 400, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
const FICHA: Token = { id: 'tok', characterId: null, name: 'Gabi', x: 420, y: 460, size: 1, image: null }

function albergue(): MapData {
  return {
    ...createEmptyMap('m-alb', '', 25, 25, GRADE),
    regions: [sala('alb', 'Albergue', retangulo(0, 0, 1000, 1000)), sala('q1', 'Quarto 1', retangulo(80, 80, 400, 400), 'alb')],
    walls: [PORTA],
    tokens: [FICHA],
  }
}

const VISAO: RegionPoint[][] = [retangulo(0, 0, 1000, 1000)]

function mundo(): Container {
  const palco = tela.palcos.at(-1)
  if (palco === undefined) throw new Error('a PlayerView não criou o Application')
  const world = palco.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

function descendentes(no: Container): Container[] {
  return no.children.flatMap((filho) => (filho instanceof Container ? [filho, ...descendentes(filho)] : []))
}

/** Quantos pontos (círculo preenchido) na cor da marca há no mundo. */
function pontosDaMarca(): number {
  let n = 0
  for (const g of descendentes(mundo())) {
    if (!(g instanceof Graphics)) continue
    for (const i of g.context.instructions) {
      if (i.action !== 'fill' || i.data.style.color !== DOOR_TO_CROSS_COLOR) continue
      n += i.data.path.instructions.filter((p) => p.action === 'circle').length
    }
  }
  return n
}

function textosNoMundo(): string[] {
  return descendentes(mundo()).flatMap((no) => (no instanceof Text ? [no.text] : []))
}

describe('PlayerView — portas por atravessar', () => {
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

  function props(extra: Partial<Props> = {}): Props {
    return { map: albergue(), vision: VISAO, ownTokens: ['tok'], settings: DEFAULT_PLAYER_SETTINGS, focusTokenId: null, focusSeq: 0, onMove: () => {}, ...extra }
  }

  async function monta(p: Props): Promise<void> {
    await act(async () => {
      root.render(<PlayerView {...p} />)
    })
    await vi.waitFor(() => {
      const el = raiz.firstElementChild
      if (!(el instanceof HTMLElement)) throw new Error('sem contêiner')
      expect(el.dataset.tokensCount).toBe('1')
    })
  }

  it('a porta marcada ganha o ponto; sem a marca, nenhum ponto', async () => {
    await monta(props({ porAtravessar: ['pa'] }))
    expect(pontosDaMarca()).toBe(1)
    await act(async () => {
      root.render(<PlayerView {...props({ porAtravessar: [] })} />)
    })
    expect(pontosDaMarca()).toBe(0)
  })

  it('o prédio mostra quantos cômodos dele o jogador já viu; o cômodo fica com o nome de sempre', async () => {
    await monta(props())
    const textos = textosNoMundo()
    expect(textos).toContain('Albergue · 1 cômodo visto')
    expect(textos).toContain('Quarto 1')
    expect(textos).not.toContain('Albergue')
  })
})
