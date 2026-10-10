import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Container } from 'pixi.js'
import { createEmptyMap, setTipoDeMapa } from '../lib/mapFactory'
import type { MapData, Region, RegionPoint } from '../types/map'
import type { EntradaDoRelevo, OpcoesDoRelevo } from '../pixi/drawRelevo'
import { DEFAULT_PLAYER_SETTINGS, type PlayerViewSettings } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * RELEVO na tela do jogador: a costura entre o PlayerView e o renderer.
 * - ligado: gera só das regiões do recorte que ESTA tela desenha (depois do
 *   filtro de camada), com o conhecido (visão e explorado) junto;
 * - "Efeitos do mapa" desmarcado, modo leve (o WebGL já caiu uma vez) e
 *   masmorra: nada — e o contêiner com a máscara do conhecido fica escondido,
 *   senão o stencil roda a cada quadro sem nada para mostrar.
 *
 * Sem navegador: o `Application` do Pixi (WebGL) e a geração da textura (tela
 * 2D) são as peças trocadas; o renderer do relevo é o de verdade, espionado.
 */

const registro = vi.hoisted(() => {
  const entradas: (EntradaDoRelevo | null)[] = []
  const apps: { stage: Container }[] = []
  return { entradas, apps }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = { add: () => undefined, remove: () => undefined }
    readonly canvas = document.createElement('canvas')
    constructor() {
      registro.apps.push(this)
    }
    async init(): Promise<void> {}
    resize(): void {}
    destroy(): void {
      this.canvas.remove()
    }
  }
  return { ...pixi, Application: ApplicationSemGpu }
})

vi.mock('../pixi/drawRelevo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../pixi/drawRelevo')>()
  const { Texture } = await import('pixi.js')
  return {
    ...real,
    createRelevoRenderer: (opcoes: OpcoesDoRelevo = {}) => {
      const relevo = real.createRelevoRenderer({ ...opcoes, gerarTextura: async () => new Texture() })
      return {
        camada: relevo.camada,
        destruir: relevo.destruir,
        atualizar: (entrada: EntradaDoRelevo | null) => {
          registro.entradas.push(entrada)
          relevo.atualizar(entrada)
        },
      }
    },
  }
})

const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 400 },
    { x: 0, y: 400 },
  ],
]
const TERRA: Region = {
  id: 'terra',
  points: [
    { x: 40, y: 40 },
    { x: 200, y: 40 },
    { x: 200, y: 200 },
    { x: 40, y: 200 },
  ],
  tag: 'region',
  fillColor: '#76c577',
  fillPattern: 'solid',
  data: {},
}
const CONTINENTE: MapData = { ...setTipoDeMapa(createEmptyMap('m-cont', '', 10, 10, 40), 'continente'), regions: [TERRA] }
const MASMORRA: MapData = { ...createEmptyMap('m-sala', '', 10, 10, 40), regions: [TERRA] }
const SEM_FICHAS: string[] = []

describe('PlayerView — relevo', () => {
  let raiz: HTMLDivElement
  let root: Root

  beforeEach(() => {
    registro.entradas.length = 0
    registro.apps.length = 0
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
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

  async function mostra(map: MapData, settings: PlayerViewSettings = DEFAULT_PLAYER_SETTINGS): Promise<void> {
    await act(async () => {
      root.render(<PlayerView map={map} vision={VISAO} ownTokens={SEM_FICHAS} settings={settings} focusTokenId={null} focusSeq={0} onMove={() => {}} />)
    })
  }

  /** Última entrada que o relevo recebeu, depois de a cena montar. */
  async function ultimaEntrada(): Promise<EntradaDoRelevo | null> {
    await vi.waitFor(() => expect(registro.entradas.length).toBeGreaterThan(0))
    const ultima = registro.entradas[registro.entradas.length - 1]
    return ultima === undefined ? null : ultima
  }

  /** O contêiner que leva a máscara do conhecido: o pai da camada do relevo no palco atual. */
  function conteinerDoRelevo(): { visible: boolean } {
    const app = registro.apps[registro.apps.length - 1]
    const camada = app.stage.getChildByLabel('relevo', true)
    if (camada === null || camada.parent === null) throw new Error('camada do relevo fora do palco')
    return camada.parent
  }

  it('ligado (Continente): só as regiões do recorte, com a visão como conhecido; o contêiner aparece com a textura', async () => {
    await mostra(CONTINENTE)
    const entrada = await ultimaEntrada()
    expect(entrada).not.toBeNull()
    expect(entrada?.regioes.map((r) => r.id)).toEqual(['terra'])
    expect(entrada?.conhecido?.visao).toBe(VISAO)
    await vi.waitFor(() => expect(conteinerDoRelevo().visible).toBe(true))
  })

  it('camada Salas escondida: as regiões filtradas, não as do mapa inteiro', async () => {
    await mostra({ ...CONTINENTE, hiddenLayers: ['salas'] })
    const entrada = await ultimaEntrada()
    expect(entrada?.regioes).toEqual([])
  })

  it('"Efeitos do mapa" desmarcado: sem relevo, e o contêiner com máscara fica escondido', async () => {
    await mostra(CONTINENTE, { ...DEFAULT_PLAYER_SETTINGS, mapEffects: false })
    expect(await ultimaEntrada()).toBeNull()
    expect(conteinerDoRelevo().visible).toBe(false)
  })

  it('masmorra (relevo desligado por padrão): sem relevo e sem máscara rodando', async () => {
    await mostra(MASMORRA)
    expect(await ultimaEntrada()).toBeNull()
    expect(conteinerDoRelevo().visible).toBe(false)
  })

  it('modo leve: depois de o WebGL cair uma vez, a tela remontada não gera relevo', async () => {
    await mostra(CONTINENTE)
    expect(await ultimaEntrada()).not.toBeNull()
    const canvas = raiz.querySelector('canvas')
    if (canvas === null) throw new Error('sem canvas')
    const appsAntes = registro.apps.length
    registro.entradas.length = 0
    await act(async () => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    await vi.waitFor(() => expect(registro.apps.length).toBeGreaterThan(appsAntes))
    expect(await ultimaEntrada()).toBeNull()
    // Nenhuma entrada ligada depois da queda.
    expect(registro.entradas.every((e) => e === null)).toBe(true)
    expect(conteinerDoRelevo().visible).toBe(false)
  })
})
