import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Prop, RegionPoint } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import { REVISIT_NOTE } from './revisitPulse'

/**
 * MAPA LEMBRADO na TELA: `revisitChanges.test.ts` prova a conta; aqui a prova
 * é a costura — a PlayerView de verdade, recebendo os snapshots de quem vai e
 * volta, acende o aviso "Mudou desde a sua última visita" na volta ao trecho
 * com entulho novo, e só nela.
 *
 * Sem navegador: o `Application` do Pixi pede WebGL, que o jsdom não tem, e é
 * a única peça trocada. O ticker não anda aqui; o piscar em si é do ticker e o
 * desenho quadro a quadro é de `revisitPulse.test.ts`.
 */

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

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

const NO_CORREDOR = [retangulo(0, 0, 400, 400)]
const NO_SALAO = [retangulo(600, 600, 1000, 1000)]
const ENTULHO: Prop = { id: 'entulho', x: 200, y: 200, width: 60, height: 40, src: '', linkedMapPath: null }
const SEM_FICHAS: string[] = []

/** Mesmo id em todo snapshot: é a mesma cena, a câmera não reenquadra. */
function pacote(props: Prop[]): MapData {
  return { ...createEmptyMap('m-cripta', '', 25, 25, 40), props }
}

describe('PlayerView — o trecho que mudou pisca com "Mudou desde a sua última visita"', () => {
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

  /** O aviso no DOM: é texto de verdade, que o leitor de tela anuncia. */
  function aviso(): HTMLElement | null {
    return raiz.querySelector<HTMLElement>('[data-testid="revisit-note"]')
  }

  async function mostra(map: MapData, vision: RegionPoint[][]): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView map={map} vision={vision} ownTokens={SEM_FICHAS} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
      )
    })
  }

  it('volta ao corredor com entulho novo: o aviso aparece, anunciado, e conta UMA área piscando', async () => {
    await mostra(pacote([]), NO_CORREDOR)
    await vi.waitFor(() => expect(conteiner().dataset.propsCount).toBeDefined())
    expect(conteiner().dataset.revisitPulses).toBe('0')
    expect(aviso()?.hidden).toBe(true)

    await mostra(pacote([]), NO_SALAO)
    expect(conteiner().dataset.revisitPulses).toBe('0')
    expect(aviso()?.hidden).toBe(true)

    await mostra(pacote([ENTULHO]), NO_CORREDOR)
    expect(conteiner().dataset.revisitPulses).toBe('1')
    const texto = aviso()
    expect(texto?.hidden).toBe(false)
    expect(texto?.textContent).toBe(REVISIT_NOTE)
    expect(texto?.textContent).toBe('Mudou desde a sua última visita')
    expect(texto?.getAttribute('aria-live')).toBe('polite')
  })

  it('primeira vez no corredor, com o entulho já lá: nada pisca', async () => {
    await mostra(pacote([]), NO_SALAO)
    await vi.waitFor(() => expect(conteiner().dataset.propsCount).toBeDefined())
    await mostra(pacote([ENTULHO]), NO_CORREDOR)
    expect(conteiner().dataset.revisitPulses).toBe('0')
    expect(aviso()?.hidden).toBe(true)
  })
})
