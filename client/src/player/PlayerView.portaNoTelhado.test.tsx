import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createExploration, markRings, type Exploration } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import { DOOR_COLOR } from '../pixi/drawDoors'
import { DURACAO_DO_TELHADO_MS } from '../pixi/telhadosRenderer'
import type { MapData, Region, RegionPoint, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * PORTA VISÍVEL POR CIMA DO TELHADO, na TELA (pedido de 20/10/2026).
 * `lib/telhado/portasDeFora.test.ts` prova a regra; aqui a prova é a COSTURA:
 * a camada `portasNoTelhado` fica acima da camada dos telhados, desenha a porta
 * de fora cujo lado de fora o jogador já viu, nenhuma quando esse lado está na
 * névoa, e nenhuma depois que o telhado termina de sumir (o jogador entrou).
 *
 * Sem navegador: só o `Application` do Pixi (que pede WebGL) é trocado. O
 * relógio guarda os quadros inscritos para o teste rodar o fade de 300 ms.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[], quadros: new Set<() => void>() }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = {
      add: (fn: () => void) => tela.quadros.add(fn),
      remove: (fn: () => void) => tela.quadros.delete(fn),
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
  return { ...pixi, Application: ApplicationSemGpu }
})

const GRADE = 40
const LADO = 25

function predio(teto: boolean): Region {
  return {
    id: 'casa',
    points: [
      { x: 200, y: 200 },
      { x: 600, y: 200 },
      { x: 600, y: 600 },
      { x: 200, y: 600 },
    ],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    // Como o recorte manda: com teto fechado, marcado e sem nome; aberto (a ficha entrou), sem o teto.
    room: { shape: 'rect', name: '', roof: teto },
  }
}

/** A porta da frente, fechada, no meio da parede de baixo; o lado de fora dela é (400, 620). */
const PORTA: Wall = { id: 'porta-da-frente', x1: 380, y1: 600, x2: 420, y2: 600, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }

function pacote(teto: boolean): MapData {
  return { ...createEmptyMap('m-casa', '', LADO, LADO, GRADE), regions: [predio(teto)], walls: [PORTA] }
}

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function exploradoEm(area: RegionPoint[]): Exploration {
  const explorado = createExploration({ width: LADO * GRADE, height: LADO * GRADE, grid: GRADE })
  markRings(explorado, [area])
  return explorado
}

/** O jogador andou pela frente da casa: o lado de fora da porta está no explorado. */
const FRENTE_EXPLORADA = exploradoEm(retangulo(300, 610, 500, 700))
/** Ele andou só mais à direita: o pedaço do mapa da porta é conhecido (a parede é desenhada), o lado de fora dela não. */
const SO_A_DIREITA = exploradoEm(retangulo(450, 640, 560, 700))
const SEM_FICHAS: string[] = []

function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

function camadaDasPortasNoTelhado(): Graphics {
  const camada = mundo().children.find((c) => c.label === 'portasNoTelhado')
  if (!(camada instanceof Graphics)) throw new Error('sem a camada portasNoTelhado no mundo')
  return camada
}

function indiceDaCamadaDosTelhados(): number {
  return mundo().children.findIndex((c) => c.children.some((t) => String(t.label).startsWith('telhado:')))
}

/** Portas fechadas pintadas: cada uma é um `fill` na cor da porta. */
function portasPintadas(g: Graphics): number {
  return g.context.instructions.filter((i) => i.action === 'fill' && i.data.style.color === DOOR_COLOR).length
}

describe('PlayerView — porta de fora visível por cima do telhado', () => {
  let raiz: HTMLDivElement
  let root: Root
  let adiantar = 0

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
    tela.quadros.clear()
    adiantar = 0
    const agoraDeVerdade = performance.now.bind(performance)
    vi.spyOn(performance, 'now').mockImplementation(() => agoraDeVerdade() + adiantar)
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

  async function mostra(map: MapData, vision: RegionPoint[][], explored: Exploration | undefined): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView
          map={map}
          vision={vision}
          explored={explored}
          ownTokens={SEM_FICHAS}
          settings={DEFAULT_PLAYER_SETTINGS}
          focusTokenId={null}
          focusSeq={0}
          onMove={() => {}}
        />,
      )
    })
    await vi.waitFor(() => expect(conteiner().dataset.portasNoTelhado).toBeDefined())
  }

  /** Anda o relógio `ms` e roda um quadro de tudo o que está inscrito nele. */
  function quadro(ms: number): void {
    adiantar += ms
    act(() => {
      for (const fn of [...tela.quadros]) fn()
    })
  }

  it('jogador de fora com o lado de fora da porta no explorado: 1 porta, numa camada acima dos telhados', async () => {
    await mostra(pacote(true), [], FRENTE_EXPLORADA)

    expect(conteiner().dataset.portasNoTelhado).toBe('1')
    const camada = camadaDasPortasNoTelhado()
    expect(portasPintadas(camada)).toBe(1)
    expect(camada.eventMode).toBe('none')
    const telhados = indiceDaCamadaDosTelhados()
    expect(telhados).toBeGreaterThanOrEqual(0)
    expect(mundo().children.indexOf(camada)).toBeGreaterThan(telhados)
  })

  it('lado de fora da porta ainda na névoa (a porta dos fundos): 0 portas, mesmo com a parede desenhada', async () => {
    await mostra(pacote(true), [], SO_A_DIREITA)

    // Controle: a porta chegou e foi desenhada na camada de sempre — quem a tira do telhado é a névoa.
    expect(conteiner().dataset.wallsDrawn).toBe('1')
    expect(conteiner().dataset.portasNoTelhado).toBe('0')
    expect(portasPintadas(camadaDasPortasNoTelhado())).toBe(0)
  })

  it('jogador entra: a porta segue por cima enquanto o telhado desbota e some com ele no fim do fade', async () => {
    await mostra(pacote(true), [], FRENTE_EXPLORADA)
    expect(conteiner().dataset.portasNoTelhado).toBe('1')

    // A ficha entrou: o pacote chega sem o teto e o telhado começa a sumir.
    await mostra(pacote(false), [retangulo(220, 220, 580, 580)], FRENTE_EXPLORADA)
    expect(conteiner().dataset.portasNoTelhado, 'a porta piscou debaixo do telhado que ainda está sumindo').toBe('1')

    quadro(DURACAO_DO_TELHADO_MS / 2)
    expect(conteiner().dataset.portasNoTelhado).toBe('1')
    quadro(DURACAO_DO_TELHADO_MS)
    quadro(16)
    expect(conteiner().dataset.portasNoTelhado).toBe('0')
    expect(portasPintadas(camadaDasPortasNoTelhado())).toBe(0)
  })
})
