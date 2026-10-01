import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Graphics, Text, type Ticker } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { useInitiativeStore } from '../stores/initiativeStore'
import { useFollowStore } from '../stores/followStore'
import { hostPlayerChanges } from '../net/playerChanges'
import { RECENTER_MS } from '../player/edgeFollow'
import { TOKEN_GLIDE_MS } from '../player/tokenGlide'
import { theme } from '../theme'
import type { Camera } from './world'
import type { MapData, Region, Token } from '../types/map'
import { PixiCanvas } from './PixiCanvas'
import { TOKEN_LIFT_SCALE, TURN_RING_LABEL } from './tokensRenderer'
import { roomLabelPosition } from './drawRoomNames'
import { ZOOM_DA_RODA_PARADA_MS } from './zoomDaRoda'

/**
 * A FIAÇÃO DO LOTE "MAPA DO MESTRE" COM O PixiCanvas MONTADO — os módulos têm
 * teste próprio; aqui a prova é que o canvas os liga pelo caminho de verdade:
 * o duplo clique no nome da sala, a roda, o arrasto da ficha, a vez na store
 * de iniciativa e no Shift+N, o passo que chega pela ponte do jogador e o
 * pedido de câmera do App.
 *
 * Mesmo arranjo sem navegador de `PixiCanvas.objetos.test.tsx`, com uma
 * diferença: o relógio de quadros é um `Ticker` de verdade, parado, e cada
 * quadro é emitido pelo teste com o tempo que ele escolhe.
 */

const tela = vi.hoisted(() => {
  const apps: { stage: Container; ticker: Ticker }[] = []
  return { apps, largura: 1200, altura: 800 }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1 })
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

const GRADE = 64
const MAPA_ID = 'm_canvas_movimento'
const LEVANTAR_MS = Number.parseFloat(theme.motion.fast)
const ASSENTAR_MS = Number.parseFloat(theme.motion.base)
const PULSO_MS = Number.parseFloat(theme.motion.base)

const QUARTO: Region = {
  id: 'quarto',
  points: [
    { x: 640, y: 320 },
    { x: 960, y: 320 },
    { x: 960, y: 640 },
    { x: 640, y: 640 },
  ],
  tag: '',
  fillColor: '#a8776a',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Quarto' },
}

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function mapa(id = MAPA_ID): MapData {
  return {
    ...createEmptyMap(id, 'Movimento', 40, 20, GRADE),
    regions: [QUARTO],
    tokens: [ficha('lanterna', 'Lanterna', 160, 160), ficha('machado', 'Machado', 160, 480)],
  }
}

let raiz: HTMLDivElement
let root: Root
let agora = 10_000
const exportador = vi.fn()

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
  useMapStore.setState({
    map: mapa(),
    selection: [],
    past: [],
    future: [],
    activeTool: 'select',
    snapTargets: { token: false, wall: false, prop: false },
    camera: { x: 0, y: 0, scale: 1 },
  })
  useInitiativeStore.getState().reset()
  useFollowStore.setState({ playerId: null })
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
})

afterEach(() => {
  act(() => root.unmount())
  raiz.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  useInitiativeStore.getState().reset()
  useFollowStore.setState({ playerId: null })
})

async function monta(cameraRequest: { camera: Camera | null; focus?: { x: number; y: number } } | null = null): Promise<void> {
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} cameraRequest={cameraRequest} />)
  })
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
}

/** Novo pedido de câmera do App (a prop muda de referência). */
function pedeCamera(cameraRequest: { camera: Camera | null; focus?: { x: number; y: number } }): void {
  act(() => {
    root.render(<PixiCanvas onImageExporterChange={exportador} cameraRequest={cameraRequest} />)
  })
}

function app(): { stage: Container; ticker: Ticker } {
  const atual = tela.apps.at(-1)
  if (atual === undefined) throw new Error('o PixiCanvas não criou o Application')
  return atual
}

/** Daqui em diante `performance.now()` é o relógio do teste. */
function congelaRelogio(): void {
  vi.spyOn(performance, 'now').mockImplementation(() => agora)
}

/** Um quadro, `ms` depois do anterior. */
function quadro(ms: number): void {
  agora += ms
  act(() => {
    app().ticker.update(agora)
  })
}

function naTela(mundo: { x: number; y: number }): { x: number; y: number } {
  const camera = useMapStore.getState().camera
  return { x: camera.x + mundo.x * camera.scale, y: camera.y + mundo.y * camera.scale }
}

