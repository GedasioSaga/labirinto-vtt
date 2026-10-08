import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Graphics, Text } from 'pixi.js'
import { SMART_GUIDE_COLOR } from './constants'
import { createEmptyMap } from '../lib/mapFactory'
import { imageExportScale, type MapImageExporter } from '../lib/mapImageExport'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Token } from '../types/map'
import { PixiCanvas } from './PixiCanvas'
import { ENDIREITAR_FANTASMA_LABEL } from './straightenGhost'
import { FANTASMA_DE_TESTE_LABEL } from './drawFantasmaDeTeste'
import { syncWorldTextResolution, TEXT_RESOLUTION_DEBOUNCE_MS } from './textResolution'

/**
 * DESEMPENHO DO CANVAS DO MESTRE (P2 e P7 da lista de 01/10/2026), com o
 * PixiCanvas montado pelo caminho de verdade — mesmo arranjo sem GPU de
 * `PixiCanvas.movimento.test.tsx`.
 *
 * P2: o `world` não recebe evento do Pixi e é um grupo de render; o contorno
 * de hover, refeito a cada pointermove, tem grupo próprio para não refazer os
 * lotes do mapa inteiro — e, desde o pedido 3 (fatia 4), também o rascunho, a
 * guia e o rótulo de medida do desenho; desde o pedido 5 (fatia 4), o
 * fantasma do endireitar, que muda o alpha a cada quadro enquanto apaga; desde
 * a Visão de jogador (entrega 3), a camada do fantasma da ficha de teste, que
 * desliza, acende e apaga quadro a quadro com o mapa parado. P7: o
 * arrasto da ficha não percorre todos os textos do mundo a cada passo; só nome
 * novo ou renomeado pede a ressincronização.
 */

const tela = vi.hoisted(() => {
  const apps: { stage: Container }[] = []
  return { apps, largura: 1200, altura: 800 }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    // `extract` devolve um PNG mínimo: a exportação de imagem roda inteira sem placa de vídeo.
    readonly renderer = Object.assign(new pixi.EventEmitter(), {
      resolution: 1,
      extract: { base64: async () => 'data:image/png;base64,AAAA' },
    })
    readonly ticker = new pixi.Ticker()
    readonly canvas = document.createElement('canvas')
    constructor() {
      tela.apps.push({ stage: this.stage })
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

// O espião conta quantas vezes o canvas percorre os textos do mundo; a conta continua a de verdade.
vi.mock('./textResolution', async (importOriginal) => {
  const real = await importOriginal<typeof import('./textResolution')>()
  return { ...real, syncWorldTextResolution: vi.fn(real.syncWorldTextResolution) }
})
const percorreTextos = vi.mocked(syncWorldTextResolution)

const GRADE = 64
/** Cor do contorno de hover (`drawHover.ts`). */
const COR_DO_HOVER = 0x6fc3ff

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function mapa(): MapData {
  return {
    ...createEmptyMap('m_canvas_desempenho', 'Desempenho', 40, 20, GRADE),
    tokens: [ficha('lanterna', 'Lanterna', 160, 160), ficha('machado', 'Machado', 160, 480)],
  }
}

let raiz: HTMLDivElement
let root: Root
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
  exportador.mockClear()
  useMapStore.setState({
    map: mapa(),
    selection: [],
    past: [],
    future: [],
    activeTool: 'select',
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
})

/** Monta e espera o ajuste de texto agendado pela câmera inicial passar: daí em diante cada percurso conta. */
async function monta(): Promise<void> {
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, TEXT_RESOLUTION_DEBOUNCE_MS + 50))
  })
  percorreTextos.mockClear()
}

function stage(): Container {
  const atual = tela.apps.at(-1)
  if (atual === undefined) throw new Error('o PixiCanvas não criou o Application')
  return atual.stage
}

function mundo(): Container {
  const world = stage().children[0]
  if (world === undefined) throw new Error('sem world')
  return world
}

function descendentes(no: Container): Container[] {
  return no.children.flatMap((filho) => [filho, ...descendentes(filho)])
}

function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', ponto: { x: number; y: number }): void {
  const camera = useMapStore.getState().camera
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = 0
  e.global.set(camera.x + ponto.x * camera.scale, camera.y + ponto.y * camera.scale)
  act(() => {
    stage().emit(tipo, e)
  })
}

function contornoDeHover(): Graphics {
  for (const no of descendentes(mundo())) {
    if (!(no instanceof Graphics)) continue
    if (no.context.instructions.some((i) => i.action === 'stroke' && i.data.style.color === COR_DO_HOVER)) return no
  }
  throw new Error('sem contorno de hover')
}

/** O Graphics do mundo que tem traço desta cor agora. */
function graficoComTraco(cor: number): Graphics {
  for (const no of descendentes(mundo())) {
    if (no instanceof Graphics && no.context.instructions.some((i) => i.action === 'stroke' && i.data.style.color === cor)) return no
  }
  throw new Error(`sem traço da cor ${cor.toString(16)}`)
}

/** Cor do rascunho da linha no teste: única no mapa, para achar o Graphics dele. */
const COR_DO_RASCUNHO = 0x12ab34

