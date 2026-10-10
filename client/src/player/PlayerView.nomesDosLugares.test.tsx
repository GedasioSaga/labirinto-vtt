import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Text, type Container } from 'pixi.js'
import { createEmptyMap, setTipoDeMapa } from '../lib/mapFactory'
import { filterMapForPlayer } from '../lib/fogFilter'
import { ficha, sala, torre } from '../lib/__fixtures__/hazardTower'
import type { MapData, Region, RegionPoint } from '../types/map'
import type { EntradaDosNomes, MovimentoDasPilulas } from '../pixi/drawNomesDosLugares'
import { DEFAULT_PLAYER_SETTINGS, type PlayerViewSettings } from './PlayerPanel'
import { LAST_SEEN_LAYER_LABEL } from './lastSeen'
import { PlayerView } from './PlayerView'

/**
 * NOMES DOS LUGARES na tela do jogador: a costura entre o PlayerView e o
 * renderer das pílulas.
 * - só região do recorte, com nome, e com o ponto da haste já conhecido;
 * - a pílula fica ACIMA da névoa (flutua sobre o preto) e abaixo das fichas;
 * - com a pílula, o mesmo nome não sai também na plaquinha;
 * - "Nomes" desmarcado esconde; "Efeitos do mapa" desmarcado e modo leve
 *   mostram os nomes sem a aparição; masmorra (chave desligada): nada.
 *
 * Sem navegador: o `Application` do Pixi (WebGL) é a peça trocada; o renderer
 * das pílulas é o de verdade, espionado.
 */