function evento(mundo: { x: number; y: number }, botao = 0): FederatedPointerEvent {
  const p = naTela(mundo)
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = botao
  e.global.set(p.x, p.y)
  return e
}

function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', mundo: { x: number; y: number }): void {
  act(() => {
    app().stage.emit(tipo, evento(mundo))
  })
}

function contêiner(): HTMLElement {
  const el = raiz.querySelector('canvas')?.parentElement
  if (!el) throw new Error('canvas fora do contêiner')
  return el
}

function descendentes(no: Container): Container[] {
  return no.children.flatMap((filho) => [filho, ...descendentes(filho)])
}

function texto(conteudo: string): Text {
  const achado = descendentes(app().stage).find((no): no is Text => no instanceof Text && no.text === conteudo)
  if (!achado) throw new Error(`sem o texto ${conteudo}`)
  return achado
}

/** O wrapper da ficha: o pai do nome dela. */
function wrapperDaFicha(nome: string): Container {
  const pai = texto(nome).parent
  if (!pai) throw new Error(`ficha ${nome} sem wrapper`)
  return pai
}

function anelDaVez(nome: string): Graphics | undefined {
  return wrapperDaFicha(nome).children.find((c): c is Graphics => c instanceof Graphics && c.label === TURN_RING_LABEL)
}

/** Largura (px de mundo) do contorno azul de hover desenhado agora, ou `null` sem contorno. */
function larguraDoHover(): number | null {
  for (const no of descendentes(app().stage)) {
    if (!(no instanceof Graphics)) continue
    for (const instrucao of no.context.instructions) {
      if (instrucao.action === 'stroke' && instrucao.data.style.color === 0x6fc3ff) return instrucao.data.style.width
    }
  }
  return null
}

describe('PixiCanvas — campo de nome da sala é a própria plaquinha (M19)', () => {
  it('duplo clique no nome abre o campo na plaquinha, vestido dela; a etiqueta do mapa sai de baixo e volta no Esc', async () => {
    await monta()
    const etiqueta = texto('Quarto')
    expect(etiqueta.visible).toBe(true)

    const centro = naTela(roomLabelPosition(QUARTO))
    act(() => {
      contêiner().dispatchEvent(new MouseEvent('dblclick', { clientX: centro.x, clientY: centro.y, bubbles: true }))
    })
    const campo = raiz.querySelector<HTMLInputElement>('input[aria-label="Nome da sala no mapa"]')
    if (!campo) throw new Error('o campo de nome da sala não abriu')
    expect(etiqueta.visible).toBe(false)
    expect(Number.parseFloat(campo.style.left)).toBeCloseTo(centro.x, 6)
    expect(Number.parseFloat(campo.style.top)).toBeCloseTo(centro.y, 6)
    expect(campo.style.backgroundColor || campo.style.background).toMatch(/c9c1ac|201, 193, 172/i)
    expect(campo.style.borderRadius).toBe('var(--lb-radius-full)')
    expect(campo.style.height).toBe('1.85em')

    act(() => {
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(raiz.querySelector('input[aria-label="Nome da sala no mapa"]')).toBeNull()
    expect(etiqueta.visible).toBe(true)
  })
})

describe('PixiCanvas — contorno de hover com espessura de tela (M18)', () => {
  it('1,5 px de tela sobre a ficha; a roda muda o zoom e, parada, o contorno é refeito na escala nova', async () => {
    await monta()
    ponteiro('pointermove', { x: 160, y: 160 })
    const escalaAntes = useMapStore.getState().camera.scale
    expect((larguraDoHover() ?? 0) * escalaAntes).toBeCloseTo(1.5, 6)

    const p = naTela({ x: 160, y: 160 })
    act(() => {
      contêiner().dispatchEvent(new WheelEvent('wheel', { deltaY: -240, clientX: p.x, clientY: p.y, cancelable: true }))
    })
    const escalaDepois = useMapStore.getState().camera.scale
    expect(escalaDepois).not.toBe(escalaAntes)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ZOOM_DA_RODA_PARADA_MS + 50))
    })
    expect((larguraDoHover() ?? 0) * escalaDepois).toBeCloseTo(1.5, 6)
  })
})

