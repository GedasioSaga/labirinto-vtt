import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { criarMovel } from '../lib/mobilia'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Prop, Region, Wall } from '../types/map'
import { PixiCanvas } from './PixiCanvas'

/**
 * A FERRAMENTA OBJETOS COM O PixiCanvas MONTADO — a costura que o
 * `stores/mobiliaNoPonto.test.ts` não vê. Lá o posicionamento é provado solto;
 * aqui a prova é que o clique no palco, com a ferramenta ativa, chega até ele:
 * o móvel da setinha nasce no ponto clicado (com o encaixe da Peça), no giro da
 * sala onde caiu, sem seleção (a ficha fica em "Colocar"), e o desfazer tira o
 * móvel inteiro; o clique num objeto já posto o seleciona em vez de pôr outro.
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

/** `pointerdown` + `pointerup` no palco do Pixi, no ponto de mundo, com o botão pedido (e o Alt, que inverte o encaixe; o Ctrl, que põe por cima de objeto). */
function aperta(mundo: { x: number; y: number }, botao: number, alt = false, ctrl = false): void {
  const p = naTela(mundo)
  const evento = (): FederatedPointerEvent => {
    const e = new FederatedPointerEvent(new EventBoundary())
    e.pointerType = 'mouse'
    e.pointerId = 1
    e.isPrimary = true
    e.button = botao
    e.altKey = alt
    e.ctrlKey = ctrl
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
  it('clique esquerdo fora de sala: a Mesa nasce no ponto, sem giro e SEM seleção (a ficha fica em "Colocar"), a ferramenta segue na mão e o desfazer a tira', async () => {
    await monta()
    aperta(NO_CORREDOR, BOTAO_ESQUERDO)

    const mesa = unicoMovel()
    expect(mesa.mobilia).toBe('mesa')
    expect(mesa.x).toBeCloseTo(NO_CORREDOR.x, 6)
    expect(mesa.y).toBeCloseTo(NO_CORREDOR.y, 6)
    expect('rotation' in mesa).toBe(false)
    expect(useMapStore.getState().selection).toEqual([])
    expect(useMapStore.getState().activeTool).toBe('mobilia')

    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map.props).toEqual([])
  })

  it('PÔR VÁRIOS EM SEGUIDA (pedido de 12/11/2026): três mesas seguidas, nenhuma fica selecionada, e o Ctrl+Z tira só a última', async () => {
    await monta()
    for (const ponto of [NO_CORREDOR, { x: 150, y: 300 }, { x: 900, y: 170 }]) {
      aperta(ponto, BOTAO_ESQUERDO)
      expect(useMapStore.getState().selection).toEqual([])
    }
    expect(useMapStore.getState().map.props).toHaveLength(3)

    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map.props.map((p) => p.x)).toEqual([NO_CORREDOR.x, 150])
  })

  it('clique num objeto JÁ POSTO: ele fica selecionado (a ficha passa para ele) e nada nasce por cima', async () => {
    const mesa = criarMovel('mesa', NO_CORREDOR, GRADE, 'mesa-posta')
    useMapStore.setState({ map: { ...mapaComQuarto(), props: [mesa] } })
    await monta()
    aperta(NO_CORREDOR, BOTAO_ESQUERDO)

    expect(useMapStore.getState().map.props).toEqual([mesa])
    expect(useMapStore.getState().selection).toEqual([{ kind: 'prop', id: 'mesa-posta' }])
    expect(useMapStore.getState().activeTool).toBe('mobilia')
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('objeto de CHÃO não prende o clique: em cima do tapete, a Mesa escolhida nasce por cima dele e nada fica selecionado', async () => {
    const tapete = criarMovel('tapete', NO_CORREDOR, GRADE, 'tapete-posto')
    useMapStore.setState({ map: { ...mapaComQuarto(), props: [tapete] } })
    await monta()
    aperta(NO_CORREDOR, BOTAO_ESQUERDO)

    const { props } = useMapStore.getState().map
    expect(props.map((p) => p.mobilia)).toEqual(['tapete', 'mesa'])
    expect(useMapStore.getState().selection).toEqual([])
  })

  it('Ctrl + clique em cima de um objeto comum põe o objeto escolhido por cima dele (o fim da lista), sem selecionar', async () => {
    const caixa = criarMovel('caixa', NO_CORREDOR, GRADE, 'caixa-grande')
    useMapStore.setState({ map: { ...mapaComQuarto(), props: [caixa] }, mobiliaTipo: 'barril' })
    await monta()
    aperta(NO_CORREDOR, BOTAO_ESQUERDO, false, true)

    expect(useMapStore.getState().map.props.map((p) => p.mobilia)).toEqual(['caixa', 'barril'])
    expect(useMapStore.getState().selection).toEqual([])
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

/** Clique direito do navegador sobre o canvas, depois do `pointerdown`/`pointerup` do mesmo botão (a ordem do navegador). */
function cliqueDireito(mundo: { x: number; y: number }): void {
  aperta(mundo, BOTAO_DIREITO)
  const p = naTela(mundo)
  const canvas = raiz.querySelector('canvas')
  if (canvas === null) throw new Error('o canvas não foi anexado ao contêiner')
  act(() => {
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: BOTAO_DIREITO, clientX: p.x, clientY: p.y }))
  })
}

describe('PixiCanvas — botão direito no objeto: Pôr por cima / por baixo', () => {
  it('com a ferramenta Objeto, o botão direito na caixa pequena a seleciona e abre o menu; "Pôr por cima" a leva ao topo num passo do Ctrl+Z', async () => {
    const grande = criarMovel('caixa', { x: 150, y: 170 }, GRADE, 'grande')
    const pequena = { ...criarMovel('caixa', { x: 180, y: 200 }, GRADE, 'pequena'), width: 32, height: 32 }
    useMapStore.setState({ map: { ...mapaComQuarto(), props: [pequena, grande] } })
    await monta()
    cliqueDireito({ x: 185, y: 210 })

    expect(useMapStore.getState().selection).toEqual([{ kind: 'prop', id: 'pequena' }])
    expect(useMapStore.getState().map.props).toHaveLength(2)
    const porCima = [...raiz.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent === 'Pôr por cima')
    if (porCima === undefined) throw new Error('o menu não tem "Pôr por cima"')
    act(() => porCima.click())

    expect(useMapStore.getState().map.props.map((p) => p.id)).toEqual(['grande', 'pequena'])
    expect(useMapStore.getState().past).toHaveLength(1)
    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map.props.map((p) => p.id)).toEqual(['pequena', 'grande'])
  })

  /** Parede solta que corta o tapete posto em `NO_CORREDOR` (192 x 128 px, de y=106 a y=234). */
  const PAREDE_NO_TAPETE: Wall = { id: 'parede-no-tapete', x1: 40, y1: 130, x2: 260, y2: 130, blocksLight: true, blocksMove: true, door: null }

  /** Os rótulos do menu aberto agora (o que acabou de fechar ainda sai por 120 ms, inerte). */
  function itensDoMenuAberto(): string[] {
    return [...raiz.querySelectorAll<HTMLButtonElement>('[role="menu"]:not([inert]) [role="menuitem"]')].map((b) => b.textContent ?? '')
  }

  function comTapeteSobAParede(): void {
    const tapete = criarMovel('tapete', NO_CORREDOR, GRADE, 'tapete-posto')
    useMapStore.setState({ map: { ...mapaComQuarto(), props: [tapete], walls: [PAREDE_NO_TAPETE] } })
  }

  it('PAREDE em cima do tapete: o botão direito na parede abre o menu DELA ("Abrir vão aqui"), e o tapete não é selecionado', async () => {
    comTapeteSobAParede()
    await monta()
    cliqueDireito({ x: 150, y: 130 })

    expect(itensDoMenuAberto().some((rotulo) => rotulo.includes('Abrir vão aqui'))).toBe(true)
    expect(itensDoMenuAberto()).not.toContain('Pôr por cima')
    expect(useMapStore.getState().selection).toEqual([])
  })

  it('no mesmo tapete, FORA da parede, o botão direito continua abrindo o menu do objeto', async () => {
    comTapeteSobAParede()
    await monta()
    cliqueDireito({ x: 150, y: 215 })

    expect(useMapStore.getState().selection).toEqual([{ kind: 'prop', id: 'tapete-posto' }])
    expect(itensDoMenuAberto()).toContain('Pôr por cima')
    expect(itensDoMenuAberto().some((rotulo) => rotulo.includes('Abrir vão aqui'))).toBe(false)
  })
})