const registro = vi.hoisted(() => {
  const entradas: (EntradaDosNomes | null)[] = []
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

vi.mock('../pixi/drawNomesDosLugares', async (importOriginal) => {
  const real = await importOriginal<typeof import('../pixi/drawNomesDosLugares')>()
  return {
    ...real,
    createNomesDosLugaresRenderer: (movimento?: MovimentoDasPilulas) => {
      const nomes = real.createNomesDosLugaresRenderer(movimento)
      return {
        ...nomes,
        atualizar: (entrada: EntradaDosNomes | null) => {
          registro.entradas.push(entrada)
          nomes.atualizar(entrada)
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

function lugar(id: string, x0: number, y0: number, x1: number, y1: number, nome: string): Region {
  return {
    id,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    tag: 'region',
    fillColor: '#76c577',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'polygon', name: nome },
  }
}

// Vila: inteira na visão. Brejo: chegou no recorte (a ponta de cima está na
// visão), mas o centro dele (600, 300) ainda está na névoa.
const VILA = lugar('vila', 40, 40, 200, 200, 'Vila')
const BREJO = lugar('brejo', 300, 100, 900, 500, 'Brejo')
const CONTINENTE: MapData = { ...setTipoDeMapa(createEmptyMap('m-cont', '', 30, 30, 40), 'continente'), regions: [VILA, BREJO] }
const MASMORRA: MapData = { ...createEmptyMap('m-sala', '', 30, 30, 40), regions: [VILA, BREJO] }
const SEM_FICHAS: string[] = []

describe('PlayerView — nomes dos lugares', () => {
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

  async function ultimaEntrada(): Promise<EntradaDosNomes | null> {
    await vi.waitFor(() => expect(registro.entradas.length).toBeGreaterThan(0))
    const ultima = registro.entradas[registro.entradas.length - 1]
    return ultima === undefined ? null : ultima
  }

  function palco(): Container {
    const app = registro.apps[registro.apps.length - 1]
    return app.stage
  }

  function camadaDosNomes(): Container {
    const camada = palco().getChildByLabel('nomesDosLugares', true)
    if (camada === null) throw new Error('camada dos nomes fora do palco')
    return camada
  }

  /** Todo texto do palco com este conteúdo (a plaquinha escreve "Vila"; a pílula, "VILA"). */
  function textos(conteudo: string): Text[] {
    const achados: Text[] = []
    const visitar = (no: Container) => {
      for (const filho of no.children) {
        if (filho instanceof Text && filho.text === conteudo) achados.push(filho)
        visitar(filho)
      }
    }
    visitar(palco())
    return achados
  }

  it('Continente: só o lugar com o ponto da haste já visto ganha pílula, com a aparição ligada', async () => {
    await mostra(CONTINENTE)
    const entrada = await ultimaEntrada()
    expect(entrada?.cena).toBe('m-cont')
    expect(entrada?.lugares.map((l) => l.id)).toEqual(['vila'])
    expect(entrada?.animar).toBe(true)
    expect(textos('VILA')).toHaveLength(1)
    expect(textos('BREJO')).toHaveLength(0)
  })

  it('a pílula substitui a plaquinha: o nome "Vila" não sai duas vezes; o Brejo, sem pílula, também não ganha plaquinha', async () => {
    await mostra(CONTINENTE)
    await ultimaEntrada()
    expect(textos('Vila')).toHaveLength(0)
    expect(textos('Brejo')).toHaveLength(0)
  })

  it('camada acima da névoa e abaixo das fichas', async () => {
    await mostra(CONTINENTE)
    await ultimaEntrada()
    const camada = camadaDosNomes()
    const mundo = camada.parent
    if (mundo === null) throw new Error('sem mundo')
    const indice = mundo.getChildIndex(camada)
    // A névoa (nunca vista e lembrada) são os Graphics com a máscara invertida do
    // conhecido e da visão (`redrawFog`): toda camada mascarada fica abaixo das pílulas.
    const nevoa = mundo.children.reduce((ultimo, c, i) => (c.mask !== null && c.mask !== undefined ? i : ultimo), -1)
    // A lembrança da ficha mora logo abaixo das fichas, que são a última camada do mundo.
    const lembranca = mundo.children.findIndex((c) => c.label === LAST_SEEN_LAYER_LABEL)
    expect(nevoa).toBeGreaterThanOrEqual(0)
    expect(indice).toBeGreaterThan(nevoa)
    expect(indice).toBeLessThan(lembranca)
    expect(lembranca).toBeLessThan(mundo.children.length - 1)
  })

  it('"Nomes" desmarcado: a camada das pílulas some junto com os nomes', async () => {
    await mostra(CONTINENTE, { ...DEFAULT_PLAYER_SETTINGS, showNames: false })
    await ultimaEntrada()
    expect(camadaDosNomes().visible).toBe(false)
  })

  it('"Efeitos do mapa" desmarcado: o nome aparece, sem a aparição', async () => {
    await mostra(CONTINENTE, { ...DEFAULT_PLAYER_SETTINGS, mapEffects: false })
    const entrada = await ultimaEntrada()
    expect(entrada?.lugares.map((l) => l.id)).toEqual(['vila'])
    expect(entrada?.animar).toBe(false)
  })

  it('masmorra (chave desligada por padrão): sem pílula, e o nome volta para a plaquinha', async () => {
    await mostra(MASMORRA)
    expect(await ultimaEntrada()).toBeNull()
    expect(textos('Vila')).toHaveLength(1)
  })

  it('zona oculta ativa sobre o ponto da haste (fogFilter real): a pílula não sai por cima do preto da zona', async () => {
    // A sala chega inteira no recorte, com o nome: a zona cobre só o centro dela,
    // não a maior parte. A visão atravessa a zona (o preto é pintado por cima), e
    // a camada das pílulas fica ACIMA de 'concealed': o ponto da haste dentro da
    // zona vazaria nome, haste e ponto por cima do preto.
    const comZona = (revealed: boolean) => {
      const base = torre({ tokens: [ficha('ana', 100, 200)], regions: [sala('sala-a', 0, 500, { room: { shape: 'rect', name: 'Praça Escondida' } })] })
      const mapa: MapData = {
        ...setTipoDeMapa(base, 'continente'),
        walls: [],
        concealZones: [{ id: 'z', name: 'Cripta', revealed, points: [{ x: 200, y: 140 }, { x: 320, y: 140 }, { x: 320, y: 260 }, { x: 200, y: 260 }] }],
      }
      return filterMapForPlayer(mapa, 'p1', { p1: ['ana'] }, 700)
    }
    const desenhar = async (view: ReturnType<typeof comZona>) => {
      registro.entradas.length = 0
      // A ficha só serve para o fogFilter calcular a visão. O rótulo dela e o
      // título da moldura medem texto num canvas 2D que o jsdom não tem, e
      // derrubariam o palco (os outros casos daqui também não têm nenhum dos dois).
      const semFichas: MapData = { ...view.map, name: '', tokens: [] }
      await act(async () => {
        root.render(
          <PlayerView map={semFichas} vision={view.vision} concealed={view.concealed} ownTokens={['ana']} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
        )
      })
      return ultimaEntrada()
    }

    const ativa = comZona(false)
    expect(ativa.map.regions.map((r) => r.room?.name)).toContain('Praça Escondida')
    expect(ativa.concealed.length).toBeGreaterThan(0)
    expect((await desenhar(ativa))?.lugares.map((l) => l.id)).toEqual([])
    expect(textos('PRAÇA ESCONDIDA')).toHaveLength(0)

    // Zona revelada: o mesmo lugar ganha a pílula (o teste não passa por vazio).
    // Palco novo, como nos outros casos: a pílula nasce no primeiro desenho.
    act(() => root.unmount())
    root = createRoot(raiz)
    expect((await desenhar(comZona(true)))?.lugares.map((l) => l.id)).toEqual(['sala-a'])
  })

  it('modo leve: depois de o WebGL cair uma vez, os nomes voltam sem a aparição', async () => {
    await mostra(CONTINENTE)
    expect((await ultimaEntrada())?.animar).toBe(true)
    const canvas = raiz.querySelector('canvas')
    if (canvas === null) throw new Error('sem canvas')
    const appsAntes = registro.apps.length
    registro.entradas.length = 0
    await act(async () => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    await vi.waitFor(() => expect(registro.apps.length).toBeGreaterThan(appsAntes))
    const depois = await ultimaEntrada()
    expect(depois?.lugares.map((l) => l.id)).toEqual(['vila'])
    expect(registro.entradas.every((e) => e === null || e.animar === false)).toBe(true)
  })
})
