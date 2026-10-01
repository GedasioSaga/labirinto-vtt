import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics, type StrokeInstruction, type Ticker } from 'pixi.js'
import { buildLineDrawing } from '../lib/drawingFactory'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapImageExporter } from '../lib/mapImageExport'
import { useMapStore } from '../stores/mapStore'
import type { MapData } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { PixiCanvas } from './PixiCanvas'
import { ENDIREITAR_FANTASMA_ALPHA, ENDIREITAR_FANTASMA_LABEL, ENDIREITAR_FANTASMA_MS } from './straightenGhost'

/**
 * Pedido 5, fatia 4, com o PixiCanvas montado pelo caminho de verdade (mesmo
 * arranjo sem GPU de `PixiCanvas.movimento.test.tsx`: Ticker de verdade,
 * parado, e cada quadro emitido pelo teste com o tempo que ele escolhe).
 *
 * O endireitar é o da store (`endireitarSelecionados`), que é o que o Alt e o
 * botão do painel chamam: o canvas só olha a store e põe o fantasma na tela.
 */

const tela = vi.hoisted(() => {
  const apps: { stage: Container; ticker: Ticker }[] = []
  /** Chamado quando a exportação de imagem tira a foto da cena. */
  const fotos: (() => void)[] = []
  return { apps, fotos, largura: 1200, altura: 800 }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    readonly renderer = Object.assign(new pixi.EventEmitter(), {
      resolution: 1,
      // A foto da exportação: quem quiser saber o que estava visível nela olha aqui.
      extract: {
        base64: async () => {
          for (const foto of tela.fotos) foto()
          return 'data:image/png;base64,AAAA'
        },
      },
    })
    readonly ticker = new pixi.Ticker()
    readonly canvas = document.createElement('canvas')
    constructor() {
      tela.apps.push({ stage: this.stage, ticker: this.ticker })
    }
    async init(): Promise<void> {}
    resize(): void {}
    destroy(): void {
      this.canvas.remove()
    }
  }
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

/** A linha torta do pedido, solta: endireita em pé, girando em volta do meio. */
const DE = { x: 300, y: 200 }
const ATE = { x: 360, y: 420 }

function mapa(): MapData {
  return {
    ...createEmptyMap('m_canvas_fantasma', 'Fantasma', 30, 20, 64),
    drawings: [buildLineDrawing('torta', DE, ATE, '#ffffff', 2)],
  }
}

let raiz: HTMLDivElement
let root: Root
let montado: boolean
let agora: number
const exportador = vi.fn<(exporter: MapImageExporter | null) => void>()

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
  tela.apps.length = 0
  tela.fotos.length = 0
  exportador.mockClear()
  agora = 10_000
  useMapStore.setState({
    map: mapa(),
    selection: [{ kind: 'drawing', id: 'torta' }],
    past: [],
    future: [],
    activeTool: 'select',
    camera: { x: 0, y: 0, scale: 1 },
  })
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
  montado = false
})

