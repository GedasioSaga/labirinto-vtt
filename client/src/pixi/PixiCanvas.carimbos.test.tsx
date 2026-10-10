import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { DENSIDADE_PADRAO, TAMANHO_DO_CARIMBO_PADRAO } from '../lib/carimbos'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { Carimbo, MapData, Region } from '../types/map'
import { AVISO_CARIMBO_NADA_A_APAGAR } from '../components/labels'
import { PixiCanvas } from './PixiCanvas'

/**
 * OS GESTOS DA FERRAMENTA CARIMBOS COM O PixiCanvas MONTADO: o clique solta
 * UM objeto no ponto; arrastar espalha vários — um Ctrl+Z pelo gesto inteiro
 * —, e o spray que começa na terra fica na terra; Alt troca carimbo e
 * borracha só naquele gesto; Esc ou trocar de ferramenta no meio descartam; a
 * borracha no vazio avisa uma vez só.
 *
 * Mesmo arranjo sem navegador de `PixiCanvas.texturas.test.tsx`: só o
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
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1, extract: { base64: async () => 'data:image/png;base64,AAAA' } })
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

/** Terra de (100, 100) a (900, 500); o resto do mapa (1000 × 600) é mar. */
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
  return { ...createEmptyMap('m_canvas_carimbos', 'Carimbos', 20, 12, 50), continente: true, regions: [TERRA] }
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
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  tela.palcos.length = 0
  useToastStore.setState({ toasts: [] })
  useMapStore.setState({
    map: mapaComTerra(),
    selection: [],
    past: [],
    future: [],
    activeTool: 'carimbos',
    carimboModo: 'carimbo',
    carimboEscolhido: 'arvore',
    carimboTamanho: TAMANHO_DO_CARIMBO_PADRAO,
    // Spray largo (≈ 48 px de mundo de raio neste mapa) para o arrasto espalhar bastante.
    carimboLargura: 120,
    carimboDensidade: DENSIDADE_PADRAO,
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
  const aoMudar = vi.fn()
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

/** Arrasta de (200, 300) a (1000, 300) — da terra até o mar —, com o botão ainda apertado no fim. */
function arrastaSemSoltar(alt = false): void {
  ponteiro('pointerdown', { x: 200, y: 300 }, alt)
  for (let x = 240; x <= 1000; x += 40) ponteiro('pointermove', { x, y: 300 }, alt)
}

function objetos(): Carimbo[] {
  return useMapStore.getState().map.carimbos ?? []
}

describe('PixiCanvas — ferramenta Carimbos', () => {
  it('o clique solta UM objeto, no ponto, do carimbo escolhido; um Ctrl+Z o tira', async () => {
    await monta()
    ponteiro('pointerdown', { x: 300, y: 250 })
    // A mão treme um pouquinho no clique: continua um só.
    ponteiro('pointermove', { x: 302, y: 251 })
    ponteiro('pointerup', { x: 302, y: 251 })
    expect(objetos()).toHaveLength(1)
    expect(objetos()[0]).toMatchObject({ tipo: 'arvore', x: 300, y: 250 })
    expect(useMapStore.getState().past).toHaveLength(1)
    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
  })

  it('arrastar espalha vários num passo só; começou na terra, fica na terra', async () => {
    await monta()
    arrastaSemSoltar()
    // Antes de soltar, nada no mapa: o spray ainda é prévia.
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
    ponteiro('pointerup', { x: 1000, y: 300 })
    expect(objetos().length).toBeGreaterThan(4)
    expect(useMapStore.getState().past).toHaveLength(1)
    for (const c of objetos()) {
      expect(c.tipo).toBe('arvore')
      expect(c.x).toBeGreaterThanOrEqual(100)
      expect(c.x).toBeLessThanOrEqual(900)
    }
  })

  it('Alt troca carimbo e borracha só naquele gesto', async () => {
    await monta()
    arrastaSemSoltar()
    ponteiro('pointerup', { x: 1000, y: 300 })
    const antes = objetos().length
    // Carimbo escolhido + Alt = borracha: o mesmo caminho tira tudo o que pôs.
    arrastaSemSoltar(true)
    ponteiro('pointerup', { x: 1000, y: 300 }, true)
    expect(objetos().length).toBeLessThan(antes)
    expect(useMapStore.getState().past).toHaveLength(2)
    // Borracha escolhida + Alt = carimbo.
    act(() => useMapStore.getState().setCarimboModo('borracha'))
    ponteiro('pointerdown', { x: 400, y: 450 }, true)
    ponteiro('pointerup', { x: 400, y: 450 }, true)
    expect(objetos().some((c) => c.x === 400 && c.y === 450)).toBe(true)
  })

  it('a borracha no vazio não vira passo e avisa uma vez só', async () => {
    await monta()
    act(() => useMapStore.getState().setCarimboModo('borracha'))
    for (let i = 0; i < 3; i++) {
      ponteiro('pointerdown', { x: 500, y: 300 })
      ponteiro('pointerup', { x: 500, y: 300 })
    }
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(useToastStore.getState().toasts.filter((t) => t.text === AVISO_CARIMBO_NADA_A_APAGAR)).toHaveLength(1)
  })

  it('Esc com o botão apertado descarta o spray: mover e soltar depois não grava nada', async () => {
    await monta()
    arrastaSemSoltar()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    ponteiro('pointermove', { x: 600, y: 400 })
    ponteiro('pointerup', { x: 600, y: 400 })
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('trocar de ferramenta no meio do spray descarta: soltar com a outra ferramenta não grava objeto', async () => {
    await monta()
    arrastaSemSoltar()
    act(() => useMapStore.setState({ activeTool: 'select' }))
    ponteiro('pointermove', { x: 700, y: 300 })
    ponteiro('pointerup', { x: 800, y: 300 })
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
