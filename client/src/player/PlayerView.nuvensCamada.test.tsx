import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Container, Ticker } from 'pixi.js'
import { CAMADAS_PADRAO } from '../lib/camadas/padrao'
import { createEmptyMap, setTipoDeMapa } from '../lib/mapFactory'
import { APARICAO_DAS_NUVENS_MS } from '../lib/nuvens'
import type { MapData, RegionPoint, Wall } from '../types/map'
import type { MovimentoDasNuvens, OpcoesDasNuvens } from '../pixi/drawNuvens'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * NUVENS E A OPACIDADE DA CAMADA TERRENO (revisão da fatia 4): a pilha de
 * camadas do jogador dá a opacidade da camada às nuvens, e o renderer anima a
 * aparição POR CIMA dela. Antes os dois escreviam o mesmo `alpha`: com
 * Terreno a 40% a nuvem voltava a 100% no fim da aparição, e no mapa antigo a
 * pilha que replanejava no meio da aparição cravava 1 (a nuvem saltava).
 *
 * Sem navegador, como em `PlayerView.nuvens.test.tsx`; o relógio e o ticker
 * do renderer das nuvens são os deste teste, para andar a aparição à mão.
 */

const registro = vi.hoisted(() => {
  const tickers: Ticker[] = []
  const relogio = { t: 1000 }
  const camadas: Container[] = []
  return { tickers, relogio, camadas }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = { add: () => undefined, remove: () => undefined }
    readonly canvas = document.createElement('canvas')
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
  const { Texture, Ticker } = await import('pixi.js')
  return {
    ...real,
    createNuvensRenderer: (movimento: MovimentoDasNuvens, opcoes: OpcoesDasNuvens = {}) => {
      // Relógio de quadros parado: só anda quando o teste chama `update`.
      const ticker = new Ticker()
      registro.tickers.push(ticker)
      const nuvens = real.createNuvensRenderer(
        { ticker, reducedMotion: movimento.reducedMotion, agora: () => registro.relogio.t },
        { ...opcoes, texturaDa: () => new Texture() },
      )
      registro.camadas.push(nuvens.camada)
      return nuvens
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
const TERRENO_A_40: MapData = { ...CONTINENTE, camadasDoJogador: CAMADAS_PADRAO.map((id) => (id === 'terreno' ? { id, alfa: 0.4 } : { id })) }
const PORTA: Wall = { id: 'porta-1', x1: 200, y1: 200, x2: 240, y2: 200, blocksLight: true, blocksMove: true, door: { kind: 'normal', open: false, locked: false } }
const SEM_FICHAS: string[] = []

describe('PlayerView — nuvens com a opacidade da camada Terreno', () => {
  let raiz: HTMLDivElement
  let root: Root

  beforeEach(() => {
    registro.tickers.length = 0
    registro.camadas.length = 0
    registro.relogio.t = 1000
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

  async function mostra(map: MapData): Promise<void> {
    await act(async () => {
      root.render(<PlayerView map={map} vision={VISAO} ownTokens={SEM_FICHAS} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />)
    })
  }

  /** A camada das nuvens já ligada (visível) na cena. */
  async function nuvensLigadas(): Promise<Container> {
    await vi.waitFor(() => expect(registro.camadas.at(-1)?.visible).toBe(true))
    const camada = registro.camadas.at(-1)
    if (camada === undefined) throw new Error('nuvens não criadas')
    return camada
  }

  function andarAte(ms: number): void {
    registro.relogio.t = ms
    for (const ticker of registro.tickers) ticker.update(ms)
  }

  it('Terreno a 40%: terminada a aparição, a nuvem fica a 40%, não a 100%', async () => {
    await mostra(TERRENO_A_40)
    const camada = await nuvensLigadas()
    expect(camada.alpha).toBe(0)
    andarAte(1000 + APARICAO_DAS_NUVENS_MS / 2)
    expect(camada.alpha).toBeGreaterThan(0)
    expect(camada.alpha).toBeLessThan(0.4)
    andarAte(1000 + APARICAO_DAS_NUVENS_MS * 2)
    expect(camada.alpha).toBeCloseTo(0.4, 10)
  })

  it('mapa antigo: a pilha que replaneja no meio da aparição não faz a nuvem saltar', async () => {
    await mostra(CONTINENTE)
    const camada = await nuvensLigadas()
    andarAte(1000 + APARICAO_DAS_NUVENS_MS * 0.3)
    const noMeio = camada.alpha
    expect(noMeio).toBeGreaterThan(0)
    expect(noMeio).toBeLessThan(1)
    // A primeira porta entra no pacote: a chave dos pares muda e a pilha replaneja.
    await mostra({ ...CONTINENTE, walls: [PORTA] })
    expect(raiz.querySelector<HTMLElement>('[data-nos-da-pilha]')).not.toBeNull()
    expect(camada.alpha).toBeCloseTo(noMeio, 10)
    andarAte(1000 + APARICAO_DAS_NUVENS_MS * 2)
    expect(camada.alpha).toBe(1)
  })
})