describe('PixiCanvas — ficha levanta ao ser arrastada (M20)', () => {
  it('clique sem arrasto não pulsa; arrastar levanta; soltar assenta', async () => {
    await monta()
    congelaRelogio()
    const lanterna = wrapperDaFicha('Lanterna')

    ponteiro('pointerdown', { x: 160, y: 160 })
    ponteiro('pointerup', { x: 160, y: 160 })
    quadro(LEVANTAR_MS)
    expect(lanterna.scale.x).toBe(1)

    ponteiro('pointerdown', { x: 160, y: 160 })
    ponteiro('pointermove', { x: 300, y: 160 })
    quadro(LEVANTAR_MS)
    expect(wrapperDaFicha('Lanterna').scale.x).toBeCloseTo(TOKEN_LIFT_SCALE, 9)

    ponteiro('pointerup', { x: 300, y: 160 })
    quadro(ASSENTAR_MS)
    expect(wrapperDaFicha('Lanterna').scale.x).toBe(1)
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 'lanterna')).toMatchObject({ x: 300, y: 160 })
  })
})

describe('PixiCanvas — anel da vez entra com pulso (M21)', () => {
  it('a vez passa pelo painel: o anel fecha sobre a ficha; pelo Shift+N: aparece parado', async () => {
    useInitiativeStore.setState({ values: { [MAPA_ID]: { lanterna: 20, machado: 10 } } })
    await monta()
    congelaRelogio()

    act(() => useInitiativeStore.getState().setTurn({ mapId: MAPA_ID, tokenId: 'lanterna' }))
    expect(anelDaVez('Lanterna')?.alpha).toBe(0)
    quadro(PULSO_MS)
    expect(anelDaVez('Lanterna')?.alpha).toBe(1)
    expect(anelDaVez('Lanterna')?.scale.x).toBe(1)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', shiftKey: true, bubbles: true }))
    })
    expect(useInitiativeStore.getState().turn).toEqual({ mapId: MAPA_ID, tokenId: 'machado' })
    expect(anelDaVez('Lanterna')).toBeUndefined()
    expect(anelDaVez('Machado')?.alpha).toBe(1)
    expect(anelDaVez('Machado')?.scale.x).toBe(1)
  })
})

describe('PixiCanvas — ficha movida pelo jogador desliza na tela do mestre (M22)', () => {
  it('o passo que chega pela ponte desliza; o arrasto do mestre vai direto', async () => {
    await monta()
    congelaRelogio()

    act(() => hostPlayerChanges.applyMove('lanterna', 480, 160))
    const lanterna = wrapperDaFicha('Lanterna')
    expect(lanterna.x).toBe(160)
    quadro(TOKEN_GLIDE_MS / 2)
    expect(lanterna.x).toBeGreaterThan(160)
    expect(lanterna.x).toBeLessThan(480)
    quadro(TOKEN_GLIDE_MS / 2)
    expect(lanterna.x).toBe(480)

    act(() => useMapStore.getState().moveTokenLive('machado', 400, 480))
    expect(wrapperDaFicha('Machado').x).toBe(400)
  })
})

describe('PixiCanvas — "Ir até lá" leva a câmera deslizando (M23)', () => {
  const FOCO = { x: 2000, y: 1000 }

  it('na mesma cena a câmera corre até o ponto; ela chega com o ponto no centro da tela', async () => {
    await monta()
    congelaRelogio()
    const antes = useMapStore.getState().camera

    pedeCamera({ camera: null, focus: FOCO })
    expect(useMapStore.getState().camera).toEqual(antes)
    quadro(RECENTER_MS / 2)
    const meio = useMapStore.getState().camera
    quadro(RECENTER_MS / 2)
    const fim = useMapStore.getState().camera
    expect(fim.x).toBeCloseTo(tela.largura / 2 - FOCO.x * fim.scale, 6)
    expect(fim.y).toBeCloseTo(tela.altura / 2 - FOCO.y * fim.scale, 6)
    expect(meio.x).toBeLessThan(antes.x)
    expect(meio.x).toBeGreaterThan(fim.x)
  })

  it('com o Seguir ligado, o pedido é instantâneo', async () => {
    await monta()
    congelaRelogio()
    useFollowStore.setState({ playerId: 'jogador-1' })
    pedeCamera({ camera: null, focus: FOCO })
    const camera = useMapStore.getState().camera
    expect(camera.x).toBeCloseTo(tela.largura / 2 - FOCO.x * camera.scale, 6)
  })

  it('chegada em OUTRA cena: instantânea, sem atravessar a tela vindo da câmera da anterior', async () => {
    await monta()
    congelaRelogio()
    act(() => useMapStore.getState().loadMap(mapa('m_outra_cena')))
    pedeCamera({ camera: { x: 0, y: 0, scale: 0.5 }, focus: FOCO })
    const camera = useMapStore.getState().camera
    expect(camera.scale).toBe(0.5)
    expect(camera.x).toBeCloseTo(tela.largura / 2 - FOCO.x * 0.5, 6)
  })
})
