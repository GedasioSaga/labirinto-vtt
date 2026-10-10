import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Graphics, type Container } from 'pixi.js'
import { createEmptyMap, setTipoDeMapa } from '../lib/mapFactory'
import type { MapData, RegionPoint } from '../types/map'
import type { EntradaDasNuvens, MovimentoDasNuvens, OpcoesDasNuvens } from '../pixi/drawNuvens'
import { DEFAULT_PLAYER_SETTINGS, type PlayerViewSettings } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * NUVENS na tela do jogador: a costura entre o PlayerView e o renderer.
 * - ligadas (Continente): as nuvens do tamanho do mapa, SOB a névoa (o preto
 *   do nunca visto e a máscara do conhecido vêm depois delas no palco) e sob
 *   os nomes;
 * - "Efeitos do mapa" desmarcado, modo leve (o WebGL já caiu uma vez),
 *   masmorra e a chave desligada pelo mestre: nenhuma, e nada roda por quadro.
 *
 * Sem navegador: o `Application` do Pixi (WebGL) e as texturas (tela 2D) são
 * as peças trocadas; o renderer das nuvens é o de verdade, espionado.
 */

const registro = vi.hoisted(() => {
  const entradas: ({ cena: string; largura: number } | null)[] = []
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

vi.mock('../pixi/drawNuvens', async (importOriginal) => {
  const real = await importOriginal<typeof import('../pixi/drawNuvens')>()
  const { Texture } = await import('pixi.js')
  return {
    ...real,
    createNuvensRenderer: (movimento: MovimentoDasNuvens, opcoes: OpcoesDasNuvens = {}) => {
      const nuvens = real.createNuvensRenderer(movimento, { ...opcoes, texturaDa: () => new Texture() })
      return {
        camada: nuvens.camada,
        destruir: nuvens.destruir,
        setTela: nuvens.setTela,
        atualizar: (entrada: EntradaDasNuvens | null) => {
          registro.entradas.push(entrada === null ? null : { cena: entrada.cena, largura: entrada.mapa.width * entrada.mapa.grid })
          nuvens.atualizar(entrada)
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
const CONTINENTE: MapData = setTipoDeMapa(createEmptyMap('m-cont', '', 40, 30, 40), 'continente')
const MASMORRA: MapData = createEmptyMap('m-sala', '', 40, 30, 40)
const SEM_FICHAS: string[] = []

describe('PlayerView — nuvens', () => {
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

  async function ultimaEntrada(): Promise<{ cena: string; largura: number } | null> {
    await vi.waitFor(() => expect(registro.entradas.length).toBeGreaterThan(0))
    return registro.entradas.at(-1) ?? null
  }

  function camada(label: string): Container {
    const app = registro.apps.at(-1)
    const achada = app?.stage.getChildByLabel(label, true) ?? null
    if (achada === null) throw new Error(`camada ${label} fora do palco`)
    return achada
  }

  function estado(): string | undefined {
    return raiz.querySelector<HTMLElement>('[data-nuvens]')?.dataset.nuvens
  }

  it('ligadas (Continente): as nuvens do mapa inteiro, sob a névoa e sob os nomes', async () => {
    await mostra(CONTINENTE)
    expect(await ultimaEntrada()).toEqual({ cena: 'm-cont', largura: 40 * 40 })
    const nuvens = camada('nuvens')
    expect(nuvens.visible).toBe(true)
    await vi.waitFor(() => expect(estado()).toBe('3'))

    const mundo = nuvens.parent
    if (mundo === null) throw new Error('nuvens sem pai')
    const indice = mundo.getChildIndex(nuvens)
    // A máscara do conhecido divide o contexto com as do relevo, das texturas e
    // dos carimbos (que moram lá embaixo, junto das camadas delas); ela é a
    // ÚLTIMA com esse contexto, logo depois do preto do nunca visto. As nuvens
    // vêm antes das duas.
    const mascaraDoRelevo = camada('relevo').parent?.mask
    if (!(mascaraDoRelevo instanceof Graphics)) throw new Error('relevo sem a máscara do conhecido')
    const comOConhecido = mundo.children.flatMap((filho, i) => (filho instanceof Graphics && filho.context === mascaraDoRelevo.context ? [i] : []))
    const conhecido = Math.max(...comOConhecido)
    expect(conhecido).toBeGreaterThan(0)
    expect(indice).toBeLessThan(conhecido - 1)
    // E abaixo das pílulas dos nomes, que ficam legíveis por cima.
    expect(indice).toBeLessThan(mundo.getChildIndex(camada('nomesDosLugares')))
  })

  it('"Efeitos do mapa" desmarcado: nenhuma nuvem e nada por quadro', async () => {
    await mostra(CONTINENTE, { ...DEFAULT_PLAYER_SETTINGS, mapEffects: false })
    expect(await ultimaEntrada()).toBeNull()
    expect(camada('nuvens').visible).toBe(false)
  })

  it('masmorra (nuvens desligadas por padrão) e chave desligada pelo mestre: nenhuma nuvem', async () => {
    await mostra(MASMORRA)
    expect(await ultimaEntrada()).toBeNull()
    registro.entradas.length = 0
    await mostra({ ...CONTINENTE, nuvens: false })
    expect(await ultimaEntrada()).toBeNull()
    expect(camada('nuvens').visible).toBe(false)
  })

  it('modo leve: depois de o WebGL cair uma vez, a tela remontada não tem nuvem', async () => {
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
    expect(camada('nuvens').visible).toBe(false)
  })
})
