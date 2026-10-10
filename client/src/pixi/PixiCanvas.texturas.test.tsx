import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { FORCA_PADRAO, TAMANHO_DO_PINCEL_PADRAO } from '../lib/texturas'
import type { MapImageExporter } from '../lib/mapImageExport'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Region } from '../types/map'
import { AVISO_TEXTURA_BALDE_IGUAL } from '../components/labels'
import { PixiCanvas } from './PixiCanvas'

/**
 * OS GESTOS DA FERRAMENTA TEXTURAS COM O PixiCanvas MONTADO: uma pincelada =
 * um passo (um Ctrl+Z); Alt troca pincel e borracha só naquele gesto; Esc ou
 * trocar de ferramenta no meio do arrasto descartam o traço; o balde é um
 * clique, sem arrasto, e o aviso de gesto sem efeito não se repete. E a
 * "Exportar imagem" sem os itens do mestre não leva a pintura da tela dele.
 *
 * Mesmo arranjo sem navegador de `PixiCanvas.penhasco.test.tsx`: só o
 * `Application` (pede WebGL) e a medida do texto (sem canvas 2d) são trocados.
 */

const tela = vi.hoisted(() => {
  const palcos: Container[] = []
  /** Visibilidade da camada das texturas no instante em que o PNG é desenhado. */
  const texturasNaExportacao: boolean[] = []
  return { palcos, texturasNaExportacao, largura: 1200, altura: 800 }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    readonly renderer = Object.assign(new pixi.EventEmitter(), {
      resolution: 1,
      extract: {
        base64: async (opcoes: { target: Container }) => {
          const camada = opcoes.target.getChildByLabel('texturas', true)
          tela.texturasNaExportacao.push(camada !== null && camada.visible)
          return 'data:image/png;base64,AAAA'
        },
      },
    })
    readonly ticker = { add: () => {}, remove: () => {} }
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
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

/** Terra de (100, 100) a (900, 500). */
const TERRA: Region = {
  id: 'terra',
  tag: 'region',
  fillColor: '#a8776a',
  fillPattern: 'solid',
  data: {},
  points: [
    { x: 100, y: 100 },
    { x: 900, y: 100 },
    { x: 900, y: 500 },
    { x: 100, y: 500 },
  ],
}

function mapaComTerra(): MapData {
  return { ...createEmptyMap('m_canvas_texturas', 'Texturas', 20, 12, 50), continente: true, regions: [TERRA] }
}

let raiz: HTMLDivElement
let root: Root
let exportador: MapImageExporter | null = null

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
  tela.texturasNaExportacao.length = 0
  exportador = null
  useToastStore.setState({ toasts: [] })
  useMapStore.setState({
    map: mapaComTerra(),
    selection: [],
    past: [],
    future: [],
    activeTool: 'texturas',
    texturaModo: 'pincel',
    texturaEscolhida: 'floresta',
    texturaTamanho: TAMANHO_DO_PINCEL_PADRAO,
    texturaForca: FORCA_PADRAO,
    pisoAtivo: 0,
    camera: { x: 0, y: 0, scale: 1 },
  })
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

async function monta(): Promise<void> {
  const aoMudar = vi.fn((fn: MapImageExporter | null) => {
    exportador = fn
  })
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={aoMudar} />)
  })
  await vi.waitFor(() => expect(aoMudar).toHaveBeenCalled())
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('o PixiCanvas não criou o Application')
  return p
}

function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', mundo: { x: number; y: number }, alt = false): void {
  const camera = useMapStore.getState().camera
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = 0
  e.buttons = tipo === 'pointerup' ? 0 : 1
  e.altKey = alt
  e.global.set(camera.x + mundo.x * camera.scale, camera.y + mundo.y * camera.scale)
  act(() => {
    palco().emit(tipo, e)
  })
}

/** Arrasta de x = 200 a x = 600 em y = 300, com o botão ainda apertado no fim. */
function arrastaSemSoltar(alt = false): void {
  ponteiro('pointerdown', { x: 200, y: 300 }, alt)
  ponteiro('pointermove', { x: 400, y: 300 }, alt)
  ponteiro('pointermove', { x: 600, y: 300 }, alt)
}

