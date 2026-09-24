import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { RoofPeek } from '../lib/fogFilter'
import type { MapData, Region, RegionPoint } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView, ROOF_COLOR } from './PlayerView'

/**
 * VER PELA PORTA ABERTA, na TELA. `lib/fogFilter.verPelaPorta.test.ts` prova o
 * recorte; aqui a prova é a COSTURA: o telhado do prédio espiado continua
 * pintado, mas recortado pela visão de quem está no vão (máscara inversa), e o
 * telhado dos outros prédios segue inteiro.
 *
 * Sem navegador: só o `Application` do Pixi (que pede WebGL) é trocado;
 * `Container` e `Graphics` são os de verdade, então o que se lê aqui são as
 * instruções de desenho e as máscaras que o Pixi mandaria para a GPU.
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

function predio(id: string, x0: number, y0: number, x1: number, y1: number): Region {
  return {
    id,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    // Como o recorte manda o teto FECHADO: marcado e sem nome.
    room: { shape: 'rect', name: '', roof: true },
  }
}

/** Casa (espiada) e celeiro (não), como chegam no pacote. */
function pacote(): MapData {
  return { ...createEmptyMap('m-vila', '', 25, 25, 40), regions: [predio('casa', 200, 200, 600, 600), predio('celeiro', 700, 100, 900, 300)] }
}

/** A visão de quem está no vão: entra pela porta (x 380..420, y 600) e abre em leque até a divisória. */
const CONE: RegionPoint[] = [
  { x: 400, y: 630 },
  { x: 380, y: 600 },
  { x: 250, y: 400 },
  { x: 550, y: 400 },
  { x: 420, y: 600 },
]
const VISAO: RegionPoint[][] = [CONE]
const ESPIADA: RoofPeek = { roofIds: ['casa'], vision: VISAO }
const SEM_FICHAS: string[] = []

type Instrucao = Graphics['context']['instructions'][number]

function ehTelhado(i: Instrucao): boolean {
  return i.action === 'fill' && i.data.style.color === ROOF_COLOR
}

/** Os vértices de cada `poly` pintado nas instruções da camada, planos (x, y, x, y, …). */
function poligonos(camada: Graphics): number[][] {
  return camada.context.instructions.flatMap((i) =>
    i.action === 'fill' ? i.data.path.instructions.filter((p) => p.action === 'poly').map((p) => planarDoPixi(p.data[0])) : [],
  )
}

/** O Pixi guarda o `poly` como veio: lista de pontos `{ x, y }` ou lista plana de números. */
function planarDoPixi(dado: unknown): number[] {
  if (!Array.isArray(dado)) return []
  return dado.flatMap((v: unknown) => (typeof v === 'number' ? [v] : typeof v === 'object' && v !== null && 'x' in v && 'y' in v ? [Number(v.x), Number(v.y)] : []))
}

function planar(points: readonly RegionPoint[]): number[] {
  return points.flatMap((p) => [p.x, p.y])
}

function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

function camadasDeTelhado(): Graphics[] {
  return mundo().children.filter((c): c is Graphics => c instanceof Graphics && c.context.instructions.some(ehTelhado))
}

describe('PlayerView — telhado recortado pela visão de quem espia pela porta', () => {
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

  async function mostra(peek: RoofPeek | undefined): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView
          map={pacote()}
          vision={VISAO}
          peek={peek}
          ownTokens={SEM_FICHAS}
          settings={DEFAULT_PLAYER_SETTINGS}
          focusTokenId={null}
          focusSeq={0}
          onMove={() => {}}
        />,
      )
    })
    await vi.waitFor(() => expect(conteiner().dataset.peekedRoofsCount).toBeDefined())
  }

  it('com a espiada, o telhado da casa sai numa camada com máscara INVERSA da visão; o do celeiro, inteiro', async () => {
    await mostra(ESPIADA)

    expect(conteiner().dataset.peekedRoofsCount).toBe('1')
    const camadas = camadasDeTelhado()
    const espiada = camadas.find((c) => c.mask !== null && c.mask !== undefined)
    const inteira = camadas.find((c) => c.mask === null || c.mask === undefined)
    expect(espiada).toBeDefined()
    expect(inteira).toBeDefined()
    if (espiada === undefined || inteira === undefined) return

    expect(poligonos(espiada)).toEqual([planar(pacote().regions[0].points)])
    expect(poligonos(inteira)).toEqual([planar(pacote().regions[1].points)])
    expect(espiada._maskOptions?.inverse).toBe(true)
    const mascara = espiada.mask
    expect(mascara).toBeInstanceOf(Graphics)
    if (!(mascara instanceof Graphics)) return
    expect(poligonos(mascara)).toEqual([planar(CONE)])
  })

  it('sem a espiada, todo telhado sai inteiro, sem máscara nenhuma', async () => {
    await mostra(undefined)

    expect(conteiner().dataset.peekedRoofsCount).toBe('0')
    const camadas = camadasDeTelhado()
    expect(camadas).toHaveLength(1)
    expect(camadas[0].mask ?? null).toBe(null)
    expect(poligonos(camadas[0])).toEqual([planar(pacote().regions[0].points), planar(pacote().regions[1].points)])
  })

  it('a espiada termina: o próximo desenho devolve o telhado inteiro à casa', async () => {
    await mostra(ESPIADA)
    expect(conteiner().dataset.peekedRoofsCount).toBe('1')

    await mostra(undefined)
    expect(conteiner().dataset.peekedRoofsCount).toBe('0')
    const comMascara = camadasDeTelhado().filter((c) => c.mask !== null && c.mask !== undefined)
    expect(comMascara).toHaveLength(0)
  })
})
