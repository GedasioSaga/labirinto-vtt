import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import {
  PROP_SILHOUETTE_EDGE_ALPHA,
  PROP_SILHOUETTE_EDGE_COLOR,
  PROP_SILHOUETTE_EDGE_SCREEN_PX,
  PROP_SILHOUETTE_FILL_ALPHA,
  PROP_SILHOUETTE_FILL_COLOR,
} from '../pixi/drawPropSilhouettes'
import { WALL_COLOR, WALL_EXTERIOR_ALPHA } from '../pixi/drawWalls'
import type { MapData, Prop, RegionPoint, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * OBJETOS COMO SILHUETA, na TELA. `lib/fogFilter.silhueta.test.ts` prova o
 * recorte e `pixi/drawPropSilhouettes.test.ts` o desenho isolado; aqui a prova
 * é a COSTURA entre os dois: o objeto que chega no pacote vira silhueta no
 * `world` da PlayerView de verdade, abaixo das paredes, e é repintado quando
 * o mapa muda e quando o zoom muda.
 *
 * Sem navegador. O `Application` do Pixi pede WebGL, que o jsdom não tem, e é
 * a ÚNICA peça trocada: `Container` e `Graphics` são os de verdade, então o que
 * se lê aqui são as instruções de desenho que o Pixi mandaria para a GPU. O
 * pixel na tela continua sendo assunto do e2e, que tem o `data-props-count`.
 */

/** Palco de cada `Application` criado: é por ele que o teste chega ao `world`. */
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

/** A parede cega entre o quarto do prefeito (Ana) e o corredor. */
const DIVISORIA: Wall = { id: 'divisoria', x1: 500, y1: 0, x2: 500, y2: 1000, blocksLight: true, blocksMove: true, door: null }
/** Como o recorte manda: só a geometria. Deitada (90°): 40 x 80 em volta de (250, 180). */
const CAMA: Prop = { id: 'cama', x: 250, y: 180, width: 80, height: 40, rotation: 90, src: '', linkedMapPath: null }
const BAU: Prop = { id: 'bau', x: 380, y: 320, width: 60, height: 40, src: '', linkedMapPath: null }
/** O lado da Ana, até a parede. */
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 1000 },
    { x: 0, y: 1000 },
  ],
]
const SEM_FICHAS: string[] = []

/** O mapa como o jogador o recebe: mesmo id em todo snapshot, então a câmera não reenquadra. */
function pacote(props: Prop[]): MapData {
  return { ...createEmptyMap('m-prefeitura', '', 25, 25, 40), walls: [DIVISORIA], props }
}

type Instrucao = Graphics['context']['instructions'][number]

function ehPreenchimentoDeSilhueta(i: Instrucao): boolean {
  return i.action === 'fill' && i.data.style.color === PROP_SILHOUETTE_FILL_COLOR && i.data.style.alpha === PROP_SILHOUETTE_FILL_ALPHA
}

function ehContornoDeSilhueta(i: Instrucao): boolean {
  return i.action === 'stroke' && i.data.style.color === PROP_SILHOUETTE_EDGE_COLOR && i.data.style.alpha === PROP_SILHOUETTE_EDGE_ALPHA
}

function ehTracoDeParede(i: Instrucao): boolean {
  return i.action === 'stroke' && i.data.style.color === WALL_COLOR && i.data.style.alpha === WALL_EXTERIOR_ALPHA
}

/** Camadas do mundo, de baixo para cima, com alguma instrução que passa em `teste`. */
function camadasCom(world: Container, teste: (i: Instrucao) => boolean): Graphics[] {
  return world.children.filter((c): c is Graphics => c instanceof Graphics && c.context.instructions.some(teste))
}

/** Caixa de cada silhueta pintada na camada: centro e tamanho do `poly`. */
function silhuetas(camada: Graphics): { cx: number; cy: number; w: number; h: number }[] {
  return camada.context.instructions.filter(ehPreenchimentoDeSilhueta).map((i) => {
    if (i.action !== 'fill') throw new Error('esperava fill')
    const poly = i.data.path.instructions.find((p) => p.action === 'poly')
    const flat = (poly?.data[0] ?? []) as number[]
    const xs = flat.filter((_, k) => k % 2 === 0)
    const ys = flat.filter((_, k) => k % 2 === 1)
    return {
      cx: (Math.max(...xs) + Math.min(...xs)) / 2,
      cy: (Math.max(...ys) + Math.min(...ys)) / 2,
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    }
  })
}