/** `pointerdown`/`pointermove`/`pointerup` no palco, no ponto de mundo, com o botão esquerdo apertado no meio. */
function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', mundo: { x: number; y: number }): void {
  const p = naTela(mundo)
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = BOTAO_ESQUERDO
  e.buttons = tipo === 'pointerup' ? 0 : 1
  e.global.set(p.x, p.y)
  act(() => {
    palco().emit(tipo, e)
  })
}

/**
 * ESC NO MEIO DE MOVER O OBJETO (prova de 11/11/2026: a barraca ficou fora do
 * lugar depois de um arrasto de mover com Esc no meio). O Esc desfaz o arrasto
 * em curso, como no giro da sala: o objeto volta ao lugar e ao giro de antes, e
 * o soltar que vem depois não grava nada.
 */
describe('PixiCanvas — Esc no meio de mover o objeto', () => {
  it('o objeto volta ao lugar e ao giro de antes, e soltar depois não deixa passo no desfazer', async () => {
    const barraca: Prop = { ...criarMovel('barraca', { x: 160, y: 480 }, GRADE, 'barraca'), rotation: 40 }
    useMapStore.setState({ map: { ...mapaComQuarto(), props: [barraca] }, activeTool: 'select' })
    await monta()

    ponteiro('pointerdown', { x: 160, y: 480 })
    ponteiro('pointermove', { x: 260, y: 530 })
    expect(unicoMovel().x).not.toBeCloseTo(160, 0)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    ponteiro('pointermove', { x: 300, y: 560 })
    ponteiro('pointerup', { x: 300, y: 560 })

    expect(useMapStore.getState().map.props).toEqual([barraca])
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
