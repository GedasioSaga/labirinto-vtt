import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Prop, Region } from '../types/map'
import { PixiCanvas } from './PixiCanvas'

/**
 * A FERRAMENTA OBJETOS COM O PixiCanvas MONTADO — a costura que o
 * `stores/mobiliaNoPonto.test.ts` não vê. Lá o posicionamento é provado solto;
 * aqui a prova é que o clique no palco, com a ferramenta ativa, chega até ele:
 * o móvel da setinha nasce no ponto clicado (com o encaixe da Peça), no giro da
 * sala onde caiu, selecionado, e o desfazer tira o móvel inteiro.
 *
 * Mesmo arranjo sem navegador de `PixiCanvas.menuDaParede.test.tsx`: só o
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
const BOTAO_DIREITO = 2
/** Longe do quarto e de qualquer outro clique do mesmo teste (um toque no mesmo ponto conta como duplo clique). */
const NO_CORREDOR = { x: 150, y: 170 }

/** Quarto quadrado de (320, 320) a (640, 640), já girado 90° — o quadrado girado cai sobre si mesmo. */
const QUARTO: Region = {
  id: 'quarto',
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
  room: { shape: 'rect', name: 'Quarto', rotation: 90 },
}

function mapaComQuarto(): MapData {
  return { ...createEmptyMap('m_canvas_objetos', 'Objetos', 40, 20, GRADE), regions: [QUARTO] }
}

/** Ponto de mundo → px do contêiner, pela câmera que o canvas aplicou no enquadramento de abertura. */
function naTela(mundo: { x: number; y: number }): { x: number; y: number } {
  const camera = useMapStore.getState().camera
  return { x: camera.x + mundo.x * camera.scale, y: camera.y + mundo.y * camera.scale }
}

let raiz: HTMLDivElement
let root: Root

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
  useMapStore.setState({
    map: mapaComQuarto(),
    selection: [],
    past: [],
    future: [],
    activeTool: 'mobilia',
    mobiliaTipo: 'mesa',
    snapTargets: { token: false, wall: false, prop: false },
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

/** Monta o canvas e espera o `setup` assíncrono chegar até o fim (o canvas anexado ao contêiner). */
async function monta(): Promise<void> {
  const exportador = vi.fn()
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  // `onImageExporterChange` é das últimas coisas do setup: com ele chamado, os ouvintes estão todos ligados.
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  // O enquadramento de abertura mexeu na câmera: tela e mundo não coincidem.
  expect(useMapStore.getState().camera).not.toEqual({ x: 0, y: 0, scale: 1 })
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('o PixiCanvas não criou o Application')
  return p
}

/** `pointerdown` + `pointerup` no palco do Pixi, no ponto de mundo, com o botão pedido (e o Alt, que inverte o encaixe). */
function aperta(mundo: { x: number; y: number }, botao: number, alt = false): void {
  const p = naTela(mundo)
  const evento = (): FederatedPointerEvent => {
    const e = new FederatedPointerEvent(new EventBoundary())
    e.pointerType = 'mouse'
    e.pointerId = 1
    e.isPrimary = true
    e.button = botao
    e.altKey = alt
    e.global.set(p.x, p.y)
    return e
  }
  act(() => {
    palco().emit('pointerdown', evento())
  })
  act(() => {
    palco().emit('pointerup', evento())
  })
}

function unicoMovel(): Prop {
  const { props } = useMapStore.getState().map
  const [movel] = props
  if (props.length !== 1 || movel === undefined) throw new Error(`esperava 1 móvel no mapa, há ${props.length}`)
  return movel
}

describe('PixiCanvas — a ferramenta Objetos põe o móvel no clique', () => {
  it('clique esquerdo fora de sala: a Mesa nasce no ponto, sem giro, selecionada, a ferramenta segue na mão e o desfazer a tira', async () => {
    await monta()
    aperta(NO_CORREDOR, BOTAO_ESQUERDO)

    const mesa = unicoMovel()
    expect(mesa.mobilia).toBe('mesa')
    expect(mesa.x).toBeCloseTo(NO_CORREDOR.x, 6)
    expect(mesa.y).toBeCloseTo(NO_CORREDOR.y, 6)
    expect('rotation' in mesa).toBe(false)
    expect(useMapStore.getState().selection).toEqual([{ kind: 'prop', id: mesa.id }])
    expect(useMapStore.getState().activeTool).toBe('mobilia')

    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map.props).toEqual([])
  })

  it('dentro do quarto girado, a Cama escolhida na setinha nasce no giro dele', async () => {
    useMapStore.setState({ mobiliaTipo: 'catre' })
    await monta()
    aperta({ x: 480, y: 480 }, BOTAO_ESQUERDO)

    const cama = unicoMovel()
    expect(cama.mobilia).toBe('catre')
    expect(cama.rotation).toBe(90)
  })

  it('com o encaixe de objeto ligado, o móvel vai para o cruzamento da grade; com Alt, fica no ponto exato', async () => {
    useMapStore.setState({ snapTargets: { token: false, wall: false, prop: true } })
    await monta()

    aperta({ x: 100, y: 90 }, BOTAO_ESQUERDO)
    const encaixado = unicoMovel()
    expect(encaixado.x).toBeCloseTo(128, 6)
    expect(encaixado.y).toBeCloseTo(64, 6)

    act(() => useMapStore.getState().undo())
    aperta({ x: 300, y: 150 }, BOTAO_ESQUERDO, true)
    const solto = unicoMovel()
    expect(solto.x).toBeCloseTo(300, 6)
    expect(solto.y).toBeCloseTo(150, 6)
  })

  it('o botão direito não põe móvel nem deixa passo no desfazer', async () => {
    await monta()
    aperta(NO_CORREDOR, BOTAO_DIREITO)

    expect(useMapStore.getState().map.props).toEqual([])
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
