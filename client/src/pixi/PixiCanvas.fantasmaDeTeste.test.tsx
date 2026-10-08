import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Graphics, Text, type Ticker } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapImageExporter } from '../lib/mapImageExport'
import type { FantasmaDeTeste } from '../net/visaoDeTeste/tipos'
import { TOKEN_GLIDE_MS } from '../player/tokenGlide'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Token } from '../types/map'
import { FANTASMA_DE_TESTE_LABEL } from './drawFantasmaDeTeste'
import { FANTASMA_APAGAR_MS } from './fantasmaDeTeste'
import { PixiCanvas } from './PixiCanvas'
import { ENDIREITAR_FANTASMA_LABEL } from './straightenGhost'

/**
 * Visão de jogador, entrega 3 — o fantasma da ficha de teste com o PixiCanvas
 * montado pelo caminho de verdade (o mesmo arranjo sem GPU de
 * `PixiCanvas.fantasmaDoEndireitar.test.tsx`: Ticker de verdade, parado, e cada
 * quadro emitido pelo teste com o tempo que ele escolhe).
 *
 * A prova principal é a do pedido: o fantasma aparece por cima das fichas e
 * NÃO é ficha — clique, hover, arrasto, laço e borracha no ponto dele não
 * acham nada, e a ficha de verdade continua respondendo onde ela está.
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

const GRADE = 64
const CENA = 'cripta'
/** A ficha de verdade: aqui ela continua, no mapa do mestre. */
const REAL = { x: 160, y: 160 }
/** Onde ela está no teste: cinco casas à direita. */
const NO_TESTE: FantasmaDeTeste = { tokenId: 'lanterna', mapId: CENA, x: 480, y: 160 }

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function mapa(): MapData {
  return { ...createEmptyMap(CENA, 'Cripta', 30, 20, GRADE), tokens: [ficha('lanterna', 'Lanterna', REAL.x, REAL.y)] }
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
  montado = false
})