describe('PixiCanvas — o mundo fora da árvore de eventos e em grupos de render (P2)', () => {
  it('o world não recebe evento do Pixi e é grupo de render; dentro dele só tem grupo próprio o que muda a cada pointermove ou quadro com o mapa parado: o contorno de hover, ao desenhar o rascunho, a guia e o rótulo de medida, o fantasma do endireitar e o da ficha de teste (a grade não)', async () => {
    await monta()
    ponteiro('pointermove', { x: 160, y: 160 })
    const hover = contornoDeHover()
    // Uma linha em curso, deitada: o rascunho, a guia (a ponta na altura do
    // começo, pedido 3, fatia 4) e o rótulo "comprimento · ângulo". A ponta
    // fica EXATA na reta do começo: o zoom aqui é o do enquadramento das
    // fichas, e a tolerância em px de tela encolhe no mundo.
    act(() => useMapStore.setState({ activeTool: 'line', drawColor: `#${COR_DO_RASCUNHO.toString(16)}` }))
    ponteiro('pointerdown', { x: 400, y: 300 })
    ponteiro('pointermove', { x: 700, y: 300 })
    const rascunho = graficoComTraco(COR_DO_RASCUNHO)
    const guia = graficoComTraco(SMART_GUIDE_COLOR)
    // `null` = o rótulo não apareceu, e o teste cai na asserção logo abaixo.
    const rotulo = descendentes(mundo()).find((no) => no instanceof Text && no.text.includes('°'))?.parent ?? null
    expect(rotulo).not.toBeNull()
    // `null` = o fantasma não existe, e o teste cai na asserção logo abaixo.
    const fantasma = descendentes(mundo()).find((no) => no.label === ENDIREITAR_FANTASMA_LABEL) ?? null
    expect(fantasma).not.toBeNull()
    // A camada do fantasma da ficha de teste: o pai da raiz dele (que existe desde a montagem, escondida).
    const camadaDoTeste = descendentes(mundo()).find((no) => no.label === FANTASMA_DE_TESTE_LABEL)?.parent ?? null
    expect(camadaDoTeste).not.toBeNull()

    expect(mundo().eventMode).toBe('none')
    expect(mundo().isRenderGroup).toBe(true)
    const grupos = descendentes(mundo()).filter((no) => no.isRenderGroup)
    expect(grupos).toHaveLength(6)
    for (const proprio of [hover, rascunho, guia, rotulo, fantasma, camadaDoTeste]) expect(grupos).toContain(proprio)
  })

  it('os ouvintes continuam no stage: o hover segue o ponteiro e o arrasto move a ficha', async () => {
    await monta()
    ponteiro('pointermove', { x: 160, y: 160 })
    expect(contornoDeHover().visible).toBe(true)

    ponteiro('pointerdown', { x: 160, y: 160 })
    ponteiro('pointermove', { x: 300, y: 160 })
    ponteiro('pointerup', { x: 300, y: 160 })
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 'lanterna')).toMatchObject({ x: 300, y: 160 })
  })
})

describe('PixiCanvas — o arrasto da ficha não percorre os textos do mundo a cada passo (P7)', () => {
  it('seis passos de arrasto: só o rótulo de quadrados, que nasce no primeiro, pede o ajuste; o arrasto seguinte, nenhum', async () => {
    await monta()
    ponteiro('pointerdown', { x: 160, y: 160 })
    percorreTextos.mockClear()
    for (let passo = 1; passo <= 6; passo += 1) ponteiro('pointermove', { x: 160 + passo * 64, y: 160 })
    ponteiro('pointerup', { x: 160 + 6 * 64, y: 160 })
    expect(percorreTextos).toHaveBeenCalledTimes(1)

    ponteiro('pointerdown', { x: 160, y: 480 })
    percorreTextos.mockClear()
    for (let passo = 1; passo <= 6; passo += 1) ponteiro('pointermove', { x: 160 + passo * 64, y: 480 })
    ponteiro('pointerup', { x: 160 + 6 * 64, y: 480 })
    expect(percorreTextos).not.toHaveBeenCalled()
  })

  it('renomear a ficha ajusta a resolução do texto: o teto depende do tamanho do nome', async () => {
    await monta()
    act(() => useMapStore.getState().renameToken('lanterna', 'Lanterna Furta-cor'))
    expect(percorreTextos).toHaveBeenCalledTimes(1)
  })

  it('exportar imagem ajusta a resolução do texto à escala do PNG e, no fim, devolve a do zoom do editor', async () => {
    await monta()
    const exportar = exportador.mock.calls.at(-1)?.[0]
    if (!exportar) throw new Error('o canvas não entregou o exportador')
    const escalaDoEditor = useMapStore.getState().camera.scale
    const { width, height, grid } = useMapStore.getState().map
    const escalaDoPng = imageExportScale(width * grid, height * grid)
    expect(escalaDoPng).not.toBe(escalaDoEditor)

    await act(async () => {
      await exportar({ grid: true, masterOnly: true })
    })
    const escalas = percorreTextos.mock.calls.map(([, escala]) => escala)
    expect(escalas).toContain(escalaDoPng)
    expect(escalas.at(-1)).toBe(escalaDoEditor)
  })
})
