import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Graphics, Texture, type Container } from 'pixi.js'
import { createEmptyMap, setTipoDeMapa } from '../lib/mapFactory'
import type { Carimbo, MapData, RegionPoint } from '../types/map'
import type { EntradaDosCarimbos, OpcoesDosCarimbos } from '../pixi/drawCarimbos'
import { QUADRO_DA_BIBLIOTECA } from '../carimbos/arte'
import { DEFAULT_PLAYER_SETTINGS, type PlayerViewSettings } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * CARIMBOS na tela do jogador: a costura entre o PlayerView e o renderer.
 * - os objetos do recorte, num contêiner com a máscara do conhecido (a mesma
 *   geometria do relevo), acima do relevo e da borda das regiões;
 * - "Efeitos do mapa" desmarcado: os objetos FICAM (são o que o mestre pôs no
 *   mapa), só a camada de sombras sai;
 * - modo leve (o WebGL já caiu uma vez): idem, e o desenho em meia resolução;
 * - tela de toque: só o pedaço de sombra encolhe (o desenho fica inteiro).
 *
 * Sem navegador: o `Application` do Pixi (WebGL) e a arte (tela 2D) são as
 * peças trocadas; o renderer é o de verdade, espionado.
 */

const registro = vi.hoisted(() => {
  const entradas: (EntradaDosCarimbos | null)[] = []
  const opcoes: OpcoesDosCarimbos[] = []
  const apps: { stage: Container }[] = []
  return { entradas, opcoes, apps }
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

vi.mock('../pixi/drawCarimbos', async (importOriginal) => {
  const real = await importOriginal<typeof import('../pixi/drawCarimbos')>()
  return {
    ...real,
    createCarimbosRenderer: (opcoes: OpcoesDosCarimbos = {}) => {
      registro.opcoes.push(opcoes)
      const carimbos = real.createCarimbosRenderer({
        ...opcoes,
        assar: () => ({ corpo: new Texture(), quadro: QUADRO_DA_BIBLIOTECA, sombra: {} as CanvasImageSource, chao: false }),
        pintarPedaco: () => new Texture(),
      })
      return {
        ...carimbos,
        atualizar: (entrada: EntradaDosCarimbos | null) => {
          registro.entradas.push(entrada)
          carimbos.atualizar(entrada)
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
const OBJETOS: Carimbo[] = [
  { id: 'a', tipo: 'pinheiro', x: 100, y: 100, tamanho: 40, giro: 0 },
  { id: 'b', tipo: 'arvore', x: 200, y: 150, tamanho: 40, giro: 90 },
]
const CONTINENTE: MapData = { ...setTipoDeMapa(createEmptyMap('m-carimbo', '', 10, 10, 40), 'continente'), carimbos: OBJETOS }
const SEM_FICHAS: string[] = []

describe('PlayerView — carimbos', () => {
  let raiz: HTMLDivElement
  let root: Root

  beforeEach(() => {
    registro.entradas.length = 0
    registro.opcoes.length = 0
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

  async function ultimaEntrada(): Promise<EntradaDosCarimbos | null> {
    await vi.waitFor(() => expect(registro.entradas.length).toBeGreaterThan(0))
    return registro.entradas[registro.entradas.length - 1] ?? null
  }

  function camadaEConteiner(label: string): { camada: Container; conteiner: Container } {
    const app = registro.apps[registro.apps.length - 1]
    const camada = app.stage.getChildByLabel(label, true)
    if (camada === null || camada.parent === null) throw new Error(`camada ${label} fora do palco`)
    return { camada, conteiner: camada.parent }
  }

  it('os objetos do recorte, sob a máscara do conhecido, acima do relevo; com sombra', async () => {
    await mostra(CONTINENTE)
    const entrada = await ultimaEntrada()
    expect(entrada?.carimbos).toBe(OBJETOS)
    expect(entrada?.sombras).toBe(true)
    const { camada, conteiner } = camadaEConteiner('carimbos')
    await vi.waitFor(() => expect(conteiner.visible).toBe(true))
    expect(camada.getChildByLabel('carimbos-corpos')?.children).toHaveLength(2)
    const relevo = camadaEConteiner('relevo').conteiner
    const mascara = conteiner.mask
    expect(mascara).toBeInstanceOf(Graphics)
    if (!(mascara instanceof Graphics) || !(relevo.mask instanceof Graphics)) return
    expect(mascara.context).toBe(relevo.mask.context)
    const pai = conteiner.parent
    expect(pai).toBe(relevo.parent)
    expect(pai?.getChildIndex(conteiner)).toBeGreaterThan(pai?.getChildIndex(relevo) ?? Infinity)
    // Desenho na resolução cheia também no jogador (o zoom de partida é perto).
    expect(registro.opcoes.at(-1)?.ladoDaArte).toBe(256)
  })

  it('"Efeitos do mapa" desmarcado: os objetos ficam, sem a camada de sombras', async () => {
    await mostra(CONTINENTE, { ...DEFAULT_PLAYER_SETTINGS, mapEffects: false })
    const entrada = await ultimaEntrada()
    expect(entrada?.carimbos).toBe(OBJETOS)
    expect(entrada?.sombras).toBe(false)
    const { camada, conteiner } = camadaEConteiner('carimbos')
    await vi.waitFor(() => expect(conteiner.visible).toBe(true))
    expect(camada.getChildByLabel('carimbos-corpos')?.children).toHaveLength(2)
    expect(camada.getChildByLabel('carimbos-sombras')?.children).toHaveLength(0)
  })

  it('modo leve: depois de o WebGL cair, os objetos ficam, sem sombras, desenho e pedaço pela metade', async () => {
    await mostra(CONTINENTE)
    expect(await ultimaEntrada()).not.toBeNull()
    expect(registro.opcoes.at(-1)?.texelsDoPedaco).toBe(512)
    const canvas = raiz.querySelector('canvas')
    if (canvas === null) throw new Error('sem canvas')
    const appsAntes = registro.apps.length
    const opcoesAntes = registro.opcoes.length
    registro.entradas.length = 0
    await act(async () => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    await vi.waitFor(() => expect(registro.apps.length).toBeGreaterThan(appsAntes))
    await vi.waitFor(() => expect(registro.opcoes.length).toBeGreaterThan(opcoesAntes))
    const leve = registro.opcoes.at(-1)
    expect(leve?.ladoDaArte).toBe(128)
    expect(leve?.texelsDoPedaco).toBe(256)
    const entrada = await ultimaEntrada()
    expect(entrada?.carimbos).toBe(OBJETOS)
    expect(entrada?.sombras).toBe(false)
  })

  it('tela de toque: o pedaço de sombra encolhe pela metade, o desenho fica inteiro', async () => {
    // O celular de verdade responde `(pointer: coarse)`; o resto das consultas, não.
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: consulta === '(pointer: coarse)',
      media: consulta,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }))
    await mostra(CONTINENTE)
    const entrada = await ultimaEntrada()
    expect(entrada?.sombras).toBe(true)
    const opcoes = registro.opcoes.at(-1)
    expect(opcoes?.texelsDoPedaco).toBe(256)
    expect(opcoes?.ladoDaArte).toBe(256)
  })

  it('mapa sem objeto: nada, e o contêiner com a máscara fica escondido', async () => {
    const { carimbos: _c, ...sem } = CONTINENTE
    await mostra(sem)
    expect(await ultimaEntrada()).toBeNull()
    expect(camadaEConteiner('carimbos').conteiner.visible).toBe(false)
  })
})
