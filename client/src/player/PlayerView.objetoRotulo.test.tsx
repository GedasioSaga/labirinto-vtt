import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Sprite, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Prop, RegionPoint, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS, type PlayerViewSettings } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * OBJETO COM RÓTULO OU IMAGEM, na TELA montada. `lib/fogFilter.ts` decide o
 * que sai e `pixi/drawPropLooks.ts` desenha; aqui a prova é a costura: o
 * rótulo que chega no pacote aparece escrito no mundo da PlayerView, a imagem
 * vira sprite no lugar e na rotação do mestre, e o snapshot sem o objeto
 * apaga os dois.
 *
 * Sem navegador: só o `Application` (WebGL) é trocado, como em
 * `PlayerView.silhueta.test.tsx`.
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
  return { ...pixi, Application: ApplicationSemGpu }
})

/**
 * O ajuste de nitidez do texto (`pixi/textResolution.ts`) MEDE cada Text do
 * mundo, e medir texto pede canvas 2D, que o jsdom não tem. É a segunda peça
 * trocada, e só a medição: o rótulo continua sendo o `Text` de verdade.
 */
vi.mock('../pixi/textResolution', async (importOriginal) => {
  const original = await importOriginal<typeof import('../pixi/textResolution')>()
  return { ...original, syncWorldTextResolution: () => 1 }
})

const IMAGEM_DO_PIANO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const DIVISORIA: Wall = { id: 'divisoria', x1: 500, y1: 0, x2: 500, y2: 1000, blocksLight: true, blocksMove: true, door: null }
/** Como o recorte manda: geometria + rótulo/imagem. */
const GUARDA_ROUPA: Prop = { id: 'guarda-roupa', x: 150, y: 150, width: 40, height: 80, src: '', linkedMapPath: null, playerLabel: 'Guarda-roupa' }
const PIANO: Prop = { id: 'piano', x: 300, y: 300, width: 80, height: 60, rotation: 30, src: '', linkedMapPath: null, playerImage: IMAGEM_DO_PIANO }
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 1000 },
    { x: 0, y: 1000 },
  ],
]
const SEM_FICHAS: string[] = []

function pacote(props: Prop[]): MapData {
  return { ...createEmptyMap('m-mansao', '', 25, 25, 40), walls: [DIVISORIA], props }
}

function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

/** Tudo que é `T` no mundo, em qualquer profundidade. */
function todos<T extends Container>(raiz: Container, tipo: new (...args: never[]) => T): T[] {
  const achados: T[] = []
  const visitar = (c: Container): void => {
    if (c instanceof tipo) achados.push(c)
    for (const filho of c.children) visitar(filho)
  }
  visitar(raiz)
  return achados
}

describe('PlayerView — rótulo e imagem do objeto que chega no recorte', () => {
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

  function conteiner(): HTMLElement {
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    return el
  }

  async function mostra(map: MapData, settings: PlayerViewSettings = DEFAULT_PLAYER_SETTINGS): Promise<void> {
    await act(async () => {
      root.render(<PlayerView map={map} vision={VISAO} ownTokens={SEM_FICHAS} settings={settings} focusTokenId={null} focusSeq={0} onMove={() => {}} />)
    })
  }

  async function monta(map: MapData): Promise<void> {
    await mostra(map)
    await vi.waitFor(() => expect(conteiner().dataset.propsCount).toBeDefined())
  }

  function rotulosDeObjeto(): Text[] {
    return todos(mundo(), Text).filter((t) => t.text === 'Guarda-roupa' || t.text === 'Armário')
  }

  function imagensDoPiano(): Sprite[] {
    return todos(mundo(), Sprite).filter((s) => s.x === 300 && s.y === 300)
  }

  it('Elisa vê "Guarda-roupa" escrito no centro da silhueta, e o piano como imagem na posição e rotação do editor', async () => {
    await monta(pacote([GUARDA_ROUPA, PIANO]))

    expect(conteiner().dataset.propLabelsCount).toBe('1')
    expect(conteiner().dataset.propImagesCount).toBe('1')
    const [rotulo] = rotulosDeObjeto()
    expect(rotulo.x).toBe(150)
    expect(rotulo.y).toBe(150)
    expect(rotulo.visible).toBe(true)
    const [imagem] = imagensDoPiano()
    expect(imagem.rotation).toBeCloseTo((30 * Math.PI) / 180, 10)
    expect(imagem.width).toBeCloseTo(80, 6)
    expect(imagem.height).toBeCloseTo(60, 6)
    // A silhueta continua embaixo: o rótulo diz o que é, não substitui a forma.
    expect(conteiner().dataset.propsCount).toBe('2')
  })

  it('snapshot seguinte sem os objetos (teto fechou, saíram da visão): o nome e a imagem somem da tela', async () => {
    await monta(pacote([GUARDA_ROUPA, PIANO]))
    await mostra(pacote([]))

    expect(conteiner().dataset.propLabelsCount).toBe('0')
    expect(conteiner().dataset.propImagesCount).toBe('0')
    expect(rotulosDeObjeto()).toHaveLength(0)
    expect(imagensDoPiano()).toHaveLength(0)
  })

  it('o mestre renomeia para "Armário": a tela do jogador troca o texto no snapshot seguinte', async () => {
    await monta(pacote([GUARDA_ROUPA]))
    await mostra(pacote([{ ...GUARDA_ROUPA, playerLabel: 'Armário' }]))

    expect(rotulosDeObjeto().map((t) => t.text)).toEqual(['Armário'])
  })

  it('"Mostrar nomes" desligado no painel do jogador esconde o rótulo, como o nome da sala', async () => {
    await monta(pacote([GUARDA_ROUPA]))
    await mostra(pacote([GUARDA_ROUPA]), { ...DEFAULT_PLAYER_SETTINGS, showNames: false })

    const [rotulo] = rotulosDeObjeto()
    expect(rotulo.text).toBe('Guarda-roupa')
    expect(rotulo.parent?.visible).toBe(false)
  })
})