function passos() {
  return useMapStore.getState().map.texturas ?? []
}

describe('PixiCanvas — ferramenta Texturas', () => {
  it('uma pincelada inteira vira UM passo (um Ctrl+Z), com a textura e a força escolhidas', async () => {
    await monta()
    arrastaSemSoltar()
    ponteiro('pointerup', { x: 700, y: 300 })
    expect(passos()).toHaveLength(1)
    expect(passos()[0]).toMatchObject({ tipo: 'pincel', textura: 'floresta', forca: FORCA_PADRAO })
    expect(useMapStore.getState().past).toHaveLength(1)
    act(() => useMapStore.getState().undo())
    expect(passos()).toHaveLength(0)
  })

  it('Alt troca pincel e borracha só naquele gesto', async () => {
    await monta()
    arrastaSemSoltar()
    ponteiro('pointerup', { x: 700, y: 300 })
    // Pincel escolhido + Alt = borracha.
    arrastaSemSoltar(true)
    ponteiro('pointerup', { x: 700, y: 300 }, true)
    expect(passos().map((p) => p.tipo)).toEqual(['pincel', 'borracha'])
    // Borracha escolhida + Alt = pincel.
    act(() => useMapStore.getState().setTexturaModo('borracha'))
    arrastaSemSoltar(true)
    ponteiro('pointerup', { x: 700, y: 300 }, true)
    expect(passos().at(-1)?.tipo).toBe('pincel')
  })

  it('Esc com o botão apertado descarta o traço: mover e soltar depois não grava nada', async () => {
    await monta()
    arrastaSemSoltar()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    ponteiro('pointermove', { x: 700, y: 300 })
    ponteiro('pointerup', { x: 800, y: 300 })
    expect(useMapStore.getState().map.texturas).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('trocar de ferramenta no meio do traço descarta: soltar com a outra ferramenta não grava textura', async () => {
    await monta()
    arrastaSemSoltar()
    act(() => useMapStore.setState({ activeTool: 'select' }))
    ponteiro('pointermove', { x: 700, y: 300 })
    ponteiro('pointerup', { x: 800, y: 300 })
    expect(useMapStore.getState().map.texturas).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('balde: um clique enche a forma sem arrasto; repetir avisa uma vez só e não grava', async () => {
    await monta()
    act(() => useMapStore.getState().setTexturaModo('balde'))
    ponteiro('pointerdown', { x: 300, y: 300 })
    expect(passos()).toHaveLength(1)
    expect(passos()[0]).toMatchObject({ tipo: 'balde', alvo: { tipo: 'regiao', id: 'terra' } })
    // Mover e soltar depois do clique do balde não pinta mais nada.
    ponteiro('pointermove', { x: 500, y: 300 })
    ponteiro('pointerup', { x: 500, y: 300 })
    expect(passos()).toHaveLength(1)
    ponteiro('pointerdown', { x: 300, y: 300 })
    ponteiro('pointerup', { x: 300, y: 300 })
    ponteiro('pointerdown', { x: 300, y: 300 })
    ponteiro('pointerup', { x: 300, y: 300 })
    expect(passos()).toHaveLength(1)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(useToastStore.getState().toasts.filter((t) => t.text === AVISO_TEXTURA_BALDE_IGUAL)).toHaveLength(1)
  })

  it('"Exportar imagem" sem os itens do mestre não leva a pintura da tela do mestre; com eles, leva', async () => {
    await monta()
    act(() => useMapStore.getState().setTexturaModo('balde'))
    ponteiro('pointerdown', { x: 300, y: 300 })
    expect(passos()).toHaveLength(1)
    const exportar = exportador
    if (exportar === null) throw new Error('o canvas não entregou o exportador')
    await act(async () => {
      await exportar({ grid: false, masterOnly: false })
    })
    await act(async () => {
      await exportar({ grid: false, masterOnly: true })
    })
    expect(tela.texturasNaExportacao).toEqual([false, true])
    // E a camada volta a aparecer no editor depois de exportar.
    expect(palco().getChildByLabel('texturas', true)?.visible).toBe(true)
  })
})
