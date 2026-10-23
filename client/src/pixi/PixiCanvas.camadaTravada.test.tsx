import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Region } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { PixiCanvas } from './PixiCanvas'

/**
 * O CADEADO DA CAMADA NO GESTO, com o PixiCanvas montado (fase 3, fatia 5):
 * o que a store não vê. A ferramenta Pino, o arrasto do pino e o Delete do
 * pino selecionado recusam camada travada com UM aviso, sem mudar o mapa nem
 * o Ctrl+Z, e o gesto não atravessa para a sala de baixo.
 *
 * Mesmo arranjo sem navegador de `PixiCanvas.objetos.test.tsx`: só o
 * `Application` (pede WebGL) e a medida do texto (sem canvas 2d) são trocados.
 */

const tela = vi.hoisted(() => {
  const palcos: Container[] = []
  return { palcos, largura: 1200, altura: 800 }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    // O canvas escuta o `resize` do renderer para redesenhar grade e fundo.
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1 })
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

const GRADE = 64
const BOTAO_ESQUERDO = 0

/** Sala quadrada de (320, 320) a (640, 640). */
const SALA: Region = {
  id: 'sala',
  points: [
    { x: 320, y: 320 },
    { x: 640, y: 320 },
    { x: 640, y: 640 },
    { x: 320, y: 640 },
  ],
  tag: '',
  fillColor: '#a8776a',
  fillPattern: 'solid',
  data: {},
}

/** O pino no meio da sala: a sala está logo embaixo dele. */
const PINO: Pin = buildPin('pino', { x: 480, y: 480 }, 'exclamacao')

function mapaBase(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m_canvas_trava', 'Trava', 40, 20, GRADE), regions: [SALA], ...extra }
}

/** Ponto de mundo → px do contêiner, pela câmera que o canvas aplicou no enquadramento de abertura. */
function naTela(mundo: { x: number; y: number }): { x: number; y: number } {
  const camera = useMapStore.getState().camera
  return { x: camera.x + mundo.x * camera.scale, y: camera.y + mundo.y * camera.scale }
}

let raiz: HTMLDivElement
let root: Root

function abrir(map: MapData, ferramenta: DrawingTool): void {
  useMapStore.setState({
    map,
    selection: [],
    selectedPinId: null,
    past: [],
    future: [],
    activeTool: ferramenta,
    snapTargets: { token: false, wall: false, prop: false },
    camera: { x: 0, y: 0, scale: 1 },
  })
  useToastStore.setState({ toasts: [] })
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  // O jsdom não tem ResizeObserver, e o canvas acompanha o tamanho do contêiner com ele.
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
  vi.restoreAllMocks()
})

/** Monta o canvas e espera o `setup` assíncrono chegar até o fim (o canvas anexado ao contêiner). */
async function monta(): Promise<void> {
  const exportador = vi.fn()
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  // `onImageExporterChange` é das últimas coisas do setup: com ele chamado, os ouvintes estão todos ligados.
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  // O enquadramento de abertura zera o rastro de avisos de antes do gesto.
  useToastStore.setState({ toasts: [] })
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('o PixiCanvas não criou o Application')
  return p
}

function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', mundo: { x: number; y: number }): void {
  const p = naTela(mundo)
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = BOTAO_ESQUERDO
  e.global.set(p.x, p.y)
  act(() => {
    palco().emit(tipo, e)
  })
}

function clica(mundo: { x: number; y: number }): void {
  ponteiro('pointerdown', mundo)
  ponteiro('pointerup', mundo)
}

function avisos(): string[] {
  return useToastStore.getState().toasts.map((aviso) => aviso.text)
}

/** Nada mudou: o mesmo mapa (nem um `set`), nenhum passo no Ctrl+Z. */
function semMudanca(antes: MapData): void {
  expect(useMapStore.getState().map).toBe(antes)
  expect(useMapStore.getState().past).toHaveLength(0)
}

describe('pino × camada Anotações travada, no gesto', () => {
  it('ferramenta Pino: o pino não nasce, nada fica selecionado, UM aviso', async () => {
    abrir(mapaBase({ lockedLayers: ['anotacoes'] }), 'pin')
    await monta()
    const antes = useMapStore.getState().map
    clica({ x: 160, y: 160 })
    semMudanca(antes)
    expect(useMapStore.getState().selectedPinId).toBeNull()
    expect(avisos()).toEqual(['A camada Anotações está travada'])
  })

  it('ferramenta Pino destravada: o pino nasce no clique e fica selecionado', async () => {
    abrir(mapaBase(), 'pin')
    await monta()
    clica({ x: 160, y: 160 })
    const [novo] = useMapStore.getState().map.pins
    expect(novo?.x).toBeCloseTo(160, 6)
    expect(useMapStore.getState().selectedPinId).toBe(novo?.id)
    expect(avisos()).toEqual([])
  })

  it('arrastar o pino não move nada (nem a sala de baixo), UM aviso', async () => {
    abrir(mapaBase({ pins: [PINO], lockedLayers: ['anotacoes'] }), 'select')
    await monta()
    const antes = useMapStore.getState().map
    ponteiro('pointerdown', PINO)
    ponteiro('pointermove', { x: 520, y: 520 })
    ponteiro('pointermove', { x: 560, y: 560 })
    ponteiro('pointerup', { x: 560, y: 560 })
    semMudanca(antes)
    expect(useMapStore.getState().selection).toEqual([])
    expect(useMapStore.getState().selectedPinId).toBeNull()
    expect(avisos()).toEqual(['A camada Anotações está travada'])
  })

  it('destravada, arrastar move o pino num passo só do Ctrl+Z', async () => {
    abrir(mapaBase({ pins: [PINO] }), 'select')
    await monta()
    ponteiro('pointerdown', PINO)
    ponteiro('pointermove', { x: 520, y: 520 })
    ponteiro('pointermove', { x: 560, y: 560 })
    ponteiro('pointerup', { x: 560, y: 560 })
    const movido = useMapStore.getState().map.pins[0]
    expect(movido?.x).toBeCloseTo(560, 6)
    expect(useMapStore.getState().map.regions).toEqual([SALA])
    expect(useMapStore.getState().past).toHaveLength(1)
  })

  it('Delete no pino selecionado: o pino fica, UM aviso (sem o "apagado — Ctrl+Z desfaz")', async () => {
    abrir(mapaBase({ pins: [PINO], lockedLayers: ['anotacoes'] }), 'select')
    useMapStore.setState({ selectedPinId: PINO.id })
    await monta()
    const antes = useMapStore.getState().map
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    })
    semMudanca(antes)
    expect(avisos()).toEqual(['A camada Anotações está travada'])
  })

  it('Delete com Anotações destravada apaga o pino e avisa como hoje', async () => {
    abrir(mapaBase({ pins: [PINO] }), 'select')
    useMapStore.setState({ selectedPinId: PINO.id })
    await monta()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    })
    expect(useMapStore.getState().map.pins).toEqual([])
    expect(avisos()).toEqual(['Ponto de interesse apagado — Ctrl+Z desfaz'])
  })
})
