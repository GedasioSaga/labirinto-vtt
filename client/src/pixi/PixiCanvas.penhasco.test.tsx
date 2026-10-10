import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Region } from '../types/map'
import { PixiCanvas } from './PixiCanvas'

/**
 * O PINCEL DE PENHASCO COM O PixiCanvas MONTADO: o gesto cancelado não grava.
 *
 * Esc (ou trocar de ferramenta) com o botão ainda apertado limpava o rascunho,
 * mas o arrasto seguia em 'painting-penhasco': o próximo movimento redesenhava
 * o risco inteiro e o soltar o gravava no mapa, com passo no desfazer, mesmo
 * cancelado ou já com outra ferramenta na mão.
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

/** Terra de (100, 100) a (900, 500): a costa de baixo (y = 500) é a que mostra a parede. */
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

function mapaComCosta(): MapData {
  return { ...createEmptyMap('m_canvas_penhasco', 'Penhasco', 20, 12, 50), continente: true, regions: [TERRA] }
}

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
  tela.palcos.length = 0
  useMapStore.setState({
    map: mapaComCosta(),
    selection: [],
    past: [],
    future: [],
    activeTool: 'penhasco',
    penhascoModo: 'riscar',
    penhascoLargura: 'media',
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
  const exportador = vi.fn()
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('o PixiCanvas não criou o Application')
  return p
}

function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', mundo: { x: number; y: number }): void {
  const camera = useMapStore.getState().camera
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = 0
  e.buttons = tipo === 'pointerup' ? 0 : 1
  e.global.set(camera.x + mundo.x * camera.scale, camera.y + mundo.y * camera.scale)
  act(() => {
    palco().emit(tipo, e)
  })
}

/** Risca a costa de baixo de x = 200 a x = 400, com o botão ainda apertado no fim. */
function riscaSemSoltar(): void {
  ponteiro('pointerdown', { x: 200, y: 500 })
  ponteiro('pointermove', { x: 300, y: 500 })
  ponteiro('pointermove', { x: 400, y: 500 })
}

describe('PixiCanvas — pincel de Penhasco', () => {
  it('riscar a costa e soltar grava um risco (o caminho que os casos abaixo cancelam)', async () => {
    await monta()
    riscaSemSoltar()
    ponteiro('pointerup', { x: 500, y: 500 })
    expect(useMapStore.getState().map.penhascos).toHaveLength(1)
    expect(useMapStore.getState().past).toHaveLength(1)
  })

  it('Esc com o botão apertado cancela o risco: mover e soltar depois não grava nada', async () => {
    await monta()
    riscaSemSoltar()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    ponteiro('pointermove', { x: 500, y: 500 })
    ponteiro('pointerup', { x: 600, y: 500 })
    expect(useMapStore.getState().map.penhascos).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('trocar de ferramenta no meio do risco cancela: soltar com a outra ferramenta não grava penhasco', async () => {
    await monta()
    riscaSemSoltar()
    act(() => useMapStore.setState({ activeTool: 'select' }))
    ponteiro('pointermove', { x: 500, y: 500 })
    ponteiro('pointerup', { x: 600, y: 500 })
    expect(useMapStore.getState().map.penhascos).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