afterEach(() => {
  if (montado) act(() => root.unmount())
  raiz.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function desenha(fantasma: FantasmaDeTeste | null): void {
  root.render(<PixiCanvas onImageExporterChange={exportador} fantasmaDeTeste={fantasma} />)
}

async function monta(fantasma: FantasmaDeTeste | null = NO_TESTE): Promise<void> {
  await act(async () => {
    desenha(fantasma)
  })
  montado = true
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  // Daqui em diante `performance.now()` é o relógio do teste.
  vi.spyOn(performance, 'now').mockImplementation(() => agora)
}

/** O App mandou outro fantasma (a prop muda de referência). */
function trocaFantasma(fantasma: FantasmaDeTeste | null): void {
  act(() => {
    desenha(fantasma)
  })
}

function app(): { stage: Container; ticker: Ticker } {
  const atual = tela.apps.at(-1)
  if (atual === undefined) throw new Error('o PixiCanvas não criou o Application')
  return atual
}

function quadro(ms: number): void {
  agora += ms
  act(() => {
    app().ticker.update(agora)
  })
}

function descendentes(no: Container): Container[] {
  return no.children.flatMap((filho) => [filho, ...descendentes(filho)])
}

function rotulado(label: string): Container {
  const achado = descendentes(app().stage).find((no) => no.label === label)
  if (!achado) throw new Error(`sem o nó ${label}`)
  return achado
}

function fantasma(): Container {
  return rotulado(FANTASMA_DE_TESTE_LABEL)
}

/** O disco, o anel e a etiqueta, que andam juntos no ponto do teste. */
function corpo(): Container {
  const achado = fantasma().children[1]
  if (!(achado instanceof Container)) throw new Error('fantasma sem corpo')
  return achado
}

/** A camada do fantasma no `world`. */
function camada(): Container {
  const pai = fantasma().parent
  if (!pai) throw new Error('fantasma fora do mundo')
  return pai
}

/** Na tela agora: ele, a camada e todo pai até o palco visíveis. */
function naTela(no: Container): boolean {
  for (let atual: Container | null = no; atual !== null; atual = atual.parent) {
    if (!atual.visible) return false
  }
  return true
}

function wrapperDaFicha(nome: string): Container {
  const texto = descendentes(app().stage).find((no): no is Text => no instanceof Text && no.text === nome)
  const pai = texto?.parent
  if (!pai) throw new Error(`ficha ${nome} sem wrapper`)
  return pai
}

function evento(mundo: { x: number; y: number }): FederatedPointerEvent {
  const { camera } = useMapStore.getState()
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = 0
  e.global.set(camera.x + mundo.x * camera.scale, camera.y + mundo.y * camera.scale)
  return e
}

function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', mundo: { x: number; y: number }): void {
  act(() => {
    app().stage.emit(tipo, evento(mundo))
  })
}

function clica(mundo: { x: number; y: number }): void {
  ponteiro('pointerdown', mundo)
  ponteiro('pointerup', mundo)
}

/** Largura do contorno azul de hover desenhado agora, ou `null` sem contorno. */
function larguraDoHover(): number | null {
  for (const no of descendentes(app().stage)) {
    if (!(no instanceof Graphics)) continue
    for (const instrucao of no.context.instructions) {
      if (instrucao.action === 'stroke' && instrucao.data.style.color === 0x6fc3ff) return instrucao.data.style.width
    }
  }
  return null
}

describe('PixiCanvas — o fantasma da ficha de teste (Visão de jogador, entrega 3)', () => {
  it('aparece no ponto do teste, por cima das fichas e abaixo das alças, num grupo de render próprio e sem evento', async () => {
    await monta()
    expect(naTela(fantasma())).toBe(true)
    expect(fantasma().alpha).toBe(1)
    expect({ x: corpo().position.x, y: corpo().position.y }).toEqual({ x: NO_TESTE.x, y: NO_TESTE.y })

    const mundo = camada().parent
    if (!mundo) throw new Error('camada fora do mundo')
    const fichas = wrapperDaFicha('Lanterna').parent
    if (!fichas) throw new Error('ficha fora do mundo')
    const indice = mundo.getChildIndex(camada())
    expect(indice).toBeGreaterThan(mundo.getChildIndex(fichas))
    expect(indice).toBeLessThan(mundo.getChildIndex(rotulado(ENDIREITAR_FANTASMA_LABEL)))

    expect(camada().eventMode).toBe('none')
    expect(fantasma().eventMode).toBe('none')
    expect(camada().isRenderGroup).toBe(true)
    // A ficha de verdade não saiu do lugar.
    expect(wrapperDaFicha('Lanterna').position.x).toBe(REAL.x)
  })

  it('clique no fantasma não seleciona nada; na ficha de verdade, seleciona a ficha', async () => {
    await monta()
    clica(NO_TESTE)
    expect(useMapStore.getState().selection).toEqual([])
    clica(REAL)
    expect(useMapStore.getState().selection).toEqual([{ kind: 'token', id: 'lanterna' }])
  })

  it('passar o ponteiro no fantasma não acende o contorno de hover; na ficha, acende', async () => {
    await monta()
    ponteiro('pointermove', NO_TESTE)
    expect(larguraDoHover()).toBeNull()
    ponteiro('pointermove', REAL)
    expect(larguraDoHover()).not.toBeNull()
  })

  /** Laço da ferramenta Selecionar: arrastar no vazio de um canto ao outro. */
  function laco(de: { x: number; y: number }, ate: { x: number; y: number }): void {
    ponteiro('pointerdown', de)
    ponteiro('pointermove', { x: (de.x + ate.x) / 2, y: (de.y + ate.y) / 2 })
    ponteiro('pointermove', ate)
    ponteiro('pointerup', ate)
  }

  it('o laço em volta do fantasma não seleciona nada; em volta da ficha de verdade, seleciona', async () => {
    await monta()
    laco({ x: 400, y: 96 }, { x: 560, y: 224 })
    expect(useMapStore.getState().selection).toEqual([])
    // Controle: o mesmo laço em volta da ficha de verdade a acha.
    laco({ x: 80, y: 96 }, { x: 240, y: 224 })
    expect(useMapStore.getState().selection).toEqual([{ kind: 'token', id: 'lanterna' }])
  })

  it('arrastar a partir do fantasma não leva ficha nenhuma; a partir da ficha de verdade, leva', async () => {
    await monta()
    const antes = useMapStore.getState().map
    ponteiro('pointerdown', NO_TESTE)
    ponteiro('pointermove', { x: 600, y: 300 })
    ponteiro('pointerup', { x: 600, y: 300 })
    expect(useMapStore.getState().map.tokens).toBe(antes.tokens)
    expect(useMapStore.getState().past).toEqual([])
    // Controle: o mesmo gesto na ficha de verdade a move.
    ponteiro('pointerdown', REAL)
    ponteiro('pointermove', { x: 288, y: 288 })
    ponteiro('pointerup', { x: 288, y: 288 })
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ x: 288, y: 288 })
  })

  it('a borracha no fantasma não apaga nada; na ficha de verdade, apaga', async () => {
    await monta()
    act(() => {
      useMapStore.setState({ activeTool: 'eraser' })
    })
    const antes = useMapStore.getState().map
    clica(NO_TESTE)
    expect(useMapStore.getState().map.tokens).toBe(antes.tokens)
    // Controle: a borracha nesta montagem apaga o que está no mapa.
    clica(REAL)
    expect(useMapStore.getState().map.tokens).toEqual([])
  })

  it('o próximo passo do teste desliza o fantasma no relógio das fichas', async () => {
    await monta()
    trocaFantasma({ ...NO_TESTE, x: 544 })
    expect(corpo().position.x).toBe(NO_TESTE.x)
    quadro(TOKEN_GLIDE_MS / 2)
    expect(corpo().position.x).toBeGreaterThan(NO_TESTE.x)
    expect(corpo().position.x).toBeLessThan(544)
    quadro(TOKEN_GLIDE_MS / 2)
    expect(corpo().position.x).toBe(544)
  })

  it('a ficha no teste em outra cena, ou sem fantasma: nada nesta', async () => {
    await monta()
    trocaFantasma({ ...NO_TESTE, mapId: 'torre' })
    quadro(FANTASMA_APAGAR_MS)
    expect(naTela(fantasma())).toBe(false)

    trocaFantasma(NO_TESTE)
    quadro(TOKEN_GLIDE_MS)
    expect(naTela(fantasma())).toBe(true)

    trocaFantasma(null)
    quadro(FANTASMA_APAGAR_MS)
    expect(naTela(fantasma())).toBe(false)
  })

  it('a ficha de verdade apagada do mapa leva o fantasma junto', async () => {
    await monta()
    act(() => {
      useMapStore.setState({ map: { ...useMapStore.getState().map, tokens: [] } })
    })
    quadro(FANTASMA_APAGAR_MS)
    expect(naTela(fantasma())).toBe(false)
  })

  it('o fantasma que chega antes da montagem terminar é o que aparece', async () => {
    // Dois commits seguidos, sem devolver a vez: o `setup()` assíncrono do
    // canvas ainda não terminou quando o segundo fantasma chega.
    act(() => {
      desenha(null)
    })
    act(() => {
      desenha(NO_TESTE)
    })
    montado = true
    await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
    expect(naTela(fantasma())).toBe(true)
    expect(corpo().position.x).toBe(NO_TESTE.x)
  })

  it('exportar imagem com o fantasma na tela: ele não sai no PNG, e volta depois', async () => {
    await monta()
    const visivelNaFoto: boolean[] = []
    tela.fotos.push(() => visivelNaFoto.push(naTela(fantasma())))
    const exportar = exportador.mock.calls.at(-1)?.[0]
    if (!exportar) throw new Error('o canvas não entregou o exportador')
    await act(async () => {
      await exportar({ grid: true, masterOnly: true })
    })
    expect(visivelNaFoto).toEqual([false])
    expect(naTela(fantasma())).toBe(true)
  })

  it('desmontar o canvas com o fantasma andando desliga o ouvinte do quadro', async () => {
    await monta()
    const ticker = app().ticker
    const ligar = vi.spyOn(ticker, 'add')
    const desligar = vi.spyOn(ticker, 'remove')
    trocaFantasma({ ...NO_TESTE, x: 544 })
    const doFantasma = ligar.mock.calls.at(-1)?.[0]
    expect(doFantasma).toBeTypeOf('function')
    await act(async () => {
      root.unmount()
    })
    montado = false
    await vi.waitFor(() => expect(desligar.mock.calls.map(([fn]) => fn)).toContain(doFantasma))
  })
})