afterEach(() => {
  if (montado) act(() => root.unmount())
  raiz.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function monta(): Promise<void> {
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  montado = true
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  // Daqui em diante `performance.now()` é o relógio do teste.
  vi.spyOn(performance, 'now').mockImplementation(() => agora)
}

function app(): { stage: Container; ticker: Ticker } {
  const atual = tela.apps.at(-1)
  if (atual === undefined) throw new Error('o PixiCanvas não criou o Application')
  return atual
}

/** Um quadro, `ms` depois do anterior. */
function quadro(ms: number): void {
  agora += ms
  act(() => {
    app().ticker.update(agora)
  })
}

function descendentes(no: Container): Container[] {
  return no.children.flatMap((filho) => [filho, ...descendentes(filho)])
}

function fantasma(): Graphics {
  const achado = descendentes(app().stage).find((no) => no.label === ENDIREITAR_FANTASMA_LABEL)
  if (!(achado instanceof Graphics)) throw new Error('o canvas não tem o Graphics do fantasma')
  return achado
}

function tracos(g: Graphics): StrokeInstruction[] {
  return g.context.instructions.filter((i): i is StrokeInstruction => i.action === 'stroke')
}

function contêiner(): HTMLElement {
  const el = raiz.querySelector('canvas')?.parentElement
  if (!el) throw new Error('canvas fora do contêiner')
  return el
}

function endireitar(): void {
  act(() => {
    useMapStore.getState().endireitarSelecionados()
  })
}

describe('PixiCanvas — o fantasma do endireitar (pedido 5, fatia 4)', () => {
  it('a linha já fica reta e a posição de antes aparece, a 0,5, na cor da seleção; apaga e some em 150 ms', async () => {
    await monta()
    expect(contêiner().dataset.straightenGhost).toBe('0')
    endireitar()

    const linha = useMapStore.getState().map.drawings[0]
    if (linha?.kind !== 'line') throw new Error('a linha sumiu')
    expect(linha.x1).toBe(linha.x2)

    const g = fantasma()
    const [traco, ...resto] = tracos(g)
    expect(resto).toHaveLength(0)
    expect(traco?.data.style.color).toBe(SELECTION_COLOR)
    expect(traco?.data.path.instructions.map((i) => [i.action, ...i.data])).toEqual([
      ['moveTo', DE.x, DE.y],
      ['lineTo', ATE.x, ATE.y],
    ])
    expect(g.alpha).toBe(ENDIREITAR_FANTASMA_ALPHA)
    expect(contêiner().dataset.straightenGhost).toBe('1')

    quadro(ENDIREITAR_FANTASMA_MS / 2)
    expect(g.alpha).toBeGreaterThan(0)
    expect(g.alpha).toBeLessThan(ENDIREITAR_FANTASMA_ALPHA)

    quadro(ENDIREITAR_FANTASMA_MS / 2)
    expect(g.context.instructions).toHaveLength(0)
    expect(contêiner().dataset.straightenGhost).toBe('0')
  })

  it('só visual: o histórico ganha o passo do endireitar e mais nada, e um Ctrl+Z devolve a linha torta', async () => {
    await monta()
    const torta = useMapStore.getState().map
    endireitar()
    quadro(ENDIREITAR_FANTASMA_MS)
    expect(useMapStore.getState().past).toEqual([torta])
    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map).toBe(torta)
    expect(tracos(fantasma())).toHaveLength(0)
  })

  it('movimento reduzido no sistema: a linha só muda, sem fantasma', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    await monta()
    endireitar()
    const linha = useMapStore.getState().map.drawings[0]
    if (linha?.kind !== 'line') throw new Error('a linha sumiu')
    expect(linha.x1).toBe(linha.x2)
    expect(fantasma().context.instructions).toHaveLength(0)
    expect(contêiner().dataset.straightenGhost).toBe('0')
  })

  it('tem grupo de render próprio: o alpha de cada quadro não refaz os lotes do mapa', async () => {
    await monta()
    expect(fantasma().isRenderGroup).toBe(true)
  })

  it('exportar imagem no meio do fantasma: ele não sai no PNG, e volta depois', async () => {
    await monta()
    endireitar()
    const visivelNaFoto: boolean[] = []
    tela.fotos.push(() => visivelNaFoto.push(fantasma().visible))
    const exportar = exportador.mock.calls.at(-1)?.[0]
    if (!exportar) throw new Error('o canvas não entregou o exportador')
    await act(async () => {
      await exportar({ grid: true, masterOnly: true })
    })
    expect(visivelNaFoto).toEqual([false])
    expect(fantasma().visible).toBe(true)
  })

  it('desmontar o canvas no meio do fantasma desliga o ouvinte do quadro', async () => {
    await monta()
    const ticker = app().ticker
    const ligar = vi.spyOn(ticker, 'add')
    const desligar = vi.spyOn(ticker, 'remove')
    endireitar()
    const doFantasma = ligar.mock.calls.at(-1)?.[0]
    expect(doFantasma).toBeTypeOf('function')
    await act(async () => {
      root.unmount()
    })
    montado = false
    await vi.waitFor(() => expect(desligar.mock.calls.map(([fn]) => fn)).toContain(doFantasma))
  })
})
