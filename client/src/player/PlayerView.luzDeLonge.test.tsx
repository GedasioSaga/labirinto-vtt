import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { FAR_LIGHT_CORE_SCREEN_RADIUS } from '../pixi/drawFarLights'
import type { Light, MapData, RegionPoint } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * LUZ VISTA DE LONGE, na TELA do jogador. `lib/fogFilter.luzDeLonge.test.ts`
 * prova o recorte (a luz fora da visão chega como ponto: raio 0) e
 * `pixi/drawFarLights.test.ts` o desenho isolado; aqui a prova é a COSTURA: o
 * ponto que chega no pacote vira um ponto aceso no `world` da PlayerView de
 * verdade, ACIMA da névoa (senão o escuro o apaga), repintado quando o mapa
 * muda e quando o zoom muda.
 *
 * Sem navegador: só o `Application` do Pixi é trocado (o jsdom não tem WebGL);
 * `Container` e `Graphics` são os de verdade, então o que se lê aqui são as
 * instruções de desenho que o Pixi mandaria para a GPU.
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

/** Cor do lampião do outro lado do vale; nenhuma outra camada pinta com ela. */
const COR_DO_LAMPIAO = 0xffcc66
/** Como o recorte manda a luz marcada que está FORA da visão: raio 0. */
const PONTO: Light = { id: 'lampiao', x: 800, y: 700, radius: 0, color: '#ffcc66', intensity: 0.8, vistaDeLonge: true }
/** O canto do jogador: a luz está fora dele. */
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 300 },
    { x: 0, y: 300 },
  ],
]
const SEM_FICHAS: string[] = []

/** O mapa como o jogador o recebe: mesmo id em todo snapshot, então a câmera não reenquadra. */
function pacote(lights: Light[]): MapData {
  return { ...createEmptyMap('m-vale', '', 25, 25, 40), lights }
}

type Instrucao = Graphics['context']['instructions'][number]

function ehPontoDoLampiao(i: Instrucao): boolean {
  return i.action === 'fill' && i.data.style.color === COR_DO_LAMPIAO
}

/** O escuro chapado da névoa (`fogUnknown`/`fogDim` pintam preto sobre o mapa todo). */
function ehNevoa(i: Instrucao): boolean {
  return i.action === 'fill' && i.data.style.color === 0x000000
}

function camadasCom(world: Container, teste: (i: Instrucao) => boolean): Graphics[] {
  return world.children.filter((c): c is Graphics => c instanceof Graphics && c.context.instructions.some(teste))
}

/** Raio de cada círculo pintado com a cor do lampião, em px de mundo. */
function raios(camada: Graphics): number[] {
  return camada.context.instructions.filter(ehPontoDoLampiao).map((i) => {
    if (i.action !== 'fill') throw new Error('esperava fill')
    const circulo = i.data.path.instructions.find((p) => p.action === 'circle')
    const r = circulo?.data[2]
    if (typeof r !== 'number') throw new Error('o ponto aceso não é um círculo')
    return r
  })
}

function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

describe('PlayerView — a luz vista de longe aparece como ponto aceso acima da névoa', () => {
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

  async function mostra(map: MapData): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView map={map} vision={VISAO} ownTokens={SEM_FICHAS} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
      )
    })
  }

  async function monta(map: MapData): Promise<void> {
    await mostra(map)
    await vi.waitFor(() => expect(conteiner().dataset.propsCount).toBeDefined())
  }

  function unicaCamadaDoPonto(): Graphics {
    const camadas = camadasCom(mundo(), ehPontoDoLampiao)
    expect(camadas).toHaveLength(1)
    return camadas[0]
  }

  it('o ponto do pacote vira brilho e miolo no mundo, numa camada ACIMA de toda a névoa', async () => {
    await monta(pacote([PONTO]))

    const world = mundo()
    const camada = unicaCamadaDoPonto()
    expect(raios(camada)).toHaveLength(2)

    const nevoas = camadasCom(world, ehNevoa)
    expect(nevoas.length).toBeGreaterThan(0)
    for (const nevoa of nevoas) expect(world.getChildIndex(camada)).toBeGreaterThan(world.getChildIndex(nevoa))
  })

  it('snapshot novo repinta: sem o ponto no pacote, a camada fica vazia; com ele de volta, o ponto reaparece', async () => {
    await monta(pacote([PONTO]))
    const camada = unicaCamadaDoPonto()

    await mostra(pacote([]))
    expect(raios(camada)).toHaveLength(0)
    expect(mundo().children).toContain(camada)

    // E volta quando o ponto chega de novo (a janela que tornou a aparecer na linha de visão).
    // Luz marcada com halo (raio > 0) não vira ponto: `pixi/drawFarLights.test.ts`; aqui o
    // halo pediria gradiente de canvas, que o jsdom não tem.
    await mostra(pacote([PONTO]))
    expect(raios(camada)).toHaveLength(2)
  })

  it('o zoom repinta: o miolo continua com o mesmo tamanho em px de TELA', async () => {
    await monta(pacote([PONTO]))
    const world = mundo()
    const camada = unicaCamadaDoPonto()
    const antes = world.scale.x
    expect(Math.min(...raios(camada))).toBeCloseTo(FAR_LIGHT_CORE_SCREEN_RADIUS / antes, 6)

    const canvas = conteiner().querySelector('canvas')
    if (canvas === null) throw new Error('a PlayerView não pôs o canvas no contêiner')
    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, clientX: 400, clientY: 300, cancelable: true }))
    })

    const depois = world.scale.x
    expect(depois).toBeGreaterThan(antes)
    expect(Math.min(...raios(camada))).toBeCloseTo(FAR_LIGHT_CORE_SCREEN_RADIUS / depois, 6)
  })
})