function larguraDoContorno(camada: Graphics): number {
  const contorno = camada.context.instructions.find(ehContornoDeSilhueta)
  if (contorno?.action !== 'stroke') throw new Error('a silhueta não tem contorno')
  return contorno.data.style.width
}

/** O `world` do jogador: o primeiro filho do palco (`app.stage.addChild(world, …)`). */
function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

describe('PlayerView — o objeto que chega no recorte aparece na tela como silhueta', () => {
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
  })

  /** O div do canvas: é nele que a PlayerView escreve as contagens para o e2e. */
  function conteiner(): HTMLElement {
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    return el
  }

  async function mostra(map: MapData): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView map={map} vision={VISAO} ownTokens={SEM_FICHAS} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
      )
    })
  }

  /** Primeiro snapshot: espera o `setup` assíncrono (o `init` do Application) chegar ao primeiro desenho. */
  async function monta(map: MapData): Promise<void> {
    await mostra(map)
    await vi.waitFor(() => expect(conteiner().dataset.propsCount).toBeDefined())
  }

  function unicaCamadaDeSilhueta(): Graphics {
    const camadas = camadasCom(mundo(), ehPreenchimentoDeSilhueta)
    expect(camadas).toHaveLength(1)
    return camadas[0]
  }

  it('a cama do pacote vira UM retângulo chapado no mundo, no lugar e no tamanho do mestre, abaixo das paredes', async () => {
    await monta(pacote([CAMA]))

    expect(conteiner().dataset.propsCount).toBe('1')
    const world = mundo()
    const camada = unicaCamadaDeSilhueta()
    const [cama] = silhuetas(camada)
    // Um pixel físico de folga: cada borda encosta no pixel da escala atual (`pixelAlign.ts`).
    const umPixel = 1 / world.scale.x
    expect(Math.abs(cama.w - 40)).toBeLessThanOrEqual(umPixel)
    expect(Math.abs(cama.h - 80)).toBeLessThanOrEqual(umPixel)
    expect(Math.abs(cama.cx - 250)).toBeLessThanOrEqual(umPixel)
    expect(Math.abs(cama.cy - 180)).toBeLessThanOrEqual(umPixel)

    // Abaixo da parede: por cima, a silhueta apagaria o traço onde o móvel encosta.
    const [paredes] = camadasCom(world, ehTracoDeParede)
    expect(paredes).toBeDefined()
    expect(world.getChildIndex(camada)).toBeLessThan(world.getChildIndex(paredes))
  })

  it('snapshot novo da mesma cena repinta: o objeto que entra na visão aparece, e o que sai some', async () => {
    await monta(pacote([CAMA]))
    const camada = unicaCamadaDeSilhueta()

    await mostra(pacote([CAMA, BAU]))
    expect(conteiner().dataset.propsCount).toBe('2')
    expect(silhuetas(camada)).toHaveLength(2)

    await mostra(pacote([]))
    expect(conteiner().dataset.propsCount).toBe('0')
    expect(silhuetas(camada)).toHaveLength(0)
    expect(mundo().children).toContain(camada)
  })

  it('o zoom repinta o contorno: continua com 1 px de TELA em qualquer escala', async () => {
    await monta(pacote([CAMA]))
    const world = mundo()
    const camada = unicaCamadaDeSilhueta()
    const antes = world.scale.x
    expect(larguraDoContorno(camada)).toBeCloseTo(PROP_SILHOUETTE_EDGE_SCREEN_PX / antes, 6)

    const canvas = conteiner().querySelector('canvas')
    if (canvas === null) throw new Error('a PlayerView não pôs o canvas no contêiner')
    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, clientX: 400, clientY: 300, cancelable: true }))
    })

    const depois = world.scale.x
    expect(depois).toBeGreaterThan(antes)
    expect(larguraDoContorno(camada)).toBeCloseTo(PROP_SILHOUETTE_EDGE_SCREEN_PX / depois, 6)
  })
})
