import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Graphics, type Container } from 'pixi.js'
import { createEmptyMap, setTipoDeMapa } from '../lib/mapFactory'
import type { MapData, PinceladaDeTextura, Region, RegionPoint } from '../types/map'
import type { EntradaDasTexturas, OpcoesDasTexturas } from '../pixi/drawTexturas'
import { DEFAULT_PLAYER_SETTINGS, type PlayerViewSettings } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * TEXTURAS na tela do jogador: a costura entre o PlayerView e o renderer.
 * - ligado: pinta os passos do recorte, com as formas que ESTA tela desenha,
 *   num contêiner com a máscara do conhecido (a mesma geometria do relevo),
 *   abaixo do relevo (a luz cai por cima da textura);
 * - "Efeitos do mapa" desmarcado e modo leve (o WebGL já caiu uma vez): nada —
 *   e o contêiner com a máscara fica escondido (o stencil não roda à toa).
 *
 * Sem navegador: o `Application` do Pixi (WebGL), a pintura das máscaras e o
 * ladrilho (tela 2D) são as peças trocadas; o renderer é o de verdade, espionado.
 */

const registro = vi.hoisted(() => {
  const entradas: (EntradaDasTexturas | null)[] = []
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

vi.mock('../pixi/drawTexturas', async (importOriginal) => {
  const real = await importOriginal<typeof import('../pixi/drawTexturas')>()
  const { Texture } = await import('pixi.js')
  return {
    ...real,
    createTexturasRenderer: (opcoes: OpcoesDasTexturas = {}) => {
      const texturas = real.createTexturasRenderer({
        ...opcoes,
        rasterizar: async (plano) => plano.camadas.map(() => document.createElement('canvas')),
        ladrilho: async () => new Texture(),
        mascara: () => new Texture(),
      })
      return {
        ...texturas,
        atualizar: (entrada: EntradaDasTexturas | null) => {
          registro.entradas.push(entrada)
          texturas.atualizar(entrada)
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
const PASSOS: PinceladaDeTextura[] = [
  { id: 'b1', tipo: 'balde', textura: 'floresta', forca: 0.8, alvo: { tipo: 'regiao', id: 'terra' } },
  { id: 'p1', tipo: 'pincel', textura: 'areia', forca: 0.8, raio: 30, pontos: [{ x: 100, y: 100 }] },
]
const CONTINENTE: MapData = { ...setTipoDeMapa(createEmptyMap('m-tex', '', 10, 10, 40), 'continente'), regions: [TERRA], texturas: PASSOS }
const SEM_FICHAS: string[] = []

describe('PlayerView — texturas', () => {
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

  async function ultimaEntrada(): Promise<EntradaDasTexturas | null> {
    await vi.waitFor(() => expect(registro.entradas.length).toBeGreaterThan(0))
    const ultima = registro.entradas[registro.entradas.length - 1]
    return ultima === undefined ? null : ultima
  }

  /** A camada de uma label no palco atual e o contêiner que leva a máscara dela. */
  function camadaEConteiner(label: string): { camada: Container; conteiner: Container } {
    const app = registro.apps[registro.apps.length - 1]
    const camada = app.stage.getChildByLabel(label, true)
    if (camada === null || camada.parent === null) throw new Error(`camada ${label} fora do palco`)
    return { camada, conteiner: camada.parent }
  }

  it('ligado: os passos do recorte, com as regiões desta tela; aparece sob a máscara do conhecido, abaixo do relevo', async () => {
    await mostra(CONTINENTE)
    const entrada = await ultimaEntrada()
    expect(entrada?.passos).toBe(PASSOS)
    expect(entrada?.regioes.map((r) => r.id)).toEqual(['terra'])
    const { camada, conteiner } = camadaEConteiner('texturas')
    await vi.waitFor(() => expect(conteiner.visible).toBe(true))
    expect(camada.children.length).toBeGreaterThan(0)
    // A máscara do conhecido: a mesma geometria (contexto) da do relevo, e não o contêiner sem máscara.
    const relevo = camadaEConteiner('relevo').conteiner
    const mascara = conteiner.mask
    const mascaraDoRelevo = relevo.mask
    expect(mascara).toBeInstanceOf(Graphics)
    expect(mascaraDoRelevo).toBeInstanceOf(Graphics)
    if (!(mascara instanceof Graphics) || !(mascaraDoRelevo instanceof Graphics)) return
    expect(mascara.context).toBe(mascaraDoRelevo.context)
    // Na ordem: a textura por baixo do relevo, no mesmo pai.
    const pai = conteiner.parent
    expect(pai).toBe(relevo.parent)
    expect(pai?.getChildIndex(conteiner)).toBeLessThan(pai?.getChildIndex(relevo) ?? -1)
  })

  it('"Efeitos do mapa" desmarcado: sem textura, e o contêiner com a máscara fica escondido', async () => {
    await mostra(CONTINENTE, { ...DEFAULT_PLAYER_SETTINGS, mapEffects: false })
    expect(await ultimaEntrada()).toBeNull()
    const { camada, conteiner } = camadaEConteiner('texturas')
    expect(camada.children).toHaveLength(0)
    expect(conteiner.visible).toBe(false)
  })

  it('modo leve: depois de o WebGL cair uma vez, a tela remontada não pinta textura', async () => {
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
    expect(registro.entradas.every((e) => e === null)).toBe(true)
    const { camada, conteiner } = camadaEConteiner('texturas')
    expect(camada.children).toHaveLength(0)
    expect(conteiner.visible).toBe(false)
  })
})
